//! Replay of recorded BX Plus data through `costos-core` (ARCHITECTURE
//! 8.1).
//!
//! **What it answers.** "If CoSTOS had been in charge on this day, where
//! would it have switched the solar pump differently from the RESOL
//! DeltaSol BX Plus?" The input is the replay data in `tests/replay/`
//! (S1–S5 and the solar pump relay, exported from vbus2influx); the output
//! is a [`Report`] with the agreement, pump hours and starts on both sides,
//! and a list of every stretch where the decisions differ.
//!
//! **How a recording becomes control cycles.** The core runs one cycle per
//! second (rule 8). The recording has a row about every 5 s, and only when
//! a value changes (at least once per 60 s). So every row is **held** until
//! the next one: the core sees the same readings for several cycles, as it
//! would with a sensor that updates every few seconds.
//!
//! **Gaps.** Rows more than [`GAP`] apart are a recording gap: nobody knows
//! what the temperatures or the BX did in between. The comparison stops at
//! the gap and restarts after it with a fresh control state, which is what
//! CoSTOS itself would do after stale sensors (ARCHITECTURE 5.1).
//!
//! **What is not counted as a difference.**
//!
//! - Stretches shorter than [`MIN_DIFFERENCE`]: the recording can't place a
//!   switch event more precisely than one sample interval.
//! - The BX's own anti-seize runs (relay on for less than
//!   [`ANTI_SEIZE_MAX`]): CoSTOS has its own anti-seize logic
//!   (ARCHITECTURE 6.2) and its own clock; these runs are listed
//!   separately in [`Report::bx_anti_seize`].
//!
//! This crate is a tool for the PC, not part of the controller, so it may
//! use `std` (rule 1 applies to `costos-core` and `costos-safety` only).

use costos_core::delta_t::{self, DeltaTConfig, DeltaTState, FlowReturn};
use costos_core::{Celsius, Kelvin, PlausibleRange, Reading, Seconds, SensorFault};

/// Rows further apart than this mark a recording gap.
///
/// The export writes at least one row per 60 s, but the raw samples
/// themselves are sometimes up to about 90 s apart (vbus2influx skipping a
/// few telegrams). Holding a value for 90 s is harmless for a solar loop
/// that changes over minutes, and treating such hiccups as gaps would reset
/// the control in the middle of a run. 120 s leaves a margin above that.
pub const GAP: u64 = 120;

/// Differences shorter than this are not listed: about one sample
/// interval of the recording (5 s).
pub const MIN_DIFFERENCE: u64 = 6;

/// BX relay runs shorter than this are its anti-seize run ("blocking
/// protection", 10 s by default), not a solar decision.
pub const ANTI_SEIZE_MAX: u64 = 30;

/// One row of a replay file: Unix time, S1–S5 in °C, relay in percent.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Row {
    /// Unix time in seconds.
    pub t: u64,
    /// S1 collector, S2 store bottom, S3 store top, S4 solar flow, S5 solar
    /// return, in °C, as recorded (one decimal).
    pub s: [f32; 5],
    /// Solar pump relay R1 in percent. The BX only uses 0 or 100: R1
    /// switches the pump's mains on and off.
    pub relay: u8,
    /// Solar pump speed, the BX's PWM A output in percent (PWM2 profile).
    /// The BX starts at its minimum speed (20 %, 30 % since 2026-09-16)
    /// and moves in steps of about 1 %. Not compared yet: CoSTOS's speed
    /// control is still to be written (ARCHITECTURE 10.2, S1).
    pub pwm: u8,
}

/// The BX Plus settings of the reference installation, read off the
/// controller (ARCHITECTURE 8.1): on at 5 K, off at 2 K, collector minimum
/// 10 °C. No minimum run time: the BX data shows none (runs as short as
/// about 4 minutes end exactly at 2 K).
#[must_use]
pub fn bx_reference_config() -> DeltaTConfig {
    DeltaTConfig {
        on: Kelvin::from_const(5.0),
        off: Kelvin::from_const(2.0),
        min_run: Seconds::ZERO,
        collector_min: Some(Celsius::from_const(10.0)),
    }
}

/// Reads a replay file: `#` lines are comments, the first other line is
/// the header `unix_s,s1,s2,s3,s4,s5,relay,pwm`, then one row per line.
///
/// Returns the line number (1-based) and a short reason on the first line
/// that can't be read; a broken file should fail loudly, not replay half a
/// day.
pub fn parse(text: &str) -> Result<Vec<Row>, String> {
    let mut rows = Vec::new();
    let mut header_seen = false;
    for (index, line) in text.lines().enumerate() {
        let number = index.saturating_add(1);
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        if !header_seen {
            if line != "unix_s,s1,s2,s3,s4,s5,relay,pwm" {
                return Err(format!("line {number}: unexpected header {line:?}"));
            }
            header_seen = true;
            continue;
        }
        let fields: Vec<&str> = line.split(',').collect();
        let [t, s1, s2, s3, s4, s5, relay, pwm] = fields.as_slice() else {
            return Err(format!("line {number}: expected 8 fields"));
        };
        let temp = |v: &str| {
            v.parse::<f32>()
                .map_err(|e| format!("line {number}: temperature {v:?}: {e}"))
        };
        let row = Row {
            t: t.parse()
                .map_err(|e| format!("line {number}: time {t:?}: {e}"))?,
            s: [temp(s1)?, temp(s2)?, temp(s3)?, temp(s4)?, temp(s5)?],
            relay: relay
                .parse()
                .map_err(|e| format!("line {number}: relay {relay:?}: {e}"))?,
            pwm: pwm
                .parse()
                .map_err(|e| format!("line {number}: pwm {pwm:?}: {e}"))?,
        };
        // Rows must move forward in time, or "hold until the next row"
        // means nothing.
        if rows.last().is_some_and(|last: &Row| last.t >= row.t) {
            return Err(format!("line {number}: time does not increase"));
        }
        rows.push(row);
    }
    Ok(rows)
}

/// A stretch where CoSTOS and the BX disagree.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Difference {
    /// Unix time of the first second of the stretch.
    pub start: u64,
    /// Length in seconds.
    pub seconds: u64,
    /// What the BX did (CoSTOS did the opposite).
    pub bx_on: bool,
    /// S1 − S2 at the start, in K.
    pub collector_dt: f32,
    /// S4 − S5 at the start, in K.
    pub loop_dt: f32,
}

/// Result of a replay.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Report {
    /// Seconds compared (gaps and BX anti-seize runs excluded).
    pub compared: u64,
    /// Of those, seconds where both agreed.
    pub agreed: u64,
    /// Seconds with the pump on: BX, CoSTOS.
    pub on_seconds: (u64, u64),
    /// Pump starts: BX, CoSTOS (anti-seize runs not counted).
    pub starts: (u32, u32),
    /// Recording gaps: (start, length in seconds).
    pub gaps: Vec<(u64, u64)>,
    /// BX anti-seize runs: (start, length in seconds).
    pub bx_anti_seize: Vec<(u64, u64)>,
    /// Every stretch of at least [`MIN_DIFFERENCE`] where they differ.
    pub differences: Vec<Difference>,
    /// Lowest and highest BX pump speed (PWM A, %) while the BX pump ran,
    /// anti-seize runs left out; `None` if it never ran. Shown for
    /// information until the speed control can be compared.
    ///
    /// Two quirks of the recording: the first sample of a run often still
    /// shows 0 % (PWM A and the relay are separate series with their own
    /// timestamps), so 0 % while running is left out; and until
    /// 2026-09-16 the BX's blocking protection also set 100 % for about
    /// 10 s once a day *while the pump was running*, so the maximum on
    /// such days is 100 % (ARCHITECTURE 8.1).
    pub bx_pwm_range: Option<(u8, u8)>,
}

impl Report {
    /// Share of compared seconds with the same decision, in percent.
    #[must_use]
    pub fn agreement_percent(&self) -> f64 {
        if self.compared == 0 {
            100.0
        } else {
            // u64 to f64: exact up to 2^53 s, far beyond any recording.
            #[allow(clippy::cast_precision_loss)]
            let share = self.agreed as f64 / self.compared as f64;
            share * 100.0
        }
    }
}

/// A recorded value as a core reading: a valid temperature checked against
/// its plausible range, as the daemon would do with a live sensor.
fn reading(value: f32, range: PlausibleRange) -> Reading {
    range.check(Celsius::new(value).ok_or(SensorFault::OutOfRange))
}

/// Marks the seconds of every BX relay run shorter than [`ANTI_SEIZE_MAX`]
/// as anti-seize, given the relay state per second (`None` in gaps).
fn anti_seize_marks(relay: &[Option<bool>], t0: u64, report: &mut Report) -> Vec<bool> {
    let mut marks = vec![false; relay.len()];
    let mut index = 0;
    while let Some(state) = relay.get(index) {
        if *state == Some(true) {
            // Find the end of this run.
            let start = index;
            while relay.get(index) == Some(&Some(true)) {
                index = index.saturating_add(1);
            }
            let length = index.saturating_sub(start);
            if (length as u64) < ANTI_SEIZE_MAX {
                for mark in marks.iter_mut().skip(start).take(length) {
                    *mark = true;
                }
                report
                    .bx_anti_seize
                    .push((t0.saturating_add(start as u64), length as u64));
            }
        } else {
            index = index.saturating_add(1);
        }
    }
    marks
}

/// Replays `rows` through the ΔT control with `config`; with
/// `flow_return`, S4 and S5 feed the flow/return switch-off
/// ([`delta_t::FlowReturn`]).
#[must_use]
pub fn replay(rows: &[Row], config: &DeltaTConfig, flow_return: bool) -> Report {
    let mut report = Report::default();
    let (Some(first), Some(last)) = (rows.first(), rows.last()) else {
        return report;
    };
    let t0 = first.t;
    // One entry per second from the first to the last row: the row that
    // holds in that second, or `None` inside a gap.
    let length = usize::try_from(last.t.saturating_sub(t0).saturating_add(1)).unwrap_or(0);
    let mut held: Vec<Option<Row>> = vec![None; length];
    for pair in rows.windows(2) {
        let [a, b] = pair else { continue };
        let span = b.t.saturating_sub(a.t);
        if span > GAP {
            report.gaps.push((a.t, span));
            // Only the second of the row itself counts; the rest is gap.
            if let Some(slot) = held.get_mut(index_of(a.t, t0)) {
                *slot = Some(*a);
            }
            continue;
        }
        for t in a.t..b.t {
            if let Some(slot) = held.get_mut(index_of(t, t0)) {
                *slot = Some(*a);
            }
        }
    }
    if let Some(slot) = held.last_mut() {
        *slot = Some(*last);
    }

    let relay: Vec<Option<bool>> = held.iter().map(|r| r.map(|r| r.relay > 0)).collect();
    let anti_seize = anti_seize_marks(&relay, t0, &mut report);

    let mut state = DeltaTState::default();
    let mut previous: Option<(bool, bool)> = None;
    let mut open: Option<Difference> = None;
    for (index, row) in held.iter().enumerate() {
        let t = t0.saturating_add(index as u64);
        let Some(row) = row else {
            // Gap: fresh state afterwards, and no start counted across it.
            state = DeltaTState::default();
            previous = None;
            close(&mut open, t, &mut report);
            continue;
        };
        let [s1, s2, _, s4, s5] = row.s;
        let fr = flow_return.then(|| FlowReturn {
            flow: reading(s4, PlausibleRange::COLLECTOR),
            ret: reading(s5, PlausibleRange::COLLECTOR),
        });
        let (next, out) = delta_t::step(
            config,
            state,
            Seconds::new(t),
            reading(s1, PlausibleRange::COLLECTOR),
            reading(s2, PlausibleRange::STORE),
            fr,
        );
        state = next;
        let bx_on = row.relay > 0;
        let ours = out.pump_on;

        // BX anti-seize seconds: CoSTOS's decision still counts for its
        // own statistics, but there is nothing to compare.
        let skip = anti_seize.get(index).copied().unwrap_or(false);
        let bx_for_stats = bx_on && !skip;
        if let Some((prev_bx, prev_ours)) = previous {
            if bx_for_stats && !prev_bx {
                report.starts.0 = report.starts.0.saturating_add(1);
            }
            if ours && !prev_ours {
                report.starts.1 = report.starts.1.saturating_add(1);
            }
        }
        previous = Some((bx_for_stats, ours));
        if ours {
            report.on_seconds.1 = report.on_seconds.1.saturating_add(1);
        }
        if skip {
            close(&mut open, t, &mut report);
            continue;
        }
        if bx_on {
            report.on_seconds.0 = report.on_seconds.0.saturating_add(1);
        }
        if bx_on && row.pwm > 0 {
            report.bx_pwm_range = Some(match report.bx_pwm_range {
                None => (row.pwm, row.pwm),
                Some((lo, hi)) => (lo.min(row.pwm), hi.max(row.pwm)),
            });
        }
        report.compared = report.compared.saturating_add(1);
        if bx_on == ours {
            report.agreed = report.agreed.saturating_add(1);
            close(&mut open, t, &mut report);
        } else if open.is_none_or(|d| d.bx_on != bx_on) {
            close(&mut open, t, &mut report);
            open = Some(Difference {
                start: t,
                seconds: 0,
                bx_on,
                collector_dt: s1 - s2,
                loop_dt: s4 - s5,
            });
        }
    }
    close(&mut open, last.t.saturating_add(1), &mut report);
    report
}

/// Index of second `t` in the per-second list starting at `t0`.
fn index_of(t: u64, t0: u64) -> usize {
    usize::try_from(t.saturating_sub(t0)).unwrap_or(usize::MAX)
}

/// Ends an open difference at `end` (exclusive) and keeps it if it is long
/// enough to mean something.
fn close(open: &mut Option<Difference>, end: u64, report: &mut Report) {
    if let Some(mut d) = open.take() {
        d.seconds = end.saturating_sub(d.start);
        if d.seconds >= MIN_DIFFERENCE {
            report.differences.push(d);
        }
    }
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    /// The six replay days from the repository.
    fn day(name: &str) -> Vec<Row> {
        let path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../tests/replay")
            .join(format!("{name}.csv"));
        parse(&std::fs::read_to_string(&path).unwrap()).unwrap()
    }

    const DAYS: [&str; 7] = [
        "2026-07-09",
        "2026-07-13",
        "2026-08-03",
        "2026-08-17",
        "2026-09-16",
        "2026-11-06",
        "2026-11-14",
    ];

    /// The regression test for the ΔT control: with the BX's own settings
    /// and the flow/return switch-off, CoSTOS decides like the BX on every
    /// replay day in at least 99 % of the seconds. A change to the control
    /// that breaks this has to explain why (ARCHITECTURE 8.1).
    #[test]
    fn every_replay_day_matches_the_bx() {
        let cfg = bx_reference_config();
        for name in DAYS {
            let report = replay(&day(name), &cfg, true);
            assert!(
                report.agreement_percent() >= 99.0,
                "{name}: {:.2} %",
                report.agreement_percent()
            );
        }
    }

    /// 2026-07-09 shows why the flow/return switch-off exists: without it,
    /// CoSTOS stops the pump at least half an hour before the BX.
    #[test]
    fn without_flow_return_the_sunny_evening_ends_early() {
        let cfg = bx_reference_config();
        let rows = day("2026-07-09");
        let with = replay(&rows, &cfg, true);
        let without = replay(&rows, &cfg, false);
        assert!(without.on_seconds.1 + 30 * 60 <= with.on_seconds.1);
        assert!(
            without
                .differences
                .iter()
                .any(|d| d.bx_on && d.seconds >= 30 * 60)
        );
    }

    /// The day without sun: no run on either side.
    #[test]
    fn day_without_sun_has_no_runs() {
        let report = replay(&day("2026-11-06"), &bx_reference_config(), true);
        assert_eq!(report.on_seconds, (0, 0));
        assert_eq!(report.starts, (0, 0));
        assert_eq!(report.bx_pwm_range, None);
    }

    /// The BX speed range: its minimum was 20 % before 2026-09-16 and
    /// 30 % after; the maximum on 07-09 is the daily 100 % blocking
    /// protection pulse during the run.
    #[test]
    fn bx_speed_range_is_recorded() {
        let summer = replay(&day("2026-07-09"), &bx_reference_config(), true);
        assert_eq!(summer.bx_pwm_range, Some((20, 100)));
        let autumn = replay(&day("2026-11-14"), &bx_reference_config(), true);
        assert_eq!(autumn.bx_pwm_range.map(|r| r.0), Some(30));
    }

    /// A real gap (none of the replay days has one, so it is made up here):
    /// it is reported, nothing is compared inside it, and the control
    /// starts fresh afterwards instead of continuing a run it can't know
    /// about.
    #[test]
    fn gaps_are_reported_and_skipped() {
        let mut text = String::from("unix_s,s1,s2,s3,s4,s5,relay,pwm\n");
        // Running before the gap: collector 10 K above the store.
        for i in 0..10 {
            text.push_str(&format!("{},60,50,55,62,52,100,30\n", 1000 + i * 5));
        }
        // 10 minutes without data, then only 3 K: CoSTOS can't know the
        // pump was running and doesn't start at 3 K; the BX keeps running.
        for i in 0..10 {
            text.push_str(&format!("{},53,50,55,52,52,100,30\n", 1645 + i * 5));
        }
        let report = replay(&parse(&text).unwrap(), &bx_reference_config(), true);
        assert_eq!(report.gaps, vec![(1045, 600)]);
        // 46 s before the gap and 46 s after it; the 599 s inside are not
        // compared.
        assert_eq!(report.compared, 92);
        assert_eq!(report.differences.len(), 1);
        assert_eq!(report.differences[0].start, 1645);
    }

    /// Broken files fail loudly with a line number.
    #[test]
    fn broken_files_are_rejected() {
        assert!(parse("nonsense").is_err());
        let ok = "unix_s,s1,s2,s3,s4,s5,relay,pwm\n10,1,2,3,4,5,0,0\n";
        assert_eq!(parse(ok).unwrap().len(), 1);
        let backwards = "unix_s,s1,s2,s3,s4,s5,relay,pwm\n10,1,2,3,4,5,0,0\n9,1,2,3,4,5,0,0\n";
        assert!(parse(backwards).unwrap_err().contains("line 3"));
        let short = "unix_s,s1,s2,s3,s4,s5,relay,pwm\n10,1,2,3\n";
        assert!(parse(short).is_err());
    }

    /// A BX run shorter than 30 s is its anti-seize run: listed, not
    /// counted as a difference or a start.
    #[test]
    fn short_bx_runs_count_as_anti_seize() {
        let mut text = String::from("unix_s,s1,s2,s3,s4,s5,relay,pwm\n");
        for i in 0..20 {
            let relay = if (5..7).contains(&i) { 100 } else { 0 };
            text.push_str(&format!(
                "{},20,40,45,25,25,{relay},{relay}\n",
                1000 + i * 5
            ));
        }
        let report = replay(&parse(&text).unwrap(), &bx_reference_config(), true);
        assert_eq!(report.bx_anti_seize, vec![(1025, 10)]);
        assert!(report.differences.is_empty());
        assert_eq!(report.starts, (0, 0));
    }
}
