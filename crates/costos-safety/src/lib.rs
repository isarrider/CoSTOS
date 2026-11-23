//! CoSTOS safety supervisor (ARCHITECTURE.md 4.2).
//!
//! Sits between the control core and the outputs and can only reduce what
//! the core asks for: force off, cap speed. It can never switch anything on.
#![cfg_attr(not(test), no_std)]
