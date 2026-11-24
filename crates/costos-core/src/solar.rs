//! One control cycle of the solar pump: all control functions in their
//! order (ARCHITECTURE 6.2).
//!
//! Each function lives in its own module and is tested on its own. This
//! module only wires them together, so that the daemon (milestone 4) and the
//! simulation tests (`costos-sim`, milestone 2) run exactly the same chain:
//!
//! ```text
//! readings ─► ΔT control ─┐
//!                         AND ─► speed control ─► anti-seize / purge ─► requested duty
//! readings ─► store max ──┘
//! ```
//!
//! 1. **ΔT control** ([`crate::delta_t`]): should the pump run at all?
//!    (switch-on/off differences, flow/return switch-off, minimum run time,
//!    collector minimum, sensor faults.)
//! 2. **Store maximum** ([`crate::store_max`]): is the store full? Its
//!    answer is ANDed with step 1: the pump runs only if the ΔT control
//!    wants it **and** the store is not full.
//! 3. **Speed control** ([`crate::speed`]): how fast, including the start
//!    profile.
//! 4. **Anti-seize and purge** ([`crate::anti_seize`]): may raise the speed
//!    to 100 % (purge at a start) or run an idle pump briefly at midday.
//!
//! The result is the **requested** duty. It is *not* the output: the
//! safety supervisor in `costos-safety` comes after this and can only
//! reduce it (ARCHITECTURE 4.2). `costos-core` doesn't depend on
//! `costos-safety`, so the daemon or the simulation calls the supervisor
//! with this module's result; keeping them apart means a mistake here can't
//! bypass a protection there.
//!
//! **A note on the anti-seize run and a full store.** The anti-seize run
//! comes after the store maximum, so it can still turn an idle pump for
//! 10 s at midday when the store is full. That is intended: 10 s move a
//! few litres and almost no heat, and a pump that never turns is the
//! bigger risk. The supervisor still blocks it in an emergency.

use crate::anti_seize::{
    self, AntiSeizeConfig, AntiSeizeConfigError, AntiSeizeState, AntiSeizeStatus,
};
use crate::delta_t::{
    self, DeltaTConfig, DeltaTConfigError, DeltaTOutput, DeltaTState, FlowReturn,
};
use crate::output::Duty;
use crate::sensor::Reading;
use crate::speed::{self, SpeedConfig, SpeedConfigError, SpeedState, SpeedStatus};
use crate::store_max::{self, StoreMaxConfig, StoreMaxConfigError, StoreMaxState, StoreMaxStatus};
use crate::time::{Seconds, TimeOfDay};

/// All settings of the solar pump's control functions.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SolarConfig {
    /// When to run.
    pub delta_t: DeltaTConfig,
    /// When the store is full.
    pub store_max: StoreMaxConfig,
    /// How fast, and how a start begins.
    pub speed: SpeedConfig,
    /// Anti-seize run and full-speed purge. Its start profile must be the
    /// same as the speed control's (checked by [`Self::validate`]): a pump
    /// has one start profile.
    pub anti_seize: AntiSeizeConfig,
}

/// Why a [`SolarConfig`] is not valid: the first function that complains.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SolarConfigError {
    /// See [`DeltaTConfigError`].
    DeltaT(DeltaTConfigError),
    /// See [`StoreMaxConfigError`].
    StoreMax(StoreMaxConfigError),
    /// See [`SpeedConfigError`].
    Speed(SpeedConfigError),
    /// See [`AntiSeizeConfigError`].
    AntiSeize(AntiSeizeConfigError),
    /// The speed control and the anti-seize/purge use different start
    /// profiles; a pump has only one.
    ProfileMismatch,
}

impl SolarConfig {
    /// Defaults of every function.
    pub const DEFAULT: Self = Self {
        delta_t: DeltaTConfig::DEFAULT,
        store_max: StoreMaxConfig::DEFAULT,
        speed: SpeedConfig::DEFAULT,
        anti_seize: AntiSeizeConfig::DEFAULT,
    };

    /// Checks every function's settings and that they fit together.
    pub fn validate(&self) -> Result<(), SolarConfigError> {
        self.delta_t.validate().map_err(SolarConfigError::DeltaT)?;
        self.store_max
            .validate()
            .map_err(SolarConfigError::StoreMax)?;
        self.speed.validate().map_err(SolarConfigError::Speed)?;
        self.anti_seize
            .validate()
            .map_err(SolarConfigError::AntiSeize)?;
        if self.speed.profile != self.anti_seize.profile {
            return Err(SolarConfigError::ProfileMismatch);
        }
        Ok(())
    }
}

impl Default for SolarConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// The inputs of one cycle. The daemon (or the simulation) fills it from
/// the sensors and its clocks; every reading is already checked against its
/// plausible range ([`crate::sensor::PlausibleRange`]).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SolarInputs {
    /// Monotonic seconds (rule 2).
    pub now: Seconds,
    /// Local time of day, for the anti-seize window.
    pub time_of_day: TimeOfDay,
    /// Collector sensor (S1).
    pub collector: Reading,
    /// Store bottom (S2): ΔT reference and, in the reference installation,
    /// the store maximum's sensor.
    pub store_bottom: Reading,
    /// The store maximum's sensor if it is not the store bottom; `None`
    /// means the store bottom is used.
    pub store_max_sensor: Option<Reading>,
    /// Flow and return (S4, S5) if the flow/return switch-off is
    /// configured.
    pub flow_return: Option<FlowReturn>,
}

/// State of all functions, carried from one cycle to the next.
/// `Default` is a fresh start.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct SolarState {
    delta_t: DeltaTState,
    store_max: StoreMaxState,
    speed: SpeedState,
    anti_seize: AntiSeizeState,
}

/// What one cycle decided, and why, function by function.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SolarOutput {
    /// The duty asked of the supervisor.
    pub requested: Duty,
    /// The ΔT control's decision and the ΔT it used.
    pub delta_t: DeltaTOutput,
    /// The store maximum's verdict.
    pub store_max: StoreMaxStatus,
    /// Whether the pump runs after the AND of ΔT control and store max.
    pub running: bool,
    /// The speed control's phase.
    pub speed: SpeedStatus,
    /// What the anti-seize/purge did.
    pub anti_seize: AntiSeizeStatus,
}

/// One control cycle of the solar pump. See the module documentation for
/// the order.
#[must_use]
pub fn step(
    config: &SolarConfig,
    state: SolarState,
    inputs: &SolarInputs,
) -> (SolarState, SolarOutput) {
    let (delta_t_state, delta_t_out) = delta_t::step(
        &config.delta_t,
        state.delta_t,
        inputs.now,
        inputs.collector,
        inputs.store_bottom,
        inputs.flow_return,
    );
    let max_reading = inputs.store_max_sensor.unwrap_or(inputs.store_bottom);
    let (store_max_state, store_max_status) =
        store_max::step(&config.store_max, state.store_max, max_reading);

    // The pump runs only if the ΔT control wants it and the store isn't full.
    let running = delta_t_out.pump_on && store_max_status.allows_loading();

    let (speed_state, speed_duty, speed_status) = speed::step(
        &config.speed,
        state.speed,
        inputs.now,
        running,
        delta_t_out.delta_t,
    );
    let (anti_seize_state, requested, anti_seize_status) = anti_seize::step(
        &config.anti_seize,
        state.anti_seize,
        inputs.now,
        inputs.time_of_day,
        speed_duty,
    );

    (
        SolarState {
            delta_t: delta_t_state,
            store_max: store_max_state,
            speed: speed_state,
            anti_seize: anti_seize_state,
        },
        SolarOutput {
            requested,
            delta_t: delta_t_out,
            store_max: store_max_status,
            running,
            speed: speed_status,
            anti_seize: anti_seize_status,
        },
    )
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use crate::sensor::SensorFault;
    use crate::temperature::Celsius;

    fn c(v: f32) -> Reading {
        Ok(Celsius::from_const(v))
    }

    fn inputs(t: u64, collector: Reading, store: Reading) -> SolarInputs {
        SolarInputs {
            now: Seconds::new(t),
            // Night, so the anti-seize window never opens in these tests.
            time_of_day: TimeOfDay::MIDNIGHT,
            collector,
            store_bottom: store,
            store_max_sensor: None,
            flow_return: None,
        }
    }

    /// A state in which the anti-seize run and the purge are not due, so
    /// the tests see the plain control chain.
    fn settled() -> SolarState {
        let cfg = SolarConfig::DEFAULT;
        let mut s = SolarState::default();
        // One cycle at 100 % marks "ran at full speed now".
        let (a, _, _) = anti_seize::step(
            &cfg.anti_seize,
            s.anti_seize,
            Seconds::new(0),
            TimeOfDay::MIDNIGHT,
            Duty::FULL,
        );
        s.anti_seize = a;
        s
    }

    fn run(
        cfg: &SolarConfig,
        mut s: SolarState,
        t0: u64,
        n: u64,
        col: f32,
        store: f32,
    ) -> (SolarState, SolarOutput) {
        let mut out = None;
        for t in t0..t0 + n {
            let (ns, o) = step(cfg, s, &inputs(t, c(col), c(store)));
            s = ns;
            out = Some(o);
        }
        (s, out.unwrap())
    }

    #[test]
    fn defaults_are_valid() {
        assert_eq!(SolarConfig::DEFAULT.validate(), Ok(()));
    }

    /// A pump has one start profile: different profiles in speed control
    /// and anti-seize are rejected.
    #[test]
    fn profiles_must_match() {
        let mut cfg = SolarConfig::DEFAULT;
        cfg.anti_seize.profile = crate::start_profile::StartProfile::Ramp {
            percent_per_second: 10,
        };
        assert_eq!(cfg.validate(), Err(SolarConfigError::ProfileMismatch));
    }

    /// Warm collector, cool store: the chain runs the pump, first with the
    /// kick, then at the minimum.
    #[test]
    fn runs_when_the_collector_is_warm() {
        let cfg = SolarConfig::DEFAULT;
        let (_, o) = run(&cfg, settled(), 10, 60, 60.0, 40.0);
        assert!(o.running);
        assert!(o.requested >= cfg.speed.min);
    }

    /// The store maximum overrides the ΔT control: a hot collector over a
    /// full store gives no loading.
    #[test]
    fn full_store_stops_loading() {
        let cfg = SolarConfig::DEFAULT;
        let (_, o) = run(&cfg, settled(), 10, 60, 90.0, 61.0);
        assert!(o.delta_t.pump_on, "the ΔT control alone would run");
        assert_eq!(o.store_max, StoreMaxStatus::Reached);
        assert!(!o.running);
        assert!(o.requested.is_off());
    }

    /// A separate store maximum sensor is used when given.
    #[test]
    fn separate_store_max_sensor() {
        let cfg = SolarConfig::DEFAULT;
        let mut s = settled();
        let mut last = None;
        for t in 10..70 {
            let mut i = inputs(t, c(70.0), c(40.0));
            i.store_max_sensor = Some(c(65.0));
            let (ns, o) = step(&cfg, s, &i);
            s = ns;
            last = Some(o);
        }
        assert!(!last.unwrap().running);
    }

    /// A collector fault stops everything.
    #[test]
    fn sensor_fault_stops_the_pump() {
        let cfg = SolarConfig::DEFAULT;
        let (s, _) = run(&cfg, settled(), 10, 60, 60.0, 40.0);
        let (_, o) = step(&cfg, s, &inputs(70, Err(SensorFault::OpenCircuit), c(40.0)));
        assert!(o.requested.is_off());
    }
}
