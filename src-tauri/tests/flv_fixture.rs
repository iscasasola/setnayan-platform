//! OUR FLV TAGS, AGAINST FFMPEG'S — byte for byte.
//!
//! `tests/fixtures/two-seconds-h264-aac.flv` is two seconds of H.264 baseline +
//! AAC-LC 48 kHz stereo written by ffmpeg 8.1.2's own FLV muxer:
//!
//! ```sh
//! ffmpeg -f lavfi -i "testsrc2=size=320x240:rate=30" \
//!        -f lavfi -i "sine=frequency=440:sample_rate=48000" \
//!        -t 2 -c:v libx264 -profile:v baseline -bf 0 -pix_fmt yuv420p -g 30 \
//!        -b:v 400k -c:a aac -ar 48000 -ac 2 -b:a 128k \
//!        -f flv tests/fixtures/two-seconds-h264-aac.flv
//! ```
//!
//! WHY A FIXTURE AND NOT A SPEC QUOTATION. Rule 8 of this program: read the live
//! object, never a docblock. The FLV tag layout in `flv.rs` is written from Adobe's
//! spec, and a spec is exactly the kind of source that can be read correctly and
//! implemented wrongly. This test takes every tag ffmpeg produced, hands its payload
//! back to our tagger, and demands the same bytes come out. If our frame-type nibble,
//! our AVCPacketType, our composition-time field or our audio header byte were wrong
//! in any way a player would notice, this fails — and it fails against a muxer whose
//! output YouTube has ingested for fifteen years, not against our own reading.
//!
//! `-bf 0` is deliberate: the S4 encoder runs `latencyMode: 'realtime'` and emits no
//! B-frames, so the fixture matches the stream we will actually send. The composition
//! time is asserted from the file rather than assumed to be zero, so if that ever
//! changes the fixture, not a comment, is what says so.

use setnayan_desktop_lib::encoder::flv;

const FIXTURE: &[u8] = include_bytes!("fixtures/two-seconds-h264-aac.flv");

struct Tag {
    tag_type: u8,
    timestamp_ms: u32,
    body: Vec<u8>,
    /// Where this tag's 11-byte header starts in the file, so a failure can be
    /// pointed at a byte offset instead of a tag number.
    offset: usize,
}

/// A minimal FLV reader. It lives in the test, not in `flv.rs`, because nothing in
/// the product reads FLV — we only ever write it.
fn read_tags(bytes: &[u8]) -> Vec<Tag> {
    assert_eq!(&bytes[0..3], b"FLV", "fixture is not an FLV file");
    let data_offset = u32::from_be_bytes([bytes[5], bytes[6], bytes[7], bytes[8]]) as usize;
    let mut cursor = data_offset + 4; // skip the header and PreviousTagSize0
    let mut tags = Vec::new();
    while cursor + 11 <= bytes.len() {
        let offset = cursor;
        let tag_type = bytes[cursor];
        let size =
            u32::from_be_bytes([0, bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3]]) as usize;
        let timestamp_ms = u32::from_be_bytes([
            bytes[cursor + 7],
            bytes[cursor + 4],
            bytes[cursor + 5],
            bytes[cursor + 6],
        ]);
        let body_start = cursor + 11;
        let body_end = body_start + size;
        assert!(body_end <= bytes.len(), "fixture truncated at {offset}");
        tags.push(Tag {
            tag_type,
            timestamp_ms,
            body: bytes[body_start..body_end].to_vec(),
            offset,
        });
        cursor = body_end + 4; // PreviousTagSize
    }
    tags
}

fn composition_time(body: &[u8]) -> i32 {
    let raw = ((body[2] as u32) << 16) | ((body[3] as u32) << 8) | body[4] as u32;
    // Signed 24-bit.
    if raw & 0x0080_0000 != 0 {
        (raw | 0xFF00_0000) as i32
    } else {
        raw as i32
    }
}

#[test]
fn every_tag_ffmpeg_wrote_is_reproduced_byte_for_byte() {
    let tags = read_tags(FIXTURE);

    let mut video_sequence_headers = 0;
    let mut video_frames = 0;
    let mut audio_sequence_headers = 0;
    let mut audio_frames = 0;
    let mut keyframes = 0;

    for tag in &tags {
        match tag.tag_type {
            flv::TAG_TYPE_VIDEO => {
                let keyframe = tag.body[0] >> 4 == 1;
                assert_eq!(tag.body[0] & 0x0F, 7, "fixture video is not AVC at {}", tag.offset);
                match tag.body[1] {
                    0 => {
                        let ours = flv::avc_sequence_header(&tag.body[5..]).unwrap();
                        assert_eq!(ours, tag.body, "AVC sequence header at byte {}", tag.offset);
                        video_sequence_headers += 1;
                    }
                    1 => {
                        let cts = composition_time(&tag.body);
                        let ours = flv::avc_nalu_tag(keyframe, cts, &tag.body[5..]).unwrap();
                        assert_eq!(ours, tag.body, "AVC NALU tag at byte {}", tag.offset);
                        video_frames += 1;
                        if keyframe {
                            keyframes += 1;
                        }
                    }
                    2 => assert_eq!(
                        flv::avc_end_of_sequence(),
                        tag.body,
                        "AVC end-of-sequence at byte {}",
                        tag.offset
                    ),
                    other => panic!("unexpected AVCPacketType {other} at byte {}", tag.offset),
                }
            }
            flv::TAG_TYPE_AUDIO => {
                assert_eq!(
                    tag.body[0],
                    flv::AUDIO_TAG_HEADER_AAC,
                    "fixture audio header byte at {} is not AAC/0xAF",
                    tag.offset
                );
                match tag.body[1] {
                    0 => {
                        let ours = flv::aac_sequence_header(&tag.body[2..]).unwrap();
                        assert_eq!(ours, tag.body, "AAC sequence header at byte {}", tag.offset);
                        audio_sequence_headers += 1;
                    }
                    1 => {
                        let ours = flv::aac_raw_tag(&tag.body[2..]);
                        assert_eq!(ours, tag.body, "AAC raw tag at byte {}", tag.offset);
                        audio_frames += 1;
                    }
                    other => panic!("unexpected AACPacketType {other} at byte {}", tag.offset),
                }
            }
            flv::TAG_TYPE_SCRIPT => {}
            other => panic!("unexpected FLV tag type {other} at byte {}", tag.offset),
        }
    }

    // A comparison that compared nothing would pass exactly as quietly as this one.
    assert_eq!(video_sequence_headers, 1, "expected exactly one avcC in the fixture");
    assert_eq!(audio_sequence_headers, 1, "expected exactly one AudioSpecificConfig");
    assert!(video_frames >= 55, "only {video_frames} video frames — is this the right fixture?");
    assert!(audio_frames >= 80, "only {audio_frames} audio frames — is this the right fixture?");
    assert!(keyframes >= 1, "the fixture has no keyframe");
}

#[test]
fn the_file_framing_reproduces_the_fixture_byte_for_byte_too() {
    // `wrap_tag` and `file_header` are what S7's local recording will write. Proving
    // them here — against the same file, with the same reader — means S7 inherits a
    // framing that has already been compared to a real muxer's output rather than one
    // written fresh under deadline on the day recording lands.
    let tags = read_tags(FIXTURE);
    let data_offset =
        u32::from_be_bytes([FIXTURE[5], FIXTURE[6], FIXTURE[7], FIXTURE[8]]) as usize;

    let ours = flv::file_header(true, true);
    assert_eq!(ours, FIXTURE[..data_offset + 4], "FLV file header + PreviousTagSize0");

    let mut compared = 0;
    for tag in &tags {
        let rebuilt = flv::wrap_tag(tag.tag_type, tag.timestamp_ms, &tag.body);
        let original = &FIXTURE[tag.offset..tag.offset + rebuilt.len()];
        assert_eq!(rebuilt, original, "tag framing at byte {}", tag.offset);
        compared += 1;
    }
    assert!(compared >= 140, "only {compared} tags framed — the reader found too few");
}

#[test]
fn the_fixture_carries_the_configuration_the_encoder_will_actually_send() {
    // Not a tautology: it is what makes the two tests above meaningful. A fixture with
    // no avcC, or with an ADTS-wrapped audio stream, would compare "successfully"
    // while proving nothing about the bytes we send YouTube.
    let tags = read_tags(FIXTURE);
    let avc_c = tags
        .iter()
        .find(|tag| tag.tag_type == flv::TAG_TYPE_VIDEO && tag.body[1] == 0)
        .map(|tag| tag.body[5..].to_vec())
        .expect("no AVC sequence header in the fixture");
    let asc = tags
        .iter()
        .find(|tag| tag.tag_type == flv::TAG_TYPE_AUDIO && tag.body[1] == 0)
        .map(|tag| tag.body[2..].to_vec())
        .expect("no AAC sequence header in the fixture");

    assert_eq!(avc_c[0], 1, "avcC configurationVersion");
    assert!(avc_c.len() > 7, "avcC too short to contain an SPS");
    // AudioSpecificConfig: 5 bits object type (2 = AAC-LC), 4 bits sample-rate index
    // (3 = 48 kHz), 4 bits channel configuration (2 = stereo).
    let object_type = asc[0] >> 3;
    let sample_rate_index = ((asc[0] & 0b0000_0111) << 1) | (asc[1] >> 7);
    let channels = (asc[1] >> 3) & 0b0000_1111;
    assert_eq!(object_type, 2, "AAC-LC");
    assert_eq!(sample_rate_index, 3, "48 kHz");
    assert_eq!(channels, 2, "stereo");

    // And the NALUs are length-prefixed (avcC form), not Annex-B start codes — the
    // form WebCodecs gives us with `avc: { format: 'avc' }`, which is why `flv.rs`
    // does no conversion. An Annex-B fixture would start 00 00 00 01.
    let first_frame = tags
        .iter()
        .find(|tag| tag.tag_type == flv::TAG_TYPE_VIDEO && tag.body[1] == 1)
        .expect("no AVC NALU tag in the fixture");
    let payload = &first_frame.body[5..];
    let first_nalu_length =
        u32::from_be_bytes([payload[0], payload[1], payload[2], payload[3]]) as usize;
    assert!(
        first_nalu_length > 0 && first_nalu_length + 4 <= payload.len(),
        "first NALU length prefix {first_nalu_length} does not fit the payload — Annex-B?"
    );
}
