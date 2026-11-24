//! `costos-cycle`: one control second of CoSTOS, in one place.
//!
//! Every second the daemon (`costosd`) and the simulation (`costos-sim`)
//! do the same thing. Before this crate they each had their own copy of
//! that order; now both call [`step`], so what the simulation tests is
//! exactly what will run on the Pi.
//!
//! ```text
//!  raw readings ─► offsets ─► plausible ranges ─► costos-core::solar (request)
//!                                                     │  (inhibit from last second: 0 %)
//!                                                     ▼
//!                                   costos-safety::supervise_solar_pump (output)
//!                                                     │
//!                       ┌─────────────────────────────┴───────────────┐
//!                       ▼                                             ▼
//!         costos-core::monitor (alarms, inhibit)        costos-core::heat (counters)
//! ```
//!
//! 1. **Offsets** (ARCHITECTURE 10.2, S4): each sensor's reading is
//!    corrected by its configured offset **before** anything looks at it, the
//!    supervisor included. In the reference installation S1 reads about
//!    8 K low (8.4); with the offset, the collector emergency stop acts on
//!    the corrected value.
//! 2. **Plausible ranges** (rule 18): collector-type sensors −40…250 °C,
//!    store sensors 0…110 °C; outside is a fault.
//! 3. **Control chain** (`costos-core::solar`): the requested duty.
//! 4. **Inhibit**: if the monitor asked for it in the previous second
//!    (repeated "no circulation"), the request becomes 0 % here, before the
//!    supervisor: a reduction, so it belongs in front of the supervisor,
//!    never behind it.
//! 5. **Supervisor** (`costos-safety`): the output, never above the request.
//! 6. **Monitor** and **heat counter** judge and count what was actually
//!    applied.
//!
//! `no_std` like `costos-core` and `costos-safety`, so it could run on a
//! microcontroller as well (6.1); the same rules apply.
#![cfg_attr(not(test), no_std)]

use costos_core::delta_t::FlowReturn;
use costos_core::heat::{self, Counters, HeatConfig, HeatState};
use costos_core::monitor::{self, Alarms, MonitorConfig, MonitorState};
use costos_core::solar::{self, SolarConfig, SolarOutput, SolarState};
use costos_core::{Duty, Kelvin, PlausibleRange, Reading, Seconds, TimeOfDay};
use costos_safety::{Interventions, SafetyConfig, SupervisorState};

/// The raw readings of the solar loop's sensors, as the hardware layer
/// delivers them (faults already detected there: open, short, stale, …).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Readings {
    /// S1 collector.
    pub collector: Reading,
    /// S2 store bottom.
    pub store_bottom: Reading,
    /// S3 store top, if configured.
    pub store_top: Option<Reading>,
    /// S4 solar flow at the store, if configured.
    pub flow: Option<Reading>,
    /// S5 solar return at the store, if configured.
    pub ret: Option<Reading>,
}

/// Offset added to each sensor's reading, in kelvin (positive = the sensor
/// reads low). Zero means no correction.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Offsets {
    /// S1.
    pub collector: Kelvin,
    /// S2.
    pub store_bottom: Kelvin,
    /// S3.
    pub store_top: Kelvin,
    /// S4.
    pub flow: Kelvin,
    /// S5.
    pub ret: Kelvin,
}

impl Offsets {
    /// No correction anywhere.
    pub const NONE: Self = Self {
        collector: Kelvin::from_const(0.0),
        store_bottom: Kelvin::from_const(0.0),
        store_top: Kelvin::from_const(0.0),
        flow: Kelvin::from_const(0.0),
        ret: Kelvin::from_const(0.0),
    };
}

/// Everything one cycle needs to know.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CycleConfig {
    /// Control functions.
    pub solar: SolarConfig,
    /// Safety supervisor.
    pub safety: SafetyConfig,
    /// Plausibility checks.
    pub monitor: MonitorConfig,
    /// Heat quantity and statistics.
    pub heat: HeatConfig,
    /// Sensor corrections.
    pub offsets: Offsets,
    /// Use flow and return for the flow/return switch-off (as the
    /// reference BX does).
    pub flow_return_switch_off: bool,
    /// Plausible ranges: collector-type sensors (S1, S4, S5).
    pub collector_range: PlausibleRange,
    /// Plausible ranges: store sensors (S2, S3).
    pub store_range: PlausibleRange,
}

/// Why a [`CycleConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum CycleConfigError {
    /// See [`solar::SolarConfigError`].
    Solar(solar::SolarConfigError),
    /// See [`costos_safety::SafetyConfigError`].
    Safety(costos_safety::SafetyConfigError),
    /// An offset is larger than 20 K: more than any sensor should be off,
    /// most likely a typing error.
    OffsetTooLarge,
}

impl CycleConfig {
    /// Checks everything that can be checked.
    pub fn validate(&self) -> Result<(), CycleConfigError> {
        self.solar.validate().map_err(CycleConfigError::Solar)?;
        self.safety.validate().map_err(CycleConfigError::Safety)?;
        let o = self.offsets;
        for k in [o.collector, o.store_bottom, o.store_top, o.flow, o.ret] {
            // NaN counts as too large: it can never be a correction.
            if k.get().is_nan() || k.get().abs() > 20.0 {
                return Err(CycleConfigError::OffsetTooLarge);
            }
        }
        Ok(())
    }
}

/// State of all parts, carried from one second to the next.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CycleState {
    solar: SolarState,
    supervisor: SupervisorState,
    monitor: MonitorState,
    heat: HeatState,
    inhibit: bool,
}

impl CycleState {
    /// A fresh start (the supervisor starts latched, ARCHITECTURE 4.2),
    /// continuing from saved counters.
    #[must_use]
    pub fn start(counters: Counters) -> Self {
        Self {
            solar: SolarState::default(),
            supervisor: SupervisorState::default(),
            monitor: MonitorState::default(),
            heat: HeatState::from_counters(counters),
            inhibit: false,
        }
    }

    /// The counters, for saving.
    #[must_use]
    pub const fn counters(&self) -> Counters {
        self.heat.counters
    }

    /// A restart of the daemon: control and supervisor start fresh (the
    /// supervisor latched, 4.2), while the alarms, the inhibit and the
    /// counters are kept, as the daemon persists them.
    #[must_use]
    pub fn restart(self) -> Self {
        Self {
            solar: SolarState::default(),
            supervisor: SupervisorState::default(),
            ..self
        }
    }

    /// The user acknowledged the alarms: clears the latched ones and the
    /// inhibit.
    #[must_use]
    pub fn acknowledge(self) -> Self {
        Self {
            monitor: self.monitor.acknowledge(),
            inhibit: false,
            ..self
        }
    }
}

impl Default for CycleState {
    fn default() -> Self {
        Self::start(Counters::default())
    }
}

/// What one second decided.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct CycleOutput {
    /// The duty to apply to the pump.
    pub duty: Duty,
    /// The corrected, range-checked readings the decision used.
    pub readings: Readings,
    /// The control chain's result (request, ΔT, statuses).
    pub solar: SolarOutput,
    /// What the supervisor did.
    pub interventions: Interventions,
    /// Alarms and notices.
    pub alarms: Alarms,
    /// Whether the pump is inhibited from the next second on.
    pub inhibit: bool,
    /// The counters after this second.
    pub counters: Counters,
}

/// A reading corrected by `offset` and checked against `range`.
fn correct(reading: Reading, offset: Kelvin, range: PlausibleRange) -> Reading {
    let shifted = match reading {
        // A correction that would leave the representable range is a
        // fault of its own kind: out of range.
        Ok(t) => t.plus(offset).ok_or(costos_core::SensorFault::OutOfRange),
        Err(f) => Err(f),
    };
    range.check(shifted)
}

/// One control second. See the crate documentation for the order.
#[must_use]
pub fn step(
    config: &CycleConfig,
    state: CycleState,
    now: Seconds,
    time_of_day: TimeOfDay,
    raw: &Readings,
) -> (CycleState, CycleOutput) {
    let o = config.offsets;
    let (cr, sr) = (config.collector_range, config.store_range);
    let r = Readings {
        collector: correct(raw.collector, o.collector, cr),
        store_bottom: correct(raw.store_bottom, o.store_bottom, sr),
        store_top: raw.store_top.map(|x| correct(x, o.store_top, sr)),
        flow: raw.flow.map(|x| correct(x, o.flow, cr)),
        ret: raw.ret.map(|x| correct(x, o.ret, cr)),
    };

    let flow_return = match (config.flow_return_switch_off, r.flow, r.ret) {
        (true, Some(flow), Some(ret)) => Some(FlowReturn { flow, ret }),
        _ => None,
    };
    let inputs = solar::SolarInputs {
        now,
        time_of_day,
        collector: r.collector,
        store_bottom: r.store_bottom,
        store_max_sensor: None,
        flow_return,
    };
    let (solar_state, solar_out) = solar::step(&config.solar, state.solar, &inputs);

    let requested = if state.inhibit {
        Duty::OFF
    } else {
        solar_out.requested
    };
    let sup_in = costos_safety::SolarInputs {
        now,
        requested,
        collector: r.collector,
        store_bottom: r.store_bottom,
        store_top: r.store_top,
    };
    let (supervisor, duty, interventions) =
        costos_safety::supervise_solar_pump(&config.safety, state.supervisor, &sup_in);

    // Every configured sensor, for the sensor alarm.
    let mut all = [Ok(costos_core::Celsius::from_const(0.0)); 5];
    let mut n = 0_usize;
    for x in [
        Some(r.collector),
        Some(r.store_bottom),
        r.store_top,
        r.flow,
        r.ret,
    ]
    .into_iter()
    .flatten()
    {
        if let Some(slot) = all.get_mut(n) {
            *slot = x;
            n = n.saturating_add(1);
        }
    }
    let sensors = all.get(..n).unwrap_or(&[]);
    let mon_in = monitor::MonitorInputs {
        now,
        time_of_day,
        pump_on: !duty.is_off(),
        collector: r.collector,
        store_bottom: r.store_bottom,
        flow: r.flow,
        ret: r.ret,
        delta_t: solar_out.delta_t.delta_t,
        store_max_reached: !solar_out.store_max.allows_loading(),
        sensors,
    };
    let (monitor, alarms, inhibit) = monitor::step(&config.monitor, state.monitor, &mon_in);
    let heat = heat::step(&config.heat, state.heat, duty, r.collector, r.flow, r.ret);

    (
        CycleState {
            solar: solar_state,
            supervisor,
            monitor,
            heat,
            inhibit,
        },
        CycleOutput {
            duty,
            readings: r,
            solar: solar_out,
            interventions,
            alarms,
            inhibit,
            counters: heat.counters,
        },
    )
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use costos_core::Celsius;

    fn c(v: f32) -> Reading {
        Ok(Celsius::from_const(v))
    }

    fn config() -> CycleConfig {
        CycleConfig {
            solar: SolarConfig::DEFAULT,
            safety: SafetyConfig::DEFAULT,
            monitor: MonitorConfig::DEFAULT,
            heat: HeatConfig::REFERENCE,
            offsets: Offsets::NONE,
            flow_return_switch_off: true,
            collector_range: PlausibleRange::COLLECTOR,
            store_range: PlausibleRange::STORE,
        }
    }

    fn readings(col: f32) -> Readings {
        Readings {
            collector: c(col),
            store_bottom: c(40.0),
            store_top: Some(c(45.0)),
            flow: Some(c(38.0)),
            ret: Some(c(38.0)),
        }
    }

    #[test]
    fn default_config_is_valid() {
        assert_eq!(config().validate(), Ok(()));
        let mut bad = config();
        bad.offsets.collector = Kelvin::from_const(25.0);
        assert_eq!(bad.validate(), Err(CycleConfigError::OffsetTooLarge));
    }

    /// The offset is applied before the supervisor: a collector reading
    /// 125 °C with an 8 K offset is 133 °C, above the 130 °C emergency
    /// limit, so the pump stays off.
    #[test]
    fn offset_reaches_the_supervisor() {
        let mut cfg = config();
        let mut s = CycleState::default();
        for t in 0..30 {
            let (ns, o) = step(
                &cfg,
                s,
                Seconds::new(t),
                TimeOfDay::MIDNIGHT,
                &readings(125.0),
            );
            s = ns;
            assert!(!o.interventions.collector_emergency || o.duty.is_off());
        }
        cfg.offsets.collector = Kelvin::from_const(8.0);
        let (_, o) = step(
            &cfg,
            s,
            Seconds::new(30),
            TimeOfDay::MIDNIGHT,
            &readings(125.0),
        );
        assert!(o.interventions.collector_emergency);
        assert!(o.duty.is_off());
        let t = o.readings.collector.unwrap().get();
        assert!((t - 133.0).abs() < 1e-3);
    }

    /// A warm collector over a cool store: after the start the pump runs,
    /// and the counters count it.
    #[test]
    fn runs_and_counts() {
        let cfg = config();
        let mut s = CycleState::default();
        let mut last = None;
        for t in 0..200 {
            let (ns, o) = step(
                &cfg,
                s,
                Seconds::new(t),
                TimeOfDay::MIDNIGHT,
                &readings(60.0),
            );
            s = ns;
            last = Some(o);
        }
        let o = last.unwrap();
        assert!(!o.duty.is_off());
        assert!(o.counters.pump_seconds > 100);
        assert_eq!(s.counters(), o.counters);
    }

    /// Saved counters survive a restart.
    #[test]
    fn counters_continue_after_a_restart() {
        let counters = Counters {
            heat_wh: 1234,
            ..Counters::default()
        };
        let s = CycleState::start(counters);
        assert_eq!(s.counters().heat_wh, 1234);
    }
}
