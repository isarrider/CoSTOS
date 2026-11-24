//! Weather for one simulated day: sun on the collector plane and air
//! temperature, computed, not read from a file, so CI needs no data.
//!
//! - **Sun position** from the usual solar-geometry formulas (declination
//!   and equation of time after Spencer), good to about 1°.
//! - **Clear sky**: direct normal irradiance after Meinel,
//!   `1353 · 0.7^(AM^0.678)` W/m², with the air mass `AM = 1/cos(zenith)`;
//!   diffuse light as 12 % of the direct normal value on the horizontal,
//!   taken onto the plane with the isotropic sky model. On a clear June day
//!   in Munich this gives about 900–1000 W/m² on a well-facing plane,
//!   which is what PVGIS shows for clear days too.
//! - **Clouds** scale the direct part ([`Clouds`]); the diffuse part is
//!   kept, a little raised under thin clouds would be more exact but
//!   doesn't matter for the control tests.
//! - **Trees** to the south (ARCHITECTURE 8.2) can block the direct part
//!   while the sun is low in that sector.
//! - **Air temperature**: a sine between `t_min` at 05:00 and `t_max` at
//!   15:00 local time.
//!
//! This is a test model, not a yield model: `tools/sim/yield_sim.py` with
//! PVGIS data is the yield reference, and the scenario tests compare the
//! two on a sunny day.

use core::f32::consts::PI;

/// The site and the collector plane.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Site {
    /// Latitude in degrees north.
    pub lat: f32,
    /// Longitude in degrees east.
    pub lon: f32,
    /// Collector tilt in degrees from horizontal.
    pub tilt: f32,
    /// Collector azimuth in degrees from **south**, west positive (PVGIS
    /// convention): 0 = south, 90 = west.
    pub aspect: f32,
    /// Obstacle to the south: (elevation, from azimuth, to azimuth) in
    /// degrees, azimuth from north clockwise. `None` = free horizon.
    pub trees: Option<(f32, f32, f32)>,
}

impl Site {
    /// The reference installation: Munich, tilt 30°, facing west turned
    /// 10° south (aspect 80°), trees about 30° high from south-east to
    /// south-west (fitted in ARCHITECTURE 8.2).
    pub const REFERENCE: Self = Self {
        lat: 48.14,
        lon: 11.58,
        tilt: 30.0,
        aspect: 80.0,
        trees: Some((30.0, 135.0, 225.0)),
    };
}

/// How clouds change the direct sun over the day.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Clouds {
    /// No clouds.
    Clear,
    /// The same fraction of the direct sun all day (0 = fully overcast).
    Overcast(f32),
    /// Passing clouds: every `period` seconds, the sun is out for
    /// `sunny_fraction` of the period and dimmed to `shade_factor` for the
    /// rest. A deterministic pattern, so the tests are reproducible.
    Broken {
        /// Length of one sun-and-cloud cycle in seconds.
        period: u32,
        /// Share of each cycle with full sun, 0–1.
        sunny_fraction: f32,
        /// Direct sun left behind a cloud, 0–1.
        shade_factor: f32,
    },
}

/// One simulated day.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Day {
    /// Day of the year, 1–365 (sun position).
    pub day_of_year: u32,
    /// Local time minus UTC in hours (1 in winter, 2 in summer in Munich).
    pub utc_offset: f32,
    /// Lowest air temperature (at 05:00), °C.
    pub t_min: f32,
    /// Highest air temperature (at 15:00), °C.
    pub t_max: f32,
    /// Cloud pattern.
    pub clouds: Clouds,
}

impl Day {
    /// A clear midsummer day (10 July, 15–29 °C).
    pub const SUMMER_CLEAR: Self = Self {
        day_of_year: 191,
        utc_offset: 2.0,
        t_min: 15.0,
        t_max: 29.0,
        clouds: Clouds::Clear,
    };
}

/// Sun azimuth (degrees from north, clockwise) and elevation (degrees) at
/// `local_seconds` after local midnight.
#[must_use]
pub fn sun_position(site: &Site, day: &Day, local_seconds: f32) -> (f32, f32) {
    let utc_hours = local_seconds / 3600.0 - day.utc_offset;
    #[allow(clippy::cast_precision_loss)]
    let doy = day.day_of_year as f32;
    let g = 2.0 * PI / 365.0 * (doy - 1.0 + (utc_hours - 12.0) / 24.0);
    let decl = 0.006918 - 0.399912 * g.cos() + 0.070257 * g.sin() - 0.006758 * (2.0 * g).cos()
        + 0.000907 * (2.0 * g).sin();
    let eqt = 229.18
        * (0.000075 + 0.001868 * g.cos()
            - 0.032077 * g.sin()
            - 0.014615 * (2.0 * g).cos()
            - 0.040849 * (2.0 * g).sin());
    let solar_minutes = utc_hours * 60.0 + eqt + 4.0 * site.lon;
    let ha = (solar_minutes / 4.0 - 180.0).to_radians();
    let lat = site.lat.to_radians();
    let cz = lat.sin() * decl.sin() + lat.cos() * decl.cos() * ha.cos();
    let el = cz.clamp(-1.0, 1.0).asin().to_degrees();
    let east = -decl.cos() * ha.sin();
    let north = decl.sin() * lat.cos() - decl.cos() * ha.cos() * lat.sin();
    let az = (east.atan2(north).to_degrees() + 360.0) % 360.0;
    (az, el)
}

/// Irradiance on the collector plane in W/m², split into (direct, diffuse),
/// clouds and trees applied.
#[must_use]
pub fn irradiance(site: &Site, day: &Day, local_seconds: f32) -> (f32, f32) {
    let (az, el) = sun_position(site, day, local_seconds);
    if el <= 0.5 {
        return (0.0, 0.0);
    }
    let zen = (90.0 - el).to_radians();
    let am = 1.0 / zen.cos();
    let dni = 1353.0 * 0.7_f32.powf(am.powf(0.678));
    // Angle of incidence on the plane.
    let tilt = site.tilt.to_radians();
    let plane_az = (180.0 + site.aspect).to_radians();
    let (saz, sel) = (az.to_radians(), el.to_radians());
    let cos_inc = sel.sin() * tilt.cos() + sel.cos() * tilt.sin() * (saz - plane_az).cos();
    let mut direct = dni * cos_inc.max(0.0);
    let diffuse = 0.12 * dni * sel.sin() * (1.0 + tilt.cos()) / 2.0;
    direct *= cloud_factor(day, local_seconds);
    if let Some((h, a1, a2)) = site.trees {
        if az >= a1 && az <= a2 && el < h {
            direct = 0.0;
        }
    }
    (direct, diffuse)
}

/// Share of the direct sun the clouds let through at this time.
fn cloud_factor(day: &Day, local_seconds: f32) -> f32 {
    match day.clouds {
        Clouds::Clear => 1.0,
        Clouds::Overcast(f) => f.clamp(0.0, 1.0),
        Clouds::Broken {
            period,
            sunny_fraction,
            shade_factor,
        } => {
            #[allow(clippy::cast_precision_loss)]
            let p = period.max(1) as f32;
            let phase = (local_seconds % p) / p;
            if phase < sunny_fraction {
                1.0
            } else {
                shade_factor.clamp(0.0, 1.0)
            }
        }
    }
}

/// Air temperature in °C at this time: rising along half a cosine from
/// `t_min` at 05:00 to `t_max` at 15:00, falling along another half cosine
/// to `t_min` at 05:00 the next morning.
#[must_use]
pub fn air_temperature(day: &Day, local_seconds: f32) -> f32 {
    let h = (local_seconds / 3600.0).rem_euclid(24.0);
    let mean = (day.t_min + day.t_max) / 2.0;
    let amp = (day.t_max - day.t_min) / 2.0;
    // Phase 0 at 05:00 (minimum), PI at 15:00 (maximum), 2 PI at 05:00.
    let phase = if (5.0..15.0).contains(&h) {
        PI * (h - 5.0) / 10.0
    } else {
        // 15:00 .. 05:00 next day = 14 hours.
        let since = (h - 15.0).rem_euclid(24.0);
        PI + PI * since / 14.0
    };
    mean - amp * phase.cos()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The sun stands south at solar noon, about 64° high in early July in
    /// Munich, and is below the horizon at midnight.
    #[test]
    fn sun_position_is_plausible() {
        let site = Site::REFERENCE;
        let day = Day::SUMMER_CLEAR;
        // Solar noon in Munich in July: about 13:20 CEST.
        let (az, el) = sun_position(&site, &day, 13.33 * 3600.0);
        assert!((az - 180.0).abs() < 3.0, "{az}");
        assert!((el - 64.0).abs() < 2.0, "{el}");
        let (_, el) = sun_position(&site, &day, 0.0);
        assert!(el < 0.0);
    }

    /// A west-facing plane gets more in the afternoon than in the morning,
    /// and up to about 900–1000 W/m² on a clear summer day.
    #[test]
    fn west_plane_peaks_in_the_afternoon() {
        let site = Site {
            trees: None,
            ..Site::REFERENCE
        };
        let day = Day::SUMMER_CLEAR;
        let g = |h: f32| {
            let (b, d) = irradiance(&site, &day, h * 3600.0);
            b + d
        };
        assert!(g(16.0) > g(10.0));
        let peak = (8..20).map(|h| g(h as f32)).fold(0.0_f32, f32::max);
        assert!((850.0..1100.0).contains(&peak), "{peak}");
        assert!(g(0.0) <= 0.0);
    }

    /// The trees take the direct sun at a low winter noon, not in summer.
    #[test]
    fn trees_block_low_winter_sun() {
        let site = Site::REFERENCE;
        let winter = Day {
            day_of_year: 350,
            utc_offset: 1.0,
            t_min: -3.0,
            t_max: 3.0,
            clouds: Clouds::Clear,
        };
        let (direct, _) = irradiance(&site, &winter, 12.33 * 3600.0);
        assert!(direct <= 0.0);
        let (direct, _) = irradiance(&site, &Day::SUMMER_CLEAR, 13.33 * 3600.0);
        assert!(direct > 0.0);
    }

    #[test]
    fn air_temperature_follows_the_day() {
        let day = Day::SUMMER_CLEAR;
        assert!((air_temperature(&day, 5.0 * 3600.0) - 15.0).abs() < 0.1);
        assert!((air_temperature(&day, 15.0 * 3600.0) - 29.0).abs() < 0.1);
    }
}
