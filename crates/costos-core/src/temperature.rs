//! Temperatures and temperature differences (ARCHITECTURE 6.1, rules 4 and 14).
//!
//! A [`Celsius`] can only hold a finite value inside a physical range, so a
//! NaN or infinity from a bad sensor can never reach a comparison in the
//! core. Temperatures and differences are signed: −40 °C on a winter
//! collector and a ΔT of −65 K are ordinary values.

/// Lowest temperature the core accepts at all (absolute zero).
pub const ABSOLUTE_MIN: f32 = -273.15;
/// Highest temperature the core accepts at all. Far above anything a
/// sensor in a solar thermal system can report; it only keeps
/// differences finite.
pub const ABSOLUTE_MAX: f32 = 1000.0;

/// A temperature in °C. Always finite and within
/// [`ABSOLUTE_MIN`]..=[`ABSOLUTE_MAX`].
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Celsius(f32);

impl Celsius {
    /// Checks a raw value. `None` for NaN, infinity or a value outside the
    /// absolute range.
    #[must_use]
    pub const fn new(value: f32) -> Option<Self> {
        // A NaN fails both comparisons.
        if value >= ABSOLUTE_MIN && value <= ABSOLUTE_MAX {
            Some(Self(value))
        } else {
            None
        }
    }

    /// For constants: fails to compile if the value is not valid.
    #[must_use]
    pub const fn from_const(value: f32) -> Self {
        match Self::new(value) {
            Some(t) => t,
            None => panic!("temperature constant outside the valid range"),
        }
    }

    /// The value in °C.
    #[must_use]
    pub const fn get(self) -> f32 {
        self.0
    }

    /// `self − other` as a signed difference. Always finite, because both
    /// temperatures are bounded.
    #[must_use]
    pub fn minus(self, other: Self) -> Kelvin {
        Kelvin(self.0 - other.0)
    }

    /// `self + difference`, or `None` if the result leaves the valid range.
    #[must_use]
    pub fn plus(self, difference: Kelvin) -> Option<Self> {
        Self::new(self.0 + difference.0)
    }
}

/// A signed temperature difference in K. Always finite.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Kelvin(f32);

impl Kelvin {
    /// Largest difference accepted: the full span between the absolute
    /// limits of [`Celsius`].
    pub const MAX_MAGNITUDE: f32 = ABSOLUTE_MAX - ABSOLUTE_MIN;

    /// Checks a raw value. `None` for NaN, infinity or a magnitude larger
    /// than [`Kelvin::MAX_MAGNITUDE`].
    #[must_use]
    pub const fn new(value: f32) -> Option<Self> {
        if value >= -Self::MAX_MAGNITUDE && value <= Self::MAX_MAGNITUDE {
            Some(Self(value))
        } else {
            None
        }
    }

    /// For constants: fails to compile if the value is not valid.
    #[must_use]
    pub const fn from_const(value: f32) -> Self {
        match Self::new(value) {
            Some(k) => k,
            None => panic!("temperature difference constant outside the valid range"),
        }
    }

    /// The value in K.
    #[must_use]
    pub const fn get(self) -> f32 {
        self.0
    }

    /// The difference with its sign flipped.
    #[must_use]
    pub const fn negated(self) -> Self {
        Self(-self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn rejects_nan_and_infinity() {
        assert_eq!(Celsius::new(f32::NAN), None);
        assert_eq!(Celsius::new(f32::INFINITY), None);
        assert_eq!(Celsius::new(f32::NEG_INFINITY), None);
        assert_eq!(Kelvin::new(f32::NAN), None);
    }

    #[test]
    fn accepts_winter_and_stagnation_values() {
        assert!(Celsius::new(-40.0).is_some());
        assert!(Celsius::new(-273.15).is_some());
        assert!(Celsius::new(250.0).is_some());
        assert_eq!(Celsius::new(-274.0), None);
        assert_eq!(Celsius::new(1000.1), None);
    }

    #[test]
    fn delta_t_can_be_negative() {
        // Rule 14: cold collector −20 °C, store 45 °C → ΔT −65 K.
        let collector = Celsius::from_const(-20.0);
        let store = Celsius::from_const(45.0);
        let dt = collector.minus(store);
        assert!(dt.get() < -64.9 && dt.get() > -65.1);
        assert!(dt < Kelvin::from_const(0.0));
    }

    proptest! {
        #[test]
        fn difference_of_any_two_temperatures_is_a_valid_kelvin(
            a in ABSOLUTE_MIN..=ABSOLUTE_MAX,
            b in ABSOLUTE_MIN..=ABSOLUTE_MAX,
        ) {
            let (a, b) = (Celsius::new(a).unwrap(), Celsius::new(b).unwrap());
            let dt = a.minus(b);
            prop_assert!(Kelvin::new(dt.get()).is_some());
            prop_assert!(dt.get().is_finite());
        }
    }
}
