//! Heat quantity and statistics of the solar pump (ARCHITECTURE 6.2).
//!
//! **Heat quantity.** Every second the pump runs, the heat carried into
//! the store is
//!
//! ```text
//! P = flow · ρc · (T_flow − T_return)
//! ```
//!
//! with the flow from a fixed value or from the pump's calibration table
//! (flow per PWM duty; for the reference installation the table calibrated
//! from the store's energy balance, ARCHITECTURE 8.4), and ρc the
//! volumetric heat capacity of the solar fluid for its glycol share.
//! Without a flow meter this is an **estimate** (the table is good to about
//! ±20 %); with a V40 flow meter (later) the flow becomes a measurement.
//!
//! **Counters only grow** (ARCHITECTURE 6.1 rule 16). Heat into the store
//! goes into [`Counters::heat_wh`]; heat flowing the other way (return
//! warmer than flow, for example the anti-seize run on a cold collector)
//! goes into its own counter [`Counters::heat_loss_wh`], never subtracted
//! from the first. Both are `u64` watt-hours; the part below one watt-hour
//! is carried in the state, so nothing is lost to rounding however small
//! the steps.
//!
//! **Statistics** next to it: pump running seconds, starts, the pump's
//! electrical energy (estimated from the duty until the pump feedback
//! reports power), and the seconds the collector spent above a threshold
//! (a stagnation indicator). The solar yield ratio (heat ÷ pump
//! electricity) is computed from the counters where it is shown.
//!
//! The daemon persists [`HeatState`] (ARCHITECTURE 6.3: written atomically
//! every few minutes), so the counters survive restarts.

use crate::output::Duty;
use crate::sensor::Reading;
use crate::temperature::Celsius;

/// Where the flow comes from.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum FlowSource {
    /// A fixed flow in l/min whenever the pump runs (set from the flow
    /// indicator, the classic way).
    Fixed(f32),
    /// Flow in l/min at 0, 10, …, 100 % PWM, interpolated in between. The
    /// first entry is used for any duty above 0 but below 10 % (the PWM2
    /// minimum band).
    Table([f32; 11]),
}

impl FlowSource {
    /// The reference installation's table (installation.md), calibrated from
    /// the store's energy balance on 67 summer days (ARCHITECTURE 8.4):
    /// 0.68 l/min in the minimum band, 1.13 l/min at 30 %, 2.66 l/min at
    /// 100 %. Good to about ±20 %.
    pub const REFERENCE: Self = Self::Table([
        0.0, 0.68, 0.81, 1.13, 1.44, 1.67, 1.80, 2.03, 2.30, 2.52, 2.66,
    ]);

    /// Flow in l/min at this duty; 0 when off.
    #[must_use]
    pub fn flow(&self, duty: Duty) -> f32 {
        if duty.is_off() {
            return 0.0;
        }
        match self {
            Self::Fixed(f) => *f,
            Self::Table(t) => {
                let d = f32::from(duty.percent());
                if d < 10.0 {
                    return t.get(1).copied().unwrap_or(0.0);
                }
                // 10 ≤ d ≤ 100: the table index below, 1..=10.
                let i = usize::from(duty.percent() / 10);
                let lo = t.get(i).copied().unwrap_or(0.0);
                let hi = t.get(i.saturating_add(1)).copied().unwrap_or(lo);
                // u8 to f32 is exact.
                let base = f32::from((duty.percent() / 10).saturating_mul(10));
                lo + (hi - lo) * (d - base) / 10.0
            }
        }
    }
}

/// Volumetric heat capacity of the solar fluid in J/(l·K) for its glycol
/// share (propylene glycol, by volume, at about 50 °C), interpolated:
/// water 4180, 30 % 3800, 40 % 3650, 50 % 3500. Values outside 0–60 % are
/// clamped. Accurate to a few percent, far better than the flow estimate.
#[must_use]
pub fn rho_c(glycol_percent: f32) -> f32 {
    const POINTS: [(f32, f32); 5] = [
        (0.0, 4180.0),
        (30.0, 3800.0),
        (40.0, 3650.0),
        (50.0, 3500.0),
        (60.0, 3350.0),
    ];
    let g = glycol_percent.clamp(0.0, 60.0);
    let mut prev = (0.0, 4180.0);
    for p in POINTS {
        if g <= p.0 {
            if p.0 <= prev.0 {
                return p.1;
            }
            return prev.1 + (p.1 - prev.1) * (g - prev.0) / (p.0 - prev.0);
        }
        prev = p;
    }
    prev.1
}

/// Settings of the heat quantity and statistics.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HeatConfig {
    /// Where the flow comes from.
    pub flow: FlowSource,
    /// Glycol share of the solar fluid, % by volume.
    pub glycol_percent: f32,
    /// Pump electrical power at the lowest running speed, W, and the extra
    /// power at 100 %, which grows with the square of the duty (a rough
    /// fit for a high-efficiency pump; the feedback replaces it later).
    pub pump_power: (f32, f32),
    /// Collector temperature above which "collector hot" seconds count.
    pub collector_hot: Celsius,
}

impl HeatConfig {
    /// The reference installation: flow table calibrated from the store balance, 40 % glycol, Wilo
    /// Yonos PARA about 3 W + 42 W × duty², hot above 80 °C.
    pub const REFERENCE: Self = Self {
        flow: FlowSource::REFERENCE,
        glycol_percent: 40.0,
        pump_power: (3.0, 42.0),
        collector_hot: Celsius::from_const(80.0),
    };
}

/// The counters. All only ever grow.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub struct Counters {
    /// Heat carried into the store, Wh.
    pub heat_wh: u64,
    /// Heat carried the other way (return warmer than flow), Wh.
    pub heat_loss_wh: u64,
    /// Seconds the pump ran.
    pub pump_seconds: u64,
    /// Pump starts.
    pub starts: u64,
    /// Pump electrical energy (estimated), Wh.
    pub pump_wh: u64,
    /// Seconds the collector was above `collector_hot`.
    pub collector_hot_seconds: u64,
}

/// Counters plus the parts below one watt-hour, carried between cycles.
/// This is what the daemon persists.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct HeatState {
    /// The counters.
    pub counters: Counters,
    heat_j: f32,
    loss_j: f32,
    pump_j: f32,
    was_on: bool,
}

impl HeatState {
    /// A state that continues from saved counters (after a restart); the
    /// parts below one watt-hour start at zero, which loses less than 1 Wh
    /// per counter, and the next cycle counts as "pump was off before".
    #[must_use]
    pub const fn from_counters(counters: Counters) -> Self {
        Self {
            counters,
            heat_j: 0.0,
            loss_j: 0.0,
            pump_j: 0.0,
            was_on: false,
        }
    }
}

/// Joules per watt-hour.
const J_PER_WH: f32 = 3600.0;

/// Moves whole watt-hours from `joules` into `counter`.
fn carry(joules: &mut f32, counter: &mut u64) {
    if *joules >= J_PER_WH {
        // Whole watt-hours: at most a few per second, far below u64.
        #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
        let wh = (*joules / J_PER_WH) as u64;
        *counter = counter.saturating_add(wh);
        #[allow(clippy::cast_precision_loss)]
        let used = wh as f32 * J_PER_WH;
        *joules -= used;
    }
}

/// One second: `duty` is the duty actually applied (after the
/// supervisor). Flow and return are needed for the heat; without either
/// (not configured or faulty) the heat of that second is not counted,
/// while the other statistics still are.
#[must_use]
pub fn step(
    config: &HeatConfig,
    state: HeatState,
    duty: Duty,
    collector: Reading,
    flow: Option<Reading>,
    ret: Option<Reading>,
) -> HeatState {
    let mut s = state;
    let on = !duty.is_off();
    let c = &mut s.counters;
    if on {
        c.pump_seconds = c.pump_seconds.saturating_add(1);
        if !s.was_on {
            c.starts = c.starts.saturating_add(1);
        }
        let d = f32::from(duty.percent()) / 100.0;
        s.pump_j += config.pump_power.0 + config.pump_power.1 * d * d;
        carry(&mut s.pump_j, &mut c.pump_wh);

        if let (Some(Ok(f)), Some(Ok(r))) = (flow, ret) {
            let w = config.flow.flow(duty) / 60.0 * rho_c(config.glycol_percent); // W/K
            let p = w * (f.get() - r.get()); // W, for one second = J
            if p >= 0.0 {
                s.heat_j += p;
                carry(&mut s.heat_j, &mut c.heat_wh);
            } else {
                s.loss_j -= p;
                carry(&mut s.loss_j, &mut c.heat_loss_wh);
            }
        }
    }
    if collector.is_ok_and(|t| t > config.collector_hot) {
        c.collector_hot_seconds = c.collector_hot_seconds.saturating_add(1);
    }
    s.was_on = on;
    s
}

#[cfg(test)]
#[allow(clippy::arithmetic_side_effects)]
mod tests {
    use super::*;
    use crate::sensor::SensorFault;

    fn c(v: f32) -> Reading {
        Ok(Celsius::from_const(v))
    }

    #[test]
    fn flow_table_interpolates() {
        let f = FlowSource::REFERENCE;
        assert!(f.flow(Duty::OFF) <= 0.0);
        assert!((f.flow(Duty::clamped(5)) - 0.68).abs() < 1e-6);
        assert!((f.flow(Duty::clamped(30)) - 1.13).abs() < 1e-6);
        assert!((f.flow(Duty::clamped(35)) - 1.285).abs() < 1e-4);
        assert!((f.flow(Duty::FULL) - 2.66).abs() < 1e-6);
        assert!((FlowSource::Fixed(4.0).flow(Duty::clamped(1)) - 4.0).abs() < 1e-6);
    }

    #[test]
    fn rho_c_by_glycol_share() {
        assert!((rho_c(0.0) - 4180.0).abs() < 1e-3);
        assert!((rho_c(40.0) - 3650.0).abs() < 1e-3);
        assert!((rho_c(35.0) - 3725.0).abs() < 1e-3);
        assert!((rho_c(99.0) - 3350.0).abs() < 1e-3);
    }

    /// One hour at a fixed 2.5 l/min with flow 10 K above return, 40 %
    /// glycol: 2.5/60 · 3650 · 10 = 1520.8 W, so 1520 Wh, the remainder
    /// carried. Pump at 30 %: 3 + 42 · 0.09 = 6.78 W → 6 Wh. One start.
    #[test]
    fn one_hour_of_heat() {
        let cfg = HeatConfig {
            flow: FlowSource::Fixed(2.5),
            ..HeatConfig::REFERENCE
        };
        let mut s = HeatState::default();
        for _ in 0..3600 {
            s = step(
                &cfg,
                s,
                Duty::clamped(30),
                c(60.0),
                Some(c(55.0)),
                Some(c(45.0)),
            );
        }
        assert_eq!(s.counters.heat_wh, 1520);
        assert_eq!(s.counters.heat_loss_wh, 0);
        assert_eq!(s.counters.pump_seconds, 3600);
        assert_eq!(s.counters.starts, 1);
        assert_eq!(s.counters.pump_wh, 6);
    }

    /// Rule 16: a return warmer than the flow counts as loss, and the heat
    /// counter never goes down.
    #[test]
    fn negative_heat_goes_into_the_loss_counter() {
        let cfg = HeatConfig::REFERENCE;
        let mut s = HeatState::default();
        for _ in 0..3600 {
            s = step(&cfg, s, Duty::FULL, c(0.0), Some(c(20.0)), Some(c(30.0)));
        }
        assert_eq!(s.counters.heat_wh, 0);
        // 2.66/60 · 3650 · 10 = 1618.2 W → 1618 Wh in an hour.
        assert!(
            (1615..=1619).contains(&s.counters.heat_loss_wh),
            "{}",
            s.counters.heat_loss_wh
        );
    }

    /// Without flow and return (or with a fault) no heat is counted, but
    /// the pump statistics are.
    #[test]
    fn no_heat_without_sensors() {
        let cfg = HeatConfig::REFERENCE;
        let mut s = HeatState::default();
        for _ in 0..100 {
            s = step(
                &cfg,
                s,
                Duty::clamped(50),
                c(60.0),
                Some(Err(SensorFault::OpenCircuit)),
                Some(c(40.0)),
            );
        }
        assert_eq!(s.counters.heat_wh, 0);
        assert_eq!(s.counters.pump_seconds, 100);
    }

    /// Starts are counted per off→on change; collector hot seconds above
    /// 80 °C.
    #[test]
    fn starts_and_hot_collector() {
        let cfg = HeatConfig::REFERENCE;
        let mut s = HeatState::default();
        for k in 0..10 {
            let duty = if k % 2 == 0 {
                Duty::clamped(30)
            } else {
                Duty::OFF
            };
            s = step(
                &cfg,
                s,
                duty,
                c(if k < 3 { 85.0 } else { 70.0 }),
                None,
                None,
            );
        }
        assert_eq!(s.counters.starts, 5);
        assert_eq!(s.counters.collector_hot_seconds, 3);
    }
}
