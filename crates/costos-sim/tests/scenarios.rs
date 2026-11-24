//! Simulation tests (ARCHITECTURE 8, item 3): the whole control chain
//! (`costos-core::solar` + `costos-safety`) against the thermal model of the
//! reference installation, in a closed loop, one simulated day each.
//!
//! Each test states what must hold and why. The thresholds are chosen from
//! the physics or the specification, not from whatever the current code
//! happens to produce: a change that breaks one has to explain itself.

// Test code: indexing into a run's samples and plain arithmetic on
// simulated seconds can't overflow here, and a panic is just a failed
// test (the same exceptions clippy.toml makes for unit tests).
#![allow(
    clippy::indexing_slicing,
    clippy::arithmetic_side_effects,
    clippy::unwrap_used
)]

use costos_sim::faults::{Fault, Kind, STALE_AFTER, Target};
use costos_sim::weather::{Clouds, Day};
use costos_sim::{Run, Sample, Scenario, run};

const H: u32 = 3600;

fn hours(r: &Run, from: f32, to: f32) -> impl Iterator<Item = &Sample> {
    r.samples
        .iter()
        .filter(move |s| (from * 3600.0..to * 3600.0).contains(&(s.t as f32)))
}

/// Most starts within any one hour of the day.
fn max_starts_per_hour(r: &Run) -> usize {
    let starts: Vec<u32> = r
        .samples
        .windows(2)
        .filter(|w| w[0].output.is_off() && !w[1].output.is_off())
        .map(|w| w[1].t)
        .collect();
    starts
        .iter()
        .map(|&t0| starts.iter().filter(|&&t| t >= t0 && t < t0 + H).count())
        .max()
        .unwrap_or(0)
}

/// A clear summer day: the speed control holds ΔT at its 10 K setpoint
/// while it has room to (the closed-loop check replay can't give,
/// ARCHITECTURE 8.1), the pump starts only a few times, and the day's heat
/// is plausible.
#[test]
fn sunny_summer_day() {
    let r = run(&Scenario::summer_day());

    // While controlling with room on both sides (above the minimum, below
    // the maximum), ΔT stays at the setpoint: mean within 0.5 K, and 95 %
    // of the seconds within ±1.5 K.
    let controlling: Vec<f32> = r
        .samples
        .iter()
        .filter(|s| s.output.percent() > 32 && s.output.percent() < 98)
        .filter_map(|s| s.delta_t)
        .collect();
    assert!(
        controlling.len() > 3 * H as usize,
        "{} s",
        controlling.len()
    );
    let mean = controlling.iter().sum::<f32>() / controlling.len() as f32;
    assert!((mean - 10.0).abs() < 0.5, "mean ΔT {mean}");
    let within = controlling
        .iter()
        .filter(|d| (**d - 10.0).abs() <= 1.5)
        .count();
    assert!(
        within * 100 >= controlling.len() * 95,
        "{within} of {}",
        controlling.len()
    );

    // A handful of starts, as recorded on clear days (8.1), not dozens.
    assert!(r.starts() <= 10, "{} starts", r.starts());

    // Heat: on a clear July day the reference loop delivers about 15–20 kWh
    // (the Python yield model's July average is 7 kWh/day over all weather;
    // a clear day is two to three times that).
    assert!((14.0..=22.0).contains(&r.heat_kwh), "{} kWh", r.heat_kwh);

    // CoSTOS's own heat counter (from S4, S5 and the flow table) agrees
    // with the model's true heat within 3 %: in the model the flow table
    // is exact, so this checks the arithmetic and the sensor placement,
    // not the table (which is only good to about ±30 % in reality).
    let counted = r.counters.heat_wh as f64 / 1000.0;
    assert!(
        (counted / r.heat_kwh - 1.0).abs() < 0.03,
        "counted {counted} kWh, true {} kWh",
        r.heat_kwh
    );
    assert_eq!(r.counters.starts as usize, r.starts());
    assert_eq!(r.counters.pump_seconds as usize, r.on_seconds());
    // The pump's electricity is a small fraction of the heat: a solar
    // yield ratio above 50 (good high-efficiency pump systems reach
    // 50–150; here about 90).
    assert!(r.counters.heat_wh > 50 * r.counters.pump_wh.max(1));
    // Nothing dangerous happened, and no plausibility check complained.
    assert!(r.max_collector() < 100.0);
    assert_eq!(r.first_alarm(|a| a.any_alarm()), None);
    assert!(
        r.samples
            .iter()
            .all(|s| !s.interventions.collector_emergency && !s.interventions.store_emergency)
    );
}

/// Passing clouds every 20 minutes: the pump follows the sun without
/// chattering. The supervisor's minimum off time (60 s) holds after every
/// stop, and there are never more than 12 starts in an hour.
#[test]
fn cloudy_day_does_not_chatter() {
    let mut s = Scenario::summer_day();
    s.day.clouds = Clouds::Broken {
        period: 1200,
        sunny_fraction: 0.4,
        shade_factor: 0.1,
    };
    let r = run(&s);
    assert!(r.starts() > 3, "the pump should still follow the sun");
    assert!(
        max_starts_per_hour(&r) <= 12,
        "{} starts in one hour",
        max_starts_per_hour(&r)
    );
    // Minimum off time: after a stop, no start within 60 s.
    let mut last_stop: Option<u32> = None;
    for w in r.samples.windows(2) {
        if !w[0].output.is_off() && w[1].output.is_off() {
            last_stop = Some(w[1].t);
        }
        if w[0].output.is_off() && !w[1].output.is_off() {
            if let Some(stop) = last_stop {
                assert!(
                    w[1].t - stop >= 60,
                    "restart {} s after a stop",
                    w[1].t - stop
                );
            }
        }
    }
    assert!(r.heat_kwh < run(&Scenario::summer_day()).heat_kwh);
}

/// A store that starts nearly full on a clear day: loading stops at the
/// store maximum (90 °C), the collector then stagnates, the supervisor
/// shuts the pump off at 130 °C and keeps it off until the collector has
/// cooled by the hysteresis.
#[test]
fn full_store_and_stagnation() {
    let mut s = Scenario::summer_day();
    s.store_start = (86.0, 88.0);
    s.draws.clear();
    let r = run(&s);

    // The store maximum shows as a notice (not an alarm).
    assert!(r.first_alarm(|a| a.store_max).is_some());
    // Store maximum: the store bottom never gets meaningfully above 90 °C.
    assert!(r.max_store() < 90.5, "{}", r.max_store());
    // While the store is at its maximum, no loading is asked for.
    assert!(
        r.samples
            .iter()
            .filter(|x| x.temps[1] >= 90.0)
            .all(|x| x.requested.is_off() || x.requested.percent() == 100),
        "loading requested above the store maximum"
    );

    // The collector stagnates and the emergency acts.
    assert!(r.max_collector() > 130.0, "{}", r.max_collector());
    for x in &r.samples {
        if x.temps[0] >= 130.0 {
            assert!(x.output.is_off(), "pump on at {} °C collector", x.temps[0]);
            assert!(x.interventions.collector_emergency);
        }
    }
    // The latch holds in the hysteresis band (120–130 °C) on the way down ...
    let first_emergency = r
        .samples
        .iter()
        .position(|x| x.interventions.collector_emergency)
        .unwrap();
    for x in &r.samples[first_emergency..] {
        if x.temps[0] > 120.5 {
            assert!(x.output.is_off());
        }
    }
    // ... and is released once the collector is below 120 °C.
    let last = r.samples.last().unwrap();
    assert!(last.temps[0] < 120.0);
    assert!(!last.interventions.collector_emergency);
}

/// A collector sensor wire that is broken for 2 minutes at 13:00 (a loose
/// terminal): the pump stops in the same second, stays off while the value
/// is unknown, and runs again afterwards.
#[test]
fn collector_sensor_open_briefly() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Sensor(0),
        kind: Kind::Open,
        from: 13 * H,
        until: Some(13 * H + 120),
    });
    let r = run(&s);
    assert!(
        hours(&r, 12.9, 12.99).all(|x| !x.output.is_off()),
        "running before"
    );
    let during = |x: &&Sample| (13 * H..13 * H + 120).contains(&x.t);
    assert!(
        r.samples.iter().filter(during).all(|x| x.output.is_off()),
        "off during the fault"
    );
    assert!(
        r.samples
            .iter()
            .filter(during)
            .all(|x| x.interventions.sensor_unknown)
    );
    // The alarm comes in the same second as the fault.
    assert_eq!(r.first_alarm(|a| a.sensor.is_some()), Some(13 * H));
    assert!(
        hours(&r, 13.1, 13.5).any(|x| !x.output.is_off()),
        "running again after"
    );
}

/// The same fault for 30 minutes: without flow the collector stagnates at
/// noon within about 20 minutes. When the sensor is back, the supervisor
/// sees more than 130 °C and keeps the pump off for the rest of the sunny
/// day. That is the intended, safe outcome, and the reason a sensor fault
/// at midday raises an alarm at once (ARCHITECTURE 6.3): someone has
/// minutes, not hours, to fix it before the day's solar heat is lost.
#[test]
fn collector_sensor_open_long_ends_in_stagnation() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Sensor(0),
        kind: Kind::Open,
        from: 13 * H,
        until: Some(13 * H + 1800),
    });
    let r = run(&s);
    let back = r.samples.iter().find(|x| x.t == 13 * H + 1800).unwrap();
    assert!(back.temps[0] > 130.0, "{} °C", back.temps[0]);
    assert!(
        r.samples
            .iter()
            .filter(|x| x.temps[0] >= 130.0)
            .all(|x| x.output.is_off())
    );
    assert!(
        r.samples
            .iter()
            .filter(|x| x.t > 13 * H + 1800)
            .any(|x| x.interventions.collector_emergency)
    );
}

/// A shorted store sensor: same as above, the store side.
#[test]
fn store_sensor_short() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Sensor(1),
        kind: Kind::Short,
        from: 14 * H,
        until: Some(14 * H + 600),
    });
    let r = run(&s);
    assert!(hours(&r, 14.0, 14.0 + 600.0 / 3600.0).all(|x| x.output.is_off()));
    assert!(hours(&r, 14.3, 15.0).any(|x| !x.output.is_off()));
}

/// A collector sensor that stops updating (hung bus) at 13:00: the last
/// value is used for at most the stale timeout, then the pump stops and
/// stays off.
#[test]
fn collector_sensor_goes_stale() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Sensor(0),
        kind: Kind::NoUpdate,
        from: 13 * H,
        until: None,
    });
    let r = run(&s);
    let stale_from = 13 * H + STALE_AFTER;
    assert!(
        r.samples
            .iter()
            .filter(|x| x.t >= stale_from)
            .all(|x| x.output.is_off()),
        "pump on with a stale collector reading"
    );
}

/// A pump that gets its signal but doesn't turn, from 11:00: no heat
/// reaches the store, the collector heats up, and the supervisor's
/// collector emergency still stops the (useless) signal at 130 °C. There is
/// no pump feedback in the chain yet (ARCHITECTURE 5.4, later), so this is
/// the last line before the hardware: the stuck pump itself is not
/// detected, only its consequence.
#[test]
fn stuck_pump_still_ends_in_the_emergency_stop() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Pump,
        kind: Kind::Stuck,
        from: 11 * H,
        until: None,
    });
    let r = run(&s);
    assert!(r.max_collector() > 130.0);
    assert!(
        r.samples
            .iter()
            .filter(|x| x.temps[0] >= 130.0)
            .all(|x| x.output.is_off())
    );
    assert!(
        r.samples
            .iter()
            .any(|x| x.interventions.collector_emergency)
    );
    // The monitor's "no circulation" (checked in 10-minute windows while
    // running) reports the stuck pump within two windows at most, and
    // before the collector reaches its emergency limit.
    let alarm = r.first_alarm(|a| a.no_circulation).expect("no alarm");
    let emergency = r
        .samples
        .iter()
        .find(|x| x.interventions.collector_emergency)
        .unwrap()
        .t;
    assert!(
        alarm <= 11 * H + 25 * 60,
        "alarm only {} s after 11:00",
        alarm - 11 * H
    );
    assert!(alarm < emergency);
}

/// A pump that is dead from the morning: the first start gets the "no
/// circulation" alarm 10 minutes later, and after three failed checks
/// in a row the monitor inhibits the pump signal (it would only run dry).
#[test]
fn dead_pump_is_found_at_the_first_start_and_inhibited() {
    let mut s = Scenario::summer_day();
    s.faults.push(Fault {
        target: Target::Pump,
        kind: Kind::Stuck,
        from: 0,
        until: None,
    });
    let r = run(&s);
    let first_start = r.samples.iter().find(|x| !x.output.is_off()).unwrap().t;
    let alarm = r.first_alarm(|a| a.no_circulation).expect("no alarm");
    assert!(
        alarm <= first_start + 601,
        "alarm {} s after the start",
        alarm - first_start
    );
    let inhibited = r
        .samples
        .iter()
        .find(|x| x.inhibit)
        .expect("never inhibited")
        .t;
    assert!(
        inhibited <= first_start + 31 * 60,
        "inhibit {} s after the start",
        inhibited - first_start
    );
    // Once inhibited, the signal stays off.
    assert!(
        r.samples
            .iter()
            .filter(|x| x.t > inhibited)
            .all(|x| x.output.is_off())
    );
}

/// The daemon restarts at 14:00 in normal operation: the pump is back
/// within seconds (kick start), no protection trips.
#[test]
fn restart_in_normal_operation() {
    let mut s = Scenario::summer_day();
    s.restarts.push(14 * H);
    let r = run(&s);
    let after: Vec<&Sample> = r
        .samples
        .iter()
        .filter(|x| x.t >= 14 * H && x.t < 14 * H + 60)
        .collect();
    assert!(
        after.iter().any(|x| !x.output.is_off()),
        "pump not back within a minute"
    );
    assert!(
        r.samples
            .iter()
            .all(|x| !x.interventions.collector_emergency)
    );
}

/// The daemon restarts while the collector is cooling down from
/// stagnation, inside the hysteresis band: it starts latched (4.2), so the
/// pump does not start into the hot collector.
#[test]
fn restart_during_stagnation_cooldown_stays_off() {
    let mut s = Scenario::summer_day();
    s.store_start = (86.0, 88.0);
    s.draws.clear();
    // Find a moment when the collector is cooling through 125 °C.
    let probe = run(&s);
    let peak = probe
        .samples
        .iter()
        .enumerate()
        .max_by(|a, b| a.1.temps[0].total_cmp(&b.1.temps[0]))
        .map(|(i, _)| i)
        .unwrap();
    let t125 = probe.samples[peak..]
        .iter()
        .find(|x| x.temps[0] < 125.0)
        .unwrap()
        .t;
    s.restarts.push(t125);
    let r = run(&s);
    for x in r.samples.iter().filter(|x| x.t >= t125) {
        if x.temps[0] > 120.5 {
            assert!(
                x.output.is_off(),
                "pump on at {} °C after the restart",
                x.temps[0]
            );
        }
    }
}

/// An overcast winter day behind the trees: no solar run, but the idle
/// pump gets its anti-seize run, 10 s at 100 % in the midday window, and
/// nothing else.
#[test]
fn winter_day_only_anti_seize() {
    let mut s = Scenario::summer_day();
    s.day = Day {
        day_of_year: 350,
        utc_offset: 1.0,
        t_min: -4.0,
        t_max: 2.0,
        clouds: Clouds::Overcast(0.0),
    };
    s.store_start = (25.0, 35.0);
    s.draws.clear();
    let r = run(&s);
    let on: Vec<&Sample> = r.samples.iter().filter(|x| !x.output.is_off()).collect();
    assert_eq!(on.len(), 10, "{} s on", on.len());
    assert!(on.iter().all(|x| x.output.percent() == 100));
    assert!(on.iter().all(|x| (12 * H..13 * H).contains(&x.t)));
}
