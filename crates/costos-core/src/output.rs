//! What the core asks an output to do.

/// Pump speed as a duty cycle, 0–100 %. Can't hold anything else.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Duty(u8);

impl Duty {
    /// Pump stopped.
    pub const OFF: Self = Self(0);
    /// Full speed.
    pub const FULL: Self = Self(100);

    /// `None` above 100 %.
    #[must_use]
    pub const fn new(percent: u8) -> Option<Self> {
        if percent <= 100 {
            Some(Self(percent))
        } else {
            None
        }
    }

    /// Clamps to 0–100 % (ARCHITECTURE 6.1 rule 19: controllers clamp).
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

    /// True for 0 %.
    #[must_use]
    pub const fn is_off(self) -> bool {
        self.0 == 0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn duty_is_bounded() {
        assert_eq!(Duty::new(101), None);
        assert_eq!(Duty::clamped(250), Duty::FULL);
        assert_eq!(Duty::new(55).map(Duty::percent), Some(55));
        assert!(Duty::OFF.is_off());
    }
}
