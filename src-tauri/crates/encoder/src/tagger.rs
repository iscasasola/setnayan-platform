//! ONE TAGGER, TWO SINKS — the bytes are made once and go to both destinations.
//!
//! Until S7 the tagging lived inside `sender.rs`: a chunk arrived, `publish_chunk`
//! turned it into an FLV body and handed it straight to the socket. That works
//! perfectly for one destination and is wrong for two, in two separate ways that both
//! matter to a wedding:
//!
//! 1. **THE RECORDING WOULD ONLY EXIST WHILE THE SOCKET DID.** The `.flv` on the
//!    laptop is the ONLY copy a hosted-channel couple can ever get (spec § 4k — they
//!    do not own the pool channel), so it must keep growing exactly while the network
//!    is down, which is the one moment a sender-owned writer is not running. Tagging
//!    above the socket is what makes "still recording" and "not connected" true at the
//!    same time.
//! 2. **THE CLOCK WOULD RESTART AT ZERO ON EVERY RECONNECT.** `RtmpClock` was a field
//!    of `RtmpSender`, and a reconnect is a NEW `RtmpSender` — RTMP has no resume, so
//!    reconnecting is a fresh connect/createStream/publish. A new sender meant a new
//!    clock, `base_us: None`, and the next frame stamped 0 after four hours of stream.
//!    YouTube reads that as a stream that jumped backwards by four hours. The clock
//!    lives here now, ABOVE the thing that dies, and outlives any number of sessions.
//!
//! ⚠ **THE WIRE AND THE FILE DO NOT WANT THE SAME FRAMES, AND THAT IS THE SUBTLE
//! PART.** After a reconnect the new ingest has never seen this stream, so H.264
//! inter-frames must be withheld until the next keyframe — they reference pictures it
//! does not have. The FILE is in the opposite position: it holds every frame since the
//! ceremony started, so those same inter-frames decode perfectly there, and dropping
//! them would punch a hole in the couple's only copy to solve a problem the file does
//! not have. So [`Tagger`] produces every frame, the file takes all of them, and
//! [`WireGate`] — a per-session thing, armed only on a resume — decides what the
//! socket is allowed. [`Pipeline`] is the one place that runs both, so there is no
//! second path where they can drift apart.
//!
//! WHAT IS STILL NOT HERE: no I/O of any kind. `file_sink.rs` writes, `sender.rs`
//! sends, `reconnect.rs` decides. These types are pure and their tests need no network
//! and no filesystem.

use super::contract::{ChunkKind, ContractError, DecoderConfig, EncodedChunk};
use super::flv::{self, FlvError};
use super::rtmp::{RtmpClock, Track};

/// One finished FLV tag body, stamped, ready for both destinations.
///
/// `body` is the tag BODY — what RTMP calls the message payload and what FLV wraps in
/// an 11-byte tag header. The socket hands the body to `publish_video_data`; the file
/// hands the identical body to `flv::wrap_tag`. Neither rebuilds it, which is why
/// "did the recording drift from the broadcast?" is not a question anyone has to keep
/// answering — `tests/recording.rs` asserts the identity byte-for-byte.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaggedFrame {
    pub track: Track,
    pub timestamp_ms: u32,
    pub body: Vec<u8>,
    /// Whether RTMP may drop this tag under pressure. Video inter-frames may; a
    /// keyframe may not, and audio NEVER may — see `sender::publish_audio`.
    pub can_be_dropped: bool,
}

impl TaggedFrame {
    /// The FLV/RTMP message type ID for this frame's track.
    pub fn tag_type(&self) -> u8 {
        match self.track {
            Track::Video => flv::TAG_TYPE_VIDEO,
            Track::Audio => flv::TAG_TYPE_AUDIO,
        }
    }

    /// Whether this is a decoder-configuration tag rather than media.
    ///
    /// Byte 1 is `AVCPacketType` for video and `AACPacketType` for audio, and 0 means
    /// "sequence header" in both. One predicate for both tracks is not a coincidence
    /// being exploited — it is the same field at the same offset in the same spec.
    pub fn is_sequence_header(&self) -> bool {
        self.body.get(1) == Some(&0)
    }

    /// Whether this is a video tag carrying an IDR access unit — the frame a decoder
    /// that has seen nothing can start from. The high nibble of byte 0 is FLV's
    /// `FrameType`, and 1 is "keyframe".
    pub fn is_video_keyframe(&self) -> bool {
        self.track == Track::Video
            && !self.is_sequence_header()
            && self.body.first().map(|byte| byte >> 4) == Some(1)
    }
}

/// Where a tagged frame goes after it exists. Implemented by the file writer, by the
/// no-op used when recording is off, and by test collectors.
///
/// Object-safe on purpose: [`Pipeline`] holds a `Box<dyn TagSink>`, so turning
/// recording on and off is not a type parameter that spreads through the encoder.
pub trait TagSink: Send {
    fn accept(&mut self, frame: &TaggedFrame) -> std::io::Result<()>;

    /// Why this sink stopped accepting, if it has. `None` means it is still healthy.
    ///
    /// A method rather than a downcast because the supervisor's only question about a
    /// recording is "is it still going, and if not why" — and it must be able to ask
    /// that of a sink it cannot name the type of.
    fn fault(&self) -> Option<String> {
        None
    }
}

/// Recording off. The couple streamed and kept nothing — their choice, and the only
/// version of "no recording" that does not need a second code path in the sender.
pub struct NoRecording;

impl TagSink for NoRecording {
    fn accept(&mut self, _frame: &TaggedFrame) -> std::io::Result<()> {
        Ok(())
    }
}

#[derive(Debug)]
pub enum TagError {
    Chunk(ContractError),
    Flv(FlvError),
}

impl std::fmt::Display for TagError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            TagError::Chunk(error) => write!(f, "malformed encoder chunk: {error}"),
            TagError::Flv(error) => write!(f, "could not build an FLV tag: {error}"),
        }
    }
}

impl std::error::Error for TagError {}

impl From<ContractError> for TagError {
    fn from(error: ContractError) -> TagError {
        TagError::Chunk(error)
    }
}

impl From<FlvError> for TagError {
    fn from(error: FlvError) -> TagError {
        TagError::Flv(error)
    }
}

/// Encoder chunks in, FLV tags out, across any number of RTMP sessions.
///
/// It is deliberately NOT reset between sessions: that is the whole point. One tagger
/// spans the wedding; senders come and go underneath it.
#[derive(Debug)]
pub struct Tagger {
    clock: RtmpClock,
    /// The last configuration seen, kept so a reconnect can re-send the sequence
    /// headers WITHOUT asking the webview to re-encode or re-announce anything. A
    /// reconnect that had to wait for the producer's next `Config` chunk would send
    /// media the new ingest cannot decode until then — or, if the producer only ever
    /// sends one, forever.
    config: Option<DecoderConfig>,
    configured: bool,
    resend_headers: bool,
    media_before_config: u64,
}

impl Tagger {
    pub fn new() -> Tagger {
        Tagger {
            clock: RtmpClock::new(),
            config: None,
            configured: false,
            resend_headers: false,
            media_before_config: 0,
        }
    }

    /// A NEW RTMP session is about to start over the top of this stream: re-send both
    /// sequence headers, because the new connection is a new publish to an ingest that
    /// has never seen this stream's `avcC`/`asc` and has nothing to decode the next
    /// NALU with.
    ///
    /// What must NOT happen here is a clock reset — and the way this method is written
    /// is the guard: it touches no clock field, so there is no line for a future
    /// session to "fix" into `self.clock = RtmpClock::new()`.
    pub fn resume_session(&mut self) {
        self.resend_headers = self.config.is_some();
    }

    /// One chunk in, zero or more finished tags out, in the order they must go.
    ///
    /// Zero is a normal answer, not a failure: media that arrives before any decoder
    /// configuration is dropped **and counted**, because it is undecodable by
    /// definition and buffering it would trade a counted defect for an uncounted leak.
    pub fn tag(&mut self, chunk: &EncodedChunk) -> Result<Vec<TaggedFrame>, TagError> {
        let mut out = Vec::new();
        match chunk.header.kind {
            ChunkKind::Config => {
                // A second config mid-stream is a re-configuration; re-sending the
                // headers is correct and cheap, and refusing it would strand a stream
                // that legitimately changed resolution.
                self.config = Some(chunk.decoder_config()?);
                self.emit_sequence_headers(chunk.header.ts_us, &mut out)?;
                self.configured = true;
                self.resend_headers = false;
            }
            ChunkKind::Video => {
                self.flush_pending_headers(chunk.header.ts_us, &mut out)?;
                if !self.configured {
                    self.media_before_config += 1;
                    return Ok(out);
                }
                let timestamp_ms = self.clock.stamp(Track::Video, chunk.header.ts_us);
                // Composition time is 0: S4 encodes realtime with no B-frames, so
                // presentation and decode order are the same. `avc_nalu_tag` refuses an
                // out-of-range value rather than truncating one, which is what would
                // tell us that assumption had changed.
                let body = flv::avc_nalu_tag(chunk.header.keyframe, 0, &chunk.payload)?;
                out.push(TaggedFrame {
                    track: Track::Video,
                    timestamp_ms,
                    body,
                    can_be_dropped: !chunk.header.keyframe,
                });
            }
            ChunkKind::Audio => {
                self.flush_pending_headers(chunk.header.ts_us, &mut out)?;
                if !self.configured {
                    self.media_before_config += 1;
                    return Ok(out);
                }
                let timestamp_ms = self.clock.stamp(Track::Audio, chunk.header.ts_us);
                out.push(TaggedFrame {
                    track: Track::Audio,
                    timestamp_ms,
                    body: flv::aac_raw_tag(&chunk.payload),
                    can_be_dropped: false,
                });
            }
        }
        Ok(out)
    }

    fn flush_pending_headers(
        &mut self,
        ts_us: u64,
        out: &mut Vec<TaggedFrame>,
    ) -> Result<(), TagError> {
        if self.resend_headers && self.config.is_some() {
            self.emit_sequence_headers(ts_us, out)?;
            self.resend_headers = false;
        }
        Ok(())
    }

    fn emit_sequence_headers(
        &mut self,
        ts_us: u64,
        out: &mut Vec<TaggedFrame>,
    ) -> Result<(), TagError> {
        let config = match self.config.clone() {
            Some(config) => config,
            None => return Ok(()),
        };
        // Both tracks are stamped from the SAME `ts_us`, and stamping is idempotent at
        // an already-reached timestamp, so re-sending headers at a reconnect costs the
        // timeline nothing and counts no clamp.
        let video_at = self.clock.stamp(Track::Video, ts_us);
        let audio_at = self.clock.stamp(Track::Audio, ts_us);
        out.push(TaggedFrame {
            track: Track::Video,
            timestamp_ms: video_at,
            body: flv::avc_sequence_header(&config.avc_c)?,
            can_be_dropped: false,
        });
        out.push(TaggedFrame {
            track: Track::Audio,
            timestamp_ms: audio_at,
            body: flv::aac_sequence_header(&config.asc)?,
            can_be_dropped: false,
        });
        Ok(())
    }

    /// Whether a configuration has ever arrived. A reconnect before this is true has
    /// no headers to re-send and nothing decodable to resume.
    pub fn has_configuration(&self) -> bool {
        self.config.is_some()
    }

    /// Chunks that arrived out of order on their own track and were clamped.
    pub fn clamped_count(&self) -> u64 {
        self.clock.clamped_count()
    }

    /// Media chunks that arrived before any decoder configuration and were dropped.
    pub fn media_before_config(&self) -> u64 {
        self.media_before_config
    }

    pub fn past_24_bit_ceiling(&self) -> bool {
        self.clock.past_24_bit_ceiling()
    }

    /// The furthest either track has reached. **The reconnect guard reads this**: it
    /// must never be smaller after a reconnect than it was before one.
    pub fn last_ms(&self) -> u32 {
        self.clock.last_ms()
    }
}

impl Default for Tagger {
    fn default() -> Tagger {
        Tagger::new()
    }
}

/// What a FRESH RTMP session is allowed to be sent, which is not everything.
///
/// Armed on a resume and open otherwise. While armed it passes sequence headers and
/// audio and withholds video until the next keyframe: inter-frames reference pictures
/// the new ingest never received, and sending them produces the smeared, tearing
/// picture everyone recognises and nobody can explain, for however long it takes the
/// next IDR to arrive. Dropping them costs the same wall-clock and looks like a clean
/// cut.
///
/// **Audio is never gated.** It has no inter-frame dependency, and silence over a
/// wedding is worse than anything this gate is protecting against.
#[derive(Debug, Default)]
pub struct WireGate {
    awaiting_keyframe: bool,
    dropped_awaiting_keyframe: u64,
}

impl WireGate {
    /// Open — the first session, where the ingest has seen everything we have sent.
    pub fn open() -> WireGate {
        WireGate { awaiting_keyframe: false, dropped_awaiting_keyframe: 0 }
    }

    /// Armed — a reconnect, where it has seen nothing.
    pub fn armed() -> WireGate {
        WireGate { awaiting_keyframe: true, dropped_awaiting_keyframe: 0 }
    }

    pub fn admits(&mut self, frame: &TaggedFrame) -> bool {
        if !self.awaiting_keyframe {
            return true;
        }
        if frame.track == Track::Audio || frame.is_sequence_header() {
            return true;
        }
        if frame.is_video_keyframe() {
            self.awaiting_keyframe = false;
            return true;
        }
        self.dropped_awaiting_keyframe += 1;
        false
    }

    /// Video frames withheld from the wire while waiting for the first keyframe. A
    /// large number here is a long GOP, not a fault — S9's surface reads it as "how
    /// much of the reconnect the viewer actually lost". The FILE kept all of them.
    pub fn dropped_awaiting_keyframe(&self) -> u64 {
        self.dropped_awaiting_keyframe
    }

    pub fn is_waiting(&self) -> bool {
        self.awaiting_keyframe
    }
}

/// THE ONE PATH a chunk takes: tag once, record all, return what the wire may have.
///
/// It owns the tagger and the recording for the whole wedding, and a per-session gate
/// the supervisor re-arms on every reconnect. Both the publishing loop in `sender.rs`
/// and the offline drain in `reconnect.rs` call [`ingest`](Pipeline::ingest) — which
/// is the point. An offline drain that recorded through its own copy of this logic is
/// exactly how the file and the broadcast would come to disagree about a wedding
/// nobody can re-shoot.
pub struct Pipeline {
    tagger: Tagger,
    sink: Box<dyn TagSink>,
    gate: WireGate,
    recorded_frames: u64,
    recording_faulted: bool,
}

impl Pipeline {
    pub fn new(tagger: Tagger, sink: Box<dyn TagSink>) -> Pipeline {
        Pipeline {
            tagger,
            sink,
            gate: WireGate::open(),
            recorded_frames: 0,
            recording_faulted: false,
        }
    }

    /// No recording — streaming only.
    pub fn streaming_only() -> Pipeline {
        Pipeline::new(Tagger::new(), Box::new(NoRecording))
    }

    /// A new RTMP session is starting over this stream: re-send the sequence headers
    /// and withhold video until the next keyframe.
    pub fn resume_session(&mut self) {
        self.tagger.resume_session();
        self.gate = WireGate::armed();
    }

    /// Tag one chunk, write EVERY frame to the recording, and return the frames the
    /// current session may send.
    ///
    /// **Recording happens before sending, deliberately.** If the socket dies on this
    /// very frame, the file has it and the ingest does not — the fuller copy is the
    /// one on the laptop, which is the only ordering that makes the recording a
    /// safety net rather than a second thing to lose.
    pub fn ingest(&mut self, chunk: &EncodedChunk) -> Result<Vec<TaggedFrame>, TagError> {
        let frames = self.tagger.tag(chunk)?;
        let mut for_wire = Vec::with_capacity(frames.len());
        for frame in frames {
            // A recording failure is latched by the sink and never surfaced here: the
            // caller is the live send path and there is nothing it should do
            // differently because a disk filled up. `reconnect.rs` reads `fault()`.
            if self.sink.accept(&frame).is_ok() {
                self.recorded_frames += 1;
            } else {
                self.recording_faulted = true;
            }
            if self.gate.admits(&frame) {
                for_wire.push(frame);
            }
        }
        Ok(for_wire)
    }

    pub fn tagger(&self) -> &Tagger {
        &self.tagger
    }

    pub fn gate(&self) -> &WireGate {
        &self.gate
    }

    /// Frames written to the recording. Compared against the wire's count in
    /// `tests/recording.rs`: after a reconnect the file must hold MORE, never fewer.
    pub fn recorded_frames(&self) -> u64 {
        self.recorded_frames
    }

    /// Why the recording stopped, if it did.
    pub fn recording_fault(&self) -> Option<String> {
        self.sink.fault().or_else(|| {
            self.recording_faulted.then(|| "the recording stopped accepting tags".to_string())
        })
    }

    /// Give the sink back at the end of the wedding — this is how the caller reaches
    /// `FlvFileWriter::finish` for the path the controller shows the operator.
    pub fn into_sink(self) -> Box<dyn TagSink> {
        self.sink
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::contract::ChunkHeader;

    const AVC_C: &[u8] = &[1, 0x42, 0xC0, 0x1F];
    const ASC: &[u8] = &[0x11, 0x90];

    fn config_chunk(ts_us: u64) -> EncodedChunk {
        EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Config, keyframe: false, seq: 0, ts_us },
            payload: DecoderConfig { avc_c: AVC_C.to_vec(), asc: ASC.to_vec() }.encode_payload(),
        }
    }

    fn video_chunk(ts_us: u64, keyframe: bool) -> EncodedChunk {
        EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Video, keyframe, seq: 1, ts_us },
            payload: vec![0, 0, 0, 2, 0x65, 0x88],
        }
    }

    fn audio_chunk(ts_us: u64) -> EncodedChunk {
        EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Audio, keyframe: false, seq: 2, ts_us },
            payload: vec![0x21, 0x10],
        }
    }

    /// A sink that keeps everything, so a test can compare the file against the wire.
    #[derive(Default)]
    struct Collector {
        frames: Vec<TaggedFrame>,
    }

    impl TagSink for Collector {
        fn accept(&mut self, frame: &TaggedFrame) -> std::io::Result<()> {
            self.frames.push(frame.clone());
            Ok(())
        }
    }

    #[test]
    fn configuration_produces_both_sequence_headers_video_first() {
        let mut tagger = Tagger::new();
        let frames = tagger.tag(&config_chunk(0)).unwrap();
        assert_eq!(frames.len(), 2);
        assert_eq!(frames[0].track, Track::Video);
        assert!(frames[0].is_sequence_header());
        assert_eq!(&frames[0].body[0..2], &[0x17, 0x00]);
        assert_eq!(frames[1].track, Track::Audio);
        assert!(frames[1].is_sequence_header());
        assert_eq!(&frames[1].body[0..2], &[0xAF, 0x00]);
    }

    #[test]
    fn media_before_configuration_is_dropped_and_counted() {
        let mut tagger = Tagger::new();
        assert!(tagger.tag(&video_chunk(0, true)).unwrap().is_empty());
        assert!(tagger.tag(&audio_chunk(0)).unwrap().is_empty());
        assert_eq!(tagger.media_before_config(), 2);
        assert!(!tagger.has_configuration());
    }

    // ── THE CLOCK SURVIVES THE SESSION ─────────────────────────────────────────
    #[test]
    fn a_resumed_session_continues_the_timeline_instead_of_restarting_it() {
        let mut tagger = Tagger::new();
        tagger.tag(&config_chunk(0)).unwrap();
        tagger.tag(&video_chunk(0, true)).unwrap();
        let before = tagger.tag(&video_chunk(4_000_000, true)).unwrap();
        assert_eq!(before[0].timestamp_ms, 4_000);

        // The socket died here. A new RtmpSender is built; the tagger is not.
        tagger.resume_session();
        let after = tagger.tag(&video_chunk(9_000_000, true)).unwrap();

        assert_eq!(after.len(), 3, "both headers, then the frame");
        assert!(after[0].is_sequence_header());
        assert!(after[1].is_sequence_header());
        assert_eq!(after[2].timestamp_ms, 9_000, "the timeline continued across the reconnect");
        assert!(
            tagger.last_ms() >= 9_000,
            "a reconnect that restarts the clock is a stream that jumps backwards"
        );
        assert_eq!(tagger.clamped_count(), 0, "continuing is not clamping");
    }

    #[test]
    fn a_resumed_session_re_sends_both_headers_before_any_media() {
        let mut tagger = Tagger::new();
        tagger.tag(&config_chunk(0)).unwrap();
        tagger.tag(&video_chunk(0, true)).unwrap();

        tagger.resume_session();
        // Audio arrives first after the reconnect — the headers still lead.
        let frames = tagger.tag(&audio_chunk(1_000_000)).unwrap();
        assert_eq!(frames.len(), 3);
        assert!(frames[0].is_sequence_header() && frames[0].track == Track::Video);
        assert!(frames[1].is_sequence_header() && frames[1].track == Track::Audio);
        assert!(!frames[2].is_sequence_header() && frames[2].track == Track::Audio);
    }

    #[test]
    fn a_reconnect_before_any_configuration_has_no_headers_to_invent() {
        let mut tagger = Tagger::new();
        tagger.resume_session();
        assert!(tagger.tag(&video_chunk(0, true)).unwrap().is_empty());
        assert_eq!(tagger.media_before_config(), 1);
    }

    #[test]
    fn a_frame_knows_its_tag_type_and_whether_rtmp_may_drop_it() {
        let mut tagger = Tagger::new();
        tagger.tag(&config_chunk(0)).unwrap();
        let key = tagger.tag(&video_chunk(0, true)).unwrap().remove(0);
        assert_eq!(key.tag_type(), flv::TAG_TYPE_VIDEO);
        assert!(key.is_video_keyframe());
        assert!(!key.can_be_dropped, "a keyframe is what everything after it depends on");
        let inter = tagger.tag(&video_chunk(33_000, false)).unwrap().remove(0);
        assert!(inter.can_be_dropped);
        assert!(!inter.is_video_keyframe());
        let audio = tagger.tag(&audio_chunk(40_000)).unwrap().remove(0);
        assert_eq!(audio.tag_type(), flv::TAG_TYPE_AUDIO);
        assert!(!audio.is_video_keyframe(), "audio is never a video keyframe");
        assert!(!audio.can_be_dropped, "audio is what the couple hears in the archive forever");
    }

    #[test]
    fn a_sequence_header_is_not_mistaken_for_a_keyframe() {
        // Both start 0x17. The difference is byte 1, and a gate that got this wrong
        // would open on the header and let the undecodable inter-frames straight
        // through — the exact defect the gate exists to prevent.
        let mut tagger = Tagger::new();
        let header = tagger.tag(&config_chunk(0)).unwrap().remove(0);
        assert_eq!(header.body[0], 0x17);
        assert!(header.is_sequence_header());
        assert!(!header.is_video_keyframe());
    }

    // ── THE GATE ───────────────────────────────────────────────────────────────
    #[test]
    fn an_open_gate_admits_everything_and_an_armed_one_waits_for_a_keyframe() {
        let mut tagger = Tagger::new();
        tagger.tag(&config_chunk(0)).unwrap();
        let inter = tagger.tag(&video_chunk(1_000_000, false)).unwrap().remove(0);
        let key = tagger.tag(&video_chunk(2_000_000, true)).unwrap().remove(0);
        let audio = tagger.tag(&audio_chunk(2_100_000)).unwrap().remove(0);

        let mut open = WireGate::open();
        assert!(open.admits(&inter));
        assert_eq!(open.dropped_awaiting_keyframe(), 0);

        let mut armed = WireGate::armed();
        assert!(armed.is_waiting());
        assert!(!armed.admits(&inter), "an inter-frame references what the new ingest lacks");
        assert!(armed.admits(&audio), "audio is never gated — silence is worse");
        assert!(armed.is_waiting(), "and audio does not open the gate");
        assert!(armed.admits(&key));
        assert!(!armed.is_waiting(), "the keyframe opens it");
        assert!(armed.admits(&inter), "and it stays open");
        assert_eq!(armed.dropped_awaiting_keyframe(), 1);
    }

    // ── THE FILE KEEPS WHAT THE WIRE CANNOT TAKE ───────────────────────────────
    #[test]
    fn a_reconnect_withholds_frames_from_the_wire_and_none_from_the_recording() {
        let mut pipeline = Pipeline::new(Tagger::new(), Box::new(Collector::default()));
        pipeline.ingest(&config_chunk(0)).unwrap();
        pipeline.ingest(&video_chunk(0, true)).unwrap();

        // The socket died; a new one came up.
        pipeline.resume_session();
        let wire_after_reconnect: usize = [
            pipeline.ingest(&video_chunk(1_000_000, false)).unwrap().len(),
            pipeline.ingest(&video_chunk(1_033_000, false)).unwrap().len(),
            pipeline.ingest(&audio_chunk(1_040_000)).unwrap().len(),
            pipeline.ingest(&video_chunk(2_000_000, true)).unwrap().len(),
        ]
        .iter()
        .sum();

        // The wire got: 2 headers (with the first inter-frame, which was withheld),
        // the audio frame, and the keyframe. The two inter-frames never went out.
        assert_eq!(wire_after_reconnect, 4);
        assert_eq!(pipeline.gate().dropped_awaiting_keyframe(), 2);

        // THE GUARD: the recording kept every one of them. Its previous frames are all
        // present, so those inter-frames decode there — punching a hole in the
        // couple's only copy would be solving a problem the file does not have.
        // 2 config headers + 1 keyframe + 2 resent headers + 2 inter + 1 audio + 1 key.
        assert_eq!(pipeline.recorded_frames(), 9);
        assert!(
            pipeline.recorded_frames() as usize > wire_after_reconnect + 3,
            "the file must hold strictly more than the wire across a reconnect"
        );
        assert!(pipeline.recording_fault().is_none());
    }

    #[test]
    fn a_clean_session_sends_the_recording_and_the_wire_the_identical_frames() {
        let mut pipeline = Pipeline::new(Tagger::new(), Box::new(Collector::default()));
        let mut wire = Vec::new();
        for chunk in [
            config_chunk(0),
            video_chunk(0, true),
            audio_chunk(21_333),
            video_chunk(33_366, false),
        ] {
            wire.extend(pipeline.ingest(&chunk).unwrap());
        }
        assert_eq!(pipeline.recorded_frames(), wire.len() as u64);
        assert_eq!(wire.len(), 5, "2 headers, keyframe, audio, inter-frame");
    }
}
