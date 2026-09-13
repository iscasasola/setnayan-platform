//! S9 (build-sessions/encoder/S9.md) — "step the bitrate before frames pile
//! up". This module answers exactly one question every ~500ms: how many
//! bytes are backed up in the outbound path right now? The JS-side decider
//! that turns that into a rung change is
//! `apps/web/lib/live-studio-encoder-bitrate.ts`'s `stepBitrateRung` — this
//! file only samples; it makes no ladder decision, matching the pure-decider
//! / impure-sampler split `live-studio-ingest-health.ts` already uses.
//!
//! ⚠ NOT WIRED TO A LIVE SOCKET YET. `src-tauri/src/encoder_ipc.rs` (S5, in
//! flight as of this session) still runs a stub byte-counter in place of the
//! real `sender.rs`/`reconnect.rs` publish path — see this crate's `lib.rs`.
//! A follow-up session that finishes that wiring is what actually calls
//! `SocketOccupancyProbe::new` on the live socket's fd (or plugs a
//! `WriteLedger` into `sender.rs`'s write path on Windows) and forwards the
//! result to JS over a `Channel<u64>` every 500ms. Until then this is a
//! correct, independently tested unit with nothing yet calling it in
//! production — see the S9 hand-back for the exact blocking dependency.
//!
//! TWO PROBES, because "how much is backed up" means something different on
//! each OS this ships to (`CLAUDE.md`'s OS floor: Apple-silicon macOS 14 +
//! Windows 10/11 — S9.md's own wording):
//!
//!   · macOS — `SO_NWRITE` (`getsockopt`) answers directly: bytes still
//!     sitting in the kernel's TCP send buffer, unsent to the peer. Measured
//!     against a REAL socket in this module's own test (`SocketOccupancyProbe`'s
//!     test below) — not asserted from documentation.
//!   · Windows has no equivalent syscall exposed without an undocumented
//!     IOCTL. `WriteLedger` instead counts what THIS process itself already
//!     knows: bytes handed to the writer (`record_submitted`) minus bytes
//!     that write has actually completed (`record_completed`). The gap
//!     between the two is exactly the backlog this process chose not to
//!     wait for — a portable, allocation-free counter pair that needs no OS
//!     call at all, which is also why it is tested on every platform rather
//!     than only on Windows (S9.md: "bytes-written minus completed-write
//!     bytes").
//!
//! `SO_NWRITE`'s numeric value (`0x1024`) is defined here rather than taken
//! from the `libc` crate, which does not name it — Apple's own
//! `<sys/socket.h>`, a value stable across macOS versions well predating 14
//! (this project's floor).

use std::io;
use std::sync::atomic::{AtomicU64, Ordering};

/// Anything that can answer "how many bytes are backed up right now" —
/// mockable in tests without a real socket.
pub trait SendBufferProbe: Send + Sync {
    fn unsent_bytes(&self) -> io::Result<u64>;
}

/// Portable send ledger: `submitted` bytes minus `completed` bytes is the
/// backlog. The counters are independent atomics rather than one guarded
/// value — `record_submitted`/`record_completed` run on the hot write path
/// and must never block on a lock the 500ms sampler might be holding.
#[derive(Debug, Default)]
pub struct WriteLedger {
    submitted: AtomicU64,
    completed: AtomicU64,
}

impl WriteLedger {
    pub fn new() -> Self {
        Self::default()
    }

    /// Call BEFORE handing `len` bytes to the writer.
    pub fn record_submitted(&self, len: u64) {
        self.submitted.fetch_add(len, Ordering::Relaxed);
    }

    /// Call once that same write has actually completed (the OS accepted it).
    pub fn record_completed(&self, len: u64) {
        self.completed.fetch_add(len, Ordering::Relaxed);
    }
}

impl SendBufferProbe for WriteLedger {
    /// `saturating_sub`, never a plain `-`: a plain unsigned subtraction
    /// would panic in debug (and wrap to a huge number in release) the
    /// instant a stale `completed` read raced ahead of `submitted` — see
    /// this module's `ledger_never_goes_negative` test, which fails the
    /// moment this is changed back to `submitted - completed`.
    fn unsent_bytes(&self) -> io::Result<u64> {
        let submitted = self.submitted.load(Ordering::Relaxed);
        let completed = self.completed.load(Ordering::Relaxed);
        Ok(submitted.saturating_sub(completed))
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use super::SendBufferProbe;
    use std::io;
    use std::os::fd::RawFd;

    /// Not exposed by the `libc` crate under this name — see this module's
    /// header for where the value comes from.
    const SO_NWRITE: libc::c_int = 0x1024;

    /// Reads a live socket's unsent-byte count via `getsockopt(SO_NWRITE)`.
    /// Holds a raw fd rather than a `TcpStream`: the sampler runs on its own
    /// 500ms tick, independent of whatever owns the stream for reading and
    /// writing (`sender.rs`'s `Io` trait object is not `Clone`), and does
    /// NOT take ownership — closing the socket stays the caller's job.
    pub struct SocketOccupancyProbe {
        fd: RawFd,
    }

    impl SocketOccupancyProbe {
        /// `fd` must name an open, valid socket for as long as this probe is
        /// used; the caller (whoever owns the real socket) is responsible
        /// for that lifetime.
        pub fn new(fd: RawFd) -> Self {
            Self { fd }
        }
    }

    impl SendBufferProbe for SocketOccupancyProbe {
        fn unsent_bytes(&self) -> io::Result<u64> {
            let mut value: libc::c_int = 0;
            let mut len = std::mem::size_of::<libc::c_int>() as libc::socklen_t;
            // SAFETY: `fd` is a valid socket for the probe's lifetime (see
            // `new`'s contract); `value`/`len` are sized exactly for an
            // `SO_NWRITE` int result, and `getsockopt` writes at most `len`
            // bytes into `value`.
            let rc = unsafe {
                libc::getsockopt(
                    self.fd,
                    libc::SOL_SOCKET,
                    SO_NWRITE,
                    &mut value as *mut _ as *mut libc::c_void,
                    &mut len,
                )
            };
            if rc != 0 {
                return Err(io::Error::last_os_error());
            }
            // SO_NWRITE cannot be meaningfully negative; guard the cast anyway
            // rather than trust the kernel never to hand back a garbage value.
            Ok(value.max(0) as u64)
        }
    }
}

#[cfg(target_os = "macos")]
pub use macos::SocketOccupancyProbe;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ledger_starts_at_zero_backlog() {
        let ledger = WriteLedger::new();
        assert_eq!(ledger.unsent_bytes().unwrap(), 0);
    }

    #[test]
    fn ledger_backlog_is_submitted_minus_completed() {
        let ledger = WriteLedger::new();
        ledger.record_submitted(1000);
        assert_eq!(ledger.unsent_bytes().unwrap(), 1000);
        ledger.record_completed(400);
        assert_eq!(ledger.unsent_bytes().unwrap(), 600);
        ledger.record_completed(600);
        assert_eq!(ledger.unsent_bytes().unwrap(), 0);
    }

    /// ⚠ GUARD — delete the `saturating_sub` in `unsent_bytes` (replace with
    /// a plain `submitted - completed`) and this test panics instead of
    /// passing: 100 - 150 underflows a `u64`.
    #[test]
    fn ledger_never_goes_negative_even_if_completed_races_ahead() {
        let ledger = WriteLedger::new();
        ledger.record_submitted(100);
        ledger.record_completed(150); // more "completed" than was ever submitted
        assert_eq!(ledger.unsent_bytes().unwrap(), 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_probe_reports_zero_before_any_write() {
        use super::macos::SocketOccupancyProbe;
        use std::net::{TcpListener, TcpStream};
        use std::os::fd::AsRawFd;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let client = TcpStream::connect(addr).unwrap();
        let (_server_side, _) = listener.accept().unwrap();

        let probe = SocketOccupancyProbe::new(client.as_raw_fd());
        assert_eq!(probe.unsent_bytes().unwrap(), 0);
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn macos_probe_reports_nonzero_against_a_peer_that_never_reads() {
        use super::macos::SocketOccupancyProbe;
        use std::io::Write;
        use std::net::{TcpListener, TcpStream};
        use std::os::fd::AsRawFd;

        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let mut client = TcpStream::connect(addr).unwrap();
        let (_server_side, _) = listener.accept().unwrap(); // accepted, never read again
        client.set_nonblocking(true).unwrap();

        let probe = SocketOccupancyProbe::new(client.as_raw_fd());

        // Write far more than any default kernel send buffer so writes start
        // returning WouldBlock — that's the backlog this probe exists to see.
        let chunk = vec![0u8; 64 * 1024];
        for _ in 0..128 {
            match client.write(&chunk) {
                Ok(_) => {}
                Err(e) if e.kind() == io::ErrorKind::WouldBlock => break,
                Err(e) => panic!("unexpected write error: {e}"),
            }
        }

        let unsent = probe.unsent_bytes().unwrap();
        assert!(unsent > 0, "expected a nonzero backlog against an unread peer, got {unsent}");
    }
}
