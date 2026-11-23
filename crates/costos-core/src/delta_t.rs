//! ΔT control (ARCHITECTURE 6.2): switches the solar pump on when the
//! collector is warmer than the store bottom by `on`, and off again when
//! the difference falls to `off`.
//!
//! - **Hysteresis**: `off` < `on`, so the pump doesn't toggle at one value.
//! - **Minimum run time**: once on, the pump stays on for at least
//!   `min_run`, unless a sensor fails.
//! - **Collector minimum** (optional, default 10 °C as on the BX Plus): no
//!   start below it, even when the difference is met.
//! - **Smoothing**: the decision uses the mean ΔT of the last
//!   [`SMOOTHING_SAMPLES`] cycles, so a single noisy reading can't toggle
//!   the pump.
//! - **Sensor fault**: pump off at once, smoothing restarts. A fault never
//!   counts as "cold" or "warm".
//! - **Flow/return switch-off** (optional, ARCHITECTURE 8.1): with a flow
//!   and a return sensor, a running pump is only stopped once *both*
//!   differences have fallen to `off`: collector minus store bottom, and
//!   solar flow minus solar return. The second one shows whether the loop
//!   still carries heat into the store, which the collector sensor alone
//!   can miss. Without the option the switch-off uses the collector
//!   difference only.
//!
//! Speed control comes on top of this later; here the request is on or
//! off.
//!
//! **How it fits together.** The daemon calls [`step`] once per second
//! with the current readings and the state returned by the previous
//! call. The result says whether the pump should run; the safety
//! supervisor (`costos-safety`) then decides whether it may, and can only
//! turn a "yes" into a "no". So this module is about *when solar heat is
//! worth collecting*; protecting the system is the supervisor's job.
//!
//! **Behaviour as on the BX Plus.** On/off differences, the collector
//! minimum and its 10 °C default follow the RESOL DeltaSol BX Plus, so
//! the replay against recorded vbus2influx data (milestone 1) compares
//! like with like.

use crate::sensor::{Reading, SensorFault};
use crate::temperature::{Celsius, Kelvin};
use crate::time::Seconds;

/// Number of control cycles (seconds) the ΔT is averaged over.
///
/// Five seconds is short against the minutes a collector takes to warm
/// up or cool down, so it delays real changes by at most a few seconds,
/// but long enough that a single noisy reading (a 1-Wire glitch that got
/// through, an electrical spike on the Pt1000 cable) is diluted to a
/// fifth. ARCHITECTURE 6.2: "a moving average over a few samples, as
/// DiSoCon2 does".
pub const SMOOTHING_SAMPLES: usize = 5;

/// Settings of the ΔT control.
///
/// Validated by [`DeltaTConfig::validate`]; the config crate calls it
/// before a setting is applied (ARCHITECTURE 7.3), so [`step`] can
/// assume valid settings.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DeltaTConfig {
    /// Switch-on difference, collector minus store bottom, in K. Must be
    /// above zero: a pump that starts at ΔT ≤ 0 would move heat from the
    /// store to the collector.
    pub on: Kelvin,
    /// Switch-off difference, in K; must be below `on`. The gap between
    /// the two is the hysteresis that keeps the pump from toggling.
    /// It may be zero or slightly negative (stop only once the collector
    /// is no warmer than the store), but not above `on`.
    pub off: Kelvin,
    /// Shortest time the pump runs once started. Protects the pump from
    /// short cycles and gives the warm fluid in the collector time to
    /// reach the store sensor: right after a start, cold fluid from the
    /// pipes passes the collector sensor and ΔT drops for a while.
    pub min_run: Seconds,
    /// No start while the collector is colder than this; `None` disables
    /// it. Without it, on a cold morning a collector at 8 °C above a
    /// store at 0 °C (a store sensor in a cold cellar) would start the
    /// pump for almost no usable heat.
    pub collector_min: Option<Celsius>,
}

/// Why a [`DeltaTConfig`] is not valid. Shown next to the field in the
/// web interface (ARCHITECTURE 7.3).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeltaTConfigError {
    /// The switch-on difference must be above zero.
    OnNotPositive,
    /// The switch-off difference must be below the switch-on difference.
    OffNotBelowOn,
}

impl DeltaTConfig {
    /// Defaults: on at 6 K and off at 4 K (the examples in ARCHITECTURE
    /// 6.2), at least 2 min run time, no start below a 10 °C collector
    /// (the BX Plus default).
    ///
    /// The 2 min run time is a starting value, not from a manual: long
    /// enough for the fluid to travel from the collector to the store in
    /// a typical single-family loop, short enough not to pump for long
    /// into a store that can't take more heat. To be checked against the
    /// replay of the reference installation.
    pub const DEFAULT: Self = Self {
        on: Kelvin::from_const(6.0),
        off: Kelvin::from_const(4.0),
        min_run: Seconds::new(120),
        collector_min: Some(Celsius::from_const(10.0)),
    };

    /// Checks the settings. The order of the checks decides which error
    /// is reported when several apply; `on` first, because `off` is
    /// judged relative to it.
    pub fn validate(&self) -> Result<(), DeltaTConfigError> {
        if self.on <= Kelvin::from_const(0.0) {
            return Err(DeltaTConfigError::OnNotPositive);
        }
        if self.off >= self.on {
            return Err(DeltaTConfigError::OffNotBelowOn);
        }
        Ok(())
    }
}

impl Default for DeltaTConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// Readings of the optional solar flow and return sensors, for the
/// flow/return switch-off (ARCHITECTURE 8.1).
///
/// **Why this exists.** The 147 days of BX Plus data from the reference
/// installation show the pump on a sunny evening running for another
/// 36 minutes after collector minus store bottom fell below 2 K, and
/// stopping only once flow minus return fell to 2 K too. In that time
/// the collector sensor read up to 18 K *below* the store, while the
/// flow, measured at the store, was still about 10 K warmer than the
/// return: the loop was still delivering heat. The BX Plus calls this the
/// "flow sensor" and "return sensor" options (manual 8.5, Solar /
/// Expert). A plain collector-minus-store rule would stop the pump early
/// on every sunny evening.
///
/// **Which sensors.** In the reference installation the flow sensor is
/// S4 and the return sensor S5, both on the pipes at the store. The
/// config decides which inputs they are; this module only sees the two
/// readings.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct FlowReturn {
    /// Solar flow: the fluid coming down from the collector, measured
    /// where it enters the store's heat exchanger.
    pub flow: Reading,
    /// Solar return: the fluid going back up to the collector, measured
    /// where it leaves the store's heat exchanger.
    pub ret: Reading,
}

/// Moving mean over the last [`SMOOTHING_SAMPLES`] differences.
///
/// A fixed-size array, no heap (rule 1: the core may run without an
/// allocator). `None` marks a slot that has not been filled since the
/// last reset, so the mean right after a start or a sensor fault uses
/// only the samples that exist instead of counting empty slots as 0 K.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
struct Window {
    samples: [Option<Kelvin>; SMOOTHING_SAMPLES],
}

impl Window {
    /// Adds the newest sample and drops the oldest.
    ///
    /// Shifting the array instead of keeping a ring-buffer index avoids
    /// index arithmetic altogether (rules 7 and 11: no wrap-around, no
    /// out-of-range index). Five elements are nothing to shift.
    fn push(mut self, value: Kelvin) -> Self {
        self.samples.rotate_left(1);
        if let Some(last) = self.samples.last_mut() {
            *last = Some(value);
        }
        self
    }

    /// Mean of the samples present. `None` only if the window is empty.
    fn mean(&self) -> Option<Kelvin> {
        let (sum, count) = self
            .samples
            .iter()
            .flatten()
            // `count` is a u8 with at most SMOOTHING_SAMPLES; saturating
            // anyway, so the lint for unchecked arithmetic has nothing
            // to find (rule 7).
            .fold((0.0_f32, 0_u8), |(sum, count), k| {
                (sum + k.get(), count.saturating_add(1))
            });
        if count == 0 {
            None
        } else {
            // The mean of valid differences is itself a valid difference,
            // so `Kelvin::new` can't fail here; it is checked anyway,
            // because "can't fail" is exactly what NaN bugs rely on.
            Kelvin::new(sum / f32::from(count))
        }
    }
}

/// State carried from one control cycle to the next.
///
/// The daemon keeps it between calls; the core never stores anything
/// itself (pure functions). The `Default` is "pump off, no history",
/// which is also what a sensor fault resets it to.
///
/// Fields are private: only [`step`] may change them, so a caller can't
/// e.g. pretend the pump has run long enough.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct DeltaTState {
    /// When the pump was started, while it runs; `None` while off. The
    /// minimum run time is measured from here.
    running_since: Option<Seconds>,
    /// The last few differences for smoothing.
    window: Window,
    /// The last few flow-minus-return differences, smoothed the same
    /// way. Stays empty while the flow/return option is off, and is
    /// cleared when one of those two sensors fails.
    loop_window: Window,
}

impl DeltaTState {
    /// True while the control wants the pump on.
    #[must_use]
    pub const fn is_running(&self) -> bool {
        self.running_since.is_some()
    }
}

/// Why the control decided as it did in this cycle.
///
/// Returned every cycle, not only on changes; the daemon logs a *change*
/// of status as an event and shows the current one in the web
/// interface (rule 3: no logging in the core). That way "why is the pump
/// off?" always has an answer.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum DeltaTStatus {
    /// Started in this cycle.
    Started,
    /// Running, difference still above the switch-off value.
    Running,
    /// Collector difference at or below the switch-off value, but flow
    /// minus return is still above it: the loop still carries heat into
    /// the store, so the pump keeps running (flow/return switch-off,
    /// [`FlowReturn`]).
    HeldByFlowReturn,
    /// Difference at or below the switch-off value, but the minimum run
    /// time is not over yet.
    HeldByMinRun,
    /// Stopped in this cycle.
    Stopped,
    /// Off, difference below the switch-on value.
    Idle,
    /// Off: the difference would start the pump, but the collector is
    /// below its minimum.
    BelowCollectorMin,
    /// Off because a sensor has no valid value.
    SensorFault(SensorFault),
}

/// Result of one control cycle.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DeltaTOutput {
    /// Whether the pump should run.
    pub pump_on: bool,
    /// The smoothed difference the decision was based on, if known.
    pub delta_t: Option<Kelvin>,
    /// The smoothed flow-minus-return difference, if the flow/return
    /// option is in use and both sensors are valid.
    pub loop_delta_t: Option<Kelvin>,
    /// A fault on the flow or return sensor, if any.
    ///
    /// Such a fault does **not** stop the pump: the flow/return condition
    /// can only *extend* a run, so without it the control simply falls
    /// back to the plain collector difference, which stops the pump
    /// earlier, never later. That is the safe side. The daemon raises an
    /// alarm from this field, so the fault doesn't go unnoticed.
    pub flow_return_fault: Option<SensorFault>,
    /// Why.
    pub status: DeltaTStatus,
}

/// One control cycle.
///
/// `now` comes from the daemon (rule 2); `collector` and `store_bottom` are
/// the current readings, already checked against their plausible ranges
/// ([`crate::sensor::PlausibleRange::check`]). `flow_return` is `Some`
/// when the flow/return switch-off is configured, `None` otherwise.
/// `state` is what the previous call returned; the returned state goes
/// into the next call.
///
/// The decision, in order:
///
/// 1. A sensor fault on the collector or store bottom → off at once,
///    history cleared. (A fault on flow or return only switches the
///    flow/return condition off, see [`DeltaTOutput::flow_return_fault`].)
/// 2. While running: keep running while the collector difference is
///    above `off`, or while flow minus return is above `off`; once both
///    are at or below `off`, keep running until `min_run` is over, then
///    stop.
/// 3. While off: stay off below `on`; at or above `on`, start unless the
///    collector is below `collector_min`.
#[must_use]
pub fn step(
    config: &DeltaTConfig,
    state: DeltaTState,
    now: Seconds,
    collector: Reading,
    store_bottom: Reading,
    flow_return: Option<FlowReturn>,
) -> (DeltaTState, DeltaTOutput) {
    // 1. Both readings must be valid. A fault never counts as cold or
    //    warm (ARCHITECTURE 4.2): with an unknown temperature the ΔT is
    //    unknown, so the pump stops, even during the minimum run time.
    //    The history is cleared too, so the next valid readings start a
    //    fresh mean instead of mixing values from before the fault.
    let (collector, store) = match (collector, store_bottom) {
        (Ok(c), Ok(s)) => (c, s),
        // If both are faulty, the collector's fault is reported (it is
        // matched first), which is the more important sensor.
        (Err(fault), _) | (_, Err(fault)) => {
            return (
                DeltaTState::default(),
                DeltaTOutput {
                    pump_on: false,
                    delta_t: None,
                    loop_delta_t: None,
                    flow_return_fault: None,
                    status: DeltaTStatus::SensorFault(fault),
                },
            );
        }
    };

    // Smooth: add this cycle's ΔT and take the mean of the last few.
    let window = state.window.push(collector.minus(store));
    let Some(delta_t) = window.mean() else {
        // Can't happen right after a push (the window holds at least the
        // sample just added). Should it ever happen, the safe answer is
        // the same as for a sensor fault: unknown → off.
        return (
            DeltaTState::default(),
            DeltaTOutput {
                pump_on: false,
                delta_t: None,
                loop_delta_t: None,
                flow_return_fault: None,
                status: DeltaTStatus::SensorFault(SensorFault::ReadError),
            },
        );
    };

    // The optional flow/return difference, smoothed like the main one.
    //
    // It is updated every cycle, also while the pump is off. While off it
    // is meaningless (no flow, both pipes just cool down), but it is only
    // *used* while the pump runs, and keeping it current means the mean
    // is already filled when it's needed. Right after a start it reflects
    // the cold coil contents passing the return sensor first and goes
    // negative (seen in the replay data); that can only shorten a run,
    // never extend it.
    let (loop_window, loop_delta_t, flow_return_fault) = match flow_return {
        // Option not configured: nothing to track.
        None => (Window::default(), None, None),
        Some(FlowReturn {
            flow: Ok(flow),
            ret: Ok(ret),
        }) => {
            let loop_window = state.loop_window.push(flow.minus(ret));
            (loop_window, loop_window.mean(), None)
        }
        // At least one of the two has failed. The history is cleared so
        // the mean restarts cleanly once the sensor is back, and the
        // condition is simply not used meanwhile (see
        // `DeltaTOutput::flow_return_fault` for why that is safe). If both
        // failed, the flow sensor's fault is reported.
        Some(FlowReturn { flow, ret }) => (Window::default(), None, flow.err().or(ret.err())),
    };

    let (running_since, status) = match state.running_since {
        // 2. Pump running.
        Some(since) => {
            // Still clearly warmer than the store: keep collecting. `>`
            // and not `>=`, so reaching `off` exactly already counts as
            // "off reached".
            if delta_t > config.off {
                (Some(since), DeltaTStatus::Running)
            // The collector difference says stop, but the loop still
            // carries heat into the store: flow minus return above `off`
            // (the same threshold, as on the BX Plus, where the replay
            // shows both ending at 2 K). Unknown counts as "no", so a
            // missing or faulty flow/return pair can't keep a pump on.
            } else if loop_delta_t.is_some_and(|d| d > config.off) {
                (Some(since), DeltaTStatus::HeldByFlowReturn)
            // `off` reached, but the pump has not run long enough yet. Rule
            // 17: `saturating_since` gives 0 if `since` lies in the future
            // (restored state), so the minimum run time is then simply
            // still running, never skipped by a wrap-around.
            } else if now.saturating_since(since) < config.min_run {
                (Some(since), DeltaTStatus::HeldByMinRun)
            } else {
                (None, DeltaTStatus::Stopped)
            }
        }
        // 3. Pump off.
        None => {
            // Not warm enough yet. `<`, so reaching `on` exactly starts.
            if delta_t < config.on {
                (None, DeltaTStatus::Idle)
            // Warm enough relative to the store, but the collector itself
            // is too cold to be worth it (only checked before a start: a
            // running pump is stopped by ΔT, as on the BX Plus).
            } else if config.collector_min.is_some_and(|min| collector < min) {
                (None, DeltaTStatus::BelowCollectorMin)
            } else {
                // Start, and remember when for the minimum run time.
                (Some(now), DeltaTStatus::Started)
            }
        }
    };

    (
        DeltaTState {
            running_since,
            window,
            loop_window,
        },
        DeltaTOutput {
            pump_on: running_since.is_some(),
            delta_t: Some(delta_t),
            loop_delta_t,
            flow_return_fault,
            status,
        },
    )
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn c(v: f32) -> Reading {
        Ok(Celsius::new(v).unwrap())
    }

    /// Runs `seconds` cycles with constant readings, starting at `t0`,
    /// one cycle per second as in the daemon. Returns the final state and
    /// the output of the last cycle.
    fn run(
        config: &DeltaTConfig,
        mut state: DeltaTState,
        t0: u64,
        seconds: u64,
        collector: Reading,
        store: Reading,
    ) -> (DeltaTState, DeltaTOutput) {
        let mut out = None;
        for t in t0..t0 + seconds {
            let (s, o) = step(config, state, Seconds::new(t), collector, store, None);
            state = s;
            out = Some(o);
        }
        (state, out.unwrap())
    }

    /// The shipped defaults must pass their own validation.
    #[test]
    fn defaults_are_valid() {
        assert_eq!(DeltaTConfig::DEFAULT.validate(), Ok(()));
    }

    /// The two config mistakes `validate` exists for: no hysteresis
    /// (off = on) and a switch-on difference that would pump heat out of
    /// the store.
    #[test]
    fn invalid_settings_are_rejected() {
        let mut cfg = DeltaTConfig::DEFAULT;
        cfg.off = cfg.on;
        assert_eq!(cfg.validate(), Err(DeltaTConfigError::OffNotBelowOn));
        cfg.on = Kelvin::from_const(-1.0);
        assert_eq!(cfg.validate(), Err(DeltaTConfigError::OnNotPositive));
    }

    /// The normal day: the collector warms to 6 K above the store, the
    /// pump starts; 5 K is inside the hysteresis band and keeps it
    /// running; at 4 K, long after the minimum run time, it stops.
    #[test]
    fn starts_at_on_difference_and_stops_at_off_difference() {
        let cfg = DeltaTConfig::DEFAULT;
        let (s, o) = run(&cfg, DeltaTState::default(), 0, 10, c(46.0), c(40.0));
        assert!(o.pump_on);
        assert!(s.is_running());
        // 5 K: inside the hysteresis band, keeps running.
        let (s, o) = run(&cfg, s, 10, 300, c(45.0), c(40.0));
        assert_eq!(o.status, DeltaTStatus::Running);
        // 4 K: off (min run time long over).
        let (_, o) = run(&cfg, s, 310, 10, c(44.0), c(40.0));
        assert!(!o.pump_on);
    }

    /// Hysteresis works from below too: 5 K never starts the pump,
    /// however long it lasts.
    #[test]
    fn does_not_start_inside_the_hysteresis_band() {
        let (_, o) = run(
            &DeltaTConfig::DEFAULT,
            DeltaTState::default(),
            0,
            60,
            c(45.0),
            c(40.0),
        );
        assert_eq!(o.status, DeltaTStatus::Idle);
    }

    /// Right after a start, cold fluid from the pipes passes the
    /// collector sensor and ΔT collapses. The minimum run time keeps the
    /// pump on until 120 s, then lets it stop.
    #[test]
    fn minimum_run_time_holds_the_pump() {
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 0, 1, c(60.0), c(40.0));
        assert!(s.is_running());
        // ΔT collapses right after the start; smoothing takes a few
        // cycles, then the minimum run time holds the pump until 120 s.
        let (s, o) = run(&cfg, s, 1, 100, c(40.0), c(40.0));
        assert_eq!(o.status, DeltaTStatus::HeldByMinRun);
        assert!(o.pump_on);
        let (_, o) = run(&cfg, s, 101, 30, c(40.0), c(40.0));
        assert!(!o.pump_on);
    }

    /// A cold morning with the store sensor in a cold cellar: ΔT is met,
    /// but an 8 °C collector isn't worth pumping.
    #[test]
    fn no_start_below_collector_minimum() {
        // Store at 0 °C, collector at 8 °C: ΔT 8 K, but below 10 °C.
        let (_, o) = run(
            &DeltaTConfig::DEFAULT,
            DeltaTState::default(),
            0,
            10,
            c(8.0),
            c(0.0),
        );
        assert_eq!(o.status, DeltaTStatus::BelowCollectorMin);
        assert!(!o.pump_on);
    }

    /// Smoothing: one spike that alone would exceed the switch-on value
    /// is diluted by the mean and does not start the pump.
    #[test]
    fn single_noisy_reading_does_not_start_the_pump() {
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 0, 10, c(42.0), c(40.0));
        // One spike of 15 K among 2 K readings: mean (4·2 + 15)/5 = 4.6 K.
        let (s, o) = step(&cfg, s, Seconds::new(10), c(55.0), c(40.0), None);
        assert!(!o.pump_on);
        let (_, o) = step(&cfg, s, Seconds::new(11), c(42.0), c(40.0), None);
        assert!(!o.pump_on);
    }

    /// ARCHITECTURE 4.2: a broken collector sensor stops the pump at once,
    /// even inside the minimum run time, and clears the state.
    #[test]
    fn sensor_fault_stops_the_pump_at_once_even_during_min_run() {
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 0, 5, c(70.0), c(40.0));
        assert!(s.is_running());
        let (s, o) = step(
            &cfg,
            s,
            Seconds::new(6),
            Err(SensorFault::OpenCircuit),
            c(40.0),
            None,
        );
        assert!(!o.pump_on);
        assert_eq!(
            o.status,
            DeltaTStatus::SensorFault(SensorFault::OpenCircuit)
        );
        assert!(!s.is_running());
    }

    /// Rule 14: a strongly negative ΔT is just a number, not a
    /// wrap-around that could look like a huge positive difference.
    #[test]
    fn frozen_collector_with_warm_store_stays_off() {
        // Rule 14: −20 °C collector, 45 °C store, ΔT −65 K.
        let (_, o) = run(
            &DeltaTConfig::DEFAULT,
            DeltaTState::default(),
            0,
            60,
            c(-20.0),
            c(45.0),
        );
        assert!(!o.pump_on);
        assert!(o.delta_t.unwrap() < Kelvin::from_const(-64.0));
    }

    /// Rule 17: a restored state whose start time lies after "now" (clock
    /// set back) neither panics nor ends the minimum run time early.
    #[test]
    fn time_going_backwards_does_not_panic_or_stop_early() {
        // Rule 17: a restored state with a start time in the future.
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 1000, 1, c(60.0), c(40.0));
        let (_, o) = run(&cfg, s, 10, 10, c(40.0), c(40.0));
        assert_eq!(o.status, DeltaTStatus::HeldByMinRun);
    }

    /// Rule 13: times near the end of `u64` behave like any other time,
    /// so no counter limit is ever reached in practice.
    #[test]
    fn ten_years_of_cycles_near_the_end_of_u64() {
        let cfg = DeltaTConfig::DEFAULT;
        let t0 = u64::MAX - 400;
        let (s, o) = run(&cfg, DeltaTState::default(), t0, 10, c(60.0), c(40.0));
        assert!(o.pump_on);
        let (_, o) = run(&cfg, s, t0 + 10, 300, c(40.0), c(40.0));
        assert!(!o.pump_on);
    }

    /// Like `run`, with flow and return readings: `seconds` cycles at
    /// constant values.
    #[allow(clippy::too_many_arguments)]
    fn run_fr(
        config: &DeltaTConfig,
        mut state: DeltaTState,
        t0: u64,
        seconds: u64,
        collector: Reading,
        store: Reading,
        flow: Reading,
        ret: Reading,
    ) -> (DeltaTState, DeltaTOutput) {
        let mut out = None;
        for t in t0..t0 + seconds {
            let fr = Some(FlowReturn { flow, ret });
            let (s, o) = step(config, state, Seconds::new(t), collector, store, fr);
            state = s;
            out = Some(o);
        }
        (state, out.unwrap())
    }

    /// The BX Plus settings of the reference installation (ARCHITECTURE
    /// 8.1): on at 5 K, off at 2 K. Minimum run time 0, because the BX
    /// data shows none.
    fn bx() -> DeltaTConfig {
        DeltaTConfig {
            on: Kelvin::from_const(5.0),
            off: Kelvin::from_const(2.0),
            min_run: Seconds::ZERO,
            collector_min: Some(Celsius::from_const(10.0)),
        }
    }

    /// The sunny evening of 2026-07-09 (replay data), simplified: the
    /// collector sensor falls far below the store, but flow minus return
    /// is still 10 K, so the pump keeps running; it stops once flow minus
    /// return reaches 2 K.
    #[test]
    fn flow_return_keeps_the_pump_on_while_the_loop_delivers_heat() {
        let cfg = bx();
        // Running in the afternoon: collector 72, store 65, flow 76, return 56.
        let (s, o) = run_fr(
            &cfg,
            DeltaTState::default(),
            0,
            60,
            c(72.0),
            c(65.0),
            c(76.0),
            c(56.0),
        );
        assert_eq!(o.status, DeltaTStatus::Running);
        // Evening: collector 18 K below the store, loop still 10 K.
        let (s, o) = run_fr(&cfg, s, 60, 600, c(47.0), c(65.0), c(64.0), c(54.0));
        assert!(o.pump_on);
        assert_eq!(o.status, DeltaTStatus::HeldByFlowReturn);
        // Flow minus return down to 2 K: both conditions met, off.
        let (_, o) = run_fr(&cfg, s, 660, 10, c(47.0), c(65.0), c(59.0), c(57.0));
        assert!(!o.pump_on);
    }

    /// The short morning runs of 2026-08-03: right after the start the
    /// cold contents of the store's coil pass the return sensor, so flow
    /// minus return is strongly negative; the run ends when the collector
    /// difference reaches 2 K, as on the BX.
    #[test]
    fn flow_return_does_not_hold_a_pump_while_the_loop_is_negative() {
        let cfg = bx();
        let (s, o) = run_fr(
            &cfg,
            DeltaTState::default(),
            0,
            30,
            c(61.0),
            c(54.0),
            c(25.0),
            c(45.0),
        );
        assert!(o.pump_on);
        let (_, o) = run_fr(&cfg, s, 30, 10, c(56.0), c(54.0), c(39.0), c(48.0));
        // Stopped a few cycles in (once the mean has caught up) and idle
        // since; the point is that the negative loop difference didn't
        // hold it.
        assert!(!o.pump_on);
        assert_eq!(o.status, DeltaTStatus::Idle);
    }

    /// The flow/return condition can only keep a running pump on; it never
    /// starts one, however warm the flow is.
    #[test]
    fn flow_return_never_starts_the_pump() {
        let (_, o) = run_fr(
            &bx(),
            DeltaTState::default(),
            0,
            60,
            c(50.0),
            c(50.0),
            c(80.0),
            c(40.0),
        );
        assert!(!o.pump_on);
        assert_eq!(o.status, DeltaTStatus::Idle);
    }

    /// A broken flow sensor doesn't stop the pump: the control falls back
    /// to the plain collector difference and reports the fault. With the
    /// collector difference low, that means the pump stops, which is the
    /// safe side.
    #[test]
    fn flow_return_fault_falls_back_to_the_collector_difference() {
        let cfg = bx();
        let (s, _) = run_fr(
            &cfg,
            DeltaTState::default(),
            0,
            60,
            c(72.0),
            c(65.0),
            c(76.0),
            c(56.0),
        );
        // Collector still clearly warmer: running, fault only reported.
        let (s, o) = run_fr(
            &cfg,
            s,
            60,
            10,
            c(72.0),
            c(65.0),
            Err(SensorFault::OpenCircuit),
            c(56.0),
        );
        assert!(o.pump_on);
        assert_eq!(o.flow_return_fault, Some(SensorFault::OpenCircuit));
        assert_eq!(o.loop_delta_t, None);
        // Collector difference gone: off, although the (unknown) loop might
        // still deliver.
        let (_, o) = run_fr(
            &cfg,
            s,
            70,
            10,
            c(47.0),
            c(65.0),
            Err(SensorFault::OpenCircuit),
            c(56.0),
        );
        assert!(!o.pump_on);
    }

    /// Without the option nothing changes: the same evening stops the
    /// pump as soon as the collector difference is gone.
    #[test]
    fn without_flow_return_the_evening_run_stops_early() {
        let cfg = bx();
        let (s, _) = run(&cfg, DeltaTState::default(), 0, 60, c(72.0), c(65.0));
        let (_, o) = run(&cfg, s, 60, 10, c(47.0), c(65.0));
        assert!(!o.pump_on);
        assert_eq!(o.loop_delta_t, None);
    }

    proptest! {
        /// Whatever the readings, a fault on either sensor means "off".
        #[test]
        fn any_fault_means_off(
            ts in 0_u64..10_000,
            store in -10.0_f32..100.0,
            running in any::<bool>(),
        ) {
            let cfg = DeltaTConfig::DEFAULT;
            let state = if running {
                run(&cfg, DeltaTState::default(), 0, 1, c(90.0), c(20.0)).0
            } else {
                DeltaTState::default()
            };
            let (_, o) = step(&cfg, state, Seconds::new(ts), Err(SensorFault::Stale), c(store), None);
            prop_assert!(!o.pump_on);
        }

        /// The pump never starts while the smoothed ΔT is below `on`.
        #[test]
        fn never_starts_below_on(
            collector in -40.0_f32..250.0,
            store in 0.0_f32..110.0,
        ) {
            let cfg = DeltaTConfig::DEFAULT;
            let (_, o) = step(&cfg, DeltaTState::default(), Seconds::ZERO, c(collector), c(store), None);
            if collector - store < cfg.on.get() {
                prop_assert!(!o.pump_on);
            }
        }
    }
}
