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
//!
//! **Why a separate crate.** The control core decides when heat is worth
//! collecting; this crate decides when pumping would be dangerous. Keeping
//! them apart means a bug in the control logic (or a later, more complex
//! controller) can't switch off a protection, and this small crate can be
//! reviewed and tested on its own. Its one promise is checked by a
//! property test over random input sequences: the output is never higher
//! than the request.
//!
//! **What it is not.** It is not the last line of defence: if this code
//! panics, the process exits, the heartbeat stops and the HAT's hardware
//! watchdog switches the outputs off (ARCHITECTURE 4.1, 4.2). And it
//! doesn't replace the overtemperature protections of the system itself
//! (safety valve, expansion vessel).
//!
//! **Where the safe state is "off".** For the solar pump, "off" is safe in
//! every case handled here. That is not true for every output in general
//! (ARCHITECTURE 4.2: safe states are per output); other outputs will get
//! their own supervisor functions.
#![cfg_attr(not(test), no_std)]

use costos_core::{Celsius, Duty, Kelvin, Reading, Seconds};

/// Highest collector emergency limit that can be configured. Lower is
/// allowed, higher is not (ARCHITECTURE 7.3: hard safety limits are not
/// configurable upwards).
///
/// 130 °C is the "about 130 °C" of ARCHITECTURE 4.2, as on the BX Plus
/// (collector emergency shutdown). Above it, the glycol in a stagnating
/// collector can flash to steam when cold fluid is pumped in, which
/// stresses the pump, the expansion vessel and the fluid.
pub const HARD_COLLECTOR_EMERGENCY: Celsius = Celsius::from_const(130.0);

/// Highest store emergency limit that can be configured.
///
/// 95 °C is the example of ARCHITECTURE 4.2: well below boiling at the
/// store's pressure, and the point above which a store full of
/// near-boiling water is a scalding risk at every tap. The normal store
/// maximum (60–85 °C) is a control function in `costos-core` and stops
/// loading much earlier; this limit only catches what gets past it.
pub const HARD_STORE_EMERGENCY: Celsius = Celsius::from_const(95.0);

/// Settings of the supervisor for the solar pump.
///
/// Validated by [`SafetyConfig::validate`] before they are applied; the
/// config crate refuses anything above the hard limits.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SafetyConfig {
    /// Collector temperature that forces the pump off, at most
    /// [`HARD_COLLECTOR_EMERGENCY`].
    pub collector_emergency: Celsius,
    /// Store temperature (the hottest store sensor) that forces the pump
    /// off, at most [`HARD_STORE_EMERGENCY`].
    pub store_emergency: Celsius,
    /// How far a temperature must fall below its limit before the pump
    /// may run again. Without it, a collector hovering at 130 °C would
    /// switch the pump on and off every second.
    pub restart_hysteresis: Kelvin,
    /// Shortest time the pump stays off after stopping. Limits how often
    /// the pump can start (ARCHITECTURE 4.2: switching rate limits), so a
    /// fault elsewhere can't wear out the pump by toggling it.
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
    ///
    /// 10 K: the collector must cool from 130 °C to 120 °C before the pump
    /// restarts, well away from the steam risk. 60 s: at most one start a
    /// minute, which a pump tolerates for years. Both are starting values,
    /// to be checked during shadow mode.
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
///
/// The `Default` (the state at a start or restart of the daemon) is
/// "**both emergencies latched**, never stopped, output 0 %".
///
/// Why start latched (ARCHITECTURE 4.2): the latches are not stored on
/// disk. If they started released, a restart while the collector is
/// still cooling down from stagnation (say 125 °C, inside the hysteresis
/// band below 130 °C) would let the pump start again at once, which is
/// exactly what the hysteresis is there to prevent. Starting latched
/// costs nothing in the normal case: a cool collector and store release
/// both latches in the very first cycle, because they are below the
/// release point. And with a sensor still unknown at start-up, the pump
/// is off anyway, and the latch waits for a real reading.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SupervisorState {
    /// Collector emergency active: set at the limit, released only after
    /// cooling by the hysteresis.
    collector_latched: bool,
    /// Store emergency active, same logic.
    store_latched: bool,
    /// When the output last went to 0 %, if it did since the start.
    stopped_at: Option<Seconds>,
    /// The output of the previous cycle, to detect the moment of a stop.
    last_output: Duty,
}

impl Default for SupervisorState {
    /// The state at a start or restart: both emergencies latched (see
    /// the type's documentation for why), no stop recorded, output off.
    fn default() -> Self {
        Self {
            collector_latched: true,
            store_latched: true,
            // No stop recorded: the minimum off time does not apply to
            // the first start. The pump was either off already, or it
            // was running when the daemon stopped and the hardware
            // watchdog has switched it off since; in both cases it is
            // off for at least the restart time.
            stopped_at: None,
            last_output: Duty::OFF,
        }
    }
}

/// The readings the supervisor looks at in one cycle.
///
/// The same readings the control core used, already range-checked. The
/// supervisor deliberately gets the raw readings, not the core's
/// smoothed ΔT: its checks must not depend on the core's logic.
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
    /// Store top sensor, if one is configured: `None` = not configured
    /// (fine), `Some(Err(..))` = configured but faulty (pump off).
    pub store_top: Option<Reading>,
}

/// Which rules reduced the output in this cycle. Several can apply at
/// once; all of them are reported, so the web interface and the metrics
/// show every reason, not just the first one found.
///
/// The daemon logs a change as an event (ARCHITECTURE 6.4: every safety
/// intervention is logged).
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
///
/// Why a missing value keeps the latch: a collector at 135 °C whose
/// sensor then fails must not count as "cooled down". The pump is off
/// anyway while the sensor is unknown (see `sensor_unknown`), and when
/// the reading returns, the latch still holds until it is really below
/// the release point.
fn latch(latched: bool, value: Option<Celsius>, limit: Celsius, hysteresis: Kelvin) -> bool {
    let Some(t) = value else { return latched };
    // At or above the limit: latch, whatever the previous state was.
    // Checked first, so a restart with a hot collector latches at once.
    if t >= limit {
        return true;
    }
    match limit.plus(hysteresis.negated()) {
        Some(release) if t <= release => false,
        // Below the limit but not cooled enough: stay as it was.
        Some(_) => latched,
        // Release point below absolute zero (a hysteresis larger than the
        // limit, which validation should prevent): cooling can never
        // release it. Keeping the latch is the safe reading of that.
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

    // Faults become "no value" here; each check below decides what a
    // missing value means for it.
    let collector = inputs.collector.ok();
    let store_bottom = inputs.store_bottom.ok();
    let store_top = inputs.store_top.map(|r| r.ok());

    // ARCHITECTURE 4.2: a faulty sensor counts as unknown, never as cold.
    // With the collector or the store unknown, neither limit below can be
    // checked, so the pump must stop. An unconfigured store top
    // (`None`) is fine; a configured but faulty one (`Some(None)`) is not.
    why.sensor_unknown =
        collector.is_none() || store_bottom.is_none() || matches!(store_top, Some(None));

    let collector_latched = latch(
        state.collector_latched,
        collector,
        config.collector_emergency,
        config.restart_hysteresis,
    );
    why.collector_emergency = collector_latched;

    // The store limit applies to its hottest point, normally the top:
    // the bottom sensor can be 30 K colder than the top in a stratified
    // store, so checking only the bottom could miss a boiling top.
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

    // Minimum off time: only while the output is still off since the
    // last stop, and only if the core now wants the pump on (otherwise
    // there is nothing to hold back, and nothing to report).
    // `saturating_since` (rule 17): a stop time in the future counts as
    // "just stopped", so the pump stays off a little longer, the safe
    // direction.
    let in_min_off = state.last_output.is_off()
        && state
            .stopped_at
            .is_some_and(|at| inputs.now.saturating_since(at) < config.min_off);
    why.min_off_time = in_min_off && !inputs.requested.is_off();

    // Every rule here is a stop rule, so any intervention means 0 %.
    // (A later "cap the speed" rule would lower `allowed` instead.)
    let allowed = if why.any() {
        Duty::OFF
    } else {
        inputs.requested
    };
    // The one guarantee: never more than was asked for. Redundant with
    // the line above today, kept on purpose so that a future rule that
    // computes `allowed` differently can't break the promise.
    let output = if allowed > inputs.requested {
        inputs.requested
    } else {
        allowed
    };

    // Remember the moment the output went from running to 0 %, whatever
    // the reason (the core stopped, or a rule here forced it). The
    // minimum off time then applies to every restart.
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

    /// The shipped defaults are valid; the hard limits can't be raised,
    /// only lowered (ARCHITECTURE 7.3).
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

    /// A normal sunny moment: nothing to do, the request passes
    /// unchanged and nothing is reported.
    #[test]
    fn passes_a_normal_request_through() {
        let (_, out, why) = sup(
            SupervisorState::default(),
            &inputs(0, Duty::FULL, c(60.0), c(40.0)),
        );
        assert_eq!(out, Duty::FULL);
        assert!(!why.any());
    }

    /// Stagnation: at 130 °C the pump is forced off; at 125 °C it stays
    /// off (inside the hysteresis); only at 120 °C may it run again.
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

    /// A stratified store: the bottom is at 60 °C, but the top is at
    /// 96 °C. The limit must see the top.
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

    /// Each required sensor failing on its own forces the pump off:
    /// collector, store bottom, and a configured store top.
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

    /// A hot collector whose sensor then fails must not count as cooled:
    /// when the reading returns at 126 °C, the emergency still holds.
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

    /// Restart while the collector cools down from stagnation: the new
    /// state starts latched, so at 125 °C (inside the hysteresis band)
    /// the pump stays off; at 120 °C it may run.
    #[test]
    fn restart_inside_the_hysteresis_band_keeps_the_pump_off() {
        let s = SupervisorState::default();
        let (s, out, why) = sup(s, &inputs(0, Duty::FULL, c(125.0), c(60.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.collector_emergency);
        let (_, out, why) = sup(s, &inputs(1, Duty::FULL, c(120.0), c(60.0)));
        assert_eq!(out, Duty::FULL);
        assert!(!why.collector_emergency);
    }

    /// Same for the store: restart with the store at 90 °C, inside the
    /// band below 95 °C, keeps the pump off until 85 °C.
    #[test]
    fn restart_with_a_hot_store_keeps_the_pump_off() {
        let s = SupervisorState::default();
        let (s, out, why) = sup(s, &inputs(0, Duty::FULL, c(100.0), c(90.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.store_emergency);
        let (_, out, _) = sup(s, &inputs(1, Duty::FULL, c(100.0), c(85.0)));
        assert_eq!(out, Duty::FULL);
    }

    /// A restart with a sensor still unknown: off, and the latch is not
    /// released by the missing value; the first real reading decides.
    #[test]
    fn restart_with_an_unknown_sensor_waits_for_a_reading() {
        let s = SupervisorState::default();
        let (s, out, _) = sup(
            s,
            &inputs(0, Duty::FULL, Err(SensorFault::Missing), c(60.0)),
        );
        assert_eq!(out, Duty::OFF);
        let (_, out, why) = sup(s, &inputs(1, Duty::FULL, c(126.0), c(60.0)));
        assert_eq!(out, Duty::OFF);
        assert!(why.collector_emergency);
    }

    /// After a stop at t = 10 s, a new request at t = 30 s is held back;
    /// at t = 70 s (60 s later) it passes.
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

    /// Random readings for the property test: mostly temperatures,
    /// including values far outside the limits, sometimes faults.
    fn any_reading() -> impl Strategy<Value = Reading> {
        prop_oneof![
            4 => (-60.0_f32..300.0).prop_map(|v| Ok(Celsius::new(v).unwrap())),
            1 => Just(Err(SensorFault::OpenCircuit)),
            1 => Just(Err(SensorFault::Stale)),
        ]
    }

    proptest! {
        /// The supervisor's one promise: never more than requested, over
        /// any sequence of inputs. Also checks that every intervention
        /// means off, and that a collector at the hard limit or a faulty
        /// collector or store sensor always means off, whatever the
        /// history (latches, minimum off time) was.
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
