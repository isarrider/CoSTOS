//! Store maximum: stop loading when the store is full (ARCHITECTURE 6.2).
//!
//! When the store reaches [`StoreMaxConfig::max`], solar loading stops,
//! even if the collector is still much hotter. Loading resumes once the
//! store has cooled to `max − hysteresis`. This is an **ordinary limit**,
//! not an emergency: it keeps the hot water at a sensible temperature,
//! limits limescale and losses, and keeps a margin to the store's own
//! limit of 95 °C. The **emergency** stop at the hard limit is a separate,
//! latching function of the safety supervisor in `costos-safety` (4.2),
//! which acts even if this one is set too high or fails.
//!
//! **Which sensor.** The store sensor the config names; in the reference
//! installation, as on the BX Plus, the store bottom S2 (installation.md).
//! The bottom is where the solar coil sits, so "bottom at max" means the
//! solar part of the store is full.
//!
//! **Defaults, and why.** 60 °C (the RESOL factory value) with 2 K
//! hysteresis (also the RESOL value). Settable from 20 to 90 °C; the store
//! itself is rated for 95 °C, and the supervisor's emergency limit sits at
//! up to 95 °C above whatever is set here.
//!
//! **Sensor fault.** An unknown store temperature blocks loading: a store
//! that *might* be full is treated as full. With the store-bottom sensor
//! the ΔT control stops anyway; this matters when the store maximum uses a
//! different sensor than the ΔT control.
//!
//! **Where it sits.** Its output is ANDed with the ΔT control's decision
//! before the speed control (6.2): pump on = ΔT says on **and** the store
//! is not full.

use crate::sensor::{Reading, SensorFault};
use crate::temperature::{Celsius, Kelvin};

/// Settings of the store maximum.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct StoreMaxConfig {
    /// Loading stops when the store reaches this temperature.
    pub max: Celsius,
    /// Loading resumes once the store is this much below `max`.
    pub hysteresis: Kelvin,
}

/// Why a [`StoreMaxConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreMaxConfigError {
    /// `max` outside 20–90 °C: below 20 °C solar could hardly load at all,
    /// above 90 °C there is no margin left to the store's 95 °C.
    MaxOutOfRange,
    /// The hysteresis must be above 0 K (otherwise the pump chatters at
    /// the limit) and below 20 K.
    HysteresisOutOfRange,
}

impl StoreMaxConfig {
    /// RESOL factory values: 60 °C, 2 K.
    pub const DEFAULT: Self = Self {
        max: Celsius::from_const(60.0),
        hysteresis: Kelvin::from_const(2.0),
    };

    /// Checks the settings.
    pub fn validate(&self) -> Result<(), StoreMaxConfigError> {
        let max = self.max.get();
        if !(20.0..=90.0).contains(&max) {
            return Err(StoreMaxConfigError::MaxOutOfRange);
        }
        let h = self.hysteresis.get();
        if h <= 0.0 || h >= 20.0 {
            return Err(StoreMaxConfigError::HysteresisOutOfRange);
        }
        Ok(())
    }
}

impl Default for StoreMaxConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// State carried from one cycle to the next.
///
/// `Default` is "not reached". After a restart with a full store, the
/// first cycle sees the temperature at or above `max` and blocks at once,
/// so no state needs to survive a restart.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct StoreMaxState {
    /// The maximum was reached and the store hasn't cooled by the
    /// hysteresis yet.
    reached: bool,
}

/// Result of one cycle.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StoreMaxStatus {
    /// Below the maximum: loading allowed.
    Below,
    /// Maximum reached, or not yet cooled by the hysteresis: loading
    /// blocked. Shown as the notice "store maximum reached" (6.3).
    Reached,
    /// Store temperature unknown: loading blocked.
    SensorFault(SensorFault),
}

impl StoreMaxStatus {
    /// Whether solar loading is allowed.
    #[must_use]
    pub const fn allows_loading(self) -> bool {
        matches!(self, Self::Below)
    }
}

/// One control cycle: `store` is the store sensor's reading, already
/// checked against its plausible range.
#[must_use]
pub fn step(
    config: &StoreMaxConfig,
    state: StoreMaxState,
    store: Reading,
) -> (StoreMaxState, StoreMaxStatus) {
    let t = match store {
        Ok(t) => t,
        // Unknown: blocked, but the hysteresis state is kept, so a short
        // fault in the middle of a "reached" phase doesn't reset it.
        Err(fault) => return (state, StoreMaxStatus::SensorFault(fault)),
    };
    let reached = if state.reached {
        // Stays blocked until the store has cooled to max − hysteresis.
        // `plus` with a negated hysteresis; if that were out of range
        // (validate rules it out) the limit is `max` itself.
        let resume = config
            .max
            .plus(config.hysteresis.negated())
            .unwrap_or(config.max);
        t > resume
    } else {
        t >= config.max
    };
    let status = if reached {
        StoreMaxStatus::Reached
    } else {
        StoreMaxStatus::Below
    };
    (StoreMaxState { reached }, status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn c(v: f32) -> Reading {
        Ok(Celsius::from_const(v))
    }

    #[test]
    fn defaults_are_valid() {
        assert_eq!(StoreMaxConfig::DEFAULT.validate(), Ok(()));
    }

    #[test]
    fn invalid_settings_are_rejected() {
        let mut cfg = StoreMaxConfig::DEFAULT;
        cfg.max = Celsius::from_const(92.0);
        assert_eq!(cfg.validate(), Err(StoreMaxConfigError::MaxOutOfRange));
        let mut cfg = StoreMaxConfig::DEFAULT;
        cfg.hysteresis = Kelvin::from_const(0.0);
        assert_eq!(
            cfg.validate(),
            Err(StoreMaxConfigError::HysteresisOutOfRange)
        );
    }

    /// Blocks at 60 °C, stays blocked down to 58 °C exclusive, resumes at
    /// 58 °C.
    #[test]
    fn blocks_at_max_and_resumes_after_the_hysteresis() {
        let cfg = StoreMaxConfig::DEFAULT;
        let (s, st) = step(&cfg, StoreMaxState::default(), c(59.9));
        assert_eq!(st, StoreMaxStatus::Below);
        let (s, st) = step(&cfg, s, c(60.0));
        assert_eq!(st, StoreMaxStatus::Reached);
        let (s, st) = step(&cfg, s, c(58.5));
        assert_eq!(st, StoreMaxStatus::Reached);
        let (_, st) = step(&cfg, s, c(58.0));
        assert_eq!(st, StoreMaxStatus::Below);
        assert!(st.allows_loading());
    }

    /// After a restart with a full store, the first cycle blocks.
    #[test]
    fn full_store_after_restart_blocks_at_once() {
        let (_, st) = step(&StoreMaxConfig::DEFAULT, StoreMaxState::default(), c(75.0));
        assert!(!st.allows_loading());
    }

    /// An unknown temperature blocks, and a short fault while blocked
    /// doesn't reset the hysteresis.
    #[test]
    fn sensor_fault_blocks_and_keeps_the_state() {
        let cfg = StoreMaxConfig::DEFAULT;
        let (s, _) = step(&cfg, StoreMaxState::default(), c(61.0));
        let (s, st) = step(&cfg, s, Err(SensorFault::OpenCircuit));
        assert_eq!(st, StoreMaxStatus::SensorFault(SensorFault::OpenCircuit));
        assert!(!st.allows_loading());
        let (_, st) = step(&cfg, s, c(59.0));
        assert_eq!(st, StoreMaxStatus::Reached);
    }

    proptest! {
        /// Whatever the history: at or above the maximum, loading is never
        /// allowed.
        #[test]
        fn never_loads_at_or_above_max(temps in proptest::collection::vec(0.0_f32..95.0, 1..300)) {
            let cfg = StoreMaxConfig::DEFAULT;
            let mut s = StoreMaxState::default();
            for t in temps {
                let (ns, st) = step(&cfg, s, c(t));
                s = ns;
                if t >= 60.0 {
                    prop_assert!(!st.allows_loading());
                }
            }
        }
    }
}
