//! Persisted counters: `counters.json` in the state directory.
//!
//! The heat counter, pump hours and starts must survive a restart and a
//! power cut, but writing them every second would wear out the SD card
//! (86 400 writes a day). The daemon writes them every
//! [`SAVE_EVERY`](crate::SAVE_EVERY) and when it stops; after a power cut
//! at most that much is lost, which is a few Wh.
//!
//! The write is atomic (temporary file, `fsync`, rename, directory
//! `fsync`), so the file is always either the old or the new state.

use std::fs::{self, File};
use std::io::{self, Write as _};
use std::path::Path;

use costos_core::heat::Counters;
use serde::{Deserialize, Serialize};

/// The file as stored: the same fields as [`Counters`] (which lives in the
/// `no_std` core and has no serde), plus when it was saved.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
#[allow(missing_docs)] // one-to-one with `Counters`
pub struct Saved {
    pub heat_wh: u64,
    pub heat_loss_wh: u64,
    pub pump_seconds: u64,
    pub starts: u64,
    pub pump_wh: u64,
    pub collector_hot_seconds: u64,
}

impl From<Counters> for Saved {
    fn from(c: Counters) -> Self {
        Self {
            heat_wh: c.heat_wh,
            heat_loss_wh: c.heat_loss_wh,
            pump_seconds: c.pump_seconds,
            starts: c.starts,
            pump_wh: c.pump_wh,
            collector_hot_seconds: c.collector_hot_seconds,
        }
    }
}

impl From<Saved> for Counters {
    fn from(s: Saved) -> Self {
        Self {
            heat_wh: s.heat_wh,
            heat_loss_wh: s.heat_loss_wh,
            pump_seconds: s.pump_seconds,
            starts: s.starts,
            pump_wh: s.pump_wh,
            collector_hot_seconds: s.collector_hot_seconds,
        }
    }
}

/// Writes `text` to `path` atomically.
pub fn write_atomic(path: &Path, text: &str) -> io::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    let name = path.file_name().and_then(|n| n.to_str()).unwrap_or("file");
    let tmp = dir.join(format!(".{name}.tmp"));
    {
        let mut f = File::create(&tmp)?;
        f.write_all(text.as_bytes())?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;
    File::open(dir)?.sync_all()
}

/// Loads the counters; a missing file is a first start (all zero). A
/// damaged file is an error: the daemon says so and does not silently
/// start the yield statistics from zero.
pub fn load(path: &Path) -> Result<Counters, String> {
    match fs::read_to_string(path) {
        Ok(text) => serde_json::from_str::<Saved>(&text)
            .map(Counters::from)
            .map_err(|e| format!("{}: {e}", path.display())),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(Counters::default()),
        Err(e) => Err(format!("{}: {e}", path.display())),
    }
}

/// Saves the counters.
pub fn save(path: &Path, counters: Counters) -> io::Result<()> {
    let mut text =
        serde_json::to_string_pretty(&Saved::from(counters)).map_err(io::Error::other)?;
    text.push('\n');
    write_atomic(path, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_and_missing_file() {
        let dir = std::env::temp_dir().join(format!("costosd-persist-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("counters.json");
        assert_eq!(load(&path).unwrap(), Counters::default());
        let c = Counters {
            heat_wh: 15_000,
            starts: 3,
            ..Counters::default()
        };
        save(&path, c).unwrap();
        assert_eq!(load(&path).unwrap(), c);
        fs::write(&path, "{ broken").unwrap();
        assert!(load(&path).is_err());
    }
}
