//! CoSTOS control core.
//!
//! Everything that decides what the pumps do, as pure functions of
//! `(config, inputs, time, previous state) → (outputs, new state, events)`.
//! The rules for this crate are in ARCHITECTURE.md 6.1.
#![cfg_attr(not(test), no_std)]
