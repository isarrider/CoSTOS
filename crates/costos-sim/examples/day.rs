//! Prints an hourly summary of a scenario, for looking at the model:
//! `cargo run -p costos-sim --example day [summer|cloudy|stagnation]`.

use costos_sim::{Scenario, run};

fn main() {
    let which = std::env::args().nth(1).unwrap_or_else(|| "summer".into());
    let mut s = Scenario::summer_day();
    match which.as_str() {
        "cloudy" => {
            s.day.clouds = costos_sim::weather::Clouds::Broken {
                period: 1200,
                sunny_fraction: 0.4,
                shade_factor: 0.1,
            };
        }
        "stagnation" => {
            s.control.store_max.max = costos_core::Celsius::from_const(80.0);
            s.store_start = (79.5, 80.0);
        }
        _ => {}
    }
    let r = run(&s);
    println!(
        "heat {:.1} kWh, on {:.1} h, starts {}, max collector {:.1}, max store {:.1}",
        r.heat_kwh,
        r.on_seconds() as f64 / 3600.0,
        r.starts(),
        r.max_collector(),
        r.max_store()
    );
    for x in r.samples.iter().step_by(1800) {
        println!(
            "{:5.1} h  S1 {:6.1} S2 {:5.1} S3 {:5.1} S4 {:5.1} S5 {:5.1}  req {:3} out {:3} flow {:.1} dT {:?} {:?}",
            f64::from(x.t) / 3600.0,
            x.temps[0],
            x.temps[1],
            x.temps[2],
            x.temps[3],
            x.temps[4],
            x.requested.percent(),
            x.output.percent(),
            x.flow,
            x.delta_t.map(|d| (d * 10.0).round() / 10.0),
            if x.interventions.any() {
                Some(x.interventions)
            } else {
                None
            }
        );
    }
}
