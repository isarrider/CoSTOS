//! Time in the core.
//!
//! Implements ARCHITECTURE 6.1 rules 2, 8 and 17:
//!
//! - **Rule 2: time is an input.** The core never reads a clock. The
//!   daemon passes the time of each control cycle in, so the same inputs
//!   always give the same decisions, and a recorded history (vbus2influx)
//!   can be replayed exactly.
//! - **Rule 8: whole seconds in a `u64`.** One control cycle is one
//!   second, and nothing in a solar thermal system needs finer timing in
//!   the decisions. A `u32` millisecond counter would overflow after
//!   49.7 days (the classic "fails after seven weeks" bug); `u64` seconds
//!   last 585 billion years.
//! - **Rule 17: differences saturate.** "Seconds since the pump started"
//!   is computed with `saturating_sub`, so a start time that lies in the
//!   future (a restored state, a clock set back) gives 0 instead of a
//!   wrap-around or a panic.
//!
//! What the number counts from (Unix time, uptime) is up to the daemon;
//! the core only ever compares and subtracts.

/// A point in time or a duration, in whole seconds.
///
/// One type for both, on purpose: the core only needs "now", "since
/// when" and "how long", and keeping one type avoids conversions. All
/// arithmetic on it saturates.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Seconds(u64);

impl Seconds {
    /// Zero seconds: the start of time, or no duration.
    pub const ZERO: Self = Self(0);

    /// Wraps a number of seconds.
    #[must_use]
    pub const fn new(seconds: u64) -> Self {
        Self(seconds)
    }

    /// Minutes to seconds, for settings given in minutes. Stays at the
    /// maximum instead of overflowing (rule 7).
    #[must_use]
    pub const fn from_minutes(minutes: u64) -> Self {
        Self(minutes.saturating_mul(60))
    }

    /// The number of seconds.
    #[must_use]
    pub const fn get(self) -> u64 {
        self.0
    }

    /// Time elapsed since `earlier`.
    ///
    /// Rule 17: zero instead of a wrap or a panic if `earlier` is later
    /// than `self`. Without this, a restored state with a start time in
    /// the future would make `now − start` either panic (overflow checks
    /// are on, rule 9) or wrap to a huge duration, which would end every
    /// minimum run time at once.
    #[must_use]
    pub const fn saturating_since(self, earlier: Self) -> Self {
        Self(self.0.saturating_sub(earlier.0))
    }

    /// `self + duration`, staying at the maximum instead of overflowing
    /// (rule 7).
    #[must_use]
    pub const fn saturating_add(self, duration: Self) -> Self {
        Self(self.0.saturating_add(duration.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Rule 17: a start time after "now" gives zero elapsed time.
    #[test]
    fn since_never_underflows() {
        let start = Seconds::new(100);
        let earlier_now = Seconds::new(40);
        assert_eq!(earlier_now.saturating_since(start), Seconds::ZERO);
        assert_eq!(Seconds::new(130).saturating_since(start), Seconds::new(30));
    }

    /// Rule 7: at the end of the range values stay at the maximum.
    #[test]
    fn add_stays_at_maximum() {
        let max = Seconds::new(u64::MAX);
        assert_eq!(max.saturating_add(Seconds::new(1)), max);
        assert_eq!(Seconds::from_minutes(u64::MAX), max);
    }

    /// Rule 8: ten years of seconds is a tiny fraction of `u64`.
    #[test]
    fn ten_years_of_seconds_is_nothing_for_u64() {
        let ten_years = Seconds::new(10 * 365 * 24 * 3600);
        assert!(ten_years.saturating_add(ten_years) > ten_years);
    }
}
