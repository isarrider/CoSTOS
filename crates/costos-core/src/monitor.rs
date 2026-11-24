//! Plausibility checks of the solar loop ("function control",
//! ARCHITECTURE 6.2): alarms and notices that cost no hardware.
//!
//! The control functions decide what the pump does; this module watches
//! whether the loop *reacts* the way a working loop does, and reports when
//! it doesn't. It never switches anything on. One check can ask for the pump
//! to be **inhibited** (no circulation, repeated), which the daemon applies
//! as a reduction before the supervisor.
//!
//! | Check | Raised when | Typical cause | Default |
//! |---|---|---|---|
//! | Sensor fault | Any configured sensor has no valid value | Cable, connector, sensor, hung bus | Alarm at once; clears after 60 s valid |
//! | Store maximum | The store maximum is reached | Full store in summer | Notice |
//! | No circulation | **At a start:** within 10 min, neither has the collector cooled by 3 K below its start value, nor (with a flow sensor) has the flow got 2 K warmer than the store bottom. **While running** (with flow and return sensors): in each further 10 min, there was no moment with the flow at least 2 K warmer than the return **and** the collector at most 10 K warmer than the flow | Dead or unpowered pump, stuck rotor, air lock, broken PWM line | Alarm; after 3 failed checks in a row the pump is inhibited until the alarm is acknowledged |
//! | ΔT too high | Running, ΔT above 50 K for 20 min, and the store bottom warmed by less than 1 K meanwhile | Air in the loop, closed valve, scaled coil, pump far too slow | Alarm |
//! | Night circulation | Pump off between 23:00 and 05:00, and within 30 min the collector warmed by 3 K while the store bottom cooled by 0.5 K | Faulty non-return valve (gravity circulation) | Alarm |
//!
//! **Why "no circulation" matters now.** The simulation tests (8.3) showed
//! that a pump that gets its signal but doesn't turn is otherwise only
//! caught by the collector emergency stop at 130 °C. This check sees it
//! within minutes of the start, from the temperatures alone: after a
//! start, cold fluid from the return pipe reaches the collector within a
//! few minutes and cools it, and the hot fluid from the collector reaches
//! the flow sensor at the store. If neither happens, nothing is moving.
//!
//! While the pump runs, the collector settles and no longer cools, so the
//! start criterion can't be repeated. Two things hold in a moving loop:
//! the flow is warmer than the return (heat goes into the store), and the
//! collector is only a little warmer than the flow (the fluid arrives
//! within minutes). When the pump stops turning, the flow-over-return
//! alone fades only slowly (both insulated pipes cool with a time constant
//! of over an hour, the simulation showed no alarm for over an hour), but
//! the collector runs away from the flow within minutes. So both must hold
//! together at some moment in every window.
//!
//! Checked against the recording (ARCHITECTURE 8.1): of 227 starts, 183
//! showed circulation within 10 minutes and 44 were shorter than 10
//! minutes (no verdict), **none would have raised the alarm**; in all 4,413
//! ten-minute windows during runs the running criterion held (the
//! collector was never more than 7.6 K above the flow for a whole window).
//! The other checks raised nothing either over the 147 days.
//!
//! **Not here yet:** "flow and return swapped". In the recording the
//! return sensor (S5) responds *first* after a normal start (the store's
//! coil contents pass it), so the obvious rule would misfire; it needs a
//! closer look at recorded starts first (ARCHITECTURE 10.2).

use crate::sensor::{Reading, SensorFault};
use crate::temperature::{Celsius, Kelvin};
use crate::time::{Seconds, TimeOfDay};

/// Settings of the checks. A duration of zero switches that check off.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MonitorConfig {
    /// A sensor alarm clears after the sensor has been valid this long.
    pub sensor_clear_after: Seconds,
    /// No circulation: time after a start within which the loop must react.
    pub circulation_window: Seconds,
    /// No circulation: the collector must drop this much below its start value.
    pub circulation_collector_drop: Kelvin,
    /// No circulation: or the flow must get this much warmer than the store bottom.
    pub circulation_flow_over_store: Kelvin,
    /// No circulation while running: the flow must get this much warmer
    /// than the return at least once per window ...
    pub circulation_flow_over_return: Kelvin,
    /// ... at a moment when the collector is at most this much warmer than
    /// the flow.
    pub circulation_collector_over_flow: Kelvin,
    /// No circulation: failed starts in a row before the pump is inhibited.
    pub circulation_failures_to_inhibit: u8,
    /// ΔT too high: threshold.
    pub delta_t_high: Kelvin,
    /// ΔT too high: how long above it.
    pub delta_t_high_for: Seconds,
    /// ΔT too high: the store bottom warming that clears the suspicion.
    pub delta_t_high_store_rise: Kelvin,
    /// Night circulation: window length.
    pub night_window: Seconds,
    /// Night circulation: collector warming within the window.
    pub night_collector_rise: Kelvin,
    /// Night circulation: store bottom cooling within the window.
    pub night_store_drop: Kelvin,
    /// Night circulation: start of the night (local time).
    pub night_from: TimeOfDay,
    /// Night circulation: end of the night (local time, next morning).
    pub night_to: TimeOfDay,
}

impl MonitorConfig {
    /// The defaults of the table in the module documentation.
    pub const DEFAULT: Self = Self {
        sensor_clear_after: Seconds::new(60),
        circulation_window: Seconds::new(600),
        circulation_collector_drop: Kelvin::from_const(3.0),
        circulation_flow_over_store: Kelvin::from_const(2.0),
        circulation_flow_over_return: Kelvin::from_const(2.0),
        circulation_collector_over_flow: Kelvin::from_const(10.0),
        circulation_failures_to_inhibit: 3,
        delta_t_high: Kelvin::from_const(50.0),
        delta_t_high_for: Seconds::new(1200),
        delta_t_high_store_rise: Kelvin::from_const(1.0),
        night_window: Seconds::new(1800),
        night_collector_rise: Kelvin::from_const(3.0),
        night_store_drop: Kelvin::from_const(0.5),
        night_from: match TimeOfDay::from_hm(23, 0) {
            Some(t) => t,
            None => TimeOfDay::MIDNIGHT,
        },
        night_to: match TimeOfDay::from_hm(5, 0) {
            Some(t) => t,
            None => TimeOfDay::MIDNIGHT,
        },
    };
}

impl Default for MonitorConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// What the checks see in one cycle. Called **after** the supervisor, with
/// the duty that was actually applied: the checks judge what the pump did,
/// not what was asked.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MonitorInputs<'a> {
    /// Monotonic seconds.
    pub now: Seconds,
    /// Local time of day.
    pub time_of_day: TimeOfDay,
    /// Whether the pump output was above 0 % this cycle.
    pub pump_on: bool,
    /// Collector (S1).
    pub collector: Reading,
    /// Store bottom (S2).
    pub store_bottom: Reading,
    /// Solar flow at the store (S4), if configured.
    pub flow: Option<Reading>,
    /// Solar return at the store (S5), if configured.
    pub ret: Option<Reading>,
    /// The ΔT the control used, if known.
    pub delta_t: Option<Kelvin>,
    /// Whether the store maximum blocked loading this cycle.
    pub store_max_reached: bool,
    /// Every configured sensor's reading, for the sensor alarm.
    pub sensors: &'a [Reading],
}

/// Active alarms and notices.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Alarms {
    /// A sensor has no valid value: index into `MonitorInputs::sensors` of
    /// the first one, and its fault. Stays set until all sensors have been
    /// valid for `sensor_clear_after`.
    pub sensor: Option<(usize, SensorFault)>,
    /// Notice: the store maximum is reached.
    pub store_max: bool,
    /// The loop didn't react to the last pump start.
    pub no_circulation: bool,
    /// ΔT stayed far too high while the store didn't warm.
    pub delta_t_too_high: bool,
    /// Gravity circulation at night.
    pub night_circulation: bool,
}

impl Alarms {
    /// Any alarm (notices don't count).
    #[must_use]
    pub const fn any_alarm(&self) -> bool {
        self.sensor.is_some()
            || self.no_circulation
            || self.delta_t_too_high
            || self.night_circulation
    }
}

/// A temperature taken at a time, for "has it changed since".
#[derive(Clone, Copy, Debug, PartialEq, Default)]
struct Mark {
    at: Seconds,
    value: f32,
}

/// State carried between cycles. `Default` = nothing seen yet.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct MonitorState {
    /// Last sensor fault and when all sensors were last seen faulty.
    sensor: Option<(usize, SensorFault)>,
    sensor_bad_at: Seconds,
    /// Current run: start time and collector at the start.
    run_start: Option<Mark>,
    /// Whether the current run already showed circulation (or got its verdict).
    run_judged: bool,
    /// While running: start of the current window, and whether it showed
    /// flow over return.
    window_start: Seconds,
    window_seen: bool,
    /// Failed starts in a row.
    circulation_failures: u8,
    no_circulation: bool,
    /// ΔT too high: since when above, and the store bottom then.
    high_since: Option<Mark>,
    delta_t_too_high: bool,
    /// Night circulation: start of the current window (collector, store).
    night_mark: Option<(Mark, f32)>,
    night_circulation: bool,
}

impl MonitorState {
    /// Clears the latched alarms (acknowledged by the user): no circulation,
    /// ΔT too high, night circulation, and the inhibit with them. The
    /// sensor alarm clears by itself once the sensors are valid.
    #[must_use]
    pub fn acknowledge(self) -> Self {
        Self {
            circulation_failures: 0,
            no_circulation: false,
            delta_t_too_high: false,
            night_circulation: false,
            ..self
        }
    }
}

/// Whether `t` lies in the night window `from`..`to`, which wraps midnight
/// when `from` > `to`.
fn in_window(t: TimeOfDay, from: TimeOfDay, to: TimeOfDay) -> bool {
    if from <= to {
        t >= from && t < to
    } else {
        t >= from || t < to
    }
}

/// One cycle of the checks. Returns the new state, the active alarms, and
/// whether the pump must be **inhibited** (repeated no circulation), which
/// the daemon applies as "requested 0 %" in the next cycle, before the
/// supervisor.
#[must_use]
pub fn step(
    config: &MonitorConfig,
    state: MonitorState,
    inputs: &MonitorInputs<'_>,
) -> (MonitorState, Alarms, bool) {
    let mut s = state;
    let now = inputs.now;

    // --- Sensor fault: raised at once, cleared after a quiet time. -------
    let first_fault = inputs
        .sensors
        .iter()
        .enumerate()
        .find_map(|(i, r)| r.err().map(|f| (i, f)));
    if let Some(f) = first_fault {
        s.sensor = Some(f);
        s.sensor_bad_at = now;
    } else if s.sensor.is_some()
        && now.saturating_since(s.sensor_bad_at) >= config.sensor_clear_after
    {
        s.sensor = None;
    }

    let collector = inputs.collector.ok().map(Celsius::get);
    let store = inputs.store_bottom.ok().map(Celsius::get);

    // --- No circulation. -------------------------------------------------
    if config.circulation_window > Seconds::ZERO {
        if inputs.pump_on {
            if s.run_start.is_none() {
                // A start: remember the collector, judge this run later.
                s.run_start = collector.map(|value| Mark { at: now, value });
                s.run_judged = false;
            }
            if let (Some(start), false) = (s.run_start, s.run_judged) {
                let cooled = collector
                    .is_some_and(|c| c <= start.value - config.circulation_collector_drop.get());
                let flow_warm = match (inputs.flow.and_then(|r| r.ok()), store) {
                    (Some(f), Some(st)) => f.get() >= st + config.circulation_flow_over_store.get(),
                    _ => false,
                };
                if cooled || flow_warm {
                    // The loop reacts: this start is fine, the streak ends.
                    s.run_judged = true;
                    s.circulation_failures = 0;
                    s.window_start = now;
                    s.window_seen = false;
                } else if now.saturating_since(start.at) >= config.circulation_window {
                    s.run_judged = true;
                    s.circulation_failures = s.circulation_failures.saturating_add(1);
                    s.no_circulation = true;
                    s.window_start = now;
                    s.window_seen = false;
                }
            } else if s.run_judged {
                // While running, with flow and return sensors: flow over
                // return at least once per window.
                if let (Some(Ok(f)), Some(Ok(r))) = (inputs.flow, inputs.ret) {
                    let collector_close = collector.is_some_and(|c| {
                        c - f.get() <= config.circulation_collector_over_flow.get()
                    });
                    if f.get() - r.get() >= config.circulation_flow_over_return.get()
                        && collector_close
                    {
                        s.window_seen = true;
                    }
                    if now.saturating_since(s.window_start) >= config.circulation_window {
                        if s.window_seen {
                            s.circulation_failures = 0;
                        } else {
                            s.circulation_failures = s.circulation_failures.saturating_add(1);
                            s.no_circulation = true;
                        }
                        s.window_start = now;
                        s.window_seen = false;
                    }
                }
            }
        } else {
            // Pump off: the next "on" is a new start. A run shorter than
            // the window (anti-seize, a short cloud gap) gets no verdict.
            s.run_start = None;
            s.run_judged = false;
        }
    }
    let inhibit = config.circulation_failures_to_inhibit > 0
        && s.circulation_failures >= config.circulation_failures_to_inhibit;

    // --- ΔT too high. ----------------------------------------------------
    if config.delta_t_high_for > Seconds::ZERO {
        match (inputs.pump_on, inputs.delta_t, store) {
            (true, Some(dt), Some(st)) if dt.get() > config.delta_t_high.get() => {
                let since = *s.high_since.get_or_insert(Mark { at: now, value: st });
                if now.saturating_since(since.at) >= config.delta_t_high_for {
                    if st - since.value < config.delta_t_high_store_rise.get() {
                        s.delta_t_too_high = true;
                    }
                    // Start a new observation window either way.
                    s.high_since = Some(Mark { at: now, value: st });
                }
            }
            _ => s.high_since = None,
        }
    }

    // --- Night circulation. ----------------------------------------------
    if config.night_window > Seconds::ZERO {
        let night = in_window(inputs.time_of_day, config.night_from, config.night_to);
        match (night && !inputs.pump_on, collector, store) {
            (true, Some(c), Some(st)) => {
                let (mark, store0) = *s.night_mark.get_or_insert((Mark { at: now, value: c }, st));
                if c - mark.value >= config.night_collector_rise.get()
                    && store0 - st >= config.night_store_drop.get()
                {
                    s.night_circulation = true;
                }
                if now.saturating_since(mark.at) >= config.night_window {
                    s.night_mark = Some((Mark { at: now, value: c }, st));
                }
            }
            _ => s.night_mark = None,
        }
    }

    let alarms = Alarms {
        sensor: s.sensor,
        store_max: inputs.store_max_reached,
        no_circulation: s.no_circulation,
        delta_t_too_high: s.delta_t_too_high,
        night_circulation: s.night_circulation,
    };
    (s, alarms, inhibit)
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;

    fn c(v: f32) -> Reading {
        Ok(Celsius::from_const(v))
    }

    fn base(t: u64, on: bool, col: f32, store: f32) -> MonitorInputs<'static> {
        MonitorInputs {
            now: Seconds::new(t),
            time_of_day: TimeOfDay::from_hm(12, 0).unwrap(),
            pump_on: on,
            collector: c(col),
            store_bottom: c(store),
            flow: None,
            ret: None,
            delta_t: Some(Kelvin::from_const(col - store)),
            store_max_reached: false,
            sensors: &[],
        }
    }

    /// A sensor fault raises the alarm in the same cycle and clears 60 s
    /// after the last fault.
    #[test]
    fn sensor_alarm_at_once_clears_later() {
        let cfg = MonitorConfig::DEFAULT;
        let bad = [c(40.0), Err(SensorFault::OpenCircuit)];
        let good = [c(40.0), c(41.0)];
        let mut i = base(0, false, 30.0, 40.0);
        i.sensors = &bad;
        let (s, a, _) = step(&cfg, MonitorState::default(), &i);
        assert_eq!(a.sensor, Some((1, SensorFault::OpenCircuit)));
        assert!(a.any_alarm());
        i.sensors = &good;
        i.now = Seconds::new(59);
        let (s, a, _) = step(&cfg, s, &i);
        assert!(a.sensor.is_some());
        i.now = Seconds::new(60);
        let (_, a, _) = step(&cfg, s, &i);
        assert_eq!(a.sensor, None);
    }

    /// A working start: the collector cools by 3 K within the window, no
    /// alarm.
    #[test]
    fn circulation_seen_when_the_collector_cools() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        for t in 0..900 {
            // Collector drops from 60 to 55 °C over the first 4 minutes.
            let col = if t < 240 {
                60.0 - t as f32 / 48.0
            } else {
                55.0
            };
            let (ns, a, inhibit) = step(&cfg, s, &base(t, true, col, 45.0));
            s = ns;
            assert!(!a.no_circulation && !inhibit);
        }
    }

    /// Or the flow gets warmer than the store bottom (flow sensor).
    #[test]
    fn circulation_seen_at_the_flow_sensor() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        for t in 0..900 {
            let mut i = base(t, true, 60.0, 45.0);
            i.flow = Some(c(if t > 200 { 50.0 } else { 20.0 }));
            let (ns, a, _) = step(&cfg, s, &i);
            s = ns;
            assert!(!a.no_circulation);
        }
    }

    /// A stuck pump: the collector keeps rising, the flow stays cold. The
    /// alarm comes 10 minutes after the first start (and stays, latched);
    /// the third failed start in a row inhibits the pump, until the alarm
    /// is acknowledged.
    #[test]
    fn no_circulation_alarm_and_inhibit() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        let mut t = 0;
        for run in 1..=3 {
            let mut alarm_at = None;
            let mut inhibit_at = None;
            for k in 0..700 {
                let mut i = base(t, true, 60.0 + k as f32 / 60.0, 45.0);
                i.flow = Some(c(20.0));
                let (ns, a, inhibit) = step(&cfg, s, &i);
                s = ns;
                if a.no_circulation && alarm_at.is_none() {
                    alarm_at = Some(k);
                }
                if inhibit && inhibit_at.is_none() {
                    inhibit_at = Some(k);
                }
                t += 1;
            }
            if run == 1 {
                assert_eq!(alarm_at, Some(600));
            }
            assert_eq!(
                inhibit_at,
                if run == 3 { Some(600) } else { None },
                "run {run}"
            );
            // Pump off for a while between the starts.
            for _ in 0..120 {
                let (ns, _, _) = step(&cfg, s, &base(t, false, 60.0, 45.0));
                s = ns;
                t += 1;
            }
        }
        let s = s.acknowledge();
        let (_, a, inhibit) = step(&cfg, s, &base(t, false, 60.0, 45.0));
        assert!(!a.no_circulation && !inhibit);
    }

    /// While running, flow over return must show up once per window: a
    /// pump that stops turning mid-run is found within two windows.
    #[test]
    fn no_circulation_while_running() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        let mut first_alarm = None;
        for t in 0..3600 {
            // Circulating for 20 minutes (collector 55 °C, flow 8 K over
            // return), then stuck: the collector runs away, the pipes keep
            // their difference for a long time.
            let col = if t < 1200 {
                55.0
            } else {
                55.0 + (t - 1200) as f32 / 60.0
            };
            let mut i = base(t, true, col, 45.0);
            let (f, r) = (54.0, 46.0);
            i.flow = Some(c(f));
            i.ret = Some(c(r));
            let (ns, a, _) = step(&cfg, s, &i);
            s = ns;
            if a.no_circulation && first_alarm.is_none() {
                first_alarm = Some(t);
            }
        }
        let at = first_alarm.expect("no alarm");
        assert!((1200..=2400).contains(&at), "{at}");
    }

    /// A short run (anti-seize, 10 s) gets no verdict.
    #[test]
    fn short_runs_are_not_judged() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        for t in 0..10 {
            let (ns, _, _) = step(&cfg, s, &base(t, true, 20.0, 40.0));
            s = ns;
        }
        let (_, a, _) = step(&cfg, s, &base(10, false, 20.0, 40.0));
        assert!(!a.no_circulation);
    }

    /// ΔT of 60 K for 20 minutes with a store that doesn't warm: alarm.
    /// The same with a store warming by 2 K: no alarm.
    #[test]
    fn delta_t_too_high() {
        let cfg = MonitorConfig::DEFAULT;
        let mut s = MonitorState::default();
        let mut last = Alarms::default();
        for t in 0..1300 {
            let (ns, a, _) = step(&cfg, s, &base(t, true, 100.0, 40.0));
            s = ns;
            last = a;
        }
        assert!(last.delta_t_too_high);
        let mut s = MonitorState::default();
        for t in 0..1300 {
            let st = 40.0 + t as f32 / 600.0;
            let (ns, a, _) = step(&cfg, s, &base(t, true, st + 60.0, st));
            s = ns;
            last = a;
        }
        assert!(!last.delta_t_too_high);
    }

    /// At night with the pump off, a collector warming by 4 K while the
    /// store bottom cools by 1 K is gravity circulation; the same in the
    /// daytime is just the sun.
    #[test]
    fn night_circulation() {
        let cfg = MonitorConfig::DEFAULT;
        let run = |hour: u32| {
            let mut s = MonitorState::default();
            let mut last = Alarms::default();
            for k in 0..1800_u64 {
                let mut i = base(k, false, 10.0 + k as f32 / 450.0, 50.0 - k as f32 / 1800.0);
                i.time_of_day = TimeOfDay::from_hm(hour, 0).unwrap();
                let (ns, a, _) = step(&cfg, s, &i);
                s = ns;
                last = a;
            }
            last.night_circulation
        };
        assert!(run(2));
        assert!(!run(12));
    }

    /// The night window wraps midnight.
    #[test]
    fn night_window_wraps() {
        let from = TimeOfDay::from_hm(23, 0).unwrap();
        let to = TimeOfDay::from_hm(5, 0).unwrap();
        assert!(in_window(TimeOfDay::from_hm(23, 30).unwrap(), from, to));
        assert!(in_window(TimeOfDay::from_hm(2, 0).unwrap(), from, to));
        assert!(!in_window(TimeOfDay::from_hm(12, 0).unwrap(), from, to));
    }
}
