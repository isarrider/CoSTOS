//! Anti-seize run and full-speed purge (ARCHITECTURE 6.2).
//!
//! Two small jobs that keep a pump healthy, both decided here and both
//! configurable:
//!
//! - **Anti-seize run.** A pump that stands still for a long time can stick
//!   (deposits between rotor and housing). If a pump has been idle for more
//!   than [`AntiSeizeConfig::idle_limit`] (default 24 h), it runs for
//!   [`AntiSeizeConfig::run`] (default 10 s) at 100 %, but only inside a
//!   time window around midday ([`AntiSeizeConfig::start`], default 12:00,
//!   for [`AntiSeizeConfig::window`], default 1 h), never at night.
//!   Replaces the BX Plus "blocking protection" (daily at 12:00 for 10 s,
//!   skipped if the pump already ran that day), which ran only 4 times in
//!   147 days of replay data, because the pump runs on most days anyway.
//! - **Full-speed purge.** With speed control a pump mostly runs slowly and
//!   rarely reaches 100 %, which is what flushes air bubbles and deposits
//!   out of the loop. If a pump hasn't been at 100 % for
//!   [`AntiSeizeConfig::purge_interval`] (default 7 days), its next normal
//!   start begins with [`AntiSeizeConfig::purge`] (default 60 s) at 100 %.
//!
//! **Why midday and why only with a normal start.** Moving fluid through
//! the collector when the sun doesn't heat it carries store heat out to
//! the collector. At midday even a winter collector is at its warmest, and
//! 10 s move very little. The purge only ever stretches a run the ΔT
//! control already wants, so it costs no heat at all; a weekly timed run
//! at 100 % was rejected for that reason (ARCHITECTURE 6.2).
//!
//! **Where it sits.** After the ΔT and speed control, before the safety
//! supervisor:
//!
//! ```text
//! ΔT control → speed control → anti-seize/purge → supervisor → PWM
//! ```
//!
//! It can raise the request (anti-seize from 0 % to 100 %, purge to 100 %)
//! but the supervisor after it can still turn everything off, so a
//! collector emergency or a failed sensor still wins.
//!
//! **Start profile.** Both runs reach 100 % the way the pump's start
//! profile says ([`StartProfile`]): with *kick* at once, with *ramp* or
//! *soft kick* in steps. The time at 100 % ([`AntiSeizeConfig::run`],
//! [`AntiSeizeConfig::purge`]) counts from the first second at 100 %, so a
//! ramp makes the run longer, never the time at full speed shorter.
//!
//! **What it never does.** It never stops a pump the control wants on, and
//! it never lowers a request except back to the request itself when its
//! own run ends.

use crate::output::Duty;
use crate::start_profile::{StartProfile, StartProfileError};
use crate::time::{Seconds, TimeOfDay};

/// Settings. A duration of zero switches that part off:
/// [`AntiSeizeConfig::run`] = 0 disables the anti-seize run,
/// [`AntiSeizeConfig::purge`] = 0 disables the purge.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct AntiSeizeConfig {
    /// Idle time after which the anti-seize run is due. Measured from the
    /// last cycle in which the pump ran at all (any duty above 0 %).
    pub idle_limit: Seconds,
    /// Local time of day from which the anti-seize run may start.
    pub start: TimeOfDay,
    /// How long after `start` it may still start. If the run is due but
    /// the window has passed (for example the pump stopped at 13:30 the
    /// day before), it waits for the next day's window; the idle time can
    /// then reach up to `idle_limit` + 24 h, which is harmless for a pump.
    /// Must not reach past midnight (checked by [`Self::validate`]).
    pub window: Seconds,
    /// Length of the anti-seize run at 100 %. 0 = off.
    pub run: Seconds,
    /// Time without a cycle at 100 % after which the next start purges.
    pub purge_interval: Seconds,
    /// Length of the purge at 100 % at the start of a normal run. 0 = off.
    pub purge: Seconds,
    /// How both runs get to 100 %: the pump's start profile, the same
    /// setting the speed control uses for normal starts.
    pub profile: StartProfile,
}

/// Why an [`AntiSeizeConfig`] is not valid.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AntiSeizeConfigError {
    /// The anti-seize run is on, but its time window is empty, so it could
    /// never start.
    WindowEmpty,
    /// The time window reaches past midnight. Not supported: "within the
    /// window" would then need two comparisons and a wrap, and a run at
    /// night is exactly what the window is there to avoid.
    WindowCrossesMidnight,
    /// The start profile is not valid.
    Profile(StartProfileError),
}

impl AntiSeizeConfig {
    /// Defaults as decided in ARCHITECTURE 6.2: 24 h idle, 12:00 to 13:00,
    /// 10 s; purge after 7 days without 100 %, for 60 s.
    pub const DEFAULT: Self = Self {
        idle_limit: Seconds::new(24 * 3600),
        // 12:00 = 43 200 s; written as a constant because
        // `TimeOfDay::from_hm` returns an `Option` and the default must not
        // need an unwrap.
        start: match TimeOfDay::new(43_200) {
            Some(t) => t,
            None => TimeOfDay::MIDNIGHT,
        },
        window: Seconds::new(3600),
        run: Seconds::new(10),
        purge_interval: Seconds::new(7 * 24 * 3600),
        purge: Seconds::new(60),
        profile: StartProfile::Kick,
    };

    /// Checks the settings.
    pub fn validate(&self) -> Result<(), AntiSeizeConfigError> {
        self.profile
            .validate()
            .map_err(AntiSeizeConfigError::Profile)?;
        // A switched-off anti-seize run needs no window.
        if self.run == Seconds::ZERO {
            return Ok(());
        }
        if self.window == Seconds::ZERO {
            return Err(AntiSeizeConfigError::WindowEmpty);
        }
        // start + window must stay within the day. Both are small numbers,
        // the addition saturates anyway (rule 7).
        let end = u64::from(self.start.get()).saturating_add(self.window.get());
        if end > 86_400 {
            return Err(AntiSeizeConfigError::WindowCrossesMidnight);
        }
        Ok(())
    }
}

impl Default for AntiSeizeConfig {
    fn default() -> Self {
        Self::DEFAULT
    }
}

/// One run towards and at 100 % (anti-seize or purge).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Run {
    /// First cycle of the run; the ramp counts from here.
    since: Seconds,
    /// The duty the ramp starts from: 0 % for an anti-seize run, the
    /// request at the start for a purge.
    from: Duty,
    /// First cycle at 100 %, once reached; the time at full speed counts
    /// from here.
    full_since: Option<Seconds>,
    /// How long to stay at 100 %.
    hold: Seconds,
}

impl Run {
    fn new(now: Seconds, from: Duty, hold: Seconds) -> Self {
        Self {
            since: now,
            from,
            full_since: None,
            hold,
        }
    }

    /// The duty for this cycle and the run as it continues, or `None` if
    /// the run is over (it has held 100 % for `hold`).
    fn advance(self, profile: &StartProfile, now: Seconds) -> Option<(Duty, Self)> {
        if let Some(full) = self.full_since {
            // Already at full speed: hold, then end.
            return (now.saturating_since(full) < self.hold).then_some((Duty::FULL, self));
        }
        let duty = profile.towards_full(self.from, now.saturating_since(self.since));
        let run = Self {
            full_since: (duty == Duty::FULL).then_some(now),
            ..self
        };
        Some((duty, run))
    }
}

/// What this module is doing at the moment.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
enum Mode {
    /// Passing the request through unchanged.
    #[default]
    Pass,
    /// Anti-seize run.
    AntiSeize(Run),
    /// Purge at the start of a normal run.
    Purge(Run),
}

/// State carried from one cycle to the next.
///
/// The `Default` is "nothing known": no run and no 100 % seen yet. That
/// makes the first start after a restart purge, and the anti-seize run due
/// at the next midday window if the pump doesn't run before. Both are
/// harmless, and better than assuming a pump has run when nobody knows.
/// The daemon persists this state with the statistics, so a restart
/// normally doesn't lose it.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct AntiSeizeState {
    /// Last cycle in which the pump ran (output above 0 %).
    last_run: Option<Seconds>,
    /// Last cycle in which the output was 100 %.
    last_full: Option<Seconds>,
    /// Whether the *request* (not the output) was on in the previous
    /// cycle; a change from off to on is a normal start.
    was_requested: bool,
    /// What is going on now.
    mode: Mode,
}

/// Why the output is what it is. Returned every cycle, like the ΔT
/// status, for the web interface and the event log.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum AntiSeizeStatus {
    /// The request passes unchanged.
    Pass,
    /// Anti-seize run: ramping up to or holding 100 %.
    AntiSeize,
    /// Purge at the start of a normal run: ramping up to or holding 100 %.
    Purge,
}

/// `true` if `interval` has passed since `last`, or if `last` is unknown.
///
/// Rule 17: a `last` that lies in the future (restored state, clock set
/// back) gives an elapsed time of zero, so nothing is due; the next real
/// run or 100 % cycle sets it right again.
fn due(now: Seconds, last: Option<Seconds>, interval: Seconds) -> bool {
    match last {
        None => true,
        Some(last) => now.saturating_since(last) >= interval,
    }
}

/// One control cycle.
///
/// `requested` is the duty the control functions ask for; `time_of_day`
/// is the local time, from the daemon like `now` (rule 2). Returns the new
/// state, the duty to pass on to the supervisor, and why.
#[must_use]
pub fn step(
    config: &AntiSeizeConfig,
    state: AntiSeizeState,
    now: Seconds,
    time_of_day: TimeOfDay,
    requested: Duty,
) -> (AntiSeizeState, Duty, AntiSeizeStatus) {
    let requested_on = !requested.is_off();
    let profile = &config.profile;

    let (mode, output, status) = if requested_on {
        // The control wants the pump on: a normal run.
        let starting = !state.was_requested;
        let purge = match state.mode {
            // A purge that is already running continues until it has held
            // 100 % long enough.
            Mode::Purge(run) => run.advance(profile, now),
            // A normal start, purge switched on and due: start one, ramping
            // from the request. Only at a start, so a long run that never
            // reaches 100 % isn't interrupted by a sudden jump.
            _ if starting
                && config.purge != Seconds::ZERO
                && due(now, state.last_full, config.purge_interval) =>
            {
                Run::new(now, requested, config.purge).advance(profile, now)
            }
            // Otherwise, including an anti-seize run that is interrupted by
            // a real request (the request takes over; the pump runs anyway).
            _ => None,
        };
        match purge {
            // Never below the request: if the control asks for more than
            // the ramp has reached, the control wins.
            Some((duty, run)) => (
                Mode::Purge(run),
                duty.max(requested),
                AntiSeizeStatus::Purge,
            ),
            None => (Mode::Pass, requested, AntiSeizeStatus::Pass),
        }
    } else {
        // The control wants the pump off. A purge that was running ends
        // here: it only ever changes the speed of a normal run, never its
        // length.
        let anti_seize = match state.mode {
            // An anti-seize run that has started runs to its end.
            Mode::AntiSeize(run) => run.advance(profile, now),
            // Due and inside the midday window: start one, from standstill.
            _ if config.run != Seconds::ZERO
                && due(now, state.last_run, config.idle_limit)
                && time_of_day >= config.start
                && time_of_day.saturating_since(config.start) < config.window =>
            {
                Run::new(now, Duty::OFF, config.run).advance(profile, now)
            }
            _ => None,
        };
        match anti_seize {
            Some((duty, run)) => (Mode::AntiSeize(run), duty, AntiSeizeStatus::AntiSeize),
            None => (Mode::Pass, requested, AntiSeizeStatus::Pass),
        }
    };

    // Bookkeeping from the *output*: an anti-seize run counts as a run and
    // as a cycle at 100 %, and a normal run at 100 % makes a purge
    // unnecessary.
    let new_state = AntiSeizeState {
        last_run: if output.is_off() {
            state.last_run
        } else {
            Some(now)
        },
        last_full: if output == Duty::FULL {
            Some(now)
        } else {
            state.last_full
        },
        was_requested: requested_on,
        mode,
    };
    (new_state, output, status)
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    const DAY: u64 = 24 * 3600;

    fn half() -> Duty {
        Duty::new(50).unwrap()
    }

    /// Time of day for an absolute time, with day 0 starting at midnight.
    /// Good enough for tests; the daemon does this with the real time zone.
    fn tod(t: u64) -> TimeOfDay {
        TimeOfDay::new(u32::try_from(t % DAY).unwrap()).unwrap()
    }

    /// Runs cycles from `t0` to `t1` (exclusive) with a constant request.
    /// Returns the final state and every output.
    fn run(
        cfg: &AntiSeizeConfig,
        mut state: AntiSeizeState,
        t0: u64,
        t1: u64,
        requested: Duty,
    ) -> (AntiSeizeState, Vec<(u64, Duty, AntiSeizeStatus)>) {
        let mut out = Vec::new();
        for t in t0..t1 {
            let (s, d, st) = step(cfg, state, Seconds::new(t), tod(t), requested);
            state = s;
            out.push((t, d, st));
        }
        (state, out)
    }

    /// One step at time `t` with the matching time of day.
    fn step_fn(
        cfg: &AntiSeizeConfig,
        state: AntiSeizeState,
        t: u64,
        requested: Duty,
    ) -> (AntiSeizeState, Duty, AntiSeizeStatus) {
        step(cfg, state, Seconds::new(t), tod(t), requested)
    }

    /// A state in which the pump ran at 100 % at time `t`, so neither job
    /// is due right after.
    fn ran_full_at(t: u64) -> AntiSeizeState {
        AntiSeizeState {
            last_run: Some(Seconds::new(t)),
            last_full: Some(Seconds::new(t)),
            was_requested: false,
            mode: Mode::Pass,
        }
    }

    #[test]
    fn defaults_are_valid() {
        assert_eq!(AntiSeizeConfig::DEFAULT.validate(), Ok(()));
        assert_eq!(
            AntiSeizeConfig::DEFAULT.start,
            TimeOfDay::from_hm(12, 0).unwrap()
        );
    }

    #[test]
    fn invalid_windows_are_rejected() {
        let mut cfg = AntiSeizeConfig::DEFAULT;
        cfg.window = Seconds::ZERO;
        assert_eq!(cfg.validate(), Err(AntiSeizeConfigError::WindowEmpty));
        cfg.window = Seconds::new(3600);
        cfg.start = TimeOfDay::from_hm(23, 30).unwrap();
        assert_eq!(
            cfg.validate(),
            Err(AntiSeizeConfigError::WindowCrossesMidnight)
        );
        // Anti-seize off: the window doesn't matter.
        cfg.run = Seconds::ZERO;
        assert_eq!(cfg.validate(), Ok(()));
    }

    /// After more than 24 h idle, the pump runs exactly 10 s at 100 %,
    /// starting at 12:00, and then not again that day.
    #[test]
    fn anti_seize_runs_ten_seconds_at_noon_after_a_day_idle() {
        let cfg = AntiSeizeConfig::DEFAULT;
        // Last ran at 15:00 on day 0; the next 12:00 (day 1) is only 21 h
        // later, so the run is due at 12:00 on day 2.
        let state = ran_full_at(15 * 3600);
        let (_, out) = run(&cfg, state, DAY, 3 * DAY, Duty::OFF);
        let on: Vec<_> = out.iter().filter(|(_, d, _)| !d.is_off()).collect();
        assert_eq!(on.len(), 10);
        assert_eq!(on[0].0, 2 * DAY + 12 * 3600);
        assert!(
            on.iter()
                .all(|(_, d, s)| *d == Duty::FULL && *s == AntiSeizeStatus::AntiSeize)
        );
    }

    /// Never at night: idle for days, but nothing happens outside the
    /// midday window.
    #[test]
    fn anti_seize_never_runs_outside_the_window() {
        let cfg = AntiSeizeConfig::DEFAULT;
        let (_, out) = run(
            &cfg,
            ran_full_at(0),
            3 * DAY,
            3 * DAY + 11 * 3600,
            Duty::OFF,
        );
        assert!(out.iter().all(|(_, d, _)| d.is_off()));
        let (_, out) = run(
            &cfg,
            ran_full_at(0),
            3 * DAY + 13 * 3600,
            4 * DAY,
            Duty::OFF,
        );
        assert!(out.iter().all(|(_, d, _)| d.is_off()));
    }

    /// A pump that runs every day never gets an anti-seize run.
    #[test]
    fn no_anti_seize_when_the_pump_runs_daily() {
        let cfg = AntiSeizeConfig::DEFAULT;
        let mut state = ran_full_at(0);
        for day in 0..5 {
            let t = day * DAY;
            // Off until 11:00, a solar run 11:00 – 16:00 at 50 %, off again.
            let (s, a) = run(&cfg, state, t, t + 11 * 3600, Duty::OFF);
            let (s, _) = run(&cfg, s, t + 11 * 3600, t + 16 * 3600, half());
            let (s, b) = run(&cfg, s, t + 16 * 3600, t + DAY, Duty::OFF);
            assert!(a.iter().chain(b.iter()).all(|(_, d, _)| d.is_off()));
            state = s;
        }
    }

    /// A normal start after more than 7 days without 100 % begins with
    /// 60 s at 100 %, then the request passes through.
    #[test]
    fn purge_at_the_first_start_after_a_week_without_full_speed() {
        let cfg = AntiSeizeConfig::DEFAULT;
        let t = 8 * DAY;
        let (s, _) = run(&cfg, ran_full_at(0), t - 10, t, Duty::OFF);
        let (_, out) = run(&cfg, s, t, t + 120, half());
        let full = out.iter().filter(|(_, d, _)| *d == Duty::FULL).count();
        assert_eq!(full, 60);
        assert_eq!(out[0].2, AntiSeizeStatus::Purge);
        assert_eq!(out[60].1, half());
        assert_eq!(out[60].2, AntiSeizeStatus::Pass);
    }

    /// The purge never interrupts a run that is already going, and never
    /// happens within the 7 days.
    #[test]
    fn no_purge_inside_the_interval_or_in_the_middle_of_a_run() {
        let cfg = AntiSeizeConfig::DEFAULT;
        // Within 7 days: a start passes unchanged.
        let (_, out) = run(&cfg, ran_full_at(0), DAY, DAY + 60, half());
        assert!(out.iter().all(|(_, d, _)| *d == half()));
        // A run that started on day 6 and is still going on day 8 (not
        // realistic, but the rule must hold) isn't interrupted.
        let (s, _) = run(&cfg, ran_full_at(0), 6 * DAY, 6 * DAY + 1, half());
        let (_, out) = run(&cfg, s, 8 * DAY, 8 * DAY + 60, half());
        assert!(out.iter().all(|(_, d, _)| *d == half()));
    }

    /// If the control stops the pump during the purge, the pump stops:
    /// the purge only stretches the *speed* of a run, never its length.
    #[test]
    fn purge_ends_when_the_request_ends() {
        let cfg = AntiSeizeConfig::DEFAULT;
        let (s, out) = run(&cfg, AntiSeizeState::default(), 1000, 1010, half());
        assert_eq!(out[0].2, AntiSeizeStatus::Purge);
        let (_, d, st) = step(&cfg, s, Seconds::new(1010), tod(1010), Duty::OFF);
        assert!(d.is_off());
        assert_eq!(st, AntiSeizeStatus::Pass);
    }

    /// Zero durations switch the two jobs off.
    #[test]
    fn zero_durations_switch_both_off() {
        let cfg = AntiSeizeConfig {
            run: Seconds::ZERO,
            purge: Seconds::ZERO,
            ..AntiSeizeConfig::DEFAULT
        };
        let (s, out) = run(&cfg, AntiSeizeState::default(), 0, 3 * DAY, Duty::OFF);
        assert!(out.iter().all(|(_, d, _)| d.is_off()));
        let (_, out) = run(&cfg, s, 3 * DAY, 3 * DAY + 60, half());
        assert!(out.iter().all(|(_, d, _)| *d == half()));
    }

    /// Rule 17: a restored state with times in the future neither panics
    /// nor triggers anything.
    #[test]
    fn times_in_the_future_trigger_nothing() {
        let cfg = AntiSeizeConfig::DEFAULT;
        let (_, out) = run(&cfg, ran_full_at(100 * DAY), 2 * DAY, 3 * DAY, Duty::OFF);
        assert!(out.iter().all(|(_, d, _)| d.is_off()));
    }

    /// With a ramp profile the anti-seize run climbs from 0 in steps of
    /// 10 %, then holds 100 % for the full 10 s: 9 ramp seconds below
    /// 100 % plus 10 at 100 %.
    #[test]
    fn anti_seize_ramps_with_a_ramp_profile() {
        let cfg = AntiSeizeConfig {
            profile: StartProfile::Ramp {
                percent_per_second: 10,
            },
            ..AntiSeizeConfig::DEFAULT
        };
        let noon = 2 * DAY + 12 * 3600;
        let (_, out) = run(&cfg, ran_full_at(0), noon, noon + 60, Duty::OFF);
        let duties: Vec<u8> = out
            .iter()
            .map(|(_, d, _)| d.percent())
            .filter(|p| *p > 0)
            .collect();
        assert_eq!(&duties[..9], &[10, 20, 30, 40, 50, 60, 70, 80, 90]);
        assert_eq!(duties.iter().filter(|p| **p == 100).count(), 10);
        assert_eq!(duties.len(), 19);
    }

    /// Soft kick ramps the purge from the request (here 30 %) up to 100 %,
    /// holds 60 s, then hands back to the request.
    #[test]
    fn purge_ramps_from_the_request_with_soft_kick() {
        let cfg = AntiSeizeConfig {
            profile: StartProfile::SoftKick {
                percent_per_second: 10,
            },
            ..AntiSeizeConfig::DEFAULT
        };
        let low = Duty::new(30).unwrap();
        let (_, out) = run(&cfg, AntiSeizeState::default(), 1000, 1200, low);
        let duties: Vec<u8> = out.iter().map(|(_, d, _)| d.percent()).collect();
        assert_eq!(&duties[..7], &[40, 50, 60, 70, 80, 90, 100]);
        assert_eq!(duties.iter().filter(|p| **p == 100).count(), 60);
        assert_eq!(duties[66], 30);
        assert!(out[66].2 == AntiSeizeStatus::Pass);
    }

    /// An invalid profile is caught by the config check.
    #[test]
    fn invalid_profile_is_rejected() {
        let cfg = AntiSeizeConfig {
            profile: StartProfile::Ramp {
                percent_per_second: 0,
            },
            ..AntiSeizeConfig::DEFAULT
        };
        assert_eq!(
            cfg.validate(),
            Err(AntiSeizeConfigError::Profile(
                StartProfileError::StepOutOfRange
            ))
        );
    }

    proptest! {
        /// With a ramp profile the output is never below the request and
        /// never above 100 %: a ramp only ever adds speed.
        #[test]
        fn ramp_never_goes_below_the_request(
            requests in proptest::collection::vec(0_u8..=100, 1..300),
            step in 1_u8..=100,
        ) {
            let cfg = AntiSeizeConfig {
                profile: StartProfile::Ramp { percent_per_second: step },
                ..AntiSeizeConfig::DEFAULT
            };
            let mut state = AntiSeizeState::default();
            for (i, r) in requests.iter().enumerate() {
                let t = 40_000 + u64::try_from(i).unwrap();
                let req = Duty::new(*r).unwrap();
                let (s, d, _) = step_fn(&cfg, state, t, req);
                state = s;
                prop_assert!(d >= req);
            }
        }

        /// Whatever happens, the output is the request or 100 %: the
        /// module never lowers a request and never invents a speed.
        #[test]
        fn output_is_the_request_or_full(
            requests in proptest::collection::vec(0_u8..=100, 1..200),
            start in 0_u64..(30 * DAY),
            step_len in 1_u64..7200,
        ) {
            let cfg = AntiSeizeConfig::DEFAULT;
            let mut state = AntiSeizeState::default();
            for (i, r) in requests.iter().enumerate() {
                let t = start + u64::try_from(i).unwrap() * step_len;
                let req = Duty::new(*r).unwrap();
                let (s, d, _) = step(&cfg, state, Seconds::new(t), tod(t), req);
                state = s;
                prop_assert!(d == req || d == Duty::FULL);
            }
        }
    }
}
