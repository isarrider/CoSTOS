//! Start profiles: how a pump gets from standstill (or a low speed) to
//! the speed it should run at (ARCHITECTURE 6.2).
//!
//! Three profiles, one setting per pump:
//!
//! | Profile | Normal start | Anti-seize run and full-speed purge |
//! |---|---|---|
//! | [`StartProfile::Kick`] (default) | 100 % for a few seconds, then control | jump straight to 100 % |
//! | [`StartProfile::Ramp`] | from the start value up in steps to the control value | ramp up to 100 %, then hold |
//! | [`StartProfile::SoftKick`] | ramp up to 100 %, hold a few seconds, then control | ramp up to 100 %, then hold |
//!
//! **Why three.** A sudden start is what moves trapped air out of the
//! loop, so *kick* is the default. Some installations knock or bang on a
//! hard start (check valves, gravity brakes, loose pipes); there *ramp*
//! (DiSoCon2's soft start) avoids it, and *soft kick* combines both: no
//! bang, but still a short time at full flow.
//!
//! The pump motor itself doesn't need a ramp: high-efficiency pumps
//! usually soft-start their motor internally whatever the PWM signal
//! does. The profile is about the hydraulics.
//!
//! This module only holds the setting and the ramp arithmetic. The normal
//! start uses it in the speed control (milestone 1, still open); the
//! anti-seize run and the purge use it already ([`crate::anti_seize`]).

use crate::output::Duty;
use crate::time::Seconds;

/// How a pump starts. See the module documentation for the table.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum StartProfile {
    /// Straight to 100 %.
    #[default]
    Kick,
    /// Up in steps of `percent_per_second`, never above the target.
    Ramp {
        /// Increase per second (per control cycle), 1–100 %.
        percent_per_second: u8,
    },
    /// Up in steps of `percent_per_second` to 100 %, hold, then control.
    SoftKick {
        /// Increase per second (per control cycle), 1–100 %.
        percent_per_second: u8,
    },
}

/// Why a [`StartProfile`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum StartProfileError {
    /// A ramp of 0 % per second would never get anywhere; above 100 % per
    /// second isn't a ramp either.
    StepOutOfRange,
}

impl StartProfile {
    /// The ramp step suggested in ARCHITECTURE 6.2: 10 % per second, so a
    /// ramp from standstill to full speed takes 10 s.
    pub const DEFAULT_STEP: u8 = 10;

    /// Checks the setting.
    pub fn validate(&self) -> Result<(), StartProfileError> {
        match self {
            Self::Kick => Ok(()),
            Self::Ramp { percent_per_second } | Self::SoftKick { percent_per_second } => {
                if (1..=100).contains(percent_per_second) {
                    Ok(())
                } else {
                    Err(StartProfileError::StepOutOfRange)
                }
            }
        }
    }

    /// The duty on the way to full speed, `elapsed` seconds after the
    /// ramp began at `from`.
    ///
    /// - Kick: 100 % at once.
    /// - Ramp and soft kick: `from` plus one step per second, counting
    ///   the first cycle as one step (so the pump already moves in the
    ///   first second), capped at 100 %.
    ///
    /// Used where the target is full speed (anti-seize run, purge, the
    /// first phase of soft kick). Saturating arithmetic throughout
    /// (rule 7): a huge `elapsed` just means 100 %.
    #[must_use]
    pub fn towards_full(&self, from: Duty, elapsed: Seconds) -> Duty {
        match self {
            Self::Kick => Duty::FULL,
            Self::Ramp { percent_per_second } | Self::SoftKick { percent_per_second } => {
                // Steps taken so far, including this cycle. More than 100
                // steps can never be needed, so the count is capped
                // before the multiplication and fits a u8 product.
                let steps = elapsed.get().saturating_add(1).min(100);
                let steps = u8::try_from(steps).unwrap_or(100);
                let rise = percent_per_second.saturating_mul(steps);
                Duty::clamped(from.percent().saturating_add(rise))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn d(p: u8) -> Duty {
        Duty::new(p).unwrap()
    }

    #[test]
    fn default_is_kick_and_valid() {
        assert_eq!(StartProfile::default(), StartProfile::Kick);
        assert_eq!(StartProfile::Kick.validate(), Ok(()));
    }

    #[test]
    fn step_must_be_between_1_and_100() {
        let zero = StartProfile::Ramp {
            percent_per_second: 0,
        };
        assert_eq!(zero.validate(), Err(StartProfileError::StepOutOfRange));
        let too_big = StartProfile::SoftKick {
            percent_per_second: 101,
        };
        assert_eq!(too_big.validate(), Err(StartProfileError::StepOutOfRange));
    }

    /// Kick: full speed in the first second.
    #[test]
    fn kick_jumps_to_full() {
        assert_eq!(
            StartProfile::Kick.towards_full(Duty::OFF, Seconds::ZERO),
            Duty::FULL
        );
    }

    /// Ramp at 10 %/s from standstill: 10 % in the first second, 100 %
    /// from the tenth on, never more.
    #[test]
    fn ramp_climbs_one_step_per_second_and_stops_at_full() {
        let p = StartProfile::Ramp {
            percent_per_second: 10,
        };
        assert_eq!(p.towards_full(Duty::OFF, Seconds::new(0)), d(10));
        assert_eq!(p.towards_full(Duty::OFF, Seconds::new(4)), d(50));
        assert_eq!(p.towards_full(Duty::OFF, Seconds::new(9)), Duty::FULL);
        assert_eq!(
            p.towards_full(Duty::OFF, Seconds::new(u64::MAX)),
            Duty::FULL
        );
        // From 30 % (a running pump) the ramp starts there.
        assert_eq!(p.towards_full(d(30), Seconds::new(0)), d(40));
    }
}
