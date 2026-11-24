//! `costos-config`: the CoSTOS settings document.
//!
//! **What it is.** All settings of one installation in one JSON document
//! ([`Settings`]), in plain units a person can read and edit: temperatures
//! in °C (`_c`), differences in K (`_k`), durations in seconds (`_s`),
//! times of day as `"HH:MM"`. The daemon converts it into the
//! [`costos_cycle::CycleConfig`] the control runs on, and only a document
//! that passes **every** check of the control crates is ever used
//! ([`Settings::to_cycle_config`]).
//!
//! **Why a document with revisions** ([`store`]). Every change, from the
//! web interface or by hand, is saved as a new numbered revision; nothing
//! is overwritten. That gives a history of who changed what when (with a
//! note), a one-click way back to an earlier revision, and protection
//! against a half-written file: each revision is written to a temporary
//! file, flushed to the SD card and only then renamed into place, so after
//! a power cut the directory holds either the old or the new revision,
//! never a torn one. If the newest revision should still be unreadable
//! (a dying SD card), the daemon falls back to the newest one that reads
//! and validates.
//!
//! **Strict on purpose.** Unknown fields are rejected (a typo such as
//! `"of_k"` must not silently fall back to a default), and every field
//! must be present: the daemon and the web interface always write the
//! whole document, so a missing field means the file was damaged or
//! edited wrongly, and that must be noticed, not papered over.
//!
//! **Two sets of defaults.**
//! - [`Settings::generic`]: the defaults of the control crates, for an
//!   unknown installation.
//! - [`Settings::reference`]: the reference installation as measured
//!   (ARCHITECTURE 8.1, 8.4, 11): ΔT 5 / 2 K like its BX, store maximum
//!   90 °C, the calibrated flow table and the S1 offset of +8 K.
//!
//! `std` crate (files, JSON); it is not part of the `no_std` set.

pub mod store;

use std::fmt;

use costos_core::anti_seize::AntiSeizeConfig;
use costos_core::delta_t::DeltaTConfig;
use costos_core::heat::{FlowSource, HeatConfig};
use costos_core::monitor::MonitorConfig;
use costos_core::solar::SolarConfig;
use costos_core::speed::{SpeedConfig, SpeedMode};
use costos_core::start_profile::StartProfile;
use costos_core::store_max::StoreMaxConfig;
use costos_core::{Celsius, Duty, Kelvin, PlausibleRange, Seconds, TimeOfDay};
use costos_cycle::{CycleConfig, CycleConfigError, Offsets};
use costos_safety::SafetyConfig;
use serde::{Deserialize, Serialize};

/// Version of the document format. Raised when a field changes meaning;
/// a document of another version is rejected rather than guessed at.
pub const FORMAT: u32 = 1;

/// The whole settings document.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Settings {
    /// Must be [`FORMAT`].
    pub format: u32,
    /// Switch-on/off differences (ARCHITECTURE 6.2, ΔT control).
    pub delta_t: DeltaT,
    /// Store maximum.
    pub store_max: StoreMax,
    /// Speed control.
    pub speed: Speed,
    /// Anti-seize run and purge.
    pub anti_seize: AntiSeize,
    /// Safety supervisor (limits can only be lowered below the hard ones).
    pub safety: Safety,
    /// Plausibility checks.
    pub monitor: Monitor,
    /// Heat quantity and statistics.
    pub heat: Heat,
    /// Sensor corrections, K added to each reading (positive = the
    /// sensor reads low).
    pub offsets: SensorOffsets,
    /// Use S4/S5 for the flow/return switch-off (like the reference BX).
    pub flow_return_switch_off: bool,
}

/// ΔT control.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct DeltaT {
    /// Switch-on difference collector − store bottom.
    pub on_k: f32,
    /// Switch-off difference.
    pub off_k: f32,
    /// Minimum run time after a start.
    pub min_run_s: u64,
    /// Collector minimum, `null` = none.
    pub collector_min_c: Option<f32>,
}

/// Store maximum.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StoreMax {
    /// Store maximum (20–90 °C).
    pub max_c: f32,
    /// Loading resumes below `max_c − hysteresis_k`.
    pub hysteresis_k: f32,
}

/// How the pump gets to a higher speed.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Profile {
    /// Straight to 100 %.
    Kick,
    /// Up in steps of `percent_per_second`.
    Ramp {
        /// Step per second, %.
        percent_per_second: u8,
    },
    /// Kick for the start, ramp for later changes.
    SoftKick {
        /// Step per second, %.
        percent_per_second: u8,
    },
}

impl Profile {
    fn to_core(self) -> StartProfile {
        match self {
            Self::Kick => StartProfile::Kick,
            Self::Ramp { percent_per_second } => StartProfile::Ramp { percent_per_second },
            Self::SoftKick { percent_per_second } => StartProfile::SoftKick { percent_per_second },
        }
    }

    fn from_core(p: StartProfile) -> Self {
        match p {
            StartProfile::Kick => Self::Kick,
            StartProfile::Ramp { percent_per_second } => Self::Ramp { percent_per_second },
            StartProfile::SoftKick { percent_per_second } => Self::SoftKick { percent_per_second },
        }
    }
}

/// How the speed follows the ΔT.
#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Mode {
    /// PI controller on ΔT.
    Pi {
        /// Proportional gain, % per K.
        kp: f32,
        /// Integral gain, % per K·s.
        ki: f32,
    },
    /// BX-like steps.
    Steps {
        /// Step, %.
        step_percent: u8,
        /// Time between steps.
        interval_s: u64,
        /// Dead band around the setpoint.
        band_k: f32,
    },
}

/// Speed control.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Speed {
    /// ΔT the speed control aims for.
    pub setpoint_k: f32,
    /// Lowest running speed, %.
    pub min_percent: u8,
    /// Highest speed, %.
    pub max_percent: u8,
    /// Controller.
    pub mode: Mode,
    /// Start profile of the pump.
    pub profile: Profile,
    /// Time at full speed after a start.
    pub kick_s: u64,
}

/// Anti-seize run and purge. A duration of 0 switches that part off.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AntiSeize {
    /// Idle time after which the anti-seize run is due.
    pub idle_limit_s: u64,
    /// Earliest start, `"HH:MM"` local time.
    pub start: String,
    /// How long after `start` it may still start.
    pub window_s: u64,
    /// Length of the run at 100 %; 0 = off.
    pub run_s: u64,
    /// Time without 100 % after which the next start purges.
    pub purge_interval_s: u64,
    /// Length of the purge at 100 %; 0 = off.
    pub purge_s: u64,
}

/// Safety supervisor.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Safety {
    /// Collector emergency stop (at most 130 °C).
    pub collector_emergency_c: f32,
    /// Store emergency stop (at most 95 °C).
    pub store_emergency_c: f32,
    /// Cooling needed before an emergency releases.
    pub restart_hysteresis_k: f32,
    /// Minimum off time after a stop.
    pub min_off_s: u64,
}

/// Plausibility checks (see `costos_core::monitor` for each one).
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[allow(missing_docs)] // one-to-one with `MonitorConfig`, documented there
pub struct Monitor {
    pub sensor_clear_after_s: u64,
    pub circulation_window_s: u64,
    pub circulation_collector_drop_k: f32,
    pub circulation_flow_over_store_k: f32,
    pub circulation_flow_over_return_k: f32,
    pub circulation_collector_over_flow_k: f32,
    pub circulation_failures_to_inhibit: u8,
    pub delta_t_high_k: f32,
    pub delta_t_high_for_s: u64,
    pub delta_t_high_store_rise_k: f32,
    pub night_window_s: u64,
    pub night_collector_rise_k: f32,
    pub night_store_drop_k: f32,
    /// `"HH:MM"`.
    pub night_from: String,
    /// `"HH:MM"`.
    pub night_to: String,
}

/// Where the flow for the heat quantity comes from.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Flow {
    /// The same flow at every speed, l/min.
    Fixed {
        /// l/min.
        l_per_min: f32,
    },
    /// Flow at 0, 10, …, 100 % (11 values), l/min.
    Table {
        /// l/min.
        l_per_min: [f32; 11],
    },
}

/// Heat quantity and statistics.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Heat {
    /// Flow source.
    pub flow: Flow,
    /// Glycol share, % by volume.
    pub glycol_percent: f32,
    /// Pump power at the lowest speed, W.
    pub pump_base_w: f32,
    /// Extra pump power at 100 % (grows with duty²), W.
    pub pump_extra_w: f32,
    /// "Collector hot" counts above this.
    pub collector_hot_c: f32,
}

/// Sensor offsets, K.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[allow(missing_docs)] // S1..S5 by role
pub struct SensorOffsets {
    pub collector_k: f32,
    pub store_bottom_k: f32,
    pub store_top_k: f32,
    pub flow_k: f32,
    pub return_k: f32,
}

/// Why a settings document can't be used. Names the field, so the web
/// interface and the log can say exactly what is wrong.
#[derive(Clone, Debug, PartialEq)]
pub enum ConfigError {
    /// `format` is not [`FORMAT`].
    Format(u32),
    /// A number is not a valid value (NaN, infinite, out of the physical
    /// range, duty above 100 %, …).
    Value(&'static str),
    /// A time of day is not `"HH:MM"`.
    TimeOfDay(&'static str),
    /// The control crates rejected the combination.
    Cycle(CycleConfigError),
}

impl fmt::Display for ConfigError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Format(v) => write!(f, "document format {v}, this program reads {FORMAT}"),
            Self::Value(field) => write!(f, "{field}: not a valid value"),
            Self::TimeOfDay(field) => write!(f, "{field}: expected \"HH:MM\""),
            Self::Cycle(e) => write!(f, "settings rejected by the control: {e:?}"),
        }
    }
}

impl std::error::Error for ConfigError {}

fn kelvin(v: f32, field: &'static str) -> Result<Kelvin, ConfigError> {
    Kelvin::new(v).ok_or(ConfigError::Value(field))
}

fn celsius(v: f32, field: &'static str) -> Result<Celsius, ConfigError> {
    Celsius::new(v).ok_or(ConfigError::Value(field))
}

fn duty(v: u8, field: &'static str) -> Result<Duty, ConfigError> {
    Duty::new(v).ok_or(ConfigError::Value(field))
}

fn finite(v: f32, field: &'static str) -> Result<f32, ConfigError> {
    if v.is_finite() {
        Ok(v)
    } else {
        Err(ConfigError::Value(field))
    }
}

/// `"HH:MM"` → [`TimeOfDay`]. Exactly two digits each, 00:00–23:59.
fn parse_time(s: &str, field: &'static str) -> Result<TimeOfDay, ConfigError> {
    let err = ConfigError::TimeOfDay(field);
    let (h, m) = s.split_once(':').ok_or_else(|| err.clone())?;
    if h.len() != 2 || m.len() != 2 {
        return Err(err);
    }
    let h: u32 = h.parse().map_err(|_| err.clone())?;
    let m: u32 = m.parse().map_err(|_| err.clone())?;
    TimeOfDay::from_hm(h, m).ok_or(err)
}

/// [`TimeOfDay`] → `"HH:MM"` (seconds are dropped; settings never use them).
fn format_time(t: TimeOfDay) -> String {
    let minutes = t.get() / 60;
    format!("{:02}:{:02}", minutes / 60, minutes % 60)
}

impl Settings {
    /// The defaults of the control crates, for an unknown installation:
    /// no sensor offsets, no flow/return switch-off.
    #[must_use]
    pub fn generic() -> Self {
        Self::from_cycle_config(&CycleConfig {
            solar: SolarConfig::DEFAULT,
            safety: SafetyConfig::DEFAULT,
            monitor: MonitorConfig::DEFAULT,
            heat: HeatConfig::REFERENCE,
            offsets: Offsets::NONE,
            flow_return_switch_off: false,
            collector_range: PlausibleRange::COLLECTOR,
            store_range: PlausibleRange::STORE,
        })
    }

    /// The reference installation (installation.md, ARCHITECTURE 8.1, 8.4,
    /// 11): ΔT 5 / 2 K without minimum run time as on its BX, flow/return
    /// switch-off on, store maximum 90 °C, the calibrated flow table, and
    /// S1 corrected by +8 K (the sensor sits inside the insulation and
    /// reads about 8 K low; with the correction the collector emergency
    /// stop acts at a real 130 °C).
    #[must_use]
    pub fn reference() -> Self {
        let mut s = Self::generic();
        s.delta_t.on_k = 5.0;
        s.delta_t.off_k = 2.0;
        s.delta_t.min_run_s = 0;
        s.store_max.max_c = 90.0;
        s.offsets.collector_k = 8.0;
        s.flow_return_switch_off = true;
        s
    }

    /// The document describing an existing configuration.
    #[must_use]
    pub fn from_cycle_config(c: &CycleConfig) -> Self {
        let d = c.solar.delta_t;
        let sm = c.solar.store_max;
        let sp = c.solar.speed;
        let a = c.solar.anti_seize;
        let m = c.monitor;
        let h = c.heat;
        Self {
            format: FORMAT,
            delta_t: DeltaT {
                on_k: d.on.get(),
                off_k: d.off.get(),
                min_run_s: d.min_run.get(),
                collector_min_c: d.collector_min.map(Celsius::get),
            },
            store_max: StoreMax {
                max_c: sm.max.get(),
                hysteresis_k: sm.hysteresis.get(),
            },
            speed: Speed {
                setpoint_k: sp.setpoint.get(),
                min_percent: sp.min.percent(),
                max_percent: sp.max.percent(),
                mode: match sp.mode {
                    SpeedMode::Pi { kp, ki } => Mode::Pi { kp, ki },
                    SpeedMode::Steps {
                        step,
                        interval,
                        band,
                    } => Mode::Steps {
                        step_percent: step,
                        interval_s: interval.get(),
                        band_k: band.get(),
                    },
                },
                profile: Profile::from_core(sp.profile),
                kick_s: sp.kick.get(),
            },
            anti_seize: AntiSeize {
                idle_limit_s: a.idle_limit.get(),
                start: format_time(a.start),
                window_s: a.window.get(),
                run_s: a.run.get(),
                purge_interval_s: a.purge_interval.get(),
                purge_s: a.purge.get(),
            },
            safety: Safety {
                collector_emergency_c: c.safety.collector_emergency.get(),
                store_emergency_c: c.safety.store_emergency.get(),
                restart_hysteresis_k: c.safety.restart_hysteresis.get(),
                min_off_s: c.safety.min_off.get(),
            },
            monitor: Monitor {
                sensor_clear_after_s: m.sensor_clear_after.get(),
                circulation_window_s: m.circulation_window.get(),
                circulation_collector_drop_k: m.circulation_collector_drop.get(),
                circulation_flow_over_store_k: m.circulation_flow_over_store.get(),
                circulation_flow_over_return_k: m.circulation_flow_over_return.get(),
                circulation_collector_over_flow_k: m.circulation_collector_over_flow.get(),
                circulation_failures_to_inhibit: m.circulation_failures_to_inhibit,
                delta_t_high_k: m.delta_t_high.get(),
                delta_t_high_for_s: m.delta_t_high_for.get(),
                delta_t_high_store_rise_k: m.delta_t_high_store_rise.get(),
                night_window_s: m.night_window.get(),
                night_collector_rise_k: m.night_collector_rise.get(),
                night_store_drop_k: m.night_store_drop.get(),
                night_from: format_time(m.night_from),
                night_to: format_time(m.night_to),
            },
            heat: Heat {
                flow: match h.flow {
                    FlowSource::Fixed(l_per_min) => Flow::Fixed { l_per_min },
                    FlowSource::Table(l_per_min) => Flow::Table { l_per_min },
                },
                glycol_percent: h.glycol_percent,
                pump_base_w: h.pump_power.0,
                pump_extra_w: h.pump_power.1,
                collector_hot_c: h.collector_hot.get(),
            },
            offsets: SensorOffsets {
                collector_k: c.offsets.collector.get(),
                store_bottom_k: c.offsets.store_bottom.get(),
                store_top_k: c.offsets.store_top.get(),
                flow_k: c.offsets.flow.get(),
                return_k: c.offsets.ret.get(),
            },
            flow_return_switch_off: c.flow_return_switch_off,
        }
    }

    /// Converts and validates: every value is checked on its own (finite,
    /// physical range), then the whole configuration by the control crates'
    /// own `validate` (the same checks the daemon relies on). Only an `Ok`
    /// here is ever handed to the control.
    pub fn to_cycle_config(&self) -> Result<CycleConfig, ConfigError> {
        if self.format != FORMAT {
            return Err(ConfigError::Format(self.format));
        }
        let d = &self.delta_t;
        let delta_t = DeltaTConfig {
            on: kelvin(d.on_k, "delta_t.on_k")?,
            off: kelvin(d.off_k, "delta_t.off_k")?,
            min_run: Seconds::new(d.min_run_s),
            collector_min: d
                .collector_min_c
                .map(|v| celsius(v, "delta_t.collector_min_c"))
                .transpose()?,
        };
        let store_max = StoreMaxConfig {
            max: celsius(self.store_max.max_c, "store_max.max_c")?,
            hysteresis: kelvin(self.store_max.hysteresis_k, "store_max.hysteresis_k")?,
        };
        let sp = &self.speed;
        let profile = sp.profile.to_core();
        let speed = SpeedConfig {
            setpoint: kelvin(sp.setpoint_k, "speed.setpoint_k")?,
            min: duty(sp.min_percent, "speed.min_percent")?,
            max: duty(sp.max_percent, "speed.max_percent")?,
            mode: match sp.mode {
                Mode::Pi { kp, ki } => SpeedMode::Pi {
                    kp: finite(kp, "speed.mode.kp")?,
                    ki: finite(ki, "speed.mode.ki")?,
                },
                Mode::Steps {
                    step_percent,
                    interval_s,
                    band_k,
                } => SpeedMode::Steps {
                    step: step_percent,
                    interval: Seconds::new(interval_s),
                    band: kelvin(band_k, "speed.mode.band_k")?,
                },
            },
            profile,
            kick: Seconds::new(sp.kick_s),
        };
        let a = &self.anti_seize;
        let anti_seize = AntiSeizeConfig {
            idle_limit: Seconds::new(a.idle_limit_s),
            start: parse_time(&a.start, "anti_seize.start")?,
            window: Seconds::new(a.window_s),
            run: Seconds::new(a.run_s),
            purge_interval: Seconds::new(a.purge_interval_s),
            purge: Seconds::new(a.purge_s),
            // One pump, one start profile: anti-seize uses the speed
            // control's (solar.rs checks they match).
            profile,
        };
        let s = &self.safety;
        let safety = SafetyConfig {
            collector_emergency: celsius(s.collector_emergency_c, "safety.collector_emergency_c")?,
            store_emergency: celsius(s.store_emergency_c, "safety.store_emergency_c")?,
            restart_hysteresis: kelvin(s.restart_hysteresis_k, "safety.restart_hysteresis_k")?,
            min_off: Seconds::new(s.min_off_s),
        };
        let m = &self.monitor;
        let monitor = MonitorConfig {
            sensor_clear_after: Seconds::new(m.sensor_clear_after_s),
            circulation_window: Seconds::new(m.circulation_window_s),
            circulation_collector_drop: kelvin(
                m.circulation_collector_drop_k,
                "monitor.circulation_collector_drop_k",
            )?,
            circulation_flow_over_store: kelvin(
                m.circulation_flow_over_store_k,
                "monitor.circulation_flow_over_store_k",
            )?,
            circulation_flow_over_return: kelvin(
                m.circulation_flow_over_return_k,
                "monitor.circulation_flow_over_return_k",
            )?,
            circulation_collector_over_flow: kelvin(
                m.circulation_collector_over_flow_k,
                "monitor.circulation_collector_over_flow_k",
            )?,
            circulation_failures_to_inhibit: m.circulation_failures_to_inhibit,
            delta_t_high: kelvin(m.delta_t_high_k, "monitor.delta_t_high_k")?,
            delta_t_high_for: Seconds::new(m.delta_t_high_for_s),
            delta_t_high_store_rise: kelvin(
                m.delta_t_high_store_rise_k,
                "monitor.delta_t_high_store_rise_k",
            )?,
            night_window: Seconds::new(m.night_window_s),
            night_collector_rise: kelvin(
                m.night_collector_rise_k,
                "monitor.night_collector_rise_k",
            )?,
            night_store_drop: kelvin(m.night_store_drop_k, "monitor.night_store_drop_k")?,
            night_from: parse_time(&m.night_from, "monitor.night_from")?,
            night_to: parse_time(&m.night_to, "monitor.night_to")?,
        };
        let h = &self.heat;
        let flow = match &h.flow {
            Flow::Fixed { l_per_min } => {
                if !(l_per_min.is_finite() && *l_per_min >= 0.0) {
                    return Err(ConfigError::Value("heat.flow.l_per_min"));
                }
                FlowSource::Fixed(*l_per_min)
            }
            Flow::Table { l_per_min } => {
                if !l_per_min.iter().all(|v| v.is_finite() && *v >= 0.0) {
                    return Err(ConfigError::Value("heat.flow.l_per_min"));
                }
                FlowSource::Table(*l_per_min)
            }
        };
        let heat = HeatConfig {
            flow,
            glycol_percent: finite(h.glycol_percent, "heat.glycol_percent")?,
            pump_power: (
                finite(h.pump_base_w, "heat.pump_base_w")?,
                finite(h.pump_extra_w, "heat.pump_extra_w")?,
            ),
            collector_hot: celsius(h.collector_hot_c, "heat.collector_hot_c")?,
        };
        let o = &self.offsets;
        let offsets = Offsets {
            collector: kelvin(o.collector_k, "offsets.collector_k")?,
            store_bottom: kelvin(o.store_bottom_k, "offsets.store_bottom_k")?,
            store_top: kelvin(o.store_top_k, "offsets.store_top_k")?,
            flow: kelvin(o.flow_k, "offsets.flow_k")?,
            ret: kelvin(o.return_k, "offsets.return_k")?,
        };
        let config = CycleConfig {
            solar: SolarConfig {
                delta_t,
                store_max,
                speed,
                anti_seize,
            },
            safety,
            monitor,
            heat,
            offsets,
            flow_return_switch_off: self.flow_return_switch_off,
            collector_range: PlausibleRange::COLLECTOR,
            store_range: PlausibleRange::STORE,
        };
        config.validate().map_err(ConfigError::Cycle)?;
        Ok(config)
    }

    /// Reads a document from JSON. Structure only; call
    /// [`Self::to_cycle_config`] to validate the values.
    pub fn from_json(text: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(text)
    }

    /// The document as pretty JSON (stable field order, for diffs).
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(self)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn both_default_sets_are_valid() {
        Settings::generic().to_cycle_config().unwrap();
        let c = Settings::reference().to_cycle_config().unwrap();
        assert!((c.offsets.collector.get() - 8.0).abs() < 1e-6);
        assert!((c.solar.store_max.max.get() - 90.0).abs() < 1e-6);
        assert!(c.flow_return_switch_off);
    }

    /// JSON → settings → config → settings gives the same document.
    #[test]
    fn round_trip() {
        let s = Settings::reference();
        let text = s.to_json().unwrap();
        let back = Settings::from_json(&text).unwrap();
        assert_eq!(back, s);
        let again = Settings::from_cycle_config(&back.to_cycle_config().unwrap());
        assert_eq!(again, s);
    }

    #[test]
    fn typos_and_missing_fields_are_rejected() {
        let text = Settings::reference().to_json().unwrap();
        let typo = text.replace("\"off_k\"", "\"of_k\"");
        assert!(Settings::from_json(&typo).is_err());
        let mut v: serde_json::Value = serde_json::from_str(&text).unwrap();
        v["delta_t"].as_object_mut().unwrap().remove("on_k");
        assert!(serde_json::from_value::<Settings>(v).is_err());
    }

    #[test]
    fn values_are_checked() {
        let mut s = Settings::reference();
        s.store_max.max_c = 95.0; // above the 90 °C the control allows
        assert!(matches!(s.to_cycle_config(), Err(ConfigError::Cycle(_))));

        let mut s = Settings::reference();
        s.safety.collector_emergency_c = 140.0; // above the hard limit
        assert!(matches!(s.to_cycle_config(), Err(ConfigError::Cycle(_))));

        let mut s = Settings::reference();
        s.speed.min_percent = 120;
        assert_eq!(
            s.to_cycle_config(),
            Err(ConfigError::Value("speed.min_percent"))
        );

        let mut s = Settings::reference();
        s.anti_seize.start = "12h".into();
        assert_eq!(
            s.to_cycle_config(),
            Err(ConfigError::TimeOfDay("anti_seize.start"))
        );

        let mut s = Settings::reference();
        s.format = 2;
        assert_eq!(s.to_cycle_config(), Err(ConfigError::Format(2)));
    }

    /// `reference.json` next to this crate is the reference document as
    /// shipped and shown in the docs; it must match the code. To update it
    /// after a deliberate change: `COSTOS_BLESS=1 cargo test -p costos-config`.
    #[test]
    fn reference_json_is_current() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/reference.json");
        let mut want = Settings::reference().to_json().unwrap();
        want.push('\n');
        if std::env::var_os("COSTOS_BLESS").is_some() {
            std::fs::write(path, &want).unwrap();
        }
        let have = std::fs::read_to_string(path).unwrap();
        assert_eq!(have, want, "reference.json is out of date");
    }

    #[test]
    fn times() {
        assert_eq!(parse_time("05:30", "t").unwrap().get(), 5 * 3600 + 30 * 60);
        assert!(parse_time("5:30", "t").is_err());
        assert!(parse_time("24:00", "t").is_err());
        assert_eq!(format_time(parse_time("23:59", "t").unwrap()), "23:59");
    }
}
