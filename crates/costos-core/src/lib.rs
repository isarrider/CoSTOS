//! CoSTOS control core.
//!
//! Everything that decides what the pumps do, written as pure functions
//! of `(config, inputs, time, previous state) → (outputs, new state,
//! status)`. Pure means: the same inputs always give the same result,
//! nothing is read from or written to the outside world.
//!
//! That is what makes the core testable and checkable (ARCHITECTURE 6.1):
//! unit and property tests, replays of recorded vbus2influx data against
//! the real RESOL decisions, and simulation runs in CI.
//!
//! The crate follows the rules of ARCHITECTURE 6.1, which are enforced
//! where possible:
//!
//! - no `std` (rule 1): `no_std` below, checked by a bare-metal CI build
//!   (rule 12);
//! - no clock (rule 2): time arrives as [`Seconds`];
//! - no logging (rule 3): each function returns a status instead;
//! - finite, signed temperatures (rules 4, 14): [`Celsius`], [`Kelvin`];
//! - faults as values (rule 5): [`Reading`], [`SensorFault`];
//! - whole seconds and saturating arithmetic (rules 7, 8, 17);
//! - no `unsafe`, no unchecked indexing or arithmetic (rules 10, 11):
//!   workspace lints;
//! - overflow checks in release builds (rule 9): workspace profile.
//!
//! Safety limits are *not* in this crate: the supervisor in
//! `costos-safety` sits after it and can only reduce what the core asks
//! for (ARCHITECTURE 4.2).

// `std` only for tests (rule 1): tests may use proptest, which needs it.
#![cfg_attr(not(test), no_std)]

pub mod anti_seize;
pub mod delta_t;
pub mod heat;
pub mod monitor;
pub mod output;
pub mod sensor;
pub mod solar;
pub mod speed;
pub mod start_profile;
pub mod store_max;
pub mod temperature;
pub mod time;

// The basic types are re-exported so other crates can write
// `costos_core::Celsius` instead of the full module path.
pub use output::Duty;
pub use sensor::{PlausibleRange, Reading, SensorFault};
pub use temperature::{Celsius, Kelvin};
pub use time::{Seconds, TimeOfDay};
