//! Sensor readings and faults (ARCHITECTURE 5.1 and 6.1, rules 5 and 18).
//!
//! A reading is either a valid temperature or a named fault, never a
//! magic number. Every function has to handle the fault case, and the
//! safety checks treat a fault as "stop".

use crate::temperature::Celsius;

/// Why a sensor has no valid value.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SensorFault {
    /// Pt1000: open circuit (broken cable, missing sensor).
    OpenCircuit,
    /// Pt1000: short circuit.
    ShortCircuit,
    /// Outside the plausible range for the sensor's role.
    OutOfRange,
    /// No new reading within the timeout (hung converter or bus).
    Stale,
    /// 1-Wire: scratchpad CRC error, also after the retry.
    CrcError,
    /// DS18x20: the 85.0 °C power-on value, not a real reading.
    PowerOnValue,
    /// Bus read failure (for example −127 °C or all bits set).
    ReadError,
    /// Changed faster than the water can change temperature.
    Jump,
    /// Configured but not found (for example missing from the 1-Wire bus).
    Missing,
}

/// One sensor reading: a valid temperature or the reason there is none.
pub type Reading = Result<Celsius, SensorFault>;

/// The temperatures a sensor in a given role can plausibly show. Outside
/// this range a reading counts as [`SensorFault::OutOfRange`].
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PlausibleRange {
    min: Celsius,
    max: Celsius,
}

impl PlausibleRange {
    /// Collector: −40 °C on a winter night up to stagnation.
    pub const COLLECTOR: Self = Self {
        min: Celsius::from_const(-40.0),
        max: Celsius::from_const(250.0),
    };

    /// Store: never frozen, never above boiling under pressure.
    pub const STORE: Self = Self {
        min: Celsius::from_const(0.0),
        max: Celsius::from_const(110.0),
    };

    /// A custom range; `None` unless `min < max`.
    #[must_use]
    pub fn new(min: Celsius, max: Celsius) -> Option<Self> {
        (min < max).then_some(Self { min, max })
    }

    /// Lower limit.
    #[must_use]
    pub const fn min(self) -> Celsius {
        self.min
    }

    /// Upper limit.
    #[must_use]
    pub const fn max(self) -> Celsius {
        self.max
    }

    /// Passes a reading through, turning an implausible value into
    /// [`SensorFault::OutOfRange`]. Faults pass unchanged.
    pub fn check(self, reading: Reading) -> Reading {
        match reading {
            Ok(t) if t < self.min || t > self.max => Err(SensorFault::OutOfRange),
            other => other,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn c(v: f32) -> Celsius {
        Celsius::new(v).unwrap()
    }

    #[test]
    fn winter_collector_is_plausible_but_minus_sixty_is_not() {
        let r = PlausibleRange::COLLECTOR;
        assert_eq!(r.check(Ok(c(-25.0))), Ok(c(-25.0)));
        assert_eq!(r.check(Ok(c(-60.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(210.0))), Ok(c(210.0)));
    }

    #[test]
    fn store_range_rejects_impossible_values() {
        let r = PlausibleRange::STORE;
        assert_eq!(r.check(Ok(c(-1.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(111.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(85.0))), Ok(c(85.0)));
    }

    #[test]
    fn faults_pass_through_unchanged() {
        let r = PlausibleRange::STORE;
        assert_eq!(r.check(Err(SensorFault::Stale)), Err(SensorFault::Stale));
    }

    #[test]
    fn custom_range_needs_min_below_max() {
        assert!(PlausibleRange::new(c(10.0), c(5.0)).is_none());
        assert!(PlausibleRange::new(c(5.0), c(5.0)).is_none());
        assert!(PlausibleRange::new(c(5.0), c(10.0)).is_some());
    }
}
