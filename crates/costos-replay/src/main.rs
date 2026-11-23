//! `costos-replay`: replays recorded BX Plus days through the CoSTOS ΔT
//! control and prints where it would have decided differently
//! (ARCHITECTURE 8.1).
//!
//! ```text
//! cargo run -p costos-replay -- tests/replay/*.csv
//! cargo run -p costos-replay -- --no-flow-return tests/replay/2026-07-09.csv
//! ```
//!
//! Times are printed in UTC, so the output doesn't depend on the PC's
//! time zone; the files' header comments name the local day.

use costos_replay::{Report, bx_reference_config, parse, replay};
use std::process::ExitCode;

/// UTC time of day `hh:mm:ss` of a Unix time. A day of seconds has no
/// leap seconds in Unix time, so the remainder is exact.
fn hms(t: u64) -> String {
    let s = t % 86_400;
    format!("{:02}:{:02}:{:02}", s / 3600, s / 60 % 60, s % 60)
}

/// Seconds as hours with one decimal.
fn hours(s: u64) -> String {
    #[allow(clippy::cast_precision_loss)]
    let h = s as f64 / 3600.0;
    format!("{h:.1} h")
}

fn print(name: &str, r: &Report) {
    println!("== {name}");
    println!(
        "   agreement {:.2} %   pump on: BX {}, CoSTOS {}   starts: BX {}, CoSTOS {}",
        r.agreement_percent(),
        hours(r.on_seconds.0),
        hours(r.on_seconds.1),
        r.starts.0,
        r.starts.1
    );
    for (start, len) in &r.gaps {
        println!("   gap          {} UTC, {len} s", hms(*start));
    }
    for (start, len) in &r.bx_anti_seize {
        println!("   BX anti-seize {} UTC, {len} s", hms(*start));
    }
    for d in &r.differences {
        println!(
            "   differs      {} UTC, {:>5} s: BX {}, CoSTOS {}  (S1-S2 {:+.1} K, S4-S5 {:+.1} K)",
            hms(d.start),
            d.seconds,
            if d.bx_on { "on " } else { "off" },
            if d.bx_on { "off" } else { "on " },
            d.collector_dt,
            d.loop_dt
        );
    }
}

#[allow(clippy::arithmetic_side_effects)]
fn main() -> ExitCode {
    let mut flow_return = true;
    let mut files = Vec::new();
    for arg in std::env::args().skip(1) {
        match arg.as_str() {
            "--no-flow-return" => flow_return = false,
            "-h" | "--help" => {
                println!("usage: costos-replay [--no-flow-return] FILE.csv ...");
                return ExitCode::SUCCESS;
            }
            _ => files.push(arg),
        }
    }
    if files.is_empty() {
        eprintln!("usage: costos-replay [--no-flow-return] FILE.csv ...");
        return ExitCode::FAILURE;
    }
    let config = bx_reference_config();
    let mut total = Report::default();
    for file in &files {
        let rows = match std::fs::read_to_string(file)
            .map_err(|e| e.to_string())
            .and_then(|t| parse(&t))
        {
            Ok(rows) => rows,
            Err(e) => {
                eprintln!("{file}: {e}");
                return ExitCode::FAILURE;
            }
        };
        let r = replay(&rows, &config, flow_return);
        print(file, &r);
        total.compared += r.compared;
        total.agreed += r.agreed;
        total.on_seconds.0 += r.on_seconds.0;
        total.on_seconds.1 += r.on_seconds.1;
        total.starts.0 += r.starts.0;
        total.starts.1 += r.starts.1;
    }
    if files.len() > 1 {
        println!(
            "== total: agreement {:.2} %   pump on: BX {}, CoSTOS {}   starts: BX {}, CoSTOS {}",
            total.agreement_percent(),
            hours(total.on_seconds.0),
            hours(total.on_seconds.1),
            total.starts.0,
            total.starts.1
        );
    }
    ExitCode::SUCCESS
}
