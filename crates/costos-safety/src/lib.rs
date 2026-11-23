//! CoSTOS safety supervisor (ARCHITECTURE.md 4.2).
//!
//! Sits between the control core and the outputs and can only **reduce**
//! what the core asks for: it returns a duty that is never higher than
//! the requested one. It can never switch anything on.
//!
//! For the solar pump it enforces:
//!
//! - **Unknown sensor → off.** A collector or store sensor without a valid
//!   value counts as unknown, never as cold.
//! - **Collector emergency shutdown**: at or above the limit (at most
//!   [`HARD_COLLECTOR_EMERGENCY`]) the pump is forced off, because pumping
//!   into a stagnating collector can flash the fluid to steam. It may run
//!   again once the collector has cooled by the restart hysteresis.
//! - **Store emergency shutdown**: at or above the limit (at most
//!   [`HARD_STORE_EMERGENCY`]) the pump is forced off, with the same
//!   hysteresis.
//! - **Minimum off time**: after stopping, the pump stays off for at
//!   least `min_off`, which also limits how often it can start.
//!
//! Same rules as `costos-core` (ARCHITECTURE 6.1): no `std`, no clock, no
//! logging; what happened leaves as [`Interventions`].
#![cfg_attr(not(test), no_std)]

use costos_core::{Celsius, Duty, Kelvin, Reading, Seconds};

/// Highest collector emergency limit that can be configured. Lower is
/// allowed, higher is not (ARCHITECTURE 7.3).
pub const HARD_COLLECTOR_EMERGENCY: Celsius = Celsius::from_const(130.0);

/// Highest store emergency limit that can be configured.
pub const HARD_STORE_EMERGENCY: Celsius = Celsius::from_const(95.0);

/// Settings of the supervisor for the solar pump.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SafetyConfig {
    /// Collector temperature that forces the pump off.
    pub collector_emergency: Celsius,
    /// Store temperature (any store sensor) that forces the pump off.
    pub store_emergency: Celsius,
    /// How far a temperature must fall below its limit before the pump
    /// may run again.
    pub restart_hysteresis: Kelvin,
    /// Shortest time the pump stays off after stopping.
    pub min_off: Seconds,
}

/// Why a [`SafetyConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SafetyConfigError {
    /// Collector limit above [`HARD_COLLECTOR_EMERGENCY`].
    CollectorAboveHardLimit,
    /// Store limit above [`HARD_STORE_EMERGENCY`].
    StoreAboveHardLimit,
    /// The restart hysteresis must be above zero.
    HysteresisNotPositive,
}

impl SafetyConfig {
    /// Defaults: the hard limits, 10 K hysteresis, 60 s minimum off time.
    pub const DEFAULT: Self = Self {
        collector_emergency: HARD_COLLECTOR_EMERGENCY,
        store_emergency: HARD_STORE_EMERGENCY,
        restart_hysteresis: Kelvin::from_const(10.0),
        min_off: Seconds::new(60),
    };

    /// Checks the settings against the compiled-in limits.
    pub fn validate(&self) -> Result<(), SafetyConfigError> {
        if self.collector_emergency > HARD_COLLECTOR_EMERGENCY {
            return Err(SafetyConfigError::CollectorAboveHardLimit);
        }
        if self.store_emergency > HARD_STORE_EMERGENCY {
            return Err(SafetyConfigError::StoreAboveHardLimit);
        }
        if self.restart_hysteresis <= Kelvin::from_const(0.0) {
            return Err(SafetyConfigError::HysteresisNotPositive);
        }
        Ok(())
    }
}

impl Default for SafetyConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// State carried from one cycle to the next.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct SupervisorState {
    collector_latched: bool,
    store_latched: bool,
    /// When the output last went to 0 %, if it did since the start.
    stopped_at: Option<Seconds>,
    last_output: Duty,
}

/// The readings the supervisor looks at in one cycle.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SolarInputs {
    /// Time of this cycle, from the daemon.
    pub now: Seconds,
    /// What the control core asks for.
    pub requested: Duty,
    /// Collector sensor.
    pub collector: Reading,
    /// Store bottom sensor (required).
    pub store_bottom: Reading,
    /// Store top sensor, if one is configured.
    pub store_top: Option<Reading>,
}

/// Which rules reduced the output in this cycle. Several can apply at
/// once; all of them are reported.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Interventions {
    /// A required sensor has no valid value.
    pub sensor_unknown: bool,
    /// Collector at or above its emergency limit, or not yet cooled down.
    pub collector_emergency: bool,
    /// Store at or above its emergency limit, or not yet cooled down.
    pub store_emergency: bool,
    /// The minimum off time is not over.
    pub min_off_time: bool,
}

impl Interventions {
    /// True if any rule applied.
    #[must_use]
    pub const fn any(&self) -> bool {
        self.sensor_unknown || self.collector_emergency || self.store_emergency || self.min_off_time
    }
}

/// Updates an emergency latch: set at or above `limit`, cleared at or
/// below `limit − hysteresis`. A missing value keeps the latch as it is.
fn latch(latched: bool, value: Option<Celsius>, limit: Celsius, hysteresis: Kelvin) -> bool {
    let Some(t) = value else { return latched };
    if t >= limit {
        return true;
    }
    match limit.plus(hysteresis.negated()) {
        Some(release) if t <= release => false,
        // Below the limit but not cooled enough: stay as it was.
        Some(_) => latched,
        // Release point below absolute zero: never released by cooling.
        None => latched,
    }
}

/// One cycle for the solar pump. Returns the new state, the duty that
/// may be applied (never above `inputs.requested`) and what intervened.
#[must_use]
pub fn supervise_solar_pump(
    config: &SafetyConfig,
    state: SupervisorState,
    inputs: &SolarInputs,
) -> (SupervisorState, Duty, Interventions) {
    let mut why = Interventions::default();

    let collector = inputs.collector.ok();
    let store_bottom = inputs.store_bottom.ok();
    let store_top = inputs.store_top.map(|r| r.ok());

    why.sensor_unknown =
        collector.is_none() || store_bottom.is_none() || matches!(store_top, Some(None));

    let collector_latched = latch(
        state.collector_latched,
        collector,
        config.collector_emergency,
        config.restart_hysteresis,
    );
    why.collector_emergency = collector_latched;

    let hottest_store = match (store_bottom, store_top.flatten()) {
        (Some(b), Some(t)) => Some(if t > b { t } else { b }),
        (b, t) => b.or(t),
    };
    let store_latched = latch(
        state.store_latched,
        hottest_store,
        config.store_emergency,
        config.restart_hysteresis,
    );
    why.store_emergency = store_latched;

    let in_min_off = state.last_output.is_off()
        && state
            .stopped_at
            .is_some_and(|at| inputs.now.saturating_since(at) < config.min_off);
    why.min_off_time = in_min_off && !inputs.requested.is_off();

    let allowed = if why.any() {
        Duty::OFF
    } else {
        inputs.requested
    };
    // The one guarantee: never more than was asked for.
    let output = if allowed > inputs.requested {
        inputs.requested
    } else {
        allowed
    };

    let stopped_at = if output.is_off() && !state.last_output.is_off() {
        Some(inputs.now)
    } else {
        state.stopped_at
    };

    (
        SupervisorState {
            collector_latched,
            store_latched,
            stopped_at,
            last_output: output,
        },
        output,
        why,
    )
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use costos_core::SensorFault;
    use proptest::prelude::*;

    fn c(v: f32) -> Reading {
        Ok(Celsius::new(v).unwrap())
    }

    fn inputs(now: u64, requested: Duty, collector: Reading, store: Reading) -> SolarInputs {
        SolarInputs {
            now: Seconds::new(now),
            requested,
            collector,
            store_bottom: store,
            store_top: None,
        }
    }

    fn sup(state: SupervisorState, i: &SolarInputs) -> (SupervisorState, Duty, Interventions) {
        supervise_solar_pump(&SafetyConfig::DEFAULT, state, i)
    }

    #[test]
    fn defaults_are_valid_and_hard_limits_hold() {
        assert_eq!(SafetyConfig::DEFAULT.validate(), Ok(()));
        let mut cfg = SafetyConfig::DEFAULT;
        cfg.collector_emergency = Celsius::from_const(140.0);
        assert_eq!(
            cfg.validate(),
            Err(SafetyConfigError::CollectorAboveHardLimit)
        );
        let mut cfg = SafetyConfig::DEFAULT;
        cfg.store_emergency = Celsius::from_const(99.0);
        assert_eq!(cfg.validate(), Err(SafetyConfigError::StoreAboveHardLimit));
        let mut cfg = SafetyConfig::DEFAULT;
        cfg.collector_emergency = Celsius::from_const(120.0);
        assert_eq!(cfg.validate(), Ok(()));
    }

    #[test]
    fn passes_a_normal_request_through() {
        let (_, out, why) = sup(
            SupervisorState::default(),
            &inputs(0, Duty::FULL, c(60.0), c(40.0)),
        );
        assert_eq!(out, Duty::FULL);
        assert!(!why.any());
    }

    #[test]
    fn collector_emergency_latches_until_cooled_by_hysteresis() {
        let s = SupervisorState::default();
        let (s, out, why) = sup(s, &inputs(0, Duty::FULL, c(130.0), c(60.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.collector_emergency);
        // 125 °C: below the limit, not yet 10 K below.
        let (s, out, _) = sup(s, &inputs(100, Duty::FULL, c(125.0), c(60.0)));
        assert_eq!(out, Duty::OFF);
        // 120 °C: released.
        let (_, out, why) = sup(s, &inputs(200, Duty::FULL, c(120.0), c(60.0)));
        assert_eq!(out, Duty::FULL);
        assert!(!why.collector_emergency);
    }

    #[test]
    fn store_emergency_uses_the_hottest_store_sensor() {
        let i = SolarInputs {
            store_top: Some(c(96.0)),
            ..inputs(0, Duty::FULL, c(100.0), c(60.0))
        };
        let (_, out, why) = sup(SupervisorState::default(), &i);
        assert_eq!(out, Duty::OFF);
        assert!(why.store_emergency);
    }

    #[test]
    fn unknown_sensor_means_off() {
        for (col, store, top) in [
            (Err(SensorFault::OpenCircuit), c(40.0), None),
            (c(60.0), Err(SensorFault::Stale), None),
            (c(60.0), c(40.0), Some(Err(SensorFault::CrcError))),
        ] {
            let i = SolarInputs {
                store_top: top,
                ..inputs(0, Duty::FULL, col, store)
            };
            let (_, out, why) = sup(SupervisorState::default(), &i);
            assert_eq!(out, Duty::OFF);
            assert!(why.sensor_unknown);
        }
    }

    #[test]
    fn a_missing_reading_does_not_release_a_latched_emergency() {
        let (s, _, _) = sup(
            SupervisorState::default(),
            &inputs(0, Duty::FULL, c(135.0), c(60.0)),
        );
        let (s, _, _) = sup(s, &inputs(1, Duty::FULL, Err(SensorFault::Stale), c(60.0)));
        let (_, out, why) = sup(s, &inputs(2, Duty::FULL, c(126.0), c(60.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.collector_emergency);
    }

    #[test]
    fn minimum_off_time_after_a_stop() {
        let s = SupervisorState::default();
        let (s, out, _) = sup(s, &inputs(0, Duty::FULL, c(60.0), c(40.0)));
        assert_eq!(out, Duty::FULL);
        let (s, out, _) = sup(s, &inputs(10, Duty::OFF, c(60.0), c(40.0)));
        assert_eq!(out, Duty::OFF);
        let (s, out, why) = sup(s, &inputs(30, Duty::FULL, c(60.0), c(40.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.min_off_time);
        let (_, out, _) = sup(s, &inputs(70, Duty::FULL, c(60.0), c(40.0)));
        assert_eq!(out, Duty::FULL);
    }

    fn any_reading() -> impl Strategy<Value = Reading> {
        prop_oneof![
            4 => (-60.0_f32..300.0).prop_map(|v| Ok(Celsius::new(v).unwrap())),
            1 => Just(Err(SensorFault::OpenCircuit)),
            1 => Just(Err(SensorFault::Stale)),
        ]
    }

    proptest! {
        /// The supervisor's one promise: never more than requested, over
        /// any sequence of inputs.
        #[test]
        fn never_increases_the_request(
            steps in proptest::collection::vec(
                (0_u8..=100, any_reading(), any_reading(), proptest::option::of(any_reading()), 0_u64..120),
                1..60,
            )
        ) {
            let mut state = SupervisorState::default();
            let mut now = 0_u64;
            for (duty, col, store, top, dt) in steps {
                now += dt;
                let requested = Duty::new(duty).unwrap();
                let i = SolarInputs { now: Seconds::new(now), requested, collector: col, store_bottom: store, store_top: top };
                let (s, out, why) = supervise_solar_pump(&SafetyConfig::DEFAULT, state, &i);
                prop_assert!(out <= requested);
                if why.any() { prop_assert!(out.is_off()); }
                if let Ok(t) = col {
                    if t >= HARD_COLLECTOR_EMERGENCY { prop_assert!(out.is_off()); }
                }
                if col.is_err() || store.is_err() { prop_assert!(out.is_off()); }
                state = s;
            }
        }
    }
}
