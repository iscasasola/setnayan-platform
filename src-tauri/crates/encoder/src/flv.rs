//! FLV TAG BODIES — the ~150 lines that stand between WebCodecs and YouTube.
//!
//! RTMP does not carry H.264 or AAC directly; it carries FLV tag bodies, and those
//! bodies are the same bytes whether they go out over the wire or into the local
//! `.flv` recording S7 writes. So the tagger is one module with no opinion about
//! destination: `rtmp.rs`/`sender.rs` hand these bodies to `publish_video_data`, and
//! the recorder hands the identical bodies to `wrap_tag`.
//!
//! WHY THIS IS HAND-ROLLED. It is about 150 lines of byte layout that has not changed
//! since 2007. The alternative on the table was an ffmpeg sidecar, which costs +80 MB
//! in the installer, a GPL question we do not want to answer, and — the real defect —
//! it puts window capture back in the pipeline we are building this encoder to remove.
//!
//! WHAT WEBCODECS ALREADY GIVES US. Configured with `avc: { format: 'avc' }`, the
//! browser emits access units in avcC form — 4-byte big-endian length prefixes ahead
//! of each NALU, no start codes — which is byte-for-byte what an FLV video tag wants
//! after its 5-byte header. There is no Annex-B conversion here because there is no
//! Annex-B to convert; if S4 ever ships `annexb` instead, that conversion belongs at
//! the producer, not in this file, and this file's fixture test will fail loudly the
//! moment it arrives.
//!
//! Reference: Adobe *Video File Format Specification v10.1*, Annex E (FLV) and E.4.3
//! (AVCVIDEOPACKET) / E.4.2 (AUDIODATA). Verified against ffmpeg's own muxer output
//! byte-for-byte in `tests/flv_fixture.rs` — a spec quotation is not evidence.

use std::collections::HashMap;

use rml_rtmp::rml_amf0::Amf0Value;
use rml_rtmp::sessions::StreamMetadata;

/// FLV tag type IDs. Also the RTMP message type IDs — not a coincidence, RTMP reuses them.
pub const TAG_TYPE_AUDIO: u8 = 8;
pub const TAG_TYPE_VIDEO: u8 = 9;
pub const TAG_TYPE_SCRIPT: u8 = 18;

/// FLV `CodecID` 7 = AVC (H.264); `SoundFormat` 10 = AAC. YouTube ingests both.
pub const VIDEO_CODEC_ID_AVC: u32 = 7;
pub const AUDIO_CODEC_ID_AAC: u32 = 10;

const FRAME_TYPE_KEY: u8 = 1;
const FRAME_TYPE_INTER: u8 = 2;

/// `AVCPacketType`: 0 sequence header, 1 NALU, 2 end-of-sequence.
const AVC_PACKET_SEQUENCE_HEADER: u8 = 0;
const AVC_PACKET_NALU: u8 = 1;
const AVC_PACKET_END_OF_SEQUENCE: u8 = 2;

/// `AACPacketType`: 0 sequence header (AudioSpecificConfig), 1 raw AAC frame data.
const AAC_PACKET_SEQUENCE_HEADER: u8 = 0;
const AAC_PACKET_RAW: u8 = 1;

/// The first audio byte for AAC: `SoundFormat 10 << 4 | SoundRate 3 << 2 | SoundSize 1 << 1 | SoundType 1`.
///
/// The rate and channel bits are **ignored for AAC** — the spec fixes them at
/// `3` (nominally 44 kHz) and `1` (stereo) regardless of the real stream, because
/// the truth lives in the AudioSpecificConfig instead. We send 48 kHz audio and this
/// byte still reads 0xAF; that is correct, not a mismatch, and it is written down here
/// because "the header says 44.1 but we encode 48" is exactly the kind of thing a
/// future session would otherwise spend an afternoon "fixing".
pub const AUDIO_TAG_HEADER_AAC: u8 = 0xAF;

/// Everything the encoder knows about the stream, in one place, so the RTMP
/// `onMetaData` and the recorded file's `onMetaData` can never disagree — they are
/// generated from this single value by `to_rml_metadata` and `on_metadata_amf0`.
#[derive(Debug, Clone, PartialEq)]
pub struct StreamMeta {
    pub width: u32,
    pub height: u32,
    pub frame_rate: f32,
    pub video_bitrate_kbps: u32,
    pub audio_sample_rate: u32,
    pub audio_channels: u32,
    pub audio_bitrate_kbps: u32,
    pub encoder_name: String,
}

impl StreamMeta {
    /// What the S-series pipeline produces today: 1280×720 @ 30 fps, AAC-LC 48 kHz
    /// stereo. The numbers are S4/S3's to change; the shape is this file's.
    pub fn defaults_720p30() -> StreamMeta {
        StreamMeta {
            width: 1280,
            height: 720,
            frame_rate: 30.0,
            video_bitrate_kbps: 2500,
            audio_sample_rate: 48_000,
            audio_channels: 2,
            audio_bitrate_kbps: 128,
            encoder_name: "Setnayan Live Studio".to_string(),
        }
    }

    /// The RTMP path — `ClientSession::publish_metadata` builds the `@setDataFrame`
    /// command from this.
    pub fn to_rml_metadata(&self) -> StreamMetadata {
        let mut metadata = StreamMetadata::new();
        metadata.video_width = Some(self.width);
        metadata.video_height = Some(self.height);
        metadata.video_codec_id = Some(VIDEO_CODEC_ID_AVC);
        metadata.video_frame_rate = Some(self.frame_rate);
        metadata.video_bitrate_kbps = Some(self.video_bitrate_kbps);
        metadata.audio_codec_id = Some(AUDIO_CODEC_ID_AAC);
        metadata.audio_bitrate_kbps = Some(self.audio_bitrate_kbps);
        metadata.audio_sample_rate = Some(self.audio_sample_rate);
        metadata.audio_channels = Some(self.audio_channels);
        metadata.audio_is_stereo = Some(self.audio_channels == 2);
        metadata.encoder = Some(self.encoder_name.clone());
        metadata
    }

    /// The file path — the AMF0 body of an FLV `onMetaData` script tag.
    ///
    /// Serialised as an AMF0 *object* (marker 0x03) rather than the ECMA array
    /// (marker 0x08) most muxers write. Both are legal, every player reads both, and
    /// `rml_amf0` implements the object — which matters because it makes the file and
    /// the RTMP stream come out of one code path instead of two that drift.
    pub fn on_metadata_amf0(&self) -> Result<Vec<u8>, FlvError> {
        let mut properties: HashMap<String, Amf0Value> = HashMap::new();
        properties.insert("width".to_string(), Amf0Value::Number(self.width as f64));
        properties.insert("height".to_string(), Amf0Value::Number(self.height as f64));
        properties.insert("framerate".to_string(), Amf0Value::Number(self.frame_rate as f64));
        properties.insert(
            "videocodecid".to_string(),
            Amf0Value::Number(VIDEO_CODEC_ID_AVC as f64),
        );
        properties.insert(
            "videodatarate".to_string(),
            Amf0Value::Number(self.video_bitrate_kbps as f64),
        );
        properties.insert(
            "audiocodecid".to_string(),
            Amf0Value::Number(AUDIO_CODEC_ID_AAC as f64),
        );
        properties.insert(
            "audiodatarate".to_string(),
            Amf0Value::Number(self.audio_bitrate_kbps as f64),
        );
        properties.insert(
            "audiosamplerate".to_string(),
            Amf0Value::Number(self.audio_sample_rate as f64),
        );
        properties.insert(
            "audiochannels".to_string(),
            Amf0Value::Number(self.audio_channels as f64),
        );
        properties.insert("stereo".to_string(), Amf0Value::Boolean(self.audio_channels == 2));
        properties.insert(
            "encoder".to_string(),
            Amf0Value::Utf8String(self.encoder_name.clone()),
        );

        let values = vec![
            Amf0Value::Utf8String("onMetaData".to_string()),
            Amf0Value::Object(properties),
        ];
        rml_rtmp::rml_amf0::serialize(&values).map_err(|_| FlvError::MetadataSerialization)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FlvError {
    /// The composition-time offset did not fit the signed 24-bit field. Cannot happen
    /// on a B-frame-free realtime encode (S4 sends `latencyMode: 'realtime'`), which is
    /// exactly why it is an error and not a silent truncation — if it ever fires, the
    /// encoder configuration changed under us.
    CompositionTimeOutOfRange { cts_ms: i32 },
    /// An empty `avcC`/`asc`. A sequence header with no bytes is a stream that will
    /// never decode; refusing here is what makes the "sequence headers first" guard mean something.
    EmptySequenceHeader,
    MetadataSerialization,
}

impl std::fmt::Display for FlvError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FlvError::CompositionTimeOutOfRange { cts_ms } => write!(
                f,
                "composition time {cts_ms} ms does not fit FLV's signed 24-bit field"
            ),
            FlvError::EmptySequenceHeader => {
                write!(f, "decoder configuration was empty (avcC or asc had no bytes)")
            }
            FlvError::MetadataSerialization => write!(f, "onMetaData could not be serialised"),
        }
    }
}

impl std::error::Error for FlvError {}

/// `AVCVIDEOPACKET` with `AVCPacketType = 0` — the AVCDecoderConfigurationRecord.
/// MUST reach the server before any NALU tag; `sender.rs` owns that ordering.
pub fn avc_sequence_header(avc_c: &[u8]) -> Result<Vec<u8>, FlvError> {
    if avc_c.is_empty() {
        return Err(FlvError::EmptySequenceHeader);
    }
    let mut out = Vec::with_capacity(5 + avc_c.len());
    out.push((FRAME_TYPE_KEY << 4) | VIDEO_CODEC_ID_AVC as u8); // 0x17
    out.push(AVC_PACKET_SEQUENCE_HEADER);
    push_i24(&mut out, 0); // CompositionTime is always 0 for a sequence header
    out.extend_from_slice(avc_c);
    Ok(out)
}

/// `AVCVIDEOPACKET` with `AVCPacketType = 1` — one access unit.
///
/// `nalus` are already length-prefixed (avcC form). `cts_ms` is the composition-time
/// offset (PTS − DTS); it is 0 for every frame a realtime, B-frame-free encode
/// produces, and the parameter exists so the ffmpeg fixture — which may carry a
/// non-zero offset — can be reproduced exactly rather than approximately.
pub fn avc_nalu_tag(keyframe: bool, cts_ms: i32, nalus: &[u8]) -> Result<Vec<u8>, FlvError> {
    if !(-(1 << 23)..(1 << 23)).contains(&cts_ms) {
        return Err(FlvError::CompositionTimeOutOfRange { cts_ms });
    }
    let frame_type = if keyframe { FRAME_TYPE_KEY } else { FRAME_TYPE_INTER };
    let mut out = Vec::with_capacity(5 + nalus.len());
    out.push((frame_type << 4) | VIDEO_CODEC_ID_AVC as u8); // 0x17 keyframe / 0x27 inter
    out.push(AVC_PACKET_NALU);
    push_i24(&mut out, cts_ms);
    out.extend_from_slice(nalus);
    Ok(out)
}

/// `AVCPacketType = 2`, empty body — "no more AVC data on this stream".
/// Sent on a clean stop so the ingest closes the sequence instead of timing it out.
pub fn avc_end_of_sequence() -> Vec<u8> {
    let mut out = Vec::with_capacity(5);
    out.push((FRAME_TYPE_KEY << 4) | VIDEO_CODEC_ID_AVC as u8);
    out.push(AVC_PACKET_END_OF_SEQUENCE);
    push_i24(&mut out, 0);
    out
}

/// `AUDIODATA` with `AACPacketType = 0` — the AudioSpecificConfig.
pub fn aac_sequence_header(asc: &[u8]) -> Result<Vec<u8>, FlvError> {
    if asc.is_empty() {
        return Err(FlvError::EmptySequenceHeader);
    }
    let mut out = Vec::with_capacity(2 + asc.len());
    out.push(AUDIO_TAG_HEADER_AAC);
    out.push(AAC_PACKET_SEQUENCE_HEADER);
    out.extend_from_slice(asc);
    Ok(out)
}

/// `AUDIODATA` with `AACPacketType = 1` — raw AAC frame data, no ADTS header.
/// `AudioEncoder` with `aac: { format: 'aac' }` already emits raw; if a future config
/// emits ADTS, it must be stripped at the producer and this file's fixture will say so.
pub fn aac_raw_tag(aac: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(2 + aac.len());
    out.push(AUDIO_TAG_HEADER_AAC);
    out.push(AAC_PACKET_RAW);
    out.extend_from_slice(aac);
    out
}

/// The 13-byte FLV file header (signature + flags + data offset + PreviousTagSize0).
///
/// The *file* framing lives here beside the tag bodies because it is nine lines and
/// because keeping it here is what let the fixture test round-trip through a real
/// `ffprobe` instead of asserting against our own reading of the spec. **S7 owns the
/// recording** — rotation, disk-full, fsync, what happens when the wedding runs long.
/// S6 owns only the bytes.
pub fn file_header(has_audio: bool, has_video: bool) -> Vec<u8> {
    let mut flags = 0u8;
    if has_audio {
        flags |= 0b100;
    }
    if has_video {
        flags |= 0b001;
    }
    let mut out = Vec::with_capacity(13);
    out.extend_from_slice(b"FLV");
    out.push(1); // version
    out.push(flags);
    out.extend_from_slice(&9u32.to_be_bytes()); // data offset
    out.extend_from_slice(&0u32.to_be_bytes()); // PreviousTagSize0
    out
}

/// Wrap a tag body in the 11-byte FLV tag header and the trailing PreviousTagSize.
///
/// `timestamp_ms` is 32-bit: the low 24 bits go in `Timestamp` and the high 8 in
/// `TimestampExtended`. That extended byte is FLV's answer to the same 24-bit ceiling
/// RTMP solves with extended chunk timestamps — 16,777,215 ms is 4 h 39 m 37 s, and a
/// wedding reception runs past it. A recording that dropped the high byte would play
/// back correct for four and a half hours and then jump to zero.
pub fn wrap_tag(tag_type: u8, timestamp_ms: u32, body: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(11 + body.len() + 4);
    out.push(tag_type);
    push_u24(&mut out, body.len() as u32);
    push_u24(&mut out, timestamp_ms & 0x00FF_FFFF);
    out.push((timestamp_ms >> 24) as u8); // TimestampExtended
    push_u24(&mut out, 0); // StreamID, always 0
    out.extend_from_slice(body);
    out.extend_from_slice(&((11 + body.len()) as u32).to_be_bytes());
    out
}

fn push_u24(out: &mut Vec<u8>, value: u32) {
    out.push((value >> 16) as u8);
    out.push((value >> 8) as u8);
    out.push(value as u8);
}

fn push_i24(out: &mut Vec<u8>, value: i32) {
    let unsigned = (value as u32) & 0x00FF_FFFF;
    push_u24(out, unsigned);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_keyframe_tag_and_an_inter_tag_differ_only_in_the_frame_type_nibble() {
        let nalus = [0, 0, 0, 2, 0x65, 0x88];
        let key = avc_nalu_tag(true, 0, &nalus).unwrap();
        let inter = avc_nalu_tag(false, 0, &nalus).unwrap();
        assert_eq!(key[0], 0x17);
        assert_eq!(inter[0], 0x27);
        assert_eq!(&key[1..], &inter[1..]);
        assert_eq!(&key[5..], &nalus, "the NALUs are passed through untouched");
    }

    #[test]
    fn the_sequence_headers_carry_their_configuration_verbatim() {
        let avc_c = [1, 0x64, 0, 0x1F, 0xFF, 0xE1];
        let tag = avc_sequence_header(&avc_c).unwrap();
        assert_eq!(&tag[0..5], &[0x17, 0x00, 0x00, 0x00, 0x00]);
        assert_eq!(&tag[5..], &avc_c);

        let asc = [0x11, 0x90];
        let tag = aac_sequence_header(&asc).unwrap();
        assert_eq!(&tag[0..2], &[0xAF, 0x00]);
        assert_eq!(&tag[2..], &asc);
    }

    #[test]
    fn an_empty_configuration_is_refused_rather_than_sent() {
        assert_eq!(avc_sequence_header(&[]).unwrap_err(), FlvError::EmptySequenceHeader);
        assert_eq!(aac_sequence_header(&[]).unwrap_err(), FlvError::EmptySequenceHeader);
    }

    #[test]
    fn a_raw_aac_tag_is_two_bytes_of_header_and_then_the_frame() {
        let frame = [0x21, 0x10, 0x05];
        assert_eq!(aac_raw_tag(&frame), vec![0xAF, 0x01, 0x21, 0x10, 0x05]);
    }

    #[test]
    fn composition_time_is_signed_and_bounded() {
        let nalus = [0u8; 4];
        assert_eq!(&avc_nalu_tag(true, -1, &nalus).unwrap()[2..5], &[0xFF, 0xFF, 0xFF]);
        assert_eq!(&avc_nalu_tag(true, 1000, &nalus).unwrap()[2..5], &[0x00, 0x03, 0xE8]);
        assert_eq!(
            avc_nalu_tag(true, 1 << 23, &nalus).unwrap_err(),
            FlvError::CompositionTimeOutOfRange { cts_ms: 1 << 23 }
        );
    }

    #[test]
    fn a_tag_past_the_24_bit_ceiling_keeps_its_high_byte() {
        // 4 h 39 m 37 s. The wedding is not over.
        let tag = wrap_tag(TAG_TYPE_VIDEO, 16_777_216, &[0xAA]);
        assert_eq!(&tag[4..8], &[0x00, 0x00, 0x00, 0x01], "low 24 bits, then TimestampExtended");
        assert_eq!(tag[0], TAG_TYPE_VIDEO);
        assert_eq!(&tag[1..4], &[0x00, 0x00, 0x01], "DataSize");
        assert_eq!(&tag[tag.len() - 4..], &12u32.to_be_bytes(), "PreviousTagSize = 11 + body");
    }

    #[test]
    fn the_file_header_declares_what_the_file_actually_holds() {
        assert_eq!(&file_header(true, true)[..5], b"FLV\x01\x05");
        assert_eq!(&file_header(false, true)[..5], b"FLV\x01\x01");
        assert_eq!(file_header(true, true).len(), 13);
    }

    #[test]
    fn metadata_serialises_and_reads_back_with_the_codec_ids_youtube_needs() {
        let meta = StreamMeta::defaults_720p30();
        let bytes = meta.on_metadata_amf0().unwrap();
        let mut cursor = std::io::Cursor::new(bytes);
        let values = rml_rtmp::rml_amf0::deserialize(&mut cursor).unwrap();
        assert_eq!(values.len(), 2);
        assert_eq!(values[0], Amf0Value::Utf8String("onMetaData".to_string()));
        let properties = match &values[1] {
            Amf0Value::Object(map) => map.clone(),
            other => panic!("expected an AMF0 object, got {other:?}"),
        };
        assert_eq!(properties.get("videocodecid"), Some(&Amf0Value::Number(7.0)));
        assert_eq!(properties.get("audiocodecid"), Some(&Amf0Value::Number(10.0)));
        assert_eq!(properties.get("audiosamplerate"), Some(&Amf0Value::Number(48_000.0)));
        assert_eq!(properties.get("width"), Some(&Amf0Value::Number(1280.0)));
        assert_eq!(properties.get("height"), Some(&Amf0Value::Number(720.0)));
        assert_eq!(properties.get("framerate"), Some(&Amf0Value::Number(30.0)));
    }

    #[test]
    fn the_rtmp_metadata_and_the_file_metadata_come_from_the_same_value() {
        let meta = StreamMeta::defaults_720p30();
        let rml = meta.to_rml_metadata();
        assert_eq!(rml.video_codec_id, Some(VIDEO_CODEC_ID_AVC));
        assert_eq!(rml.audio_codec_id, Some(AUDIO_CODEC_ID_AAC));
        assert_eq!(rml.audio_sample_rate, Some(meta.audio_sample_rate));
        assert_eq!(rml.video_width, Some(meta.width));
        assert_eq!(rml.audio_is_stereo, Some(true));
    }
}
