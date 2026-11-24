//! Speed control of the solar pump (ARCHITECTURE 6.2).
//!
//! While the ΔT control ([`crate::delta_t`]) says "pump on", this module
//! decides **how fast**: it drives the PWM duty so that the collector stays
//! about [`SpeedConfig::setpoint`] warmer than the store bottom.
//!
//! - ΔT **above** the setpoint: the collector delivers more heat than the
//!   current flow carries away, so the pump speeds up.
//! - ΔT **below** the setpoint: the flow is more than needed, so it slows
//!   down, but never below [`SpeedConfig::min`]; switching the pump *off*
//!   stays the ΔT control's job.
//!
//! **Defaults, and why** (ARCHITECTURE 8.2, yield simulation): setpoint
//! **10 K** (as good as 8 K for the yield, the RESOL default and what the
//! BX Plus does, so shadow mode compares like with like), minimum **30 %**
//! (30–50 % are equal for the yield, below 30 % loses heat in the 2 × 25 m
//! of pipe; the BX was switched from 20 to 30 % on 2026-09-16). A dynamic
//! setpoint was simulated and gains nothing, so the setpoint is fixed.
//!
//! **Two controllers**, chosen by [`SpeedMode`]:
//!
//! - [`SpeedMode::Pi`] (default): a PI controller. The proportional part
//!   reacts at once to a change of ΔT, the integral part removes the
//!   remaining offset slowly. The integral is clamped to the speed range
//!   (anti-windup, ARCHITECTURE 6.1 rule 19): after an hour at full speed
//!   it can't have grown so far that the pump stays at 100 % for minutes
//!   after ΔT has dropped.
//! - [`SpeedMode::Steps`]: what the BX Plus does according to the replay
//!   data: one small step (1 %) at a fixed interval (about 30 s) whenever
//!   ΔT is outside a band around the setpoint. Slower and coarser, but it
//!   lets replay and shadow mode compare speed with the BX like for like.
//!
//! **Start.** A start (the ΔT control switching on) first runs the pump's
//! [`StartProfile`]: *kick* holds 100 % for [`SpeedConfig::kick`], *ramp*
//! climbs from 0 to the minimum in steps, *soft kick* climbs to 100 %,
//! holds it for [`SpeedConfig::kick`] and then hands over. Control then
//! begins at the minimum speed, as the BX does.
//!
//! **Where it sits:** ΔT control → speed control → anti-seize/purge
//! ([`crate::anti_seize`]) → supervisor → PWM. The supervisor can still
//! cut everything; this module never sees a sensor reading directly, only
//! the smoothed ΔT the ΔT control already worked out.
//!
//! **Time step.** One call per control cycle (1 s, rule 8). The PI integral
//! uses the real time since the last call, capped at [`MAX_DT`], so a
//! stalled daemon doesn't produce one huge integration step.

use crate::output::Duty;
use crate::start_profile::{StartProfile, StartProfileError};
use crate::temperature::Kelvin;
use crate::time::Seconds;

/// Longest time step the PI integral accepts in one call. Normally a call
/// comes every second; after a pause (daemon stalled, clock jump) the
/// integral only moves as if 5 s had passed.
pub const MAX_DT: Seconds = Seconds::new(5);

/// How the speed follows ΔT.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum SpeedMode {
    /// PI controller. Output = `kp` · error + integral, where error = ΔT −
    /// setpoint in kelvin, and the integral grows by `ki` · error per
    /// second.
    Pi {
        /// Proportional gain in % per K: how much faster at once for each
        /// kelvin above the setpoint.
        kp: f32,
        /// Integral gain in % per K per second: how fast the remaining
        /// offset is worked off. 0.02 means 1 % per 25 s at 2 K off.
        ki: f32,
    },
    /// BX-like steps: every `interval`, one `step` up if ΔT is more than
    /// `band` above the setpoint, one down if more than `band` below.
    Steps {
        /// Step size in %, 1–100.
        step: u8,
        /// Time between steps.
        interval: Seconds,
        /// Dead band around the setpoint, in kelvin, ≥ 0.
        band: Kelvin,
    },
}

/// Settings of the speed control.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct SpeedConfig {
    /// ΔT (collector minus store bottom) to hold.
    pub setpoint: Kelvin,
    /// Lowest speed while running, and the speed control starts at.
    pub min: Duty,
    /// Highest speed while controlling (a start profile may still use 100 %).
    pub max: Duty,
    /// PI or BX-like steps.
    pub mode: SpeedMode,
    /// How a start begins.
    pub profile: StartProfile,
    /// How long *kick* and *soft kick* hold 100 % at a start.
    pub kick: Seconds,
}

/// Why a [`SpeedConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpeedConfigError {
    /// The setpoint must be above 0 K: holding the collector *colder* than
    /// the store would mean pumping heat out of the store.
    SetpointNotPositive,
    /// The minimum must be above 0 % (0 % is "off", the ΔT control's job)
    /// and not above the maximum.
    BadRange,
    /// A PI gain is negative or not a number.
    BadGain,
    /// Steps: step size outside 1–100 %, interval zero or band negative.
    BadSteps,
    /// The start profile is not valid.
    Profile(StartProfileError),
}

impl SpeedConfig {
    /// Defaults from ARCHITECTURE 6.2 and 8.2: setpoint 10 K, 30–100 %, PI
    /// with 2 %/K and 0.02 %/(K·s), kick start for 5 s.
    ///
    /// The PI gains are chosen to be about as calm as the BX: at 2 K off
    /// the integral moves 1 % every 25 s (the BX: 1 % every 10–170 s, median
    /// 39 s), and the proportional part adds 2 % per kelvin at once.
    pub const DEFAULT: Self = Self {
        setpoint: Kelvin::from_const(10.0),
        min: Duty::clamped(30),
        max: Duty::FULL,
        mode: SpeedMode::Pi { kp: 2.0, ki: 0.02 },
        profile: StartProfile::Kick,
        kick: Seconds::new(5),
    };

    /// A BX-like configuration for replay and shadow mode: 1 % every 30 s
    /// outside a ±1 K band, starting at `min` without a kick (the BX starts
    /// at its minimum speed, replay data 8.1).
    #[must_use]
    pub const fn bx_like(min: Duty) -> Self {
        Self {
            setpoint: Kelvin::from_const(10.0),
            min,
            max: Duty::FULL,
            mode: SpeedMode::Steps {
                step: 1,
                interval: Seconds::new(30),
                band: Kelvin::from_const(1.0),
            },
            // A ramp from 0 at 100 %/s reaches any minimum in the first
            // second: in effect "start at the minimum", as the BX does.
            profile: StartProfile::Ramp {
                percent_per_second: 100,
            },
            kick: Seconds::ZERO,
        }
    }

    /// Checks the settings.
    pub fn validate(&self) -> Result<(), SpeedConfigError> {
        if self.setpoint.get() <= 0.0 {
            return Err(SpeedConfigError::SetpointNotPositive);
        }
        if self.min.is_off() || self.min > self.max {
            return Err(SpeedConfigError::BadRange);
        }
        match self.mode {
            SpeedMode::Pi { kp, ki } => {
                // A NaN fails both `is_finite` and `>= 0.0`.
                let ok = |g: f32| g.is_finite() && g >= 0.0;
                if !ok(kp) || !ok(ki) {
                    return Err(SpeedConfigError::BadGain);
                }
            }
            SpeedMode::Steps {
                step,
                interval,
                band,
            } => {
                if !(1..=100).contains(&step) || interval == Seconds::ZERO || band.get() < 0.0 {
                    return Err(SpeedConfigError::BadSteps);
                }
            }
        }
        self.profile.validate().map_err(SpeedConfigError::Profile)
    }
}

impl Default for SpeedConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// Where in a run the pump is.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
enum Phase {
    /// Not running.
    #[default]
    Off,
    /// Start profile running since this time.
    Starting(Seconds),
    /// Controlling the speed.
    Control,
}

/// State carried from one cycle to the next. `Default` = pump off.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct SpeedState {
    phase: Phase,
    /// PI: the integral part, in % (kept within min..=max).
    /// Steps: the current speed in %.
    level: f32,
    /// Time of the last call (PI) or the last step (Steps).
    last: Seconds,
}

/// What the speed control is doing, for the interface and the log.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SpeedStatus {
    /// Pump off.
    Off,
    /// Start profile (kick, ramp or soft kick).
    Starting,
    /// Controlling; the output is between min and max.
    Controlling,
}

/// A speed in % (any `f32`) as a [`Duty`]: rounded, NaN and negatives give
/// 0 %, everything from 100 % up gives 100 %. Written without `f32::round`,
/// which needs `std`.
fn to_duty(percent: f32) -> Duty {
    // NaN is neither > 0 nor >= 100, so it ends up in the first branch.
    if percent.is_nan() || percent <= 0.0 {
        Duty::OFF
    } else if percent >= 100.0 {
        Duty::FULL
    } else {
        // 0 < percent + 0.5 < 100.5: the cast truncates to 0..=100.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let rounded = (percent + 0.5) as u8;
        Duty::clamped(rounded)
    }
}

/// `value` limited to `lo..=hi` (as `f32::clamp`, but never panics: if
/// `lo > hi`, which `validate` rules out, `lo` wins).
fn limit(value: f32, lo: f32, hi: f32) -> f32 {
    if value > hi {
        hi
    } else if value < lo || value.is_nan() {
        lo
    } else {
        value
    }
}

/// Number of cycles the start profile runs before control begins.
///
/// - Kick: `kick` cycles at 100 %.
/// - Ramp: the cycles the ramp from 0 needs *below* `min` (control then
///   starts at `min`); 0 if one step already reaches it, so the pump
///   starts straight at its minimum, as the BX does.
/// - Soft kick: the ramp cycles below 100 %, then `kick` cycles at 100 %.
///
/// The ramp counts its first cycle as one step, as
/// [`StartProfile::towards_full`] does: at 10 %/s the outputs are 10, 20,
/// 30, …
fn start_cycles(config: &SpeedConfig) -> u64 {
    // Cycles strictly below `target` % for a ramp of `step` %/s.
    let below = |step: u8, target: u8| -> u64 {
        if step == 0 {
            return 0;
        }
        u64::from(target.div_ceil(step)).saturating_sub(1)
    };
    match config.profile {
        StartProfile::Kick => config.kick.get(),
        StartProfile::Ramp { percent_per_second } => {
            below(percent_per_second, config.min.percent())
        }
        StartProfile::SoftKick { percent_per_second } => {
            below(percent_per_second, 100).saturating_add(config.kick.get())
        }
    }
}

/// One control cycle.
///
/// `running` is the ΔT control's decision ([`crate::delta_t::DeltaTOutput::pump_on`]),
/// `delta_t` its smoothed ΔT. Returns the new state, the speed and why.
#[must_use]
pub fn step(
    config: &SpeedConfig,
    state: SpeedState,
    now: Seconds,
    running: bool,
    delta_t: Option<Kelvin>,
) -> (SpeedState, Duty, SpeedStatus) {
    if !running {
        // Off: forget everything, the next start begins from scratch.
        return (SpeedState::default(), Duty::OFF, SpeedStatus::Off);
    }
    let min = f32::from(config.min.percent());
    let max = f32::from(config.max.percent());

    // Start phase: from the first running cycle, the start profile runs
    // for `start_cycles` cycles, then control takes over at the minimum.
    let since = match state.phase {
        Phase::Off => Some(now),
        Phase::Starting(since) => Some(since),
        Phase::Control => None,
    };
    if let Some(since) = since {
        let elapsed = now.saturating_since(since);
        if elapsed.get() < start_cycles(config) {
            let duty = match config.profile {
                StartProfile::Kick => Duty::FULL,
                // The ramp phase ends before it reaches the minimum.
                StartProfile::Ramp { .. } | StartProfile::SoftKick { .. } => {
                    config.profile.towards_full(Duty::OFF, elapsed)
                }
            };
            let new = SpeedState {
                phase: Phase::Starting(since),
                level: min,
                last: now,
            };
            return (new, duty, SpeedStatus::Starting);
        }
        // Start profile over (or none): control begins at the minimum.
        let new = SpeedState {
            phase: Phase::Control,
            level: min,
            last: now,
        };
        return (new, config.min, SpeedStatus::Controlling);
    }

    // Control phase. Without a ΔT (it shouldn't happen while running, the
    // ΔT control stops on a fault) the speed simply holds.
    let error = delta_t.map_or(0.0, |d| d.get() - config.setpoint.get());
    match config.mode {
        SpeedMode::Pi { kp, ki } => {
            let dt = now.saturating_since(state.last);
            let dt = if dt > MAX_DT { MAX_DT } else { dt };
            // u64 seconds to f32: exact for anything up to MAX_DT.
            #[allow(clippy::cast_precision_loss)]
            let dt = dt.get() as f32;
            // Anti-windup: the integral never leaves the speed range, so it
            // can't build up beyond what the pump can do.
            let integral = limit(state.level + ki * error * dt, min, max);
            let out = limit(kp * error + integral, min, max);
            let new = SpeedState {
                phase: Phase::Control,
                level: integral,
                last: now,
            };
            (new, to_duty(out), SpeedStatus::Controlling)
        }
        SpeedMode::Steps {
            step,
            interval,
            band,
        } => {
            let mut level = state.level;
            let mut last = state.last;
            if now.saturating_since(state.last) >= interval {
                last = now;
                if error > band.get() {
                    level = limit(level + f32::from(step), min, max);
                } else if error < -band.get() {
                    level = limit(level - f32::from(step), min, max);
                }
            }
            let new = SpeedState {
                phase: Phase::Control,
                level,
                last,
            };
            (new, to_duty(level), SpeedStatus::Controlling)
        }
    }
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    fn k(v: f32) -> Option<Kelvin> {
        Some(Kelvin::from_const(v))
    }

    /// Runs `n` cycles from `t0` with a constant ΔT; returns the state and
    /// all speeds in %.
    fn run(
        cfg: &SpeedConfig,
        mut s: SpeedState,
        t0: u64,
        n: u64,
        dt: f32,
    ) -> (SpeedState, Vec<u8>) {
        let mut out = Vec::new();
        for t in t0..t0 + n {
            let (ns, d, _) = step(cfg, s, Seconds::new(t), true, k(dt));
            s = ns;
            out.push(d.percent());
        }
        (s, out)
    }

    #[test]
    fn defaults_are_valid() {
        assert_eq!(SpeedConfig::DEFAULT.validate(), Ok(()));
        assert_eq!(SpeedConfig::bx_like(Duty::clamped(30)).validate(), Ok(()));
    }

    #[test]
    fn invalid_settings_are_rejected() {
        let mut c = SpeedConfig::DEFAULT;
        c.setpoint = Kelvin::from_const(0.0);
        assert_eq!(c.validate(), Err(SpeedConfigError::SetpointNotPositive));
        let mut c = SpeedConfig::DEFAULT;
        c.min = Duty::OFF;
        assert_eq!(c.validate(), Err(SpeedConfigError::BadRange));
        c.min = Duty::clamped(80);
        c.max = Duty::clamped(50);
        assert_eq!(c.validate(), Err(SpeedConfigError::BadRange));
        let mut c = SpeedConfig::DEFAULT;
        c.mode = SpeedMode::Pi {
            kp: f32::NAN,
            ki: 0.1,
        };
        assert_eq!(c.validate(), Err(SpeedConfigError::BadGain));
        c.mode = SpeedMode::Steps {
            step: 0,
            interval: Seconds::new(30),
            band: Kelvin::from_const(1.0),
        };
        assert_eq!(c.validate(), Err(SpeedConfigError::BadSteps));
    }

    /// Not running: off, and the state is cleared.
    #[test]
    fn off_when_not_running() {
        let (s, _) = run(&SpeedConfig::DEFAULT, SpeedState::default(), 0, 60, 15.0);
        let (s, d, st) = step(&SpeedConfig::DEFAULT, s, Seconds::new(60), false, k(15.0));
        assert_eq!((d, st), (Duty::OFF, SpeedStatus::Off));
        assert_eq!(s, SpeedState::default());
    }

    /// Kick: 100 % for 5 s, then control from the minimum, 30 %.
    #[test]
    fn kick_start_then_minimum() {
        let (_, out) = run(&SpeedConfig::DEFAULT, SpeedState::default(), 0, 7, 10.0);
        assert_eq!(out, vec![100, 100, 100, 100, 100, 30, 30]);
    }

    /// Ramp at 10 %/s: 10, 20, 30, then control from 30 %.
    #[test]
    fn ramp_start_climbs_to_the_minimum() {
        let cfg = SpeedConfig {
            profile: StartProfile::Ramp {
                percent_per_second: 10,
            },
            ..SpeedConfig::DEFAULT
        };
        let (_, out) = run(&cfg, SpeedState::default(), 0, 6, 10.0);
        assert_eq!(out, vec![10, 20, 30, 30, 30, 30]);
    }

    /// Soft kick at 10 %/s: up to 100 % in 10 s, hold 5 s, then 30 %.
    #[test]
    fn soft_kick_ramps_holds_and_hands_over() {
        let cfg = SpeedConfig {
            profile: StartProfile::SoftKick {
                percent_per_second: 10,
            },
            ..SpeedConfig::DEFAULT
        };
        let (_, out) = run(&cfg, SpeedState::default(), 0, 16, 10.0);
        assert_eq!(&out[..9], &[10, 20, 30, 40, 50, 60, 70, 80, 90]);
        assert_eq!(&out[9..14], &[100, 100, 100, 100, 100]);
        assert_eq!(out[14], 30);
    }

    /// The BX-like configuration starts straight at its minimum.
    #[test]
    fn bx_like_starts_at_the_minimum() {
        let cfg = SpeedConfig::bx_like(Duty::clamped(20));
        let (_, out) = run(&cfg, SpeedState::default(), 0, 3, 10.0);
        assert_eq!(out, vec![20, 20, 20]);
    }

    /// PI: ΔT 4 K above the setpoint makes the pump faster over time;
    /// at the setpoint it holds; below, it falls back, never under 30 %.
    #[test]
    fn pi_follows_the_error_within_the_range() {
        let cfg = SpeedConfig::DEFAULT;
        let (s, out) = run(&cfg, SpeedState::default(), 0, 600, 14.0);
        let after = *out.last().unwrap();
        assert!(after > 70, "{after}");
        let (s, out) = run(&cfg, s, 600, 60, 10.0);
        assert!(
            out.windows(2).all(|w| w[0] == w[1]),
            "holds at the setpoint"
        );
        let (_, out) = run(&cfg, s, 660, 1200, 4.0);
        assert_eq!(*out.last().unwrap(), 30);
        assert!(out.iter().all(|p| *p >= 30));
    }

    /// Anti-windup (rule 19): an hour at ΔT 30 K drives the pump to 100 %,
    /// but when ΔT drops below the setpoint the speed leaves 100 % at once
    /// and is back at the minimum within minutes, not hours.
    #[test]
    fn pi_integral_does_not_wind_up() {
        let cfg = SpeedConfig::DEFAULT;
        let (s, out) = run(&cfg, SpeedState::default(), 0, 3600, 30.0);
        assert_eq!(*out.last().unwrap(), 100);
        let (_, out) = run(&cfg, s, 3600, 900, 6.0);
        assert!(out[0] < 100, "first cycle {}", out[0]);
        assert_eq!(*out.last().unwrap(), 30);
    }

    /// A pause between calls (a stalled daemon) moves the integral as if
    /// only 5 s had passed.
    #[test]
    fn pi_caps_the_time_step() {
        let cfg = SpeedConfig::DEFAULT;
        let (s, _) = run(&cfg, SpeedState::default(), 0, 10, 10.0);
        let (_, d, _) = step(&cfg, s, Seconds::new(10_000), true, k(14.0));
        // 2 %/K * 4 K + (30 + 0.02 * 4 * 5) = 38.4 -> 38 %.
        assert_eq!(d.percent(), 38);
    }

    /// Steps: +1 % every 30 s above the band, nothing inside it, −1 %
    /// below it, never under the minimum.
    #[test]
    fn steps_move_one_percent_per_interval() {
        let cfg = SpeedConfig::bx_like(Duty::clamped(30));
        let (s, out) = run(&cfg, SpeedState::default(), 0, 301, 14.0);
        assert_eq!(*out.last().unwrap(), 40);
        let (s, out) = run(&cfg, s, 301, 300, 10.5);
        assert!(out.iter().all(|p| *p == 40));
        let (_, out) = run(&cfg, s, 601, 3000, 3.0);
        assert_eq!(*out.last().unwrap(), 30);
    }

    proptest! {
        /// Whatever ΔT does: off when not running; while running the speed
        /// is the start profile or between min and max.
        #[test]
        fn output_stays_in_range(
            dts in proptest::collection::vec(-20.0_f32..60.0, 1..400),
            onoff in proptest::collection::vec(any::<bool>(), 1..400),
        ) {
            let cfg = SpeedConfig::DEFAULT;
            let mut s = SpeedState::default();
            for (i, dt) in dts.iter().enumerate() {
                let running = onoff.get(i % onoff.len()).copied().unwrap_or(true);
                let t = u64::try_from(i).unwrap();
                let (ns, d, st) = step(&cfg, s, Seconds::new(t), running, k(*dt));
                s = ns;
                match st {
                    SpeedStatus::Off => prop_assert!(d.is_off()),
                    // Kick: the start is 100 %.
                    SpeedStatus::Starting => prop_assert!(d == Duty::FULL),
                    SpeedStatus::Controlling => prop_assert!(d >= cfg.min && d <= cfg.max),
                }
            }
        }
    }
}
