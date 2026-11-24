//! Revision store: every saved settings document is a new numbered file.
//!
//! ```text
//! /var/lib/costos/settings/
//!   rev-000001.json   ← first save (e.g. the reference defaults)
//!   rev-000002.json   ← "ΔT on 6 K" (web interface)
//!   rev-000003.json   ← "restore of revision 1"
//! ```
//!
//! Each file is a [`Revision`]: number, time, a short note and the whole
//! [`Settings`] document. Nothing is ever changed in place.
//!
//! **Atomic write.** A revision is written to a hidden temporary file in
//! the same directory, flushed (`fsync`) to the card, renamed to its final
//! name (atomic on Linux within one file system), and then the directory
//! itself is flushed so the rename survives a power cut. A reader never
//! sees half a file: either the revision is there complete or not at all.
//!
//! **Only valid documents are saved.** [`Store::save`] runs the full
//! validation first, so a revision on disk was usable when it was written.
//!
//! **Falling back.** [`Store::latest_valid`] returns the newest revision
//! that reads and validates, and lists the newer ones it had to skip, so
//! the daemon can start with the last good settings and report the damage
//! instead of refusing to run the pump at all. (Refusing would not be
//! safer: with no control the collector stagnates.)
//!
//! **Pruning.** Only the newest `keep` revisions are kept; older ones are
//! deleted after a successful save. Each document is a few kB.

use std::fmt;
use std::fs::{self, File};
use std::io::{self, Write as _};
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::{ConfigError, Settings};

/// One saved revision.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Revision {
    /// Number, counting up from 1.
    pub revision: u64,
    /// When it was saved, Unix seconds.
    pub saved_at: u64,
    /// What changed and why, as given by whoever saved it.
    pub note: String,
    /// The settings.
    pub settings: Settings,
}

/// Why a revision could not be read or saved.
#[derive(Debug)]
pub enum StoreError {
    /// File system.
    Io(io::Error),
    /// Not a revision document.
    Json(serde_json::Error),
    /// Reads, but the settings are not valid.
    Invalid(ConfigError),
    /// The number in the file is not the number in its name.
    WrongNumber {
        /// From the file name.
        expected: u64,
        /// From the content.
        found: u64,
    },
}

impl fmt::Display for StoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Io(e) => write!(f, "file system: {e}"),
            Self::Json(e) => write!(f, "not a revision document: {e}"),
            Self::Invalid(e) => write!(f, "invalid settings: {e}"),
            Self::WrongNumber { expected, found } => {
                write!(f, "file of revision {expected} contains revision {found}")
            }
        }
    }
}

impl std::error::Error for StoreError {}

impl From<io::Error> for StoreError {
    fn from(e: io::Error) -> Self {
        Self::Io(e)
    }
}

impl From<serde_json::Error> for StoreError {
    fn from(e: serde_json::Error) -> Self {
        Self::Json(e)
    }
}

/// Revisions that were skipped while looking for the latest valid one,
/// newest first, each with the reason.
pub type Skipped = Vec<(u64, StoreError)>;

/// The directory of revisions.
#[derive(Clone, Debug)]
pub struct Store {
    dir: PathBuf,
    keep: usize,
}

/// `rev-000042.json` → 42. Anything else (temporary files, other files a
/// person put there) is ignored.
fn number_of(name: &str) -> Option<u64> {
    let digits = name.strip_prefix("rev-")?.strip_suffix(".json")?;
    if digits.is_empty() || !digits.bytes().all(|b| b.is_ascii_digit()) {
        return None;
    }
    digits.parse().ok()
}

fn file_name(revision: u64) -> String {
    format!("rev-{revision:06}.json")
}

impl Store {
    /// Opens (and creates, if needed) the directory. `keep` is how many
    /// revisions survive pruning; at least 1.
    pub fn open(dir: impl Into<PathBuf>, keep: usize) -> io::Result<Self> {
        let dir = dir.into();
        fs::create_dir_all(&dir)?;
        Ok(Self {
            dir,
            keep: keep.max(1),
        })
    }

    /// The directory.
    #[must_use]
    pub fn dir(&self) -> &Path {
        &self.dir
    }

    /// All revision numbers on disk, oldest first.
    pub fn revisions(&self) -> io::Result<Vec<u64>> {
        let mut out = Vec::new();
        for entry in fs::read_dir(&self.dir)? {
            let entry = entry?;
            if let Some(n) = entry.file_name().to_str().and_then(number_of) {
                out.push(n);
            }
        }
        out.sort_unstable();
        Ok(out)
    }

    /// Reads one revision and validates its settings.
    pub fn load(&self, revision: u64) -> Result<Revision, StoreError> {
        let text = fs::read_to_string(self.dir.join(file_name(revision)))?;
        let rev: Revision = serde_json::from_str(&text)?;
        if rev.revision != revision {
            return Err(StoreError::WrongNumber {
                expected: revision,
                found: rev.revision,
            });
        }
        rev.settings
            .to_cycle_config()
            .map_err(StoreError::Invalid)?;
        Ok(rev)
    }

    /// The newest revision that reads and validates, if any, and the newer
    /// ones that had to be skipped (newest first) with the reason.
    pub fn latest_valid(&self) -> io::Result<(Option<Revision>, Skipped)> {
        let mut skipped = Vec::new();
        for n in self.revisions()?.into_iter().rev() {
            match self.load(n) {
                Ok(rev) => return Ok((Some(rev), skipped)),
                Err(e) => skipped.push((n, e)),
            }
        }
        Ok((None, skipped))
    }

    /// Saves `settings` as the next revision (after validating them), then
    /// prunes. `now` is Unix seconds (passed in, so tests are repeatable).
    pub fn save(&self, settings: &Settings, note: &str, now: u64) -> Result<Revision, StoreError> {
        settings.to_cycle_config().map_err(StoreError::Invalid)?;
        let next = self.revisions()?.last().map_or(1, |n| n.saturating_add(1));
        let rev = Revision {
            revision: next,
            saved_at: now,
            note: note.to_owned(),
            settings: settings.clone(),
        };
        let mut text = serde_json::to_string_pretty(&rev)?;
        text.push('\n');

        let name = file_name(next);
        let tmp = self.dir.join(format!(".{name}.tmp"));
        {
            let mut f = File::create(&tmp)?;
            f.write_all(text.as_bytes())?;
            // On the card before the rename makes it visible.
            f.sync_all()?;
        }
        fs::rename(&tmp, self.dir.join(&name))?;
        // The rename itself is an entry in the directory: flush that too.
        File::open(&self.dir)?.sync_all()?;

        self.prune()?;
        Ok(rev)
    }

    /// Saves an earlier revision's settings again as a new revision: the
    /// way back, without losing the history in between.
    pub fn restore(&self, revision: u64, now: u64) -> Result<Revision, StoreError> {
        let old = self.load(revision)?;
        self.save(
            &old.settings,
            &format!("restore of revision {revision}"),
            now,
        )
    }

    /// Deletes all but the newest `keep` revisions.
    fn prune(&self) -> io::Result<()> {
        let all = self.revisions()?;
        let excess = all.len().saturating_sub(self.keep);
        for n in all.into_iter().take(excess) {
            fs::remove_file(self.dir.join(file_name(n)))?;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU32, Ordering};

    /// A fresh, empty directory per test (no tempfile dependency).
    fn temp_store(keep: usize) -> Store {
        static N: AtomicU32 = AtomicU32::new(0);
        let n = N.fetch_add(1, Ordering::Relaxed);
        let dir = std::env::temp_dir().join(format!("costos-config-{}-{n}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        Store::open(dir, keep).unwrap()
    }

    #[test]
    fn save_load_and_count_up() {
        let st = temp_store(10);
        assert_eq!(st.latest_valid().unwrap().0, None);
        let a = st.save(&Settings::reference(), "initial", 100).unwrap();
        let mut changed = Settings::reference();
        changed.delta_t.on_k = 6.0;
        let b = st.save(&changed, "ΔT on 6 K", 200).unwrap();
        assert_eq!((a.revision, b.revision), (1, 2));
        assert_eq!(st.revisions().unwrap(), vec![1, 2]);
        let (latest, skipped) = st.latest_valid().unwrap();
        assert_eq!(latest.unwrap(), b);
        assert!(skipped.is_empty());
        assert_eq!(st.load(1).unwrap(), a);
    }

    #[test]
    fn invalid_settings_are_not_saved() {
        let st = temp_store(10);
        let mut bad = Settings::reference();
        bad.store_max.max_c = 99.0;
        assert!(matches!(st.save(&bad, "x", 1), Err(StoreError::Invalid(_))));
        assert!(st.revisions().unwrap().is_empty());
    }

    /// A damaged newest file (here: cut off) is skipped and reported; the
    /// previous revision is used.
    #[test]
    fn falls_back_past_a_damaged_revision() {
        let st = temp_store(10);
        st.save(&Settings::reference(), "good", 1).unwrap();
        st.save(&Settings::generic(), "will be damaged", 2).unwrap();
        let path = st.dir().join(file_name(2));
        let text = fs::read_to_string(&path).unwrap();
        fs::write(&path, &text[..text.len() / 2]).unwrap();

        let (latest, skipped) = st.latest_valid().unwrap();
        assert_eq!(latest.unwrap().revision, 1);
        assert_eq!(skipped.len(), 1);
        assert_eq!(skipped[0].0, 2);
        // The next save still counts on from the highest number on disk.
        assert_eq!(
            st.save(&Settings::reference(), "fix", 3).unwrap().revision,
            3
        );
    }

    #[test]
    fn restore_and_prune() {
        let st = temp_store(3);
        for i in 0..5 {
            let mut s = Settings::reference();
            s.delta_t.on_k = 5.0 + i as f32;
            st.save(&s, "step", i).unwrap();
        }
        assert_eq!(st.revisions().unwrap(), vec![3, 4, 5]);
        let r = st.restore(3, 99).unwrap();
        assert_eq!(r.revision, 6);
        assert_eq!(r.note, "restore of revision 3");
        assert!((r.settings.delta_t.on_k - 7.0).abs() < 1e-6);
        assert_eq!(st.revisions().unwrap(), vec![4, 5, 6]);
    }

    #[test]
    fn other_files_are_ignored() {
        let st = temp_store(3);
        fs::write(st.dir().join("README"), "x").unwrap();
        fs::write(st.dir().join(".rev-000009.json.tmp"), "half").unwrap();
        fs::write(st.dir().join("rev-abc.json"), "x").unwrap();
        assert!(st.revisions().unwrap().is_empty());
    }
}
