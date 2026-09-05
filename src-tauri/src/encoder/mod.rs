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
//! · [`sender`] — TLS, handshake, publish, ordering. The only file that touches a socket.
//!
//! WHAT IS NOT HERE YET, ON PURPOSE:
//! · The Tauri commands and their ACL entries — **S5**, whose transport is an open
//!   owner decision as of 2026-09-05. Nothing in this module names `tauri`, so that
//!   decision can land without reopening any of it.
//! · Reconnect, the backup ingest, local recording — **S7**. `sender::SenderOutcome`
//!   is the seam it wraps.
//! · Ingest health and adaptive bitrate — **S9**, extending the existing
//!   `apps/web/lib/live-studio-ingest-health.ts`. `sender::SenderStats` is what it reads.

pub mod contract;
pub mod flv;
pub mod rtmp;
pub mod sender;
