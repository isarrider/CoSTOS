//! Time in the core (ARCHITECTURE 6.1, rules 2, 8 and 17).
//!
//! The core never reads a clock: the daemon passes the current time in.
//! All times and durations are whole seconds in a `u64`, so there is no
//! millisecond counter that could overflow after 49.7 days.

/// A point in time or a duration, in whole seconds.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash, Default)]
pub struct Seconds(u64);

impl Seconds {
    /// Zero seconds.
    pub const ZERO: Self = Self(0);

    /// Wraps a number of seconds.
    #[must_use]
    pub const fn new(seconds: u64) -> Self {
        Self(seconds)
    }

    /// Minutes to seconds; stays at the maximum instead of overflowing.
    #[must_use]
    pub const fn from_minutes(minutes: u64) -> Self {
        Self(minutes.saturating_mul(60))
    }

    /// The number of seconds.
    #[must_use]
    pub const fn get(self) -> u64 {
        self.0
    }

    /// Time elapsed since `earlier`. Zero instead of a wrap or a panic if
    /// `earlier` is later than `self` (a restart, a restored state).
    #[must_use]
    pub const fn saturating_since(self, earlier: Self) -> Self {
        Self(self.0.saturating_sub(earlier.0))
    }

    /// `self + duration`, staying at the maximum instead of overflowing.
    #[must_use]
    pub const fn saturating_add(self, duration: Self) -> Self {
        Self(self.0.saturating_add(duration.0))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn since_never_underflows() {
        let start = Seconds::new(100);
        let earlier_now = Seconds::new(40);
        assert_eq!(earlier_now.saturating_since(start), Seconds::ZERO);
        assert_eq!(Seconds::new(130).saturating_since(start), Seconds::new(30));
    }

    #[test]
    fn add_stays_at_maximum() {
        let max = Seconds::new(u64::MAX);
        assert_eq!(max.saturating_add(Seconds::new(1)), max);
        assert_eq!(Seconds::from_minutes(u64::MAX), max);
    }

    #[test]
    fn ten_years_of_seconds_is_nothing_for_u64() {
        let ten_years = Seconds::new(10 * 365 * 24 * 3600);
        assert!(ten_years.saturating_add(ten_years) > ten_years);
    }
}
