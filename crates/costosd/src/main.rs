//! `costosd`: the CoSTOS daemon (ARCHITECTURE 6.1, milestone 4).
//!
//! **What it does now.** The skeleton of the program that will run on the
//! Pi, complete except for the hardware:
//!
//! 1. Loads the settings from the revision store (`costos-config`) in the
//!    state directory. On a first start it saves the reference
//!    installation's settings as revision 1. If the newest revision is
//!    damaged it falls back to the newest good one and says which it
//!    skipped.
//! 2. Loads the counters (`counters.json`); a damaged file stops the
//!    start, so the yield statistics are never silently reset.
//! 3. Runs one control second after the other through
//!    [`costos_cycle::step`], the very function the simulation tests run,
//!    against a [`Backend`]. The only backend today is the simulator
//!    (real time or accelerated); the hardware backend comes with the HAT.
//! 4. Prints a status line every `--status-every` seconds and logs every
//!    change of the supervisor's interventions and of the alarms
//!    (ARCHITECTURE 6.4: every safety intervention is logged).
//! 5. Saves the counters every [`SAVE_EVERY`] and at the end.
//!
//! **Not yet:** hardware backend and watchdog, web interface and metrics,
//! persisting latched alarms, signal handling (with the simulator the run
//! ends after `--days`; on the Pi systemd stops it and at most
//! [`SAVE_EVERY`] of counting is lost).
//!
//! ```text
//! costosd --state-dir /var/lib/costos --sim --day-of-year 196 --days 3 --speed 0
//! ```

mod backend;
mod persist;

use std::path::PathBuf;
use std::process::ExitCode;
use std::time::{SystemTime, UNIX_EPOCH};

use costos_config::Settings;
use costos_config::store::Store;
use costos_core::{Kelvin, Reading};
use costos_cycle::{CycleState, Readings};

use crate::backend::{Backend, Simulator};

/// How often the counters are saved, in control seconds.
pub const SAVE_EVERY: u64 = 600;

/// How many settings revisions are kept.
const KEEP_REVISIONS: usize = 50;

/// Command line options.
#[derive(Clone, Debug, PartialEq)]
struct Options {
    state_dir: PathBuf,
    day_of_year: u32,
    days: u32,
    speed: u32,
    status_every: u64,
    store: (f32, f32),
}

const USAGE: &str = "\
usage: costosd --state-dir DIR [--sim] [options]

  --state-dir DIR      settings revisions and counters (created if missing)
  --sim                simulator backend (the only one for now; default)
  --day-of-year N      first simulated day, 1-365 (default 196, mid-July)
  --days N             simulated days to run (default 1)
  --speed N            1 = real time, 60 = a minute per second, 0 = as fast
                       as possible (default 0)
  --status-every S     status line every S control seconds (default 900)
  --store B,T          store bottom/top at the start, °C (default 40,45)
";

fn parse_args(args: impl IntoIterator<Item = String>) -> Result<Options, String> {
    let mut o = Options {
        state_dir: PathBuf::new(),
        day_of_year: 196,
        days: 1,
        speed: 0,
        status_every: 900,
        store: (40.0, 45.0),
    };
    let mut it = args.into_iter();
    while let Some(a) = it.next() {
        let mut value = |name: &str| it.next().ok_or(format!("{name} needs a value"));
        match a.as_str() {
            "--state-dir" => o.state_dir = PathBuf::from(value("--state-dir")?),
            "--sim" => {}
            "--day-of-year" => {
                o.day_of_year = value("--day-of-year")?
                    .parse()
                    .map_err(|e| format!("--day-of-year: {e}"))?;
                if !(1..=365).contains(&o.day_of_year) {
                    return Err("--day-of-year: 1-365".into());
                }
            }
            "--days" => {
                o.days = value("--days")?
                    .parse()
                    .map_err(|e| format!("--days: {e}"))?
            }
            "--speed" => {
                o.speed = value("--speed")?
                    .parse()
                    .map_err(|e| format!("--speed: {e}"))?
            }
            "--status-every" => {
                o.status_every = value("--status-every")?
                    .parse()
                    .map_err(|e| format!("--status-every: {e}"))?;
            }
            "--store" => {
                let v = value("--store")?;
                let (b, t) = v.split_once(',').ok_or("--store: B,T")?;
                o.store = (
                    b.parse().map_err(|e| format!("--store: {e}"))?,
                    t.parse().map_err(|e| format!("--store: {e}"))?,
                );
            }
            "-h" | "--help" => return Err(String::new()),
            other => return Err(format!("unknown option {other}")),
        }
    }
    if o.state_dir.as_os_str().is_empty() {
        return Err("--state-dir is required".into());
    }
    Ok(o)
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_secs())
}

/// A reading for the status line: `12.3` or the fault.
fn show(r: Reading) -> String {
    match r {
        Ok(c) => format!("{:5.1}", c.get()),
        Err(f) => format!("{f:?}"),
    }
}

fn show_opt(r: Option<Reading>) -> String {
    r.map_or_else(|| "  -  ".into(), show)
}

/// `HH:MM` of a time of day in seconds.
fn hm(seconds: u32) -> String {
    format!("{:02}:{:02}", seconds / 3600, seconds % 3600 / 60)
}

fn status_line(day: u32, tod: u32, r: &Readings, out: &costos_cycle::CycleOutput) -> String {
    let dt = out
        .solar
        .delta_t
        .delta_t
        .map_or_else(|| "  -  ".into(), |k: Kelvin| format!("{:5.1}", k.get()));
    let c = out.counters;
    #[allow(clippy::cast_precision_loss)]
    let kwh = c.heat_wh as f64 / 1000.0;
    format!(
        "day {day} {}  S1 {} S2 {} S3 {} S4 {} S5 {}  ΔT {dt}  pump {:3} %  \
         {:?}  heat {kwh:.2} kWh, {} starts{}",
        hm(tod),
        show(r.collector),
        show(r.store_bottom),
        show_opt(r.store_top),
        show_opt(r.flow),
        show_opt(r.ret),
        out.duty.percent(),
        out.solar.speed,
        c.starts,
        if out.alarms.any_alarm() {
            format!("  ALARM {:?}", out.alarms)
        } else {
            String::new()
        },
    )
}

/// The settings to run with: the newest valid revision, or the reference
/// installation saved as revision 1 on a first start.
fn load_settings(store: &Store) -> Result<costos_cycle::CycleConfig, String> {
    let (latest, skipped) = store
        .latest_valid()
        .map_err(|e| format!("{}: {e}", store.dir().display()))?;
    for (n, e) in &skipped {
        eprintln!("settings: revision {n} skipped: {e}");
    }
    let rev = match latest {
        Some(rev) => rev,
        None if skipped.is_empty() => {
            let rev = store
                .save(
                    &Settings::reference(),
                    "first start: reference installation",
                    unix_now(),
                )
                .map_err(|e| format!("settings: {e}"))?;
            eprintln!("settings: none found, saved the reference installation as revision 1");
            rev
        }
        // Revisions exist but none is usable: do not quietly replace a
        // configured installation with the reference one.
        None => return Err("settings: no usable revision; fix or remove the files".into()),
    };
    eprintln!("settings: revision {} ({})", rev.revision, rev.note);
    rev.settings
        .to_cycle_config()
        .map_err(|e| format!("settings: {e}"))
}

fn run(o: &Options) -> Result<(), String> {
    std::fs::create_dir_all(&o.state_dir).map_err(|e| format!("{}: {e}", o.state_dir.display()))?;
    let store = Store::open(o.state_dir.join("settings"), KEEP_REVISIONS)
        .map_err(|e| format!("settings: {e}"))?;
    let config = load_settings(&store)?;
    let counters_path = o.state_dir.join("counters.json");
    let counters = persist::load(&counters_path)?;
    eprintln!(
        "counters: {} Wh, {} starts, {} h pump",
        counters.heat_wh,
        counters.starts,
        counters.pump_seconds / 3600
    );

    let mut backend = Simulator::new(o.day_of_year, o.store, o.speed);
    let mut state = CycleState::start(counters);
    let total = u64::from(o.days).saturating_mul(86_400);
    let mut last_interventions = costos_safety::Interventions::default();
    let mut last_alarms = costos_core::monitor::Alarms::default();

    for i in 0..total {
        let tick = backend.tick();
        let raw = backend.read();
        let (next, out) = costos_cycle::step(&config, state, tick.now, tick.time_of_day, &raw);
        state = next;
        backend.apply(out.duty);

        let tod = tick.time_of_day.get();
        if out.interventions != last_interventions {
            eprintln!(
                "day {} {}  supervisor: {:?}",
                tick.day,
                hm(tod),
                out.interventions
            );
            last_interventions = out.interventions;
        }
        if out.alarms != last_alarms {
            eprintln!("day {} {}  alarms: {:?}", tick.day, hm(tod), out.alarms);
            last_alarms = out.alarms;
        }
        if i.checked_rem(o.status_every) == Some(0) {
            println!(
                "{}  | {}",
                status_line(tick.day, tod, &out.readings, &out),
                backend.status()
            );
        }
        if i % SAVE_EVERY == SAVE_EVERY - 1 {
            persist::save(&counters_path, state.counters())
                .map_err(|e| format!("counters: {e}"))?;
        }
    }
    persist::save(&counters_path, state.counters()).map_err(|e| format!("counters: {e}"))?;
    let c = state.counters();
    println!(
        "end: heat {} Wh, pump {} Wh, {} starts, {} h pump | {}",
        c.heat_wh,
        c.pump_wh,
        c.starts,
        c.pump_seconds / 3600,
        backend.status()
    );
    Ok(())
}

fn main() -> ExitCode {
    match parse_args(std::env::args().skip(1)) {
        Ok(o) => match run(&o) {
            Ok(()) => ExitCode::SUCCESS,
            Err(e) => {
                eprintln!("costosd: {e}");
                ExitCode::FAILURE
            }
        },
        Err(e) => {
            if !e.is_empty() {
                eprintln!("costosd: {e}\n");
            }
            eprint!("{USAGE}");
            ExitCode::from(2)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn args(s: &str) -> Vec<String> {
        s.split_whitespace().map(String::from).collect()
    }

    #[test]
    fn options() {
        let o = parse_args(args("--state-dir /tmp/x --days 3 --store 50,60")).unwrap();
        assert_eq!(o.days, 3);
        assert!((o.store.1 - 60.0).abs() < 1e-6);
        assert!(parse_args(args("--days 3")).is_err());
        assert!(parse_args(args("--state-dir x --day-of-year 400")).is_err());
        assert!(parse_args(args("--state-dir x --bogus")).is_err());
    }

    /// A whole simulated summer day through the daemon: settings saved on
    /// the first start, heat counted, counters persisted and continued by a
    /// second run.
    #[test]
    fn first_start_and_continue() {
        let dir = std::env::temp_dir().join(format!("costosd-run-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let o = parse_args(vec![
            "--state-dir".into(),
            dir.display().to_string(),
            "--status-every".into(),
            "0".into(),
        ])
        .unwrap();
        run(&o).unwrap();
        let first = persist::load(&dir.join("counters.json")).unwrap();
        assert!(first.heat_wh > 5_000, "{first:?}");
        assert!(dir.join("settings/rev-000001.json").exists());

        run(&o).unwrap();
        let second = persist::load(&dir.join("counters.json")).unwrap();
        assert!(second.heat_wh > first.heat_wh);
        assert!(second.starts > first.starts);
        // Still only the one revision: the second start used it.
        assert!(!dir.join("settings/rev-000002.json").exists());
    }
}
