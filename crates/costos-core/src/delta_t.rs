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
//!
//! Speed control comes on top of this later; here the request is on or
//! off.

use crate::sensor::{Reading, SensorFault};
use crate::temperature::{Celsius, Kelvin};
use crate::time::Seconds;

/// Number of control cycles (seconds) the ΔT is averaged over.
pub const SMOOTHING_SAMPLES: usize = 5;

/// Settings of the ΔT control.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct DeltaTConfig {
    /// Switch-on difference, collector minus store bottom.
    pub on: Kelvin,
    /// Switch-off difference; must be below `on`.
    pub off: Kelvin,
    /// Shortest time the pump runs once started.
    pub min_run: Seconds,
    /// No start while the collector is colder than this.
    pub collector_min: Option<Celsius>,
}

/// Why a [`DeltaTConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DeltaTConfigError {
    /// The switch-on difference must be above zero.
    OnNotPositive,
    /// The switch-off difference must be below the switch-on difference.
    OffNotBelowOn,
}

impl DeltaTConfig {
    /// Defaults as in ARCHITECTURE 6.2: on at 6 K, off at 4 K, at least
    /// 2 min run time, no start below a 10 °C collector.
    pub const DEFAULT: Self = Self {
        on: Kelvin::from_const(6.0),
        off: Kelvin::from_const(4.0),
        min_run: Seconds::new(120),
        collector_min: Some(Celsius::from_const(10.0)),
    };

    /// Checks the settings.
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

/// Moving mean over the last [`SMOOTHING_SAMPLES`] differences.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
struct Window {
    samples: [Option<Kelvin>; SMOOTHING_SAMPLES],
}

impl Window {
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
            .fold((0.0_f32, 0_u8), |(sum, count), k| {
                (sum + k.get(), count.saturating_add(1))
            });
        if count == 0 {
            None
        } else {
            // The mean of valid differences is itself a valid difference.
            Kelvin::new(sum / f32::from(count))
        }
    }
}

/// State carried from one control cycle to the next.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct DeltaTState {
    /// When the pump was started, while it runs.
    running_since: Option<Seconds>,
    window: Window,
}

impl DeltaTState {
    /// True while the control wants the pump on.
    #[must_use]
    pub const fn is_running(&self) -> bool {
        self.running_since.is_some()
    }
}

/// Why the control decided as it did in this cycle. The daemon logs a
/// change of status as an event (rule 3: no logging in the core).
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum DeltaTStatus {
    /// Started in this cycle.
    Started,
    /// Running, difference still above the switch-off value.
    Running,
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
    /// Why.
    pub status: DeltaTStatus,
}

/// One control cycle.
///
/// `now` comes from the daemon (rule 2); `collector` and `store_bottom` are
/// the current readings, already checked against their plausible ranges.
#[must_use]
pub fn step(
    config: &DeltaTConfig,
    state: DeltaTState,
    now: Seconds,
    collector: Reading,
    store_bottom: Reading,
) -> (DeltaTState, DeltaTOutput) {
    let (collector, store) = match (collector, store_bottom) {
        (Ok(c), Ok(s)) => (c, s),
        (Err(fault), _) | (_, Err(fault)) => {
            return (
                DeltaTState::default(),
                DeltaTOutput {
                    pump_on: false,
                    delta_t: None,
                    status: DeltaTStatus::SensorFault(fault),
                },
            );
        }
    };

    let window = state.window.push(collector.minus(store));
    let Some(delta_t) = window.mean() else {
        // Can't happen right after a push; treated as "unknown" anyway.
        return (
            DeltaTState::default(),
            DeltaTOutput {
                pump_on: false,
                delta_t: None,
                status: DeltaTStatus::SensorFault(SensorFault::ReadError),
            },
        );
    };

    let (running_since, status) = match state.running_since {
        Some(since) => {
            if delta_t > config.off {
                (Some(since), DeltaTStatus::Running)
            } else if now.saturating_since(since) < config.min_run {
                (Some(since), DeltaTStatus::HeldByMinRun)
            } else {
                (None, DeltaTStatus::Stopped)
            }
        }
        None => {
            if delta_t < config.on {
                (None, DeltaTStatus::Idle)
            } else if config.collector_min.is_some_and(|min| collector < min) {
                (None, DeltaTStatus::BelowCollectorMin)
            } else {
                (Some(now), DeltaTStatus::Started)
            }
        }
    };

    (
        DeltaTState {
            running_since,
            window,
        },
        DeltaTOutput {
            pump_on: running_since.is_some(),
            delta_t: Some(delta_t),
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

    /// Runs `seconds` cycles with constant readings, starting at `t0`.
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
            let (s, o) = step(config, state, Seconds::new(t), collector, store);
            state = s;
            out = Some(o);
        }
        (state, out.unwrap())
    }

    #[test]
    fn defaults_are_valid() {
        assert_eq!(DeltaTConfig::DEFAULT.validate(), Ok(()));
    }

    #[test]
    fn invalid_settings_are_rejected() {
        let mut cfg = DeltaTConfig::DEFAULT;
        cfg.off = cfg.on;
        assert_eq!(cfg.validate(), Err(DeltaTConfigError::OffNotBelowOn));
        cfg.on = Kelvin::from_const(-1.0);
        assert_eq!(cfg.validate(), Err(DeltaTConfigError::OnNotPositive));
    }

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

    #[test]
    fn single_noisy_reading_does_not_start_the_pump() {
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 0, 10, c(42.0), c(40.0));
        // One spike of 15 K among 2 K readings: mean (4·2 + 15)/5 = 4.6 K.
        let (s, o) = step(&cfg, s, Seconds::new(10), c(55.0), c(40.0));
        assert!(!o.pump_on);
        let (_, o) = step(&cfg, s, Seconds::new(11), c(42.0), c(40.0));
        assert!(!o.pump_on);
    }

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
        );
        assert!(!o.pump_on);
        assert_eq!(
            o.status,
            DeltaTStatus::SensorFault(SensorFault::OpenCircuit)
        );
        assert!(!s.is_running());
    }

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

    #[test]
    fn time_going_backwards_does_not_panic_or_stop_early() {
        // Rule 17: a restored state with a start time in the future.
        let cfg = DeltaTConfig::DEFAULT;
        let (s, _) = run(&cfg, DeltaTState::default(), 1000, 1, c(60.0), c(40.0));
        let (_, o) = run(&cfg, s, 10, 10, c(40.0), c(40.0));
        assert_eq!(o.status, DeltaTStatus::HeldByMinRun);
    }

    #[test]
    fn ten_years_of_cycles_near_the_end_of_u64() {
        let cfg = DeltaTConfig::DEFAULT;
        let t0 = u64::MAX - 400;
        let (s, o) = run(&cfg, DeltaTState::default(), t0, 10, c(60.0), c(40.0));
        assert!(o.pump_on);
        let (_, o) = run(&cfg, s, t0 + 10, 300, c(40.0), c(40.0));
        assert!(!o.pump_on);
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
            let (_, o) = step(&cfg, state, Seconds::new(ts), Err(SensorFault::Stale), c(store));
            prop_assert!(!o.pump_on);
        }

        /// The pump never starts while the smoothed ΔT is below `on`.
        #[test]
        fn never_starts_below_on(
            collector in -40.0_f32..250.0,
            store in 0.0_f32..110.0,
        ) {
            let cfg = DeltaTConfig::DEFAULT;
            let (_, o) = step(&cfg, DeltaTState::default(), Seconds::ZERO, c(collector), c(store));
            if collector - store < cfg.on.get() {
                prop_assert!(!o.pump_on);
            }
        }
    }
}
