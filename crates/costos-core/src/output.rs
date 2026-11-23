//! What the core asks an output to do.
//!
//! The control functions decide a pump speed; the safety supervisor
//! (`costos-safety`) may then only lower it; the hardware layer turns it
//! into a PWM signal (ARCHITECTURE 5.3). A [`Duty`] is the value passed
//! along that chain.

/// Pump speed as a PWM duty cycle, 0–100 %.
///
/// Invariant: at most 100. The field is private, so a value like 150 %
/// can't exist, and the hardware layer never has to guess what it
/// means.
///
/// 0 % means "pump stopped" for the solar-profile pumps CoSTOS uses
/// (Wilo PWM2, Grundfos profile C; ARCHITECTURE 5.3). How a percentage
/// maps to the pump's own speed curve is the pump's business, not the
/// core's.
///
/// Ordered, so the supervisor can compare "allowed" with "requested".
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Duty(u8);

impl Duty {
    /// Pump stopped. Also the `Default`, so a forgotten value means off.
    pub const OFF: Self = Self(0);
    /// Full speed.
    pub const FULL: Self = Self(100);

    /// Checks a value. `None` above 100 %.
    #[must_use]
    pub const fn new(percent: u8) -> Option<Self> {
        if percent <= 100 {
            Some(Self(percent))
        } else {
            None
        }
    }

    /// Clamps to 0–100 %, for controller outputs (rule 19: a controller
    /// clamps its output instead of producing an impossible value).
    #[must_use]
    pub const fn clamped(percent: u8) -> Self {
        if percent <= 100 {
            Self(percent)
        } else {
            Self::FULL
        }
    }

    /// The duty cycle in %.
    #[must_use]
    pub const fn percent(self) -> u8 {
        self.0
    }

    /// True for 0 %, i.e. pump stopped.
    #[must_use]
    pub const fn is_off(self) -> bool {
        self.0 == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The invariant: nothing above 100 % gets in, clamping caps it.
    #[test]
    fn duty_is_bounded() {
        assert_eq!(Duty::new(101), None);
        assert_eq!(Duty::clamped(250), Duty::FULL);
        assert_eq!(Duty::new(55).map(Duty::percent), Some(55));
        assert!(Duty::OFF.is_off());
    }
}
