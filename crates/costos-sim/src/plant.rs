//! The solar loop of the reference installation as a thermal model.
//!
//! A port of `tools/sim/yield_sim.py` (ARCHITECTURE 8.2), whose parameters
//! were checked against the recording: pump hours in summer, mean pump
//! speed, the transport delay after a start, and the coil. Same nodes, same
//! numbers; explicit Euler steps of one second, which is well below the
//! fastest time constant (the collector at full flow, about 30 s).
//!
//! ```text
//!   sun ─► collector (1 node) ──flow pipe (1 node)──► lower coil ─► return pipe (1 node) ─┐
//!              ▲                                       │ heat                              │
//!              └───────────────────────────────────────┼───────────────────────────────────┘
//!                                                      ▼
//!                                   store: lower node (400 l) ⇄ upper node (400 l)
//! ```
//!
//! | Part | Model |
//! |---|---|
//! | Collector | 2 × 30 tubes (58 used), data sheet 2037 / 1853 / 1682 W at 1000 W/m² and ΔT 0 / 30 / 50 K as a quadratic; heat pipes as thermal diodes (no gain: only the manifold loses 1 W/K); **40 kJ/K** (see below) |
//! | Pipes | stainless corrugated, inner 15 mm, 2 × 25 m, 0.20 l/m, 0.22 W/(m·K), 3 of 25 m outdoors, indoors at 15 °C |
//! | Lower coil | UA 650 W/K: outlet = store + (inlet − store) · e^(−UA/W) |
//! | Store | two nodes of 400 l, 2.5 W/K loss each to 20 °C, 30 W/K between them, mixed when the lower one gets warmer |
//! | Pump | flow from the calibrated table (PWM2: 0.68 l/min in the minimum band, 1.13 l/min at 30 %, 2.66 l/min at 100 %) |
//!
//! **Collector heat capacity.** The Python yield model uses 15 kJ/K, which
//! only matters for the yield in the third digit. For the *control* it
//! matters a lot: with 15 kJ/K a clear summer morning gives about 20 starts,
//! because the cold fluid from 25 m of pipe cools the small collector node
//! below the switch-off difference again and again. The recording shows
//! one to three starts on clear days (ARCHITECTURE 8.1). 58 heat pipes with
//! their absorber fins, the manifold and its fluid come to roughly
//! 35–45 kJ/K; 40 kJ/K gives a handful of starts on a clear day and changes
//! the day's yield by under 1 %.
//!
//! **Calibrated against the recording** (ARCHITECTURE 8.4). Three things
//! in the real loop differ from a plain textbook model, and the recording
//! shows each of them on clear July days (pump running, means):
//!
//! | Measured | Recording | Model parameter |
//! |---|---|---|
//! | S4 − S1 (flow at the store minus collector sensor) | about +8 K | [`Params::collector_sensor_offset`] 8 K: the collector sensor reads lower than the fluid leaving the collector |
//! | S2 − S5 (store sensor minus coil outlet) | about 7 K | [`Params::coil_sink_offset`] 7 K: the water around the lower coil is colder than at the S2 sensor |
//! | Heat into the store | 15–17 kWh on a clear day (store balance) | 90 % of the data sheet output |
//! | Flow | half the first estimate (store balance) | the calibrated table |
//!
//! With these, a clear July day gives about 15 kWh, a mean pump speed of
//! 38 % (recording: 31 %), S4 − S5 of 18 K (22 K) and S1 − S2 of 6.3 K
//! (7.4 K): close, and the rest fits a flow that is a little lower still.
//!
//! **Sensors** as in installation.md: S1 collector (the manifold node, read
//! `collector_sensor_offset` low), S2
//! store bottom (lower node), S3 store top (upper node), S4 flow at the
//! store (flow pipe node), S5 return at the store (coil outlet while
//! flowing, the return pipe node otherwise).

use crate::weather::{self, Day, Site};

/// Solar fluid heat capacity per litre, J/(l·K) (40 % glycol).
const RHO_C: f32 = 3650.0;
/// Water heat capacity per litre, J/(l·K).
const WATER_C: f32 = 4180.0;

/// Flow in l/min at 0, 10, …, 100 % PWM, calibrated from the store's energy
/// balance (ARCHITECTURE 8.4, installation.md).
const FLOW_TABLE: [f32; 11] = [
    0.0, 0.68, 0.81, 1.13, 1.44, 1.67, 1.80, 2.03, 2.30, 2.52, 2.66,
];

/// Pump flow in l/min for a PWM duty in %. 0 % = stopped; anything above
/// 0 but below 10 % runs in the PWM2 minimum band (0.68 l/min).
#[must_use]
pub fn flow_for_duty(duty: u8) -> f32 {
    if duty == 0 {
        return 0.0;
    }
    let d = f32::from(duty.min(100));
    if d < 10.0 {
        return FLOW_TABLE[1];
    }
    // d in 10..=100: interpolate in the table.
    #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
    let i = ((d / 10.0) as usize).min(9);
    let f = (d - 10.0 * i as f32) / 10.0;
    let lo = FLOW_TABLE.get(i).copied().unwrap_or(0.0);
    let hi = FLOW_TABLE.get(i.saturating_add(1)).copied().unwrap_or(lo);
    lo + (hi - lo) * f
}

/// Model parameters. [`Params::REFERENCE`] is the reference installation.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Params {
    /// Collector output at 1000 W/m² and ΔT 0, W (whole field).
    pub p0: f32,
    /// Linear loss coefficient, W/K (whole field).
    pub k1: f32,
    /// Quadratic loss coefficient, W/K² (whole field).
    pub k2: f32,
    /// Collector heat capacity (manifold, heat pipes with absorbers, fluid), J/K.
    pub c_collector: f32,
    /// Pipe length one way, m.
    pub pipe_length: f32,
    /// Coil heat transfer, W/K.
    pub ua_coil: f32,
    /// Volume of each store node, l.
    pub store_node_litres: f32,
    /// How much colder than the lower node (S2) the water around the coil
    /// is, K (stratification below the S2 sensor, ARCHITECTURE 8.4).
    pub coil_sink_offset: f32,
    /// How much lower the collector sensor S1 reads than the fluid leaving
    /// the collector, K (sensor in a sleeve of the manifold, ARCHITECTURE 8.4).
    pub collector_sensor_offset: f32,
}

impl Params {
    /// The reference installation (installation.md, ARCHITECTURE 8.2).
    pub const REFERENCE: Self = Self {
        // 90 % of the data sheet: calibrated against clear July days of the
        // recording (ARCHITECTURE 8.4); dirt on the tubes, the roof and the
        // real sky make up the difference.
        p0: 0.9 * 2037.0 * 2.0 * 58.0 / 60.0,
        k1: 4.68 * 2.0 * 58.0 / 60.0,
        k2: 0.0483 * 2.0 * 58.0 / 60.0,
        c_collector: 40_000.0,
        pipe_length: 25.0,
        ua_coil: 650.0,
        store_node_litres: 400.0,
        // S2 − S5 while running is about 7 K in the recording.
        coil_sink_offset: 7.0,
        // S4 − S1 while running is about +8 K in the recording: the flow at
        // the store is warmer than the collector sensor reads.
        collector_sensor_offset: 8.0,
    };
}

/// The state of the loop: all node temperatures in °C.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Plant {
    /// Parameters.
    pub params: Params,
    /// Collector manifold (S1).
    pub collector: f32,
    /// Flow pipe, at the store end (S4).
    pub flow_pipe: f32,
    /// Return pipe.
    pub return_pipe: f32,
    /// Coil outlet while flowing (S5), else the return pipe.
    pub coil_out: f32,
    /// Store lower node (S2).
    pub store_low: f32,
    /// Store upper node (S3).
    pub store_high: f32,
    /// Heat delivered into the store so far, J.
    pub heat_into_store: f64,
}

impl Plant {
    /// A loop at rest: collector and pipes at `ambient`, store at
    /// `store_low` / `store_high`.
    #[must_use]
    pub fn new(params: Params, ambient: f32, store_low: f32, store_high: f32) -> Self {
        Self {
            params,
            collector: ambient,
            flow_pipe: ambient,
            return_pipe: ambient,
            coil_out: ambient,
            store_low,
            store_high,
            heat_into_store: 0.0,
        }
    }

    /// One second: `flow_lpm` through the loop (0 = pump off or stuck),
    /// sun and air from `site`/`day` at `local_seconds`, and `draw_w` taken
    /// from the upper store node (hot-water use).
    pub fn step(&mut self, site: &Site, day: &Day, local_seconds: f32, flow_lpm: f32, draw_w: f32) {
        let p = self.params;
        let (direct, diffuse) = weather::irradiance(site, day, local_seconds);
        let g = direct + diffuse;
        let ta = weather::air_temperature(day, local_seconds);
        let dt_amb = self.collector - ta;
        let mut q = p.p0 * g / 1000.0 - p.k1 * dt_amb - p.k2 * dt_amb * dt_amb.abs();
        // Heat pipes are thermal diodes: once the absorber can't deliver,
        // only the manifold loses heat.
        if q < -dt_amb {
            q = -dt_amb;
        }
        let w = flow_lpm / 60.0 * RHO_C; // W/K
        let c_pipe = p.pipe_length * (0.20 * RHO_C + 0.15 * 500.0);
        let ua_pipe = p.pipe_length * 0.22;
        let t_env = 0.12 * ta + 0.88 * 15.0;
        let c_node = p.store_node_litres * WATER_C;

        let (q_coil, tout) = if w > 0.0 {
            let sink = self.store_low - p.coil_sink_offset;
            let tout = sink + (self.flow_pipe - sink) * (-p.ua_coil / w).exp();
            (w * (self.flow_pipe - tout), tout)
        } else {
            (0.0, self.return_pipe)
        };
        let tc = self.collector + (q + w * (self.return_pipe - self.collector)) / p.c_collector;
        let tf = self.flow_pipe
            + (w * (self.collector - self.flow_pipe) - ua_pipe * (self.flow_pipe - t_env)) / c_pipe;
        let tr = self.return_pipe
            + (w * (tout - self.return_pipe) - ua_pipe * (self.return_pipe - t_env)) / c_pipe;
        let mut lo = self.store_low
            + (q_coil - 2.5 * (self.store_low - 20.0) - 30.0 * (self.store_low - self.store_high))
                / c_node;
        let mut hi = self.store_high
            + (-2.5 * (self.store_high - 20.0) + 30.0 * (self.store_low - self.store_high)
                - draw_w)
                / c_node;
        if lo > hi {
            let m = (lo + hi) / 2.0;
            lo = m;
            hi = m;
        }
        self.collector = tc;
        self.flow_pipe = tf;
        self.return_pipe = tr;
        self.coil_out = tout;
        self.store_low = lo;
        self.store_high = hi;
        if q_coil > 0.0 {
            self.heat_into_store += f64::from(q_coil);
        }
    }

    /// The five sensor values S1–S5 in °C.
    #[must_use]
    pub fn sensors(&self) -> [f32; 5] {
        [
            self.collector - self.params.collector_sensor_offset,
            self.store_low,
            self.store_high,
            self.flow_pipe,
            self.coil_out,
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn flow_table() {
        assert!(flow_for_duty(0) <= 0.0);
        assert!((flow_for_duty(5) - 0.68).abs() < 1e-6);
        assert!((flow_for_duty(30) - 1.13).abs() < 1e-6);
        assert!((flow_for_duty(35) - 1.285).abs() < 1e-3);
        assert!((flow_for_duty(100) - 2.66).abs() < 1e-6);
    }

    /// With no flow on a clear summer day the collector stagnates far above
    /// 130 °C (the real one is rated 208 °C), and the store doesn't move.
    #[test]
    fn stagnation_without_flow() {
        let site = Site::REFERENCE;
        let day = Day::SUMMER_CLEAR;
        let mut plant = Plant::new(Params::REFERENCE, 15.0, 60.0, 62.0);
        for s in 0..(17 * 3600) {
            #[allow(clippy::cast_precision_loss)]
            plant.step(&site, &day, s as f32, 0.0, 0.0);
        }
        assert!(plant.collector > 150.0, "{}", plant.collector);
        assert!(plant.heat_into_store <= 0.0);
    }
}
