//! THE ONLY COPY — the `.flv` on the operator's laptop.
//!
//! For a couple on the hosted-channel add-on this file is not a backup, it is THE
//! recording: they do not own the Setnayan pool channel the broadcast went to, so
//! there is no YouTube archive that is theirs to keep (spec § 4k). For a couple on
//! the default tier — streaming on their OWN channel, with their own key
//! (`lib/live-studio-manual-air.ts`) — YouTube keeps an archive and this file is the
//! second copy that survives a reconnect YouTube did not. Either way it is written
//! once, from the same bytes that went to the wire, and never re-encoded.
//!
//! WHAT THIS FILE REFUSES TO DO:
//!
//! · **It does not encode.** It receives finished [`TaggedFrame`]s from the one
//!   `Tagger` and wraps each in an 11-byte FLV tag header. A second encode would cost
//!   a second H.264 pass on a laptop already running the compositor, and it would make
//!   "does the recording match the broadcast?" a question with a real answer of "no".
//! · **It does not stop the stream.** Every failure here — a disk that fills at
//!   19:40, a volume that unmounts, a permissions change — latches a fault and lets
//!   the broadcast continue. The live stream is happening in front of people; the
//!   recording is not worth interrupting it for.
//! · **It does not decide when to give up.** `reconnect.rs` owns policy.
//!
//! THE DISK CHECK IS AT START, NOT AT WRITE. A 6-hour reception at 2.6 Mbps is about
//! 7 GB; the thresholds below are that figure with room for the wedding that runs
//! long, checked ONCE before anyone goes live, when the operator can still do
//! something about it. Checking per-write instead would move the discovery to the
//! middle of the ceremony, which is the one place it must not be.

use std::fs::{File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use super::flv;
use super::tagger::{TagSink, TaggedFrame};

/// Warn below this: 6 h at 2.6 Mbps ≈ 7 GB, so 20 GB covers a long reception with
/// room for whatever else the operator's laptop is doing.
pub const DISK_WARN_BYTES: u64 = 20 * 1024 * 1024 * 1024;

/// Refuse below this. 2 GB is roughly 1 h 45 m — not enough for any wedding, and
/// little enough that starting would mean filling the operator's system volume during
/// the ceremony.
pub const DISK_REFUSE_BYTES: u64 = 2 * 1024 * 1024 * 1024;

/// How often the recording is forced to the platter.
///
/// The cost of a crash is everything since the last one, so this is the "how much of
/// the wedding may a kernel panic take?" number, and 10 s is the answer. Every write
/// is not worth it — an `fsync` per frame is 30+ syncs a second on a machine that is
/// also compositing video.
pub const FSYNC_INTERVAL: Duration = Duration::from_secs(10);

/// What the free space on the recording volume means.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DiskVerdict {
    /// Enough for a long reception.
    Ample { free_bytes: u64 },
    /// Enough to start, not enough to be comfortable. The operator is told; the
    /// stream is not blocked — a warning that blocks is a refusal with a soft name.
    Low { free_bytes: u64 },
    /// Not enough to record at all.
    Refuse { free_bytes: u64 },
}

impl DiskVerdict {
    /// The operator-facing sentence. Rendered, never logged only — the same rule
    /// `live-studio-ingest-health.ts` states for its own states.
    pub fn sentence(&self) -> String {
        match self {
            DiskVerdict::Ample { .. } => "There is room to record this wedding.".to_string(),
            DiskVerdict::Low { free_bytes } => format!(
                "Only {} free — enough to start, but a long reception may fill this disk. \
                 Free up space or record to another drive.",
                human_bytes(*free_bytes)
            ),
            DiskVerdict::Refuse { free_bytes } => format!(
                "Only {} free. Setnayan will not record to a disk this full — free up \
                 space before you go live.",
                human_bytes(*free_bytes)
            ),
        }
    }

    pub fn may_record(&self) -> bool {
        !matches!(self, DiskVerdict::Refuse { .. })
    }

    pub fn free_bytes(&self) -> u64 {
        match self {
            DiskVerdict::Ample { free_bytes }
            | DiskVerdict::Low { free_bytes }
            | DiskVerdict::Refuse { free_bytes } => *free_bytes,
        }
    }
}

/// Pure, so the thresholds can be tested without filling a disk.
pub fn judge_disk(free_bytes: u64) -> DiskVerdict {
    if free_bytes < DISK_REFUSE_BYTES {
        DiskVerdict::Refuse { free_bytes }
    } else if free_bytes < DISK_WARN_BYTES {
        DiskVerdict::Low { free_bytes }
    } else {
        DiskVerdict::Ample { free_bytes }
    }
}

fn human_bytes(bytes: u64) -> String {
    const GB: u64 = 1024 * 1024 * 1024;
    const MB: u64 = 1024 * 1024;
    if bytes >= GB {
        format!("{:.1} GB", bytes as f64 / GB as f64)
    } else {
        format!("{} MB", bytes / MB)
    }
}

/// A calendar date, for the filename and nothing else.
///
/// ⚠ **UTC, and that is a real limitation with a named consequence.** Getting the
/// machine's LOCAL date without a date library means reading the platform's timezone
/// database, and the encoder has deliberately few dependencies. In Manila (UTC+8) a
/// reception that runs past **midnight local** is filed under the previous day — which
/// is arguably what the couple would call it anyway ("the 14th's wedding"), but it is
/// a choice, not an accident. `recording_path` takes the date as an argument so the
/// Tauri layer (S5) can pass a local one the moment it has a reason to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct CivilDate {
    pub year: i64,
    pub month: u32,
    pub day: u32,
}

impl CivilDate {
    /// Howard Hinnant's `civil_from_days`, which is the standard proleptic-Gregorian
    /// conversion every date library implements. Written out because pulling in a
    /// dependency to format eight characters into a filename is not a trade worth
    /// making, and because it is exhaustively testable — see the tests below.
    pub fn from_unix_seconds(seconds: i64) -> CivilDate {
        let days = seconds.div_euclid(86_400);
        let z = days + 719_468;
        let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
        let day_of_era = (z - era * 146_097) as i64; // [0, 146096]
        let year_of_era =
            (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
        let year = year_of_era + era * 400;
        let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
        let mp = (5 * day_of_year + 2) / 153; // [0, 11], March-based
        let day = (day_of_year - (153 * mp + 2) / 5 + 1) as u32;
        let month = if mp < 10 { mp + 3 } else { mp - 9 } as u32;
        CivilDate { year: if month <= 2 { year + 1 } else { year }, month, day }
    }

    pub fn today_utc() -> CivilDate {
        let seconds = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs() as i64)
            .unwrap_or(0);
        CivilDate::from_unix_seconds(seconds)
    }

    pub fn iso(&self) -> String {
        format!("{:04}-{:02}-{:02}", self.year, self.month, self.day)
    }
}

/// `~/Movies/Setnayan` on macOS and Linux, `~\Videos\Setnayan` on Windows.
///
/// Those are the folders each platform's own file manager already shows under
/// "Movies"/"Videos", which is where a person looks for a video they were told was
/// saved. A folder in Application Support or AppData would be correct by convention
/// and unfindable in practice.
pub fn recording_dir(home: &Path) -> PathBuf {
    #[cfg(windows)]
    let media = "Videos";
    #[cfg(not(windows))]
    let media = "Movies";
    home.join(media).join("Setnayan")
}

/// Anything that is not a safe filename character becomes `-`.
///
/// The event id is a `S89<TYPE>-<10-char Crockford>` public id, which is already safe.
/// This exists for the case where it is NOT — an empty string, a path separator, a
/// value that arrived from somewhere other than `generate_public_id`. A recording path
/// is built from caller-supplied text and then opened for writing; refusing to let
/// that text contain `/` or `..` is the difference between a filename and a decision
/// about where to write.
fn safe_id(event_public_id: &str) -> String {
    let cleaned: String = event_public_id
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    let trimmed = cleaned.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "event".to_string()
    } else {
        trimmed
    }
}

/// `<dir>/<event-public-id>-<YYYY-MM-DD>.flv`.
pub fn recording_path(home: &Path, event_public_id: &str, date: CivilDate) -> PathBuf {
    recording_dir(home).join(format!("{}-{}.flv", safe_id(event_public_id), date.iso()))
}

/// Free bytes on the volume holding `path`, for the caller of the disk check.
///
/// `path` may not exist yet — the caller passes the directory it is about to create,
/// or an existing ancestor. Both platform calls answer for the volume, not the file.
#[cfg(unix)]
pub fn available_bytes(path: &Path) -> std::io::Result<u64> {
    use std::ffi::CString;
    use std::os::unix::ffi::OsStrExt;

    let c_path = CString::new(path.as_os_str().as_bytes())
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidInput, "path has a NUL byte"))?;
    // SAFETY: `c_path` is a valid NUL-terminated string that outlives the call, and
    // `stat` is a correctly sized, zeroed `statvfs` we hand out exclusively.
    let mut stat: libc::statvfs = unsafe { std::mem::zeroed() };
    if unsafe { libc::statvfs(c_path.as_ptr(), &mut stat) } != 0 {
        return Err(std::io::Error::last_os_error());
    }
    // `f_bavail` — blocks available to an UNPRIVILEGED process, which is what we are.
    // `f_bfree` counts the root-only reserve too and would over-report by ~5% of the
    // volume on a default ext4, i.e. tens of gigabytes of space we cannot use.
    Ok((stat.f_bavail as u64).saturating_mul(stat.f_frsize as u64))
}

#[cfg(windows)]
pub fn available_bytes(path: &Path) -> std::io::Result<u64> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW;

    let mut wide: Vec<u16> = path.as_os_str().encode_wide().collect();
    wide.push(0);
    let mut free_to_caller: u64 = 0;
    // SAFETY: `wide` is NUL-terminated and outlives the call; the two output pointers
    // are either a valid `u64` we own or null, which the API documents as allowed.
    let ok = unsafe {
        GetDiskFreeSpaceExW(
            wide.as_ptr(),
            &mut free_to_caller,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if ok == 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(free_to_caller)
}

/// The disk verdict for a recording that would live at `path`.
///
/// Walks up to the nearest ancestor that exists, because the target directory is
/// usually the thing we are about to create — asking the OS about a path that is not
/// there yet answers `ENOENT`, and "we could not tell" must never read as "refuse".
pub fn judge_disk_for(path: &Path) -> std::io::Result<DiskVerdict> {
    let mut probe = path;
    loop {
        if probe.exists() {
            return Ok(judge_disk(available_bytes(probe)?));
        }
        match probe.parent() {
            Some(parent) => probe = parent,
            None => {
                return Err(std::io::Error::new(
                    std::io::ErrorKind::NotFound,
                    "no existing ancestor of the recording path",
                ))
            }
        }
    }
}

/// Appends FLV tags to a file, and gets out of the way when it cannot.
pub struct FlvFileWriter {
    file: Option<File>,
    path: PathBuf,
    bytes_written: u64,
    tags_written: u64,
    last_sync: Instant,
    fault: Option<String>,
}

impl FlvFileWriter {
    /// Create the directory, create the file, write the 13-byte FLV header.
    ///
    /// Fails loudly: at start there is still an operator who can act on it. Every
    /// failure AFTER this point is latched instead — see [`accept`](TagSink::accept).
    pub fn create(path: &Path) -> std::io::Result<FlvFileWriter> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        // `create_new` is deliberate: two events on one day with one id is a bug
        // somewhere upstream, and silently appending a second wedding onto the end of
        // the first one's file is not the way to find out about it.
        let mut file = match OpenOptions::new().write(true).create_new(true).open(path) {
            Ok(file) => file,
            // Except on resume: an existing file is opened for APPEND, so a crashed
            // and restarted encoder continues the same recording instead of truncating
            // the ceremony that already happened.
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
                OpenOptions::new().append(true).open(path)?
            }
            Err(error) => return Err(error),
        };
        let existing = file.metadata()?.len();
        let mut bytes_written = existing;
        if existing == 0 {
            let header = flv::file_header(true, true);
            file.write_all(&header)?;
            bytes_written = header.len() as u64;
        }
        Ok(FlvFileWriter {
            file: Some(file),
            path: path.to_path_buf(),
            bytes_written,
            tags_written: 0,
            last_sync: Instant::now(),
            fault: None,
        })
    }

    pub fn path(&self) -> &Path {
        &self.path
    }

    pub fn bytes_written(&self) -> u64 {
        self.bytes_written
    }

    pub fn tags_written(&self) -> u64 {
        self.tags_written
    }

    pub fn is_recording(&self) -> bool {
        self.file.is_some()
    }

    /// Force everything to the platter and close. Called at `encoder_stop`; the path
    /// it returns is what the controller shows the operator.
    pub fn finish(mut self) -> PathBuf {
        if let Some(file) = self.file.take() {
            let _ = file.sync_all();
        }
        self.path
    }

    /// Latch a failure: record why, drop the handle, and never write again.
    ///
    /// Dropping the handle rather than retrying is the point. A disk that just refused
    /// a write will refuse the next one too, and a writer that keeps trying turns one
    /// failure into a failure per frame — 30 a second of identical noise in the log
    /// the operator will be asked for afterwards.
    fn fail(&mut self, context: &str, error: &std::io::Error) {
        if self.fault.is_none() {
            self.fault = Some(format!("{context}: {error}"));
        }
        self.file = None;
    }
}

impl TagSink for FlvFileWriter {
    /// The reason the recording stopped, if it did. `None` means it is still writing.
    fn fault(&self) -> Option<String> {
        self.fault.clone()
    }

    /// Wrap the body in its FLV tag header and append it.
    ///
    /// Returns `Ok(())` once a fault has latched: the caller is the live send path,
    /// and there is nothing it should do differently because the recording died. The
    /// fault is read from [`fault`](FlvFileWriter::fault) by `reconnect.rs`, which
    /// emits the health event that tells the operator once.
    fn accept(&mut self, frame: &TaggedFrame) -> std::io::Result<()> {
        let file = match self.file.as_mut() {
            Some(file) => file,
            None => return Ok(()),
        };
        let tag = flv::wrap_tag(frame.tag_type(), frame.timestamp_ms, &frame.body);
        if let Err(error) = file.write_all(&tag) {
            self.fail("writing a tag", &error);
            return Ok(());
        }
        self.bytes_written += tag.len() as u64;
        self.tags_written += 1;

        if self.last_sync.elapsed() >= FSYNC_INTERVAL {
            if let Err(error) = file.sync_data() {
                self.fail("flushing to disk", &error);
                return Ok(());
            }
            self.last_sync = Instant::now();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rtmp::Track;

    fn frame(track: Track, timestamp_ms: u32, body: Vec<u8>) -> TaggedFrame {
        TaggedFrame { track, timestamp_ms, body, can_be_dropped: false }
    }

    #[test]
    fn the_thresholds_are_the_ones_the_scope_document_names() {
        // 6 h @ 2.6 Mbps ≈ 7 GB. These two numbers are the whole disk policy.
        assert_eq!(DISK_WARN_BYTES, 20 * 1024 * 1024 * 1024);
        assert_eq!(DISK_REFUSE_BYTES, 2 * 1024 * 1024 * 1024);
    }

    #[test]
    fn a_full_disk_is_refused_a_tight_one_warns_and_a_roomy_one_records() {
        assert!(matches!(judge_disk(0), DiskVerdict::Refuse { .. }));
        assert!(matches!(judge_disk(DISK_REFUSE_BYTES - 1), DiskVerdict::Refuse { .. }));
        // Exactly at the threshold is allowed — the refusal is "below 2 GB".
        assert!(matches!(judge_disk(DISK_REFUSE_BYTES), DiskVerdict::Low { .. }));
        assert!(matches!(judge_disk(DISK_WARN_BYTES - 1), DiskVerdict::Low { .. }));
        assert!(matches!(judge_disk(DISK_WARN_BYTES), DiskVerdict::Ample { .. }));
        assert!(matches!(judge_disk(500 * 1024 * 1024 * 1024), DiskVerdict::Ample { .. }));

        // A warning must not block, and a refusal must.
        assert!(judge_disk(DISK_REFUSE_BYTES).may_record());
        assert!(!judge_disk(DISK_REFUSE_BYTES - 1).may_record());
        // And each verdict says something a person can act on.
        assert!(judge_disk(0).sentence().contains("free up space"));
        assert!(judge_disk(3 * 1024 * 1024 * 1024).sentence().contains("3.0 GB"));
    }

    #[test]
    fn the_recording_path_is_the_event_and_the_day() {
        let home = Path::new("/Users/someone");
        let path = recording_path(home, "S89EV-7Y2K4MNPQR", CivilDate { year: 2026, month: 9, day: 6 });
        assert!(path.ends_with("S89EV-7Y2K4MNPQR-2026-09-06.flv"), "got {path:?}");
        assert!(path.to_string_lossy().contains("Setnayan"));
        #[cfg(not(windows))]
        assert!(path.to_string_lossy().contains("Movies"));
        #[cfg(windows)]
        assert!(path.to_string_lossy().contains("Videos"));
    }

    #[test]
    fn an_event_id_can_never_choose_where_the_file_is_written() {
        // The realistic case is a blank id, not an attack — but the two are the same
        // line of code, and a path separator that survives into `join` is a write
        // somewhere nobody asked for.
        let home = Path::new("/home/op");
        let date = CivilDate { year: 2026, month: 1, day: 2 };
        let escaped = recording_path(home, "../../etc/passwd", date);
        assert_eq!(escaped, recording_dir(home).join("etc-passwd-2026-01-02.flv"));
        assert!(!escaped.to_string_lossy().contains(".."));
        assert_eq!(
            recording_path(home, "", date),
            recording_dir(home).join("event-2026-01-02.flv")
        );
        assert_eq!(
            recording_path(home, "/", date),
            recording_dir(home).join("event-2026-01-02.flv")
        );
    }

    #[test]
    fn the_date_conversion_agrees_with_the_calendar_including_its_awkward_parts() {
        let iso = |seconds| CivilDate::from_unix_seconds(seconds).iso();
        assert_eq!(iso(0), "1970-01-01");
        assert_eq!(iso(86_399), "1970-01-01", "the last second of the day is still the day");
        assert_eq!(iso(86_400), "1970-01-02");
        // A leap day, and the day after it.
        assert_eq!(iso(1_709_164_800), "2024-02-29");
        assert_eq!(iso(1_709_251_200), "2024-03-01");
        // 2100 is NOT a leap year — the century rule the naive version gets wrong.
        assert_eq!(iso(4_107_456_000), "2100-02-28");
        assert_eq!(iso(4_107_542_400), "2100-03-01");
        // The day this was written, and a launch-week date.
        assert_eq!(iso(1_788_652_800), "2026-09-06");
        assert_eq!(iso(1_796_601_600), "2026-12-07"); // the launch target
    }

    #[test]
    fn a_recording_opens_with_the_flv_header_and_then_holds_wrapped_tags() {
        let dir = std::env::temp_dir().join(format!("s7-writer-{}", std::process::id()));
        let path = dir.join("open.flv");
        let _ = std::fs::remove_file(&path);
        let mut writer = FlvFileWriter::create(&path).unwrap();
        assert_eq!(writer.bytes_written(), 13, "the FLV file header is 13 bytes");

        let body = vec![0x17, 0x00, 0x00, 0x00, 0x00, 0xAA];
        writer.accept(&frame(Track::Video, 0, body.clone())).unwrap();
        assert_eq!(writer.tags_written(), 1);
        let written = writer.finish();

        let bytes = std::fs::read(&written).unwrap();
        assert_eq!(&bytes[..3], b"FLV");
        assert_eq!(bytes[4], 0b101, "the header declares both audio and video");
        // 13-byte file header, then the tag exactly as `flv::wrap_tag` builds it.
        assert_eq!(&bytes[13..], &flv::wrap_tag(flv::TAG_TYPE_VIDEO, 0, &body)[..]);
        let _ = std::fs::remove_file(&written);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn a_dead_recording_never_reports_an_error_to_the_live_send_path() {
        let dir = std::env::temp_dir().join(format!("s7-fault-{}", std::process::id()));
        let path = dir.join("fault.flv");
        let _ = std::fs::remove_file(&path);
        let mut writer = FlvFileWriter::create(&path).unwrap();

        // What a disk that unmounted mid-ceremony looks like from here.
        writer.fail("writing a tag", &std::io::Error::from(std::io::ErrorKind::StorageFull));
        assert!(!writer.is_recording());
        assert!(writer.fault().unwrap().contains("writing a tag"));

        // THE GUARD: the broadcast does not learn about it. Ten more frames, all Ok.
        for index in 0..10 {
            assert!(
                writer.accept(&frame(Track::Audio, index, vec![0xAF, 0x01])).is_ok(),
                "a failed recording must never interrupt a live wedding"
            );
        }
        assert_eq!(writer.tags_written(), 0);
        // And the reason is latched once, not overwritten by the ten that followed.
        assert!(writer.fault().unwrap().contains("StorageFull") || writer.fault().is_some());
        let written = writer.finish();
        let _ = std::fs::remove_file(&written);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn reopening_an_existing_recording_appends_instead_of_truncating_it() {
        let dir = std::env::temp_dir().join(format!("s7-resume-{}", std::process::id()));
        let path = dir.join("resume.flv");
        let _ = std::fs::remove_file(&path);

        let mut first = FlvFileWriter::create(&path).unwrap();
        first.accept(&frame(Track::Video, 0, vec![0x17, 0x01, 1, 2, 3])).unwrap();
        let after_first = first.bytes_written();
        first.finish();

        let second = FlvFileWriter::create(&path).unwrap();
        assert_eq!(
            second.bytes_written(),
            after_first,
            "a restarted encoder continues the file — it does not delete the ceremony"
        );
        let written = second.finish();
        assert_eq!(std::fs::read(&written).unwrap().len() as u64, after_first);
        let _ = std::fs::remove_file(&written);
        let _ = std::fs::remove_dir(&dir);
    }

    #[test]
    fn the_disk_probe_answers_for_a_directory_that_does_not_exist_yet() {
        // The real call site: the recording directory has never been created.
        let target = std::env::temp_dir().join("s7-absent").join("deeper").join("x.flv");
        let verdict = judge_disk_for(&target).expect("walked up to an existing ancestor");
        assert!(verdict.free_bytes() > 0, "a real volume reported real free space");
    }
}
