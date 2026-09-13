//! THE NATIVE ENCODER — the one part of Live Studio a browser cannot do.
//!
//! Everything else in the pipeline is web: the phones, the controller, the program
//! canvas, the overlays, the mixer, WebCodecs H.264/AAC. Then it stops. A browser
//! cannot open a socket to `rtmps://a.rtmps.youtube.com:443` and speak RTMP on it, and
//! that single missing capability is the entire reason the desktop app exists. This
//! module is that capability and nothing else:
//!
//! ```text
//!   webview ── encoded chunks ──► contract.rs ──► flv.rs ──► sender.rs ──► YouTube
//!   (S1–S5)     (S5's transport)   the shape     the bytes    the socket
//! ```
//!
//! · [`contract`] — the 16-byte header, and the deliberate ignorance of which envelope
//!   carried it (S0 measured that the envelope is not settled; see its module docs).
//! · [`flv`] — FLV tag bodies. Pure, no I/O, byte-checked against ffmpeg's own muxer.
//! · [`rtmp`] — destination, clock, redaction. Pure.
//! · [`sender`] — TLS, handshake, publish, ordering. The only file that speaks to a socket.
//! · [`tagger`] — S7. The clock and the FLV bodies, ABOVE the socket so both survive a
//!   reconnect and so one set of bytes reaches both the wire and the recording.
//! · [`file_sink`] — S7. The `.flv` on the laptop; for a hosted-channel couple, the
//!   only copy that will ever exist.
//! · [`reconnect`] — S7. Backoff, the backup ingest, the grace window. The only file
//!   that decides anything.
//! · [`occupancy`] — S9. Samples how many bytes are backed up in the outbound path;
//!   the JS-side `stepBitrateRung` (`apps/web/lib/live-studio-encoder-bitrate.ts`)
//!   decides what to do about it. Nothing wires this to a live socket yet — see its
//!   own module docs for exactly what a follow-up session still has to connect.
//!
//! WHAT IS NOT HERE YET, ON PURPOSE:
//! · The Tauri commands and their ACL entries — **S5** (open PR as of this writing):
//!   `src-tauri/src/encoder_ipc.rs` exists but still runs a STUB byte-counter sink in
//!   place of this crate's real sender/reconnect path (see its own comment).
//!   Nothing in this crate names `tauri`, so that wiring can land without reopening
//!   any of it — enforced by the compiler (separate crate, no tauri dependency), which
//!   is also what lets its tests run on every pull request in seconds instead of after
//!   a webkit build. `Cargo.toml` here explains the rest.
//! · The `Channel<HealthEvent>` / `Channel<SendBufferOccupancy>` bridge from this
//!   crate's `reconnect::HealthEvent` and `occupancy::SendBufferProbe` to the
//!   `IngestHealthStrip` — **S9's own live-wiring half**, blocked on the stub sink
//!   above having a real publish session to report on. `live-studio-ingest-health.ts`
//!   and `live-studio-encoder-bitrate.ts` already accept the real shape.

pub mod contract;
pub mod file_sink;
pub mod flv;
pub mod occupancy;
pub mod reconnect;
pub mod rtmp;
pub mod sender;
pub mod tagger;
