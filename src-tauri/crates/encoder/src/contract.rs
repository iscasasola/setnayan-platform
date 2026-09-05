//! THE WIRE CONTRACT — what the webview hands Rust, and nothing about how it got here.
//!
//! S5 owns the transport; this file owns the *shape*, and the two are deliberately
//! separate because on 2026-09-05 the transport stopped being knowable. S0 measured,
//! inside the real Tauri webview on `https://www.setnayan.com`, that **1797 of 1797**
//! 10 KB chunks reached Rust as `InvokeBody::Json` arrays and **zero** as `Raw`:
//! WebKit refuses the `ipc://localhost` custom protocol from an https document, so
//! Tauri's `ipc-protocol.js` latches into its postMessage/JSON fallback and never
//! leaves it. The loopback fallback is blocked for the same mixed-content reason
//! (0 of 1801 requests arrived, against 1776/1776 from `tauri://localhost`).
//! `build-sessions/encoder/S0-FINDING.md` § 3.1, § 3.3, § 7.
//!
//! So the envelope — raw body, JSON array of byte values, a localhost socket, or a
//! custom-scheme origin that restores `Raw` — **is an open owner decision**, and this
//! module is written so that decision cannot reach the encoder. Everything downstream
//! of `EncodedChunk` is identical in all four worlds. What each envelope owes us is
//! one function that produces bytes; `Envelope` records which one paid, so a health
//! event can say "degraded transport" without the FLV tagger ever learning the word.
//!
//! ⚠ S5 IS EXPECTED TO ADOPT THIS FILE, NOT WRITE A SECOND ONE. Its prompt says the
//! contract lands in its first commit at exactly this path; S6 ran first and put it
//! here. If you are S5: mirror it in `apps/web/lib/encoder/ipc-contract.ts` and make
//! the byte-equality fixture test point at `ENCODED_FIXTURE` below. Do not fork it.
//!
//! LAYOUT — 16-byte little-endian header, then payload:
//!
//! ```text
//!   0  u8   kind      0 video · 1 audio · 2 config
//!   1  u8   flags     bit0 keyframe (video only; 0 elsewhere)
//!   2  u16  reserved  MUST be 0 — a non-zero value is a version skew, not padding
//!   4  u32  seq       monotonic per stream, from 0, one sequence for all kinds
//!   8  u64  ts_us     microseconds on the S3 master clock (AudioContext.currentTime)
//!  16  ..   payload
//! ```
//!
//! `ts_us` is microseconds and 64-bit ON PURPOSE. RTMP's own timestamps are 32-bit
//! milliseconds and its chunk headers carry only 24 bits before an extended field is
//! required — the boundary at 16,777,215 ms is 4 h 39 m 37 s, which is INSIDE a
//! wedding, not past it. Keeping the wire clock wide and converting once, late, in
//! `rtmp::RtmpClock` is what stops that boundary from being a truncation bug.

use std::fmt;

/// Header length in bytes. The payload starts here.
pub const HEADER_LEN: usize = 16;

/// `flags` bit 0 — this video chunk is a keyframe (an IDR access unit).
pub const FLAG_KEYFRAME: u8 = 0b0000_0001;

/// What a chunk carries. Wire values are frozen: they are on the wire.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChunkKind {
    /// One encoded H.264 access unit, in avcC (length-prefixed) form.
    Video,
    /// AAC-LC raw frames, bundled by the worker into roughly 100 ms.
    Audio,
    /// The decoder configuration — `avcC` + `asc`. Sent before any media.
    Config,
}

impl ChunkKind {
    pub fn from_wire(value: u8) -> Option<ChunkKind> {
        match value {
            0 => Some(ChunkKind::Video),
            1 => Some(ChunkKind::Audio),
            2 => Some(ChunkKind::Config),
            _ => None,
        }
    }

    pub fn to_wire(self) -> u8 {
        match self {
            ChunkKind::Video => 0,
            ChunkKind::Audio => 1,
            ChunkKind::Config => 2,
        }
    }
}

/// Which envelope delivered these bytes. **Provenance only** — nothing in the encoder
/// branches on it. It exists so the health surface can tell the owner "this machine is
/// on the degraded JSON transport" (S0 § 3.1: ≈ 3.6 × expansion, p99 293 ms at 10 KB)
/// without the FLV tagger, the clock or the sender knowing a transport exists at all.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Envelope {
    /// `InvokeBody::Raw` — one contiguous body, no copy. What S5 originally assumed.
    Raw,
    /// `InvokeBody::Json` array of byte values — what macOS measurably does today.
    JsonArray,
    /// A localhost HTTP/WebSocket body (S0 § 7 option B), if that is ever chosen.
    Loopback,
}

impl Envelope {
    /// Whether this envelope hands us bytes without a per-chunk parse and re-copy.
    /// The health surface (S9) may warn on `false`; the encoder may not refuse on it.
    /// A guard that refused would refuse **every macOS user** — that is the precise
    /// mistake S0 caught in S5's original "anything but `Raw` REFUSES go-live".
    pub fn is_zero_copy(self) -> bool {
        matches!(self, Envelope::Raw)
    }
}

/// A parsed header. Cheap, `Copy`, and carries no payload.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ChunkHeader {
    pub kind: ChunkKind,
    pub keyframe: bool,
    pub seq: u32,
    pub ts_us: u64,
}

/// A header plus its payload, owned.
///
/// Owned rather than borrowed because the JSON envelope has to materialise the bytes
/// anyway, and pretending otherwise would put a lifetime through the whole encoder to
/// buy nothing on the transport we actually measured.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EncodedChunk {
    pub header: ChunkHeader,
    pub payload: Vec<u8>,
}

/// The decoder configuration a stream cannot start without.
///
/// `avcC` is the AVCDecoderConfigurationRecord WebCodecs hands back in
/// `EncodedVideoChunkMetadata.decoderConfig.description` when configured with
/// `avc: { format: 'avc' }`; `asc` is the AudioSpecificConfig from `AudioEncoder`.
/// Both are opaque here — `flv.rs` wraps them, nothing parses them.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DecoderConfig {
    pub avc_c: Vec<u8>,
    pub asc: Vec<u8>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ContractError {
    /// Fewer than `HEADER_LEN` bytes arrived — a truncated envelope, not a short frame.
    ShortHeader { len: usize },
    UnknownKind { value: u8 },
    /// `reserved` was not zero. Treated as a version skew and refused rather than
    /// ignored: the field exists so a future producer can be told apart from a
    /// corrupt one, which only works if today's consumer actually checks it.
    ReservedNotZero { value: u16 },
    /// A byte value outside 0..=255 in a JSON-array envelope, or a non-number.
    NotAByte { index: usize },
    /// The config payload's JSON prefix did not parse, or its lengths did not add up.
    BadConfigPayload { reason: &'static str },
    /// A non-video chunk carried the keyframe flag.
    KeyframeOnNonVideo,
}

impl fmt::Display for ContractError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ContractError::ShortHeader { len } => {
                write!(f, "encoder chunk truncated: {len} bytes, need at least {HEADER_LEN}")
            }
            ContractError::UnknownKind { value } => write!(f, "unknown chunk kind {value}"),
            ContractError::ReservedNotZero { value } => {
                write!(f, "reserved header field was {value}, expected 0 (producer/consumer version skew)")
            }
            ContractError::NotAByte { index } => {
                write!(f, "JSON envelope element {index} is not a byte value")
            }
            ContractError::BadConfigPayload { reason } => {
                write!(f, "config payload malformed: {reason}")
            }
            ContractError::KeyframeOnNonVideo => {
                write!(f, "keyframe flag set on a chunk that is not video")
            }
        }
    }
}

impl std::error::Error for ContractError {}

impl ChunkHeader {
    /// Parse the fixed 16 bytes. Rejects everything it can name.
    pub fn parse(bytes: &[u8]) -> Result<ChunkHeader, ContractError> {
        if bytes.len() < HEADER_LEN {
            return Err(ContractError::ShortHeader { len: bytes.len() });
        }
        let kind = ChunkKind::from_wire(bytes[0])
            .ok_or(ContractError::UnknownKind { value: bytes[0] })?;
        let flags = bytes[1];
        let reserved = u16::from_le_bytes([bytes[2], bytes[3]]);
        if reserved != 0 {
            return Err(ContractError::ReservedNotZero { value: reserved });
        }
        let keyframe = flags & FLAG_KEYFRAME != 0;
        if keyframe && kind != ChunkKind::Video {
            return Err(ContractError::KeyframeOnNonVideo);
        }
        let seq = u32::from_le_bytes([bytes[4], bytes[5], bytes[6], bytes[7]]);
        let mut ts = [0u8; 8];
        ts.copy_from_slice(&bytes[8..16]);
        Ok(ChunkHeader { kind, keyframe, seq, ts_us: u64::from_le_bytes(ts) })
    }

    /// Serialise the header. Used by the fixture test and by any producer written in
    /// Rust; the real producer is the webview, which writes the same 16 bytes in JS.
    pub fn encode(&self) -> [u8; HEADER_LEN] {
        let mut out = [0u8; HEADER_LEN];
        out[0] = self.kind.to_wire();
        out[1] = if self.keyframe { FLAG_KEYFRAME } else { 0 };
        // bytes 2..4 stay zero — `reserved`.
        out[4..8].copy_from_slice(&self.seq.to_le_bytes());
        out[8..16].copy_from_slice(&self.ts_us.to_le_bytes());
        out
    }
}

impl EncodedChunk {
    /// THE ONE DECODER. Every envelope funnels here.
    pub fn parse(bytes: &[u8]) -> Result<EncodedChunk, ContractError> {
        let header = ChunkHeader::parse(bytes)?;
        Ok(EncodedChunk { header, payload: bytes[HEADER_LEN..].to_vec() })
    }

    /// The JSON-array envelope — today's measured reality on macOS.
    ///
    /// Tauri hands a `serde_json::Value::Array` of numbers when the custom protocol
    /// is unavailable. This normalises it to bytes and then calls the same parser, so
    /// there is exactly one place that understands the header no matter how it came in.
    pub fn from_json_array(values: &[serde_json::Value]) -> Result<EncodedChunk, ContractError> {
        let mut bytes = Vec::with_capacity(values.len());
        for (index, value) in values.iter().enumerate() {
            let byte = value
                .as_u64()
                .and_then(|n| u8::try_from(n).ok())
                .ok_or(ContractError::NotAByte { index })?;
            bytes.push(byte);
        }
        EncodedChunk::parse(&bytes)
    }

    pub fn encode(&self) -> Vec<u8> {
        let mut out = Vec::with_capacity(HEADER_LEN + self.payload.len());
        out.extend_from_slice(&self.header.encode());
        out.extend_from_slice(&self.payload);
        out
    }

    /// Read a `Config` chunk's payload.
    ///
    /// LAYOUT — `u32 LE json_len | json | avcC | asc`. The JSON prefix carries only
    /// the two lengths, so the configuration bytes themselves stay binary instead of
    /// being expanded into a number array a second time. (S5's prompt calls this
    /// "`{ avcC: bytes, asc: bytes }` as JSON-prefixed"; this is that, pinned to a
    /// byte layout so the fixture test can assert equality rather than intent.)
    pub fn decoder_config(&self) -> Result<DecoderConfig, ContractError> {
        if self.header.kind != ChunkKind::Config {
            return Err(ContractError::BadConfigPayload { reason: "chunk is not a config chunk" });
        }
        let payload = &self.payload;
        if payload.len() < 4 {
            return Err(ContractError::BadConfigPayload { reason: "no length prefix" });
        }
        let json_len =
            u32::from_le_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
        let json_end = 4usize
            .checked_add(json_len)
            .ok_or(ContractError::BadConfigPayload { reason: "length prefix overflows" })?;
        if json_end > payload.len() {
            return Err(ContractError::BadConfigPayload { reason: "json prefix past end" });
        }
        let json: serde_json::Value = serde_json::from_slice(&payload[4..json_end])
            .map_err(|_| ContractError::BadConfigPayload { reason: "json prefix did not parse" })?;
        let avc_len = json
            .get("avcC_len")
            .and_then(|v| v.as_u64())
            .ok_or(ContractError::BadConfigPayload { reason: "avcC_len missing" })?
            as usize;
        let asc_len = json
            .get("asc_len")
            .and_then(|v| v.as_u64())
            .ok_or(ContractError::BadConfigPayload { reason: "asc_len missing" })?
            as usize;
        let avc_end = json_end
            .checked_add(avc_len)
            .ok_or(ContractError::BadConfigPayload { reason: "avcC length overflows" })?;
        let asc_end = avc_end
            .checked_add(asc_len)
            .ok_or(ContractError::BadConfigPayload { reason: "asc length overflows" })?;
        if asc_end != payload.len() {
            return Err(ContractError::BadConfigPayload {
                reason: "declared lengths do not account for the whole payload",
            });
        }
        Ok(DecoderConfig {
            avc_c: payload[json_end..avc_end].to_vec(),
            asc: payload[avc_end..asc_end].to_vec(),
        })
    }
}

impl DecoderConfig {
    /// Build the `Config` payload. The producer is JS; this is the definition the
    /// JS mirror is tested against, and what the fixture in `tests/` is generated from.
    pub fn encode_payload(&self) -> Vec<u8> {
        let json = format!(
            "{{\"avcC_len\":{},\"asc_len\":{}}}",
            self.avc_c.len(),
            self.asc.len()
        );
        let mut out = Vec::with_capacity(4 + json.len() + self.avc_c.len() + self.asc.len());
        out.extend_from_slice(&(json.len() as u32).to_le_bytes());
        out.extend_from_slice(json.as_bytes());
        out.extend_from_slice(&self.avc_c);
        out.extend_from_slice(&self.asc);
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn header_round_trips_through_bytes() {
        let header = ChunkHeader {
            kind: ChunkKind::Video,
            keyframe: true,
            seq: 0xDEAD_BEEF,
            ts_us: 16_777_216_000,
        };
        assert_eq!(ChunkHeader::parse(&header.encode()).unwrap(), header);
    }

    #[test]
    fn header_is_little_endian_at_the_documented_offsets() {
        let bytes = ChunkHeader {
            kind: ChunkKind::Audio,
            keyframe: false,
            seq: 0x0102_0304,
            ts_us: 0x0807_0605_0403_0201,
        }
        .encode();
        assert_eq!(bytes[0], 1, "kind byte");
        assert_eq!(&bytes[2..4], &[0, 0], "reserved");
        assert_eq!(&bytes[4..8], &[0x04, 0x03, 0x02, 0x01], "seq LE");
        assert_eq!(bytes[8], 0x01, "ts_us LE low byte");
        assert_eq!(bytes[15], 0x08, "ts_us LE high byte");
    }

    #[test]
    fn the_json_envelope_and_the_raw_envelope_decode_identically() {
        // This is the whole point of the file: S0 measured that macOS gets the JSON
        // array and only the JSON array. Both paths must produce the same chunk.
        let chunk = EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Video, keyframe: true, seq: 7, ts_us: 33_366 },
            payload: vec![0, 0, 0, 5, 0x65, 1, 2, 3, 4],
        };
        let raw = chunk.encode();
        let json: Vec<serde_json::Value> =
            raw.iter().map(|b| serde_json::Value::from(*b as u64)).collect();
        assert_eq!(EncodedChunk::parse(&raw).unwrap(), chunk);
        assert_eq!(EncodedChunk::from_json_array(&json).unwrap(), chunk);
    }

    #[test]
    fn a_short_or_skewed_header_is_named_not_guessed() {
        assert_eq!(
            ChunkHeader::parse(&[0u8; 15]).unwrap_err(),
            ContractError::ShortHeader { len: 15 }
        );
        let mut bytes = [0u8; HEADER_LEN];
        bytes[0] = 9;
        assert_eq!(ChunkHeader::parse(&bytes).unwrap_err(), ContractError::UnknownKind { value: 9 });
        let mut bytes = [0u8; HEADER_LEN];
        bytes[2] = 1;
        assert_eq!(
            ChunkHeader::parse(&bytes).unwrap_err(),
            ContractError::ReservedNotZero { value: 1 }
        );
        let mut bytes = [0u8; HEADER_LEN];
        bytes[0] = ChunkKind::Audio.to_wire();
        bytes[1] = FLAG_KEYFRAME;
        assert_eq!(ChunkHeader::parse(&bytes).unwrap_err(), ContractError::KeyframeOnNonVideo);
    }

    #[test]
    fn a_json_element_that_is_not_a_byte_is_refused_by_index() {
        let mut json: Vec<serde_json::Value> =
            (0..HEADER_LEN).map(|_| serde_json::Value::from(0u64)).collect();
        json[5] = serde_json::Value::from(300u64);
        assert_eq!(
            EncodedChunk::from_json_array(&json).unwrap_err(),
            ContractError::NotAByte { index: 5 }
        );
    }

    #[test]
    fn decoder_config_round_trips_and_refuses_a_payload_that_does_not_add_up() {
        let config = DecoderConfig {
            avc_c: vec![1, 0x64, 0, 0x1F, 0xFF, 0xE1],
            asc: vec![0x11, 0x90],
        };
        let chunk = EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Config, keyframe: false, seq: 0, ts_us: 0 },
            payload: config.encode_payload(),
        };
        assert_eq!(chunk.decoder_config().unwrap(), config);

        let mut truncated = chunk.clone();
        truncated.payload.pop();
        assert!(matches!(
            truncated.decoder_config().unwrap_err(),
            ContractError::BadConfigPayload { .. }
        ));
    }

    #[test]
    fn only_the_raw_envelope_claims_zero_copy() {
        assert!(Envelope::Raw.is_zero_copy());
        assert!(!Envelope::JsonArray.is_zero_copy());
        assert!(!Envelope::Loopback.is_zero_copy());
    }
}
