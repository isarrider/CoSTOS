//! Fault injection and the simulated sensor layer.
//!
//! In the real system the hardware layer and the daemon turn chip results
//! into readings and detect faults (ARCHITECTURE 4.2, 5.1): open and short
//! circuits from the chip's fault bits, and **stale** readings when no new
//! value arrives within a few seconds (a hung converter or 1-Wire bus).
//! This module plays that part for the simulation, so the scenarios can
//! check what the control chain and the supervisor do with each fault.

use costos_core::{Celsius, Reading, SensorFault};

/// After this many seconds without a new value, a reading counts as
/// [`SensorFault::Stale`] ("older than a few seconds", ARCHITECTURE 5.1;
/// 10 s here).
pub const STALE_AFTER: u32 = 10;

/// What a fault affects.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Target {
    /// One of the five sensors, by index: 0 = S1 collector, 1 = S2 store
    /// bottom, 2 = S3 store top, 3 = S4 flow, 4 = S5 return.
    Sensor(usize),
    /// The solar pump.
    Pump,
}

/// Kinds of fault.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Kind {
    /// Broken wire: the chip reports an open circuit.
    Open,
    /// Shorted cable: the chip reports a short circuit.
    Short,
    /// No new value any more (hung bus): the last value is kept, and after
    /// [`STALE_AFTER`] seconds the reading is stale.
    NoUpdate,
    /// The pump gets its signal but doesn't turn (blocked rotor, failed
    /// electronics): no flow, whatever the duty. Only for [`Target::Pump`].
    Stuck,
}

/// One injected fault, active from `from` to `until` (exclusive; `None` =
/// to the end), in seconds after local midnight.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Fault {
    /// What breaks.
    pub target: Target,
    /// How it breaks.
    pub kind: Kind,
    /// From when.
    pub from: u32,
    /// Until when.
    pub until: Option<u32>,
}

impl Fault {
    fn active(&self, t: u32) -> bool {
        t >= self.from && self.until.is_none_or(|u| t < u)
    }
}

/// The simulated sensor layer: true temperatures in, readings out.
#[derive(Clone, Debug, PartialEq)]
pub struct SensorLayer {
    faults: Vec<Fault>,
    /// Last value delivered per sensor, and when it was fresh.
    last: [Option<(f32, u32)>; 5],
}

impl SensorLayer {
    /// A layer with these faults.
    #[must_use]
    pub fn new(faults: Vec<Fault>) -> Self {
        Self {
            faults,
            last: [None; 5],
        }
    }

    /// Whether the pump is stuck at `t`.
    #[must_use]
    pub fn pump_stuck(&self, t: u32) -> bool {
        self.faults
            .iter()
            .any(|f| f.target == Target::Pump && f.kind == Kind::Stuck && f.active(t))
    }

    /// The readings of S1–S5 at `t`, from the true temperatures `temps`.
    /// A value that isn't a valid temperature (NaN) becomes
    /// [`SensorFault::ReadError`].
    pub fn read(&mut self, t: u32, temps: [f32; 5]) -> [Reading; 5] {
        let mut out = [Err(SensorFault::Missing); 5];
        for (i, (slot, temp)) in out.iter_mut().zip(temps).enumerate() {
            let fault = self
                .faults
                .iter()
                .find(|f| f.target == Target::Sensor(i) && f.active(t))
                .map(|f| f.kind);
            let last = self.last.get_mut(i);
            *slot = match fault {
                Some(Kind::Open) => Err(SensorFault::OpenCircuit),
                Some(Kind::Short) => Err(SensorFault::ShortCircuit),
                Some(Kind::NoUpdate) => match last.and_then(|l| *l) {
                    // Hold the last value until it is too old.
                    Some((v, at)) if t.saturating_sub(at) < STALE_AFTER => {
                        Celsius::new(v).ok_or(SensorFault::ReadError)
                    }
                    Some(_) => Err(SensorFault::Stale),
                    None => Err(SensorFault::Missing),
                },
                // A stuck pump is not a sensor fault; no fault: fresh value.
                Some(Kind::Stuck) | None => {
                    if let Some(l) = last {
                        *l = Some((temp, t));
                    }
                    Celsius::new(temp).ok_or(SensorFault::ReadError)
                }
            };
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn faults_become_readings() {
        let faults = vec![
            Fault {
                target: Target::Sensor(0),
                kind: Kind::Open,
                from: 10,
                until: Some(20),
            },
            Fault {
                target: Target::Sensor(1),
                kind: Kind::NoUpdate,
                from: 10,
                until: None,
            },
        ];
        let mut layer = SensorLayer::new(faults);
        let temps = [50.0, 40.0, 45.0, 48.0, 42.0];
        let r = layer.read(5, temps);
        assert!(r.iter().all(Result::is_ok));
        let r = layer.read(12, [60.0, 41.0, 45.0, 48.0, 42.0]);
        assert_eq!(r[0], Err(SensorFault::OpenCircuit));
        // S2 holds the value from t = 5 ...
        assert_eq!(r[1], Ok(Celsius::from_const(40.0)));
        // ... until it is 10 s old.
        let r = layer.read(15, temps);
        assert_eq!(r[1], Err(SensorFault::Stale));
        let r = layer.read(25, temps);
        assert!(r[0].is_ok());
    }
}
