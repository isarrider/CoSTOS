//! `costos-replay`: replays recorded BX Plus days through the CoSTOS ΔT
//! control and prints where it would have decided differently
//! (ARCHITECTURE 8.1).
//!
//! ```text
//! cargo run -p costos-replay -- tests/replay/*.csv
//! cargo run -p costos-replay -- --no-flow-return tests/replay/2026-07-09.csv
//! cargo run -p costos-replay -- --pi tests/replay/*.csv   # CoSTOS's PI speed control
//! cargo run -p costos-replay -- --setpoint 8 tests/replay/*.csv   # another ΔT setpoint
//! ```
//!
//! Times are printed in UTC, so the output doesn't depend on the PC's
//! time zone; the files' header comments name the local day.

use costos_core::speed::SpeedConfig;
use costos_replay::{Report, bx_reference_config, bx_speed_config, parse, replay_with_speed};
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
    if let Some((lo, hi)) = r.bx_pwm_range {
        println!("   BX pump speed while on: {lo}–{hi} % (PWM A)");
    }
    if let Some((bx, ours, diff)) = r.speed_means() {
        println!(
            "   speed while both ran: BX {bx:.1} %, CoSTOS {ours:.1} %, mean difference {diff:.1} points"
        );
    }
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
    let mut pi = false;
    let mut setpoint: Option<f32> = None;
    let mut want_setpoint = false;
    let mut files = Vec::new();
    for arg in std::env::args().skip(1) {
        if want_setpoint {
            want_setpoint = false;
            match arg.parse::<f32>() {
                Ok(v) if v > 0.0 && v < 100.0 => setpoint = Some(v),
                _ => {
                    eprintln!("--setpoint needs a value in K, e.g. --setpoint 8");
                    return ExitCode::FAILURE;
                }
            }
            continue;
        }
        match arg.as_str() {
            "--setpoint" => want_setpoint = true,
            "--no-flow-return" => flow_return = false,
            "--pi" => pi = true,
            "-h" | "--help" => {
                println!(
                    "usage: costos-replay [--no-flow-return] [--pi] [--setpoint K] FILE.csv ..."
                );
                return ExitCode::SUCCESS;
            }
            _ => files.push(arg),
        }
    }
    if files.is_empty() {
        eprintln!("usage: costos-replay [--no-flow-return] [--pi] [--setpoint K] FILE.csv ...");
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
        // Speed control: BX-like steps by default (compares like with like),
        // CoSTOS's own PI controller with --pi.
        // --setpoint overrides the ΔT setpoint of either speed control.
        let first = rows.first().map_or(0, |r| r.t);
        let mut speed = if pi {
            SpeedConfig::DEFAULT
        } else {
            bx_speed_config(first)
        };
        if let Some(k) = setpoint.and_then(costos_core::Kelvin::new) {
            speed.setpoint = k;
        }
        let r = replay_with_speed(&rows, &config, flow_return, &speed);
        print(file, &r);
        total.compared += r.compared;
        total.agreed += r.agreed;
        total.on_seconds.0 += r.on_seconds.0;
        total.on_seconds.1 += r.on_seconds.1;
        total.starts.0 += r.starts.0;
        total.starts.1 += r.starts.1;
        total.speed_seconds += r.speed_seconds;
        total.speed_sums.0 += r.speed_sums.0;
        total.speed_sums.1 += r.speed_sums.1;
        total.speed_sums.2 += r.speed_sums.2;
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
        if let Some((bx, ours, diff)) = total.speed_means() {
            println!(
                "   speed while both ran: BX {bx:.1} %, CoSTOS {ours:.1} %, mean difference {diff:.1} points"
            );
        }
    }
    ExitCode::SUCCESS
}
