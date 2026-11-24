//! Backends: where the readings come from and where the duty goes.
//!
//! The daemon's loop is the same for every backend:
//!
//! ```text
//! loop {
//!     tick   = backend.tick()      // wait for the next control second
//!     raw    = backend.read()      // S1..S5 as the hardware layer sees them
//!     out    = costos_cycle::step  // the whole decision
//!     backend.apply(out.duty)      // PWM (or the model's pump)
//! }
//! ```
//!
//! Today there is one backend, the [`Simulator`]: the thermal model of
//! `costos-sim`, run in real time or accelerated. The hardware backend
//! (HAT: Pt1000 front end, PWM, hardware watchdog) comes with the board
//! (ARCHITECTURE 10.2) and only has to implement [`Backend`].

use std::thread;
use std::time::{Duration, Instant};

use costos_core::{Celsius, Duty, Reading, Seconds, SensorFault, TimeOfDay};
use costos_cycle::Readings;
use costos_sim::plant::{Params, Plant, flow_for_duty};
use costos_sim::weather::{self, Clouds, Day, Site};

/// The time of one control second.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Tick {
    /// Monotonic seconds since the daemon started.
    pub now: Seconds,
    /// Local time of day.
    pub time_of_day: TimeOfDay,
    /// Days since the start (0 on the first day); for status lines.
    pub day: u32,
}

/// What the daemon needs from the world.
pub trait Backend {
    /// Waits until the next control second is due and returns its time.
    fn tick(&mut self) -> Tick;
    /// The current raw readings (faults detected, no offsets applied).
    fn read(&mut self) -> Readings;
    /// Applies the duty until the next call.
    fn apply(&mut self, duty: Duty);
    /// Extra text for the status line (the simulator shows the true heat).
    fn status(&self) -> String;
}

/// A temperature as a reading. The model always has a value; a NaN (which
/// the model should never produce) becomes a read error, as from hardware.
fn reading(v: f32) -> Reading {
    Celsius::new(v).ok_or(SensorFault::ReadError)
}

/// The thermal model as backend: the reference installation on a sequence
/// of clear days, with two hot-water draws a day.
pub struct Simulator {
    site: Site,
    plant: Plant,
    /// Day of the year of the first day.
    start_day_of_year: u32,
    /// Simulated seconds since the start.
    t: u64,
    /// Real time per simulated second; zero = as fast as possible.
    period: Duration,
    next: Instant,
    duty: Duty,
}

impl Simulator {
    /// Starts at local midnight of `day_of_year` (1–365) with the store at
    /// `store` °C (bottom, top). `speed` is the acceleration: 1 = real time,
    /// 60 = one simulated minute per second, 0 = as fast as possible.
    #[must_use]
    pub fn new(day_of_year: u32, store: (f32, f32), speed: u32) -> Self {
        let first = Self::day(day_of_year);
        let ambient = weather::air_temperature(&first, 0.0);
        let period = if speed == 0 {
            Duration::ZERO
        } else {
            Duration::from_secs(1)
                .checked_div(speed)
                .unwrap_or(Duration::ZERO)
        };
        Self {
            site: Site::REFERENCE,
            plant: Plant::new(Params::REFERENCE, ambient, store.0, store.1),
            start_day_of_year: day_of_year.clamp(1, 365),
            t: 0,
            period,
            next: Instant::now(),
            duty: Duty::OFF,
        }
    }

    /// The weather of a day of the year: clear sky, air temperature from a
    /// simple Munich annual curve (daily mean about −1 °C in mid-January to
    /// 19 °C in mid-July, ±6 K over the day), summer time from end of
    /// March to end of October.
    #[must_use]
    pub fn day(day_of_year: u32) -> Day {
        let doy = day_of_year.clamp(1, 365);
        #[allow(clippy::cast_precision_loss)]
        let phase = (doy as f32 - 196.0) / 365.0 * std::f32::consts::TAU;
        let mean = 9.0 + 10.0 * phase.cos();
        Day {
            day_of_year: doy,
            utc_offset: if (87..=300).contains(&doy) { 2.0 } else { 1.0 },
            t_min: mean - 6.0,
            t_max: mean + 6.0,
            clouds: Clouds::Clear,
        }
    }

    /// Hot-water use at this time of day, W: 2 kW for 15 min at 07:00,
    /// 6 kW for 30 min at 19:00 (a morning and an evening shower).
    fn draw(time_of_day: u64) -> f32 {
        match time_of_day {
            25_200..26_100 => 2000.0,
            68_400..70_200 => 6000.0,
            _ => 0.0,
        }
    }

    fn day_index(&self) -> u32 {
        u32::try_from(self.t / 86_400).unwrap_or(u32::MAX)
    }

    fn current_day(&self) -> Day {
        // Day of the year wraps after 365.
        let offset = self.day_index() % 365;
        let doy = (self
            .start_day_of_year
            .saturating_sub(1)
            .saturating_add(offset))
            % 365;
        Self::day(doy.saturating_add(1))
    }
}

impl Backend for Simulator {
    fn tick(&mut self) -> Tick {
        if !self.period.is_zero() {
            // Fixed schedule, not "sleep one period": the loop's own run
            // time does not add up to drift.
            let now = Instant::now();
            if self.next > now {
                thread::sleep(self.next.saturating_duration_since(now));
            }
            self.next = self.next.checked_add(self.period).unwrap_or(self.next);
        }
        let tod = u32::try_from(self.t % 86_400).unwrap_or(0);
        Tick {
            now: Seconds::new(self.t),
            time_of_day: TimeOfDay::new(tod).unwrap_or(TimeOfDay::MIDNIGHT),
            day: self.day_index(),
        }
    }

    fn read(&mut self) -> Readings {
        let [s1, s2, s3, s4, s5] = self.plant.sensors();
        Readings {
            collector: reading(s1),
            store_bottom: reading(s2),
            store_top: Some(reading(s3)),
            flow: Some(reading(s4)),
            ret: Some(reading(s5)),
        }
    }

    fn apply(&mut self, duty: Duty) {
        self.duty = duty;
        let day = self.current_day();
        let tod = self.t % 86_400;
        #[allow(clippy::cast_precision_loss)]
        let local = tod as f32;
        self.plant.step(
            &self.site,
            &day,
            local,
            flow_for_duty(duty.percent()),
            Self::draw(tod),
        );
        self.t = self.t.saturating_add(1);
    }

    fn status(&self) -> String {
        format!(
            "model: {:.2} kWh into the store",
            self.plant.heat_into_store / 3.6e6
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn days_follow_the_year() {
        let jan = Simulator::day(15);
        let jul = Simulator::day(196);
        assert!(jan.t_max < 6.0 && jul.t_max > 24.0);
        assert!((jan.utc_offset - 1.0).abs() < 1e-6);
        assert!((jul.utc_offset - 2.0).abs() < 1e-6);
    }

    #[test]
    fn time_advances_with_apply() {
        let mut sim = Simulator::new(196, (40.0, 45.0), 0);
        for _ in 0..90_000 {
            let _ = sim.tick();
            sim.apply(Duty::OFF);
        }
        let t = sim.tick();
        assert_eq!(t.now.get(), 90_000);
        assert_eq!(t.day, 1);
        assert_eq!(t.time_of_day.get(), 3600);
        // Second day of the run is day 197.
        assert_eq!(sim.current_day().day_of_year, 197);
    }
}
