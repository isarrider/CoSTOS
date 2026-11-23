//! Sensor readings and faults.
//!
//! Implements ARCHITECTURE 5.1 and 6.1 rules 5 and 18:
//!
//! - **Rule 5: a failed sensor arrives as "no value".** A reading is
//!   either a valid temperature or a named [`SensorFault`], never a magic
//!   number like −127 or 85. Because a [`Reading`] is a `Result`, every
//!   function that uses one has to handle the fault case explicitly; the
//!   compiler won't let it forget. The safety checks treat a fault as
//!   "stop" (ARCHITECTURE 4.2: a faulty sensor counts as unknown, never as
//!   cold).
//! - **Rule 18: plausibility per sensor role.** A value can be a valid
//!   temperature and still be impossible for its role: −60 °C on a
//!   collector or 120 °C in a pressurised store means the sensor or its
//!   cable is broken. [`PlausibleRange`] turns such values into
//!   [`SensorFault::OutOfRange`] before the control functions see them.
//!
//! The hardware layer (`costos-hw-linux`) detects most faults (open
//! circuit, CRC error, power-on value); this module only names them and
//! adds the range check, so the control logic never depends on how a
//! particular chip reports a problem.

use crate::temperature::Celsius;

/// Why a sensor has no valid value.
///
/// The list follows ARCHITECTURE 5.1. Each kind is counted separately in
/// the metrics (`costos_sensor_errors_total{kind=…}`), so a marginal
/// cable shows up as a rising counter long before the sensor fails for
/// good. For the control logic every kind means the same: no value.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum SensorFault {
    /// Pt1000: open circuit (broken cable, sensor unplugged). Reported by
    /// the MAX31865 / LTC2983 fault bits.
    OpenCircuit,
    /// Pt1000: short circuit (crushed cable, water in a connector).
    ShortCircuit,
    /// The value is a valid temperature but outside the plausible range
    /// for the sensor's role ([`PlausibleRange`]).
    OutOfRange,
    /// No new reading within the timeout: a hung converter or 1-Wire
    /// bus. Without this, the last good value would be used forever.
    Stale,
    /// 1-Wire: scratchpad CRC error, also after the one retry.
    CrcError,
    /// DS18x20: exactly 85.0 °C straight after a power glitch, before any
    /// conversion. Must not be taken for a real 85 °C, which is a
    /// realistic store temperature.
    PowerOnValue,
    /// Bus read failure, e.g. −127 °C or all bits set on 1-Wire.
    ReadError,
    /// The value changed faster than water in a store or collector can
    /// change temperature; treated like a CRC error.
    Jump,
    /// Configured but not found, e.g. missing from the 1-Wire bus scan.
    Missing,
}

/// One sensor reading: a valid temperature or the reason there is none.
pub type Reading = Result<Celsius, SensorFault>;

/// The temperatures a sensor in a given role can plausibly show.
///
/// Invariant: `min < max` (checked in [`PlausibleRange::new`]; the
/// constants are correct by construction).
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct PlausibleRange {
    min: Celsius,
    max: Celsius,
}

impl PlausibleRange {
    /// Collector: from −40 °C on a winter night up to 250 °C, above the
    /// stagnation temperature of an evacuated tube collector (208 °C in
    /// the reference installation). Values from ARCHITECTURE 6.1 rule 18.
    pub const COLLECTOR: Self = Self {
        min: Celsius::from_const(-40.0),
        max: Celsius::from_const(250.0),
    };

    /// Store: a filled store never freezes (0 °C would already mean a
    /// broken heating), and even under pressure it stays below 110 °C.
    /// Values from ARCHITECTURE 6.1 rule 18.
    pub const STORE: Self = Self {
        min: Celsius::from_const(0.0),
        max: Celsius::from_const(110.0),
    };

    /// A custom range, e.g. from the config for another role.
    ///
    /// `None` unless `min < max`: an empty or inverted range would turn
    /// every reading into a fault (or none), which is always a config
    /// mistake.
    #[must_use]
    pub fn new(min: Celsius, max: Celsius) -> Option<Self> {
        (min < max).then_some(Self { min, max })
    }

    /// Lower limit; a reading below it is a fault.
    #[must_use]
    pub const fn min(self) -> Celsius {
        self.min
    }

    /// Upper limit; a reading above it is a fault.
    #[must_use]
    pub const fn max(self) -> Celsius {
        self.max
    }

    /// Passes a reading through, turning an implausible value into
    /// [`SensorFault::OutOfRange`].
    ///
    /// Both limits are inclusive: exactly −40 °C on a collector is still
    /// plausible. An existing fault passes unchanged, so the original
    /// reason (e.g. `OpenCircuit`) isn't hidden behind `OutOfRange`.
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

    /// Rule 18, the example from ARCHITECTURE 6.1: −25 °C on the
    /// collector is a normal winter value, −60 °C is a broken sensor.
    /// 210 °C is stagnation, still plausible.
    #[test]
    fn winter_collector_is_plausible_but_minus_sixty_is_not() {
        let r = PlausibleRange::COLLECTOR;
        assert_eq!(r.check(Ok(c(-25.0))), Ok(c(-25.0)));
        assert_eq!(r.check(Ok(c(-60.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(210.0))), Ok(c(210.0)));
    }

    /// A frozen or boiling store is a sensor fault. 85 °C is a real store
    /// temperature and must pass (the DS18x20 power-on value is detected
    /// in the driver, not by value).
    #[test]
    fn store_range_rejects_impossible_values() {
        let r = PlausibleRange::STORE;
        assert_eq!(r.check(Ok(c(-1.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(111.0))), Err(SensorFault::OutOfRange));
        assert_eq!(r.check(Ok(c(85.0))), Ok(c(85.0)));
    }

    /// The original fault reason is kept, so the web interface and the
    /// metrics show "stale", not a generic "out of range".
    #[test]
    fn faults_pass_through_unchanged() {
        let r = PlausibleRange::STORE;
        assert_eq!(r.check(Err(SensorFault::Stale)), Err(SensorFault::Stale));
    }

    /// An inverted or empty range from a config is refused.
    #[test]
    fn custom_range_needs_min_below_max() {
        assert!(PlausibleRange::new(c(10.0), c(5.0)).is_none());
        assert!(PlausibleRange::new(c(5.0), c(5.0)).is_none());
        assert!(PlausibleRange::new(c(5.0), c(10.0)).is_some());
    }
}
