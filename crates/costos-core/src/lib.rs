//! CoSTOS control core.
//!
//! Everything that decides what the pumps do, as pure functions of
//! `(config, inputs, time, previous state) → (outputs, new state, status)`.
//! The rules for this crate are in ARCHITECTURE.md 6.1: no `std`, no
//! clock, no I/O, no logging; finite temperatures, faults as values,
//! whole seconds, saturating counters.
#![cfg_attr(not(test), no_std)]

pub mod output;
pub mod sensor;
pub mod temperature;
pub mod time;

pub use output::Duty;
pub use sensor::{PlausibleRange, Reading, SensorFault};
pub use temperature::{Celsius, Kelvin};
pub use time::Seconds;
