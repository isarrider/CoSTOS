//! Temperatures and temperature differences.
//!
//! Implements ARCHITECTURE 6.1 rules 4 and 14:
//!
//! - **Rule 4: a temperature can only be finite.** A sensor driver that
//!   divides by zero, or a converter that returns garbage, can produce a
//!   NaN. A NaN makes every comparison false, so `t_store >= t_max` would
//!   silently never become true and the store limit would be off. The
//!   types here make a NaN impossible inside the core: the only way to get
//!   a [`Celsius`] or [`Kelvin`] is through a constructor that rejects it.
//! - **Rule 14: temperatures and differences are signed.** A winter
//!   collector at −25 °C is normal, and a ΔT of −65 K (cold collector,
//!   warm store) is an everyday value. An unsigned type would wrap −1 °C
//!   into a huge positive number and could start the pump on a frozen
//!   collector.
//!
//! Both types are thin wrappers around `f32`. `f32` is precise to well
//! below 0.01 K in the range used here, which is far finer than any
//! sensor (the DS18B20 resolves 0.0625 K, the MAX31865 about 0.03 K).

/// Lowest temperature the core accepts at all: absolute zero.
///
/// Not a plausibility limit (those are per sensor role, see
/// [`crate::sensor::PlausibleRange`]); it only keeps the arithmetic of
/// [`Celsius::minus`] bounded.
pub const ABSOLUTE_MIN: f32 = -273.15;

/// Highest temperature the core accepts at all.
///
/// Far above anything a sensor in a solar thermal system can report
/// (stagnation of an evacuated tube collector is around 200–250 °C). Like
/// [`ABSOLUTE_MIN`] it only bounds the arithmetic, so that the difference
/// of any two temperatures is always a finite [`Kelvin`].
pub const ABSOLUTE_MAX: f32 = 1000.0;

/// A temperature in °C.
///
/// Invariant: always finite and within
/// [`ABSOLUTE_MIN`]..=[`ABSOLUTE_MAX`]. The field is private, so the
/// invariant can only be broken inside this module.
///
/// `PartialOrd` is enough for comparisons: because a NaN can't exist,
/// every comparison of two `Celsius` values is well defined.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Celsius(f32);

impl Celsius {
    /// Checks a raw value from a sensor driver or a config file.
    ///
    /// Returns `None` for NaN, ±infinity, or a value outside the absolute
    /// range. The caller turns `None` into a sensor fault (for a reading)
    /// or a validation error (for a setting); the core never sees it.
    #[must_use]
    pub const fn new(value: f32) -> Option<Self> {
        // A NaN fails both comparisons, so this one condition rejects NaN,
        // both infinities and out-of-range values at once.
        if value >= ABSOLUTE_MIN && value <= ABSOLUTE_MAX {
            Some(Self(value))
        } else {
            None
        }
    }

    /// Builds a constant, for defaults and hard limits in the code.
    ///
    /// Evaluated at compile time when used in a `const`, so an invalid
    /// constant is a compile error, not a runtime panic. Don't use it for
    /// values that come from outside (sensors, config); use
    /// [`Celsius::new`] for those.
    #[must_use]
    pub const fn from_const(value: f32) -> Self {
        match Self::new(value) {
            Some(t) => t,
            // Only reachable at compile time for a wrong constant.
            None => panic!("temperature constant outside the valid range"),
        }
    }

    /// The value in °C, for output (metrics, web interface) and for
    /// arithmetic that builds a new checked value.
    #[must_use]
    pub const fn get(self) -> f32 {
        self.0
    }

    /// `self − other` as a signed difference, e.g. collector minus store
    /// bottom for the ΔT control.
    ///
    /// Always valid without a check: both temperatures lie within
    /// [`ABSOLUTE_MIN`]..=[`ABSOLUTE_MAX`], so the difference lies within
    /// ±[`Kelvin::MAX_MAGNITUDE`] and is finite.
    #[must_use]
    pub fn minus(self, other: Self) -> Kelvin {
        Kelvin(self.0 - other.0)
    }

    /// `self + difference`, e.g. a limit minus its hysteresis.
    ///
    /// Returns `None` if the result leaves the absolute range (e.g. a
    /// hysteresis larger than the distance to absolute zero), so the
    /// caller has to decide what that means instead of getting a value
    /// outside the invariant.
    #[must_use]
    pub fn plus(self, difference: Kelvin) -> Option<Self> {
        Self::new(self.0 + difference.0)
    }
}

/// A signed temperature difference in K.
///
/// Invariant: always finite, magnitude at most [`Kelvin::MAX_MAGNITUDE`].
/// Used for ΔT values and for settings such as switch-on differences and
/// hysteresis.
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
pub struct Kelvin(f32);

impl Kelvin {
    /// Largest difference accepted: the full span between the absolute
    /// limits of [`Celsius`], so that every [`Celsius::minus`] result
    /// fits.
    pub const MAX_MAGNITUDE: f32 = ABSOLUTE_MAX - ABSOLUTE_MIN;

    /// Checks a raw value, e.g. a setting or a computed mean.
    ///
    /// Returns `None` for NaN, ±infinity, or a magnitude larger than
    /// [`Kelvin::MAX_MAGNITUDE`].
    #[must_use]
    pub const fn new(value: f32) -> Option<Self> {
        // Same trick as in `Celsius::new`: NaN fails both comparisons.
        if value >= -Self::MAX_MAGNITUDE && value <= Self::MAX_MAGNITUDE {
            Some(Self(value))
        } else {
            None
        }
    }

    /// Builds a constant at compile time; see [`Celsius::from_const`].
    #[must_use]
    pub const fn from_const(value: f32) -> Self {
        match Self::new(value) {
            Some(k) => k,
            // Only reachable at compile time for a wrong constant.
            None => panic!("temperature difference constant outside the valid range"),
        }
    }

    /// The value in K.
    #[must_use]
    pub const fn get(self) -> f32 {
        self.0
    }

    /// The difference with its sign flipped, e.g. to subtract a
    /// hysteresis with [`Celsius::plus`]. Stays valid because the range
    /// is symmetric around zero.
    #[must_use]
    pub const fn negated(self) -> Self {
        Self(-self.0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    /// Rule 4: the values a broken sensor or driver can produce never
    /// become a temperature or a difference.
    #[test]
    fn rejects_nan_and_infinity() {
        assert_eq!(Celsius::new(f32::NAN), None);
        assert_eq!(Celsius::new(f32::INFINITY), None);
        assert_eq!(Celsius::new(f32::NEG_INFINITY), None);
        assert_eq!(Kelvin::new(f32::NAN), None);
    }

    /// The whole real-world range is accepted (winter night to
    /// stagnation); only physically impossible values are not.
    #[test]
    fn accepts_winter_and_stagnation_values() {
        assert!(Celsius::new(-40.0).is_some());
        assert!(Celsius::new(-273.15).is_some());
        assert!(Celsius::new(250.0).is_some());
        assert_eq!(Celsius::new(-274.0), None);
        assert_eq!(Celsius::new(1000.1), None);
    }

    /// Rule 14, the example from ARCHITECTURE 6.1: cold collector −20 °C,
    /// store 45 °C → ΔT −65 K, a normal negative value, not a wrap-around.
    #[test]
    fn delta_t_can_be_negative() {
        let collector = Celsius::from_const(-20.0);
        let store = Celsius::from_const(45.0);
        let dt = collector.minus(store);
        assert!(dt.get() < -64.9 && dt.get() > -65.1);
        assert!(dt < Kelvin::from_const(0.0));
    }

    proptest! {
        /// `minus` claims it needs no check. This tries the claim with
        /// random temperatures across the whole absolute range.
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
