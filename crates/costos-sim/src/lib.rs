//! `costos-sim`: closed-loop simulation of the CoSTOS control chain against
//! a thermal model of the reference solar loop (ARCHITECTURE 8, milestone 2).
//!
//! **Why this exists.** The unit tests check each control function on fixed
//! inputs, and the replay checks the on/off decisions against the BX Plus.
//! Neither can show what happens when CoSTOS's own decisions change the
//! temperatures it then measures: replay is open loop (ARCHITECTURE 8.1). A
//! speed control that "holds ΔT at 10 K", a store maximum that must stop a
//! store heating up, an emergency latch that must release after the
//! collector cools: all of these only show in a closed loop. This crate
//! provides one.
//!
//! **What runs.** Every simulated second:
//!
//! 1. [`plant::Plant`] gives the five sensor temperatures (S1–S5).
//! 2. The sensor layer ([`faults`]) turns them into readings, with injected
//!    faults where a scenario asks for them, and checks them against their
//!    plausible ranges, as the daemon will.
//! 3. `costos_core::solar::step` decides the requested duty: exactly the
//!    chain the daemon will run.
//! 4. `costos_safety::supervise_solar_pump` reduces it where needed.
//! 5. The plant gets the resulting flow (none if the pump is "stuck") for
//!    the next second.
//!
//! **What it is not.** Not a yield model: `tools/sim/yield_sim.py` with
//! PVGIS data is the yield reference (ARCHITECTURE 8.2). The model here is
//! the same one, so the yields agree on a comparable day (a scenario test
//! checks that), but the weather is a clear-sky formula with scripted
//! clouds, made for reproducible control tests in CI.
//!
//! `std` crate, outside the `no_std` rules of 6.1 (as the architecture says
//! for `costos-sim`), but with the same lints; the few float-to-integer
//! conversions are marked where they happen.

pub mod faults;
pub mod plant;
pub mod weather;

use costos_core::delta_t::FlowReturn;
use costos_core::solar::{self, SolarConfig, SolarState};
use costos_core::{Duty, PlausibleRange, Reading, Seconds, TimeOfDay};
use costos_safety::{Interventions, SafetyConfig, SupervisorState};

use crate::faults::{Fault, SensorLayer};
use crate::plant::{Params, Plant, flow_for_duty};
use crate::weather::{Day, Site};

/// Hot-water use: `watts` taken from the store top between `from` and `to`
/// seconds after local midnight.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Draw {
    /// Start, seconds after local midnight.
    pub from: u32,
    /// End (exclusive), seconds after local midnight.
    pub to: u32,
    /// Power taken from the store top, W.
    pub watts: f32,
}

/// One scenario: site, day, start temperatures, settings and what goes
/// wrong.
#[derive(Clone, Debug, PartialEq)]
pub struct Scenario {
    /// Site and collector plane.
    pub site: Site,
    /// Weather of the day.
    pub day: Day,
    /// Model parameters.
    pub params: Params,
    /// Store lower and upper node at midnight, °C.
    pub store_start: (f32, f32),
    /// Settings of the control functions.
    pub control: SolarConfig,
    /// Settings of the supervisor.
    pub safety: SafetyConfig,
    /// Feed S4/S5 to the flow/return switch-off (as on the reference BX).
    pub flow_return: bool,
    /// Hot-water draws.
    pub draws: Vec<Draw>,
    /// Faults to inject.
    pub faults: Vec<Fault>,
    /// Seconds after midnight at which the daemon restarts: all control and
    /// supervisor state is lost and starts from its default.
    pub restarts: Vec<u32>,
    /// Simulated seconds from local midnight.
    pub seconds: u32,
}

impl Scenario {
    /// A clear summer day with the reference installation and the default
    /// settings, the store at 45 / 50 °C at midnight, an evening shower.
    #[must_use]
    pub fn summer_day() -> Self {
        Self {
            site: Site::REFERENCE,
            day: Day::SUMMER_CLEAR,
            params: Params::REFERENCE,
            store_start: (45.0, 50.0),
            control: reference_control(),
            safety: SafetyConfig::DEFAULT,
            flow_return: true,
            draws: vec![Draw {
                from: 19 * 3600,
                to: 19 * 3600 + 1800,
                watts: 6000.0,
            }],
            faults: Vec::new(),
            restarts: Vec::new(),
            seconds: 24 * 3600,
        }
    }
}

/// The control settings of the reference installation: defaults, with the
/// BX's switch-on/off differences (5 / 2 K, no minimum run time, collector
/// minimum 10 °C; ARCHITECTURE 8.1) and the store maximum at 90 °C
/// (ARCHITECTURE 11).
#[must_use]
pub fn reference_control() -> SolarConfig {
    let mut c = SolarConfig::DEFAULT;
    c.delta_t.on = costos_core::Kelvin::from_const(5.0);
    c.delta_t.off = costos_core::Kelvin::from_const(2.0);
    c.delta_t.min_run = Seconds::ZERO;
    c.store_max.max = costos_core::Celsius::from_const(90.0);
    c
}

/// One recorded second.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Sample {
    /// Seconds after local midnight.
    pub t: u32,
    /// True temperatures S1–S5 (before the sensor layer).
    pub temps: [f32; 5],
    /// What the control chain asked for.
    pub requested: Duty,
    /// What the supervisor let through.
    pub output: Duty,
    /// Flow through the loop, l/min.
    pub flow: f32,
    /// What the supervisor did.
    pub interventions: Interventions,
    /// The ΔT the control used, if known.
    pub delta_t: Option<f32>,
}

/// Result of a run.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Run {
    /// Every simulated second.
    pub samples: Vec<Sample>,
    /// Heat into the store, kWh.
    pub heat_kwh: f64,
}

impl Run {
    /// Number of starts (output from 0 to above 0).
    #[must_use]
    pub fn starts(&self) -> usize {
        self.samples
            .windows(2)
            .filter(|w| matches!(w, [a, b] if a.output.is_off() && !b.output.is_off()))
            .count()
    }

    /// Seconds with the output above 0.
    #[must_use]
    pub fn on_seconds(&self) -> usize {
        self.samples.iter().filter(|s| !s.output.is_off()).count()
    }

    /// Highest true collector temperature.
    #[must_use]
    pub fn max_collector(&self) -> f32 {
        self.samples
            .iter()
            .map(|s| s.temps[0])
            .fold(f32::MIN, f32::max)
    }

    /// Highest true store bottom temperature.
    #[must_use]
    pub fn max_store(&self) -> f32 {
        self.samples
            .iter()
            .map(|s| s.temps[1])
            .fold(f32::MIN, f32::max)
    }
}

/// Runs a scenario second by second. See the crate documentation for the
/// order within a second.
#[must_use]
pub fn run(scenario: &Scenario) -> Run {
    let s = scenario;
    let ambient = weather::air_temperature(&s.day, 0.0);
    let mut plant = Plant::new(s.params, ambient, s.store_start.0, s.store_start.1);
    let mut sensors = SensorLayer::new(s.faults.clone());
    let mut control = SolarState::default();
    let mut supervisor = SupervisorState::default();
    let mut samples = Vec::with_capacity(s.seconds as usize);

    for t in 0..s.seconds {
        if s.restarts.contains(&t) {
            control = SolarState::default();
            supervisor = SupervisorState::default();
        }
        #[allow(clippy::cast_precision_loss)]
        let local = t as f32;
        let temps = plant.sensors();
        let [s1, s2, s3, s4, s5] = sensors.read(t, temps);
        let collector = PlausibleRange::COLLECTOR.check(s1);
        let store_bottom = PlausibleRange::STORE.check(s2);
        let store_top: Reading = PlausibleRange::STORE.check(s3);
        let flow_return = s.flow_return.then(|| FlowReturn {
            flow: PlausibleRange::COLLECTOR.check(s4),
            ret: PlausibleRange::COLLECTOR.check(s5),
        });
        let now = Seconds::new(u64::from(t));
        let inputs = solar::SolarInputs {
            now,
            time_of_day: TimeOfDay::new(t % 86_400).unwrap_or(TimeOfDay::MIDNIGHT),
            collector,
            store_bottom,
            store_max_sensor: None,
            flow_return,
        };
        let (next, out) = solar::step(&s.control, control, &inputs);
        control = next;
        let sup_in = costos_safety::SolarInputs {
            now,
            requested: out.requested,
            collector,
            store_bottom,
            store_top: Some(store_top),
        };
        let (next_sup, allowed, why) =
            costos_safety::supervise_solar_pump(&s.safety, supervisor, &sup_in);
        supervisor = next_sup;
        let output = allowed;

        let flow = if sensors.pump_stuck(t) {
            0.0
        } else {
            flow_for_duty(output.percent())
        };
        let draw: f32 = s
            .draws
            .iter()
            .filter(|d| (d.from..d.to).contains(&(t % 86_400)))
            .map(|d| d.watts)
            .sum();
        plant.step(&s.site, &s.day, local, flow, draw);
        samples.push(Sample {
            t,
            temps,
            requested: out.requested,
            output,
            flow,
            interventions: why,
            delta_t: out.delta_t.delta_t.map(costos_core::Kelvin::get),
        });
    }
    Run {
        samples,
        heat_kwh: plant.heat_into_store / 3.6e6,
    }
}
