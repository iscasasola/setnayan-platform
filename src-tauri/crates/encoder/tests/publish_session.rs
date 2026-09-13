//! A REAL RTMP SERVER ON THE OTHER END — in memory, with no network.
//!
//! `RtmpSender::negotiate` takes any `AsyncRead + AsyncWrite`, so these tests hand it
//! one half of a `tokio::io::duplex` pipe and put `rml_rtmp`'s own `ServerSession` on
//! the other. That is a genuine RTMP peer: it does the server handshake, deserialises
//! our chunks, and raises the same events YouTube's ingest would act on. What it
//! proves is what a socket test would prove, minus the socket — no port, no TLS, no
//! flake, and it runs in CI on a machine with no ingest anywhere near it.
//!
//! The marathon test is the reason the whole file exists. RTMP chunk headers carry a
//! 24-bit timestamp; past 16,777,215 ms — **4 h 39 m 37 s** — every chunk must carry a
//! 32-bit extended timestamp instead. A wedding ceremony, reception and first dance
//! runs past that. The failure mode if it is wrong is the worst kind: four and a half
//! hours of perfect stream, and then a timestamp that jumps backwards by 4.6 hours in
//! front of everyone the couple invited.

use std::collections::VecDeque;
use std::time::Duration;

use rml_rtmp::chunk_io::ChunkSerializer;
use rml_rtmp::handshake::{Handshake, HandshakeProcessResult, PeerType};
use rml_rtmp::messages::{MessagePayload, RtmpMessage};
use rml_rtmp::sessions::{
    ServerSession, ServerSessionConfig, ServerSessionEvent, ServerSessionResult, StreamMetadata,
};
use rml_rtmp::time::RtmpTimestamp;
use tokio::io::{AsyncReadExt, AsyncWriteExt, DuplexStream};
use tokio::sync::mpsc;

use setnayan_encoder::contract::{ChunkHeader, ChunkKind, DecoderConfig, EncodedChunk};
use setnayan_encoder::flv::StreamMeta;
use setnayan_encoder::rtmp::{Redactor, RtmpEndpoint, MAX_INITIAL_TIMESTAMP_MS};
use setnayan_encoder::sender::{EndReason, RtmpSender, SenderError};
use setnayan_encoder::tagger::Pipeline;

const STREAM_KEY: &str = "abcd-efgh-ijkl-mnop-qrst";
const AVC_C: &[u8] = &[1, 0x42, 0xC0, 0x1F, 0xFF, 0xE1, 0x00, 0x04, 0x67, 0x42, 0xC0, 0x1F];
const ASC: &[u8] = &[0x11, 0x90];

/// What the fake ingest decides to do with the publish request.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Policy {
    Accept,
    RejectPublish,
}

/// What arrived, in order — enough to assert ordering without holding a five-hour
/// stream in memory.
#[derive(Debug, Default)]
struct IngestReport {
    /// The first tags seen, as `(kind, first two body bytes)`. `kind` is 'v' or 'a';
    /// the two bytes are the FLV tag header, which is what says "sequence header"
    /// (`0x17 0x00` / `0xAF 0x00`) versus "media" (`0x17/0x27 0x01` / `0xAF 0x01`).
    opening_tags: Vec<(char, u8, u8)>,
    metadata: Option<StreamMetadata>,
    video_tags: u64,
    audio_tags: u64,
    max_video_timestamp: u32,
    /// Any video timestamp that arrived lower than its predecessor. At the 24-bit
    /// boundary a truncating encoder produces exactly this, and nothing else does.
    backwards_timestamps: u64,
    /// Video timestamps past the 24-bit ceiling — i.e. carried by extended timestamps.
    extended_timestamps: u64,
}

const OPENING_TAGS_KEPT: usize = 8;

/// How long a whole publish may take before the test calls it stalled. See the note
/// at its use — the failure this catches is a hang, which no assertion can catch.
const RUN_BUDGET: Duration = Duration::from_secs(180);

/// The server side: handshake, `ServerSession`, accept or reject, record.
async fn fake_ingest(mut io: DuplexStream, policy: Policy) -> IngestReport {
    let mut report = IngestReport::default();
    let mut buffer = vec![0u8; 64 * 1024];

    // ── handshake ──────────────────────────────────────────────────────────────
    let mut handshake = Handshake::new(PeerType::Server);
    let leftover = loop {
        let count = match io.read(&mut buffer).await {
            Ok(0) | Err(_) => return report,
            Ok(count) => count,
        };
        match handshake.process_bytes(&buffer[..count]).expect("server handshake") {
            HandshakeProcessResult::InProgress { response_bytes } => {
                if io.write_all(&response_bytes).await.is_err() {
                    return report;
                }
            }
            HandshakeProcessResult::Completed { response_bytes, remaining_bytes } => {
                if io.write_all(&response_bytes).await.is_err() {
                    return report;
                }
                break remaining_bytes;
            }
        }
    };

    let (mut session, initial) =
        ServerSession::new(ServerSessionConfig::new()).expect("server session");
    // A QUEUE, NOT A STACK. RTMP compresses chunk headers against the previously sent
    // chunk on the same stream, so packets that go out in a different order than the
    // session produced them are undeserialisable at the far end. Popping from the back
    // of this list — the first way this test was written — makes the *client* fail with
    // `NoPreviousChunkOnStream`, which reads like a client bug and is not one.
    let mut pending: VecDeque<ServerSessionResult> = initial.into();
    let mut inbound = leftover;

    loop {
        if !inbound.is_empty() {
            let results = match session.handle_input(&inbound) {
                Ok(results) => results,
                Err(_) => return report,
            };
            inbound.clear();
            pending.extend(results);
        }

        // Drain everything the session produced, accepting requests as they appear.
        while let Some(result) = pending.pop_front() {
            match result {
                ServerSessionResult::OutboundResponse(packet) => {
                    if io.write_all(&packet.bytes).await.is_err() {
                        return report;
                    }
                }
                ServerSessionResult::RaisedEvent(event) => match event {
                    ServerSessionEvent::ConnectionRequested { request_id, .. } => {
                        pending.extend(session.accept_request(request_id).expect("accept connect"));
                    }
                    ServerSessionEvent::PublishStreamRequested { request_id, .. } => {
                        let results = match policy {
                            Policy::Accept => session.accept_request(request_id),
                            Policy::RejectPublish => session.reject_request(
                                request_id,
                                "NetStream.Publish.BadName",
                                // The ingest echoes the key back in its refusal. Real
                                // ones do this; it is the string most likely to leak.
                                &format!("stream key {STREAM_KEY} is not authorised"),
                            ),
                        };
                        pending.extend(results.expect("answer publish"));
                    }
                    ServerSessionEvent::StreamMetadataChanged { metadata, .. } => {
                        report.metadata = Some(metadata);
                    }
                    ServerSessionEvent::VideoDataReceived { data, timestamp, .. } => {
                        if report.opening_tags.len() < OPENING_TAGS_KEPT {
                            report.opening_tags.push(('v', data[0], data[1]));
                        }
                        report.video_tags += 1;
                        if timestamp.value < report.max_video_timestamp {
                            report.backwards_timestamps += 1;
                        }
                        if timestamp.value >= MAX_INITIAL_TIMESTAMP_MS {
                            report.extended_timestamps += 1;
                        }
                        report.max_video_timestamp =
                            report.max_video_timestamp.max(timestamp.value);
                    }
                    ServerSessionEvent::AudioDataReceived { data, .. } => {
                        if report.opening_tags.len() < OPENING_TAGS_KEPT {
                            report.opening_tags.push(('a', data[0], data[1]));
                        }
                        report.audio_tags += 1;
                    }
                    _ => {}
                },
                ServerSessionResult::UnhandleableMessageReceived(_) => {}
            }
        }

        let count = match io.read(&mut buffer).await {
            Ok(0) | Err(_) => return report,
            Ok(count) => count,
        };
        inbound.extend_from_slice(&buffer[..count]);
    }
}

fn endpoint() -> RtmpEndpoint {
    RtmpEndpoint::parse("rtmp://ingest.test/live2", Some(STREAM_KEY)).unwrap()
}

fn config_chunk(seq: u32, ts_us: u64) -> EncodedChunk {
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Config, keyframe: false, seq, ts_us },
        payload: DecoderConfig { avc_c: AVC_C.to_vec(), asc: ASC.to_vec() }.encode_payload(),
    }
}

fn video_chunk(seq: u32, ts_us: u64, keyframe: bool) -> EncodedChunk {
    // An avcC-form access unit: 4-byte big-endian length, then the NALU.
    let payload = vec![0, 0, 0, 4, if keyframe { 0x65 } else { 0x41 }, 1, 2, 3];
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Video, keyframe, seq, ts_us },
        payload,
    }
}

fn audio_chunk(seq: u32, ts_us: u64) -> EncodedChunk {
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Audio, keyframe: false, seq, ts_us },
        payload: vec![0x21, 0x10, 0x05, 0x00],
    }
}

/// Connect a sender to a fake ingest and hand back both sides' work.
async fn publish<F>(policy: Policy, produce: F) -> (Result<PublishRun, SenderError>, IngestReport)
where
    F: FnOnce(mpsc::Sender<EncodedChunk>) -> tokio::task::JoinHandle<()>,
{
    let (client_io, server_io) = tokio::io::duplex(64 * 1024);
    let ingest = tokio::spawn(fake_ingest(server_io, policy));

    let sender = RtmpSender::negotiate(
        Box::new(client_io),
        endpoint(),
        StreamMeta::defaults_720p30(),
        Redactor::new(STREAM_KEY),
    )
    .await;

    let outcome = match sender {
        Ok(sender) => {
            let (tx, mut rx) = mpsc::channel(256);
            let producer = produce(tx);
            // A BUDGET, BECAUSE THE FAILURE MODE HERE IS A HANG, NOT A PANIC.
            // If a chunk stream desynchronises, the ingest stops making sense of it
            // and stops reading; the sender then blocks forever on a full pipe and the
            // test never finishes. That was measured: sabotaging the extended-timestamp
            // branch in the vendored serializer turned this test from red into
            // *silent*, and a check that hangs is not a check. 180 s against a normal
            // run of ~35 s.
            let mut pipeline = Pipeline::streaming_only();
            let outcome = tokio::time::timeout(RUN_BUDGET, sender.run(&mut rx, &mut pipeline))
                .await
                .expect(
                    "the publish stalled — the ingest stopped reading, which is what a \
                     desynchronised chunk stream looks like from this side",
                );
            // DROP THE RECEIVER BEFORE WAITING ON THE PRODUCER. If the session ended
            // early — which is exactly what a failing guard causes — the producer is
            // parked on a full channel that nothing will ever drain again, and
            // `producer.await` waits for it forever. That is how the first version of
            // this helper turned a red test into a hang: everything parked, no CPU, no
            // timer pending, no output. Dropping `rx` makes the next `send` fail, which
            // every producer here treats as "stop".
            drop(rx);
            let _ = tokio::time::timeout(RUN_BUDGET, producer).await;
            Ok(PublishRun { outcome })
        }
        Err(error) => Err(error),
    };

    // The sender is dropped by now, so the ingest's read returns 0 and it reports.
    let report = tokio::time::timeout(Duration::from_secs(120), ingest)
        .await
        .expect("ingest did not finish")
        .expect("ingest task");
    (outcome, report)
}

struct PublishRun {
    outcome: setnayan_encoder::sender::SenderOutcome,
}

#[tokio::test]
async fn a_publish_session_sends_its_sequence_headers_before_any_media() {
    let (run, report) = publish(Policy::Accept, |tx| {
        tokio::spawn(async move {
            tx.send(config_chunk(0, 0)).await.unwrap();
            tx.send(video_chunk(1, 0, true)).await.unwrap();
            tx.send(audio_chunk(2, 21_333)).await.unwrap();
            tx.send(video_chunk(3, 33_366, false)).await.unwrap();
        })
    })
    .await;

    let run = run.expect("the ingest accepted the publish");
    assert!(matches!(run.outcome.reason, EndReason::ProducerFinished));
    assert_eq!(run.outcome.stats.video_tags, 2);
    assert_eq!(run.outcome.stats.audio_tags, 1);
    assert_eq!(run.outcome.stats.media_before_config, 0);

    // THE GUARD: the first video tag on the wire is the AVC sequence header
    // (0x17 0x00) and the first audio tag is the AAC sequence header (0xAF 0x00) —
    // before any tag whose second byte is 0x01. An ingest that receives a NALU first
    // has nothing to decode it with.
    assert_eq!(
        report.opening_tags,
        vec![
            ('v', 0x17, 0x00), // AVCDecoderConfigurationRecord
            ('a', 0xAF, 0x00), // AudioSpecificConfig
            ('v', 0x17, 0x01), // keyframe NALU
            ('a', 0xAF, 0x01), // raw AAC
            ('v', 0x27, 0x01), // inter-frame NALU
        ],
        "sequence headers must precede every media tag"
    );

    let metadata = report.metadata.expect("onMetaData reached the ingest");
    assert_eq!(metadata.video_codec_id, Some(7));
    assert_eq!(metadata.audio_codec_id, Some(10));
    assert_eq!(metadata.audio_sample_rate, Some(48_000));
    assert_eq!(metadata.video_width, Some(1280));
}

#[tokio::test]
async fn media_that_arrives_before_the_configuration_is_dropped_and_counted() {
    let (run, report) = publish(Policy::Accept, |tx| {
        tokio::spawn(async move {
            // Undecodable by definition — there is no avcC yet.
            tx.send(video_chunk(0, 0, true)).await.unwrap();
            tx.send(audio_chunk(1, 0)).await.unwrap();
            tx.send(config_chunk(2, 0)).await.unwrap();
            tx.send(video_chunk(3, 33_366, true)).await.unwrap();
        })
    })
    .await;

    let run = run.expect("accepted");
    assert_eq!(run.outcome.stats.media_before_config, 2, "counted, not silently swallowed");
    assert_eq!(run.outcome.stats.video_tags, 1, "only the post-config frame was sent");
    assert_eq!(report.opening_tags[0], ('v', 0x17, 0x00), "the wire still opens with the avcC");
}

#[tokio::test]
async fn a_refused_publish_reports_the_ingest_reason_with_the_key_scrubbed_out() {
    let (run, _) = publish(Policy::RejectPublish, |tx| {
        tokio::spawn(async move {
            drop(tx);
        })
    })
    .await;

    let error = run.err().expect("a rejected publish must not look like success");
    let text = format!("{error}");
    assert!(
        matches!(error, SenderError::Rejected { .. }),
        "expected a rejection, got {error:?}"
    );
    assert!(
        text.contains("not authorised"),
        "the ingest's own words must survive: {text}"
    );
    assert!(
        !text.contains(STREAM_KEY),
        "THE STREAM KEY REACHED AN ERROR STRING: {text}"
    );
    assert!(text.contains("****"), "the key should be visibly redacted: {text}");
}

/// FOUR HOURS FORTY-FIVE MINUTES, in a couple of seconds.
///
/// 30 fps video and 100 ms audio bundles for 17,100 s of stream time — 513,000 video
/// tags — pushed through the real sender, the real chunk serializer, a real
/// `ServerSession` and its deserializer. Timestamps only: the payloads are eight bytes,
/// because what is under test is the clock and the chunk header, not throughput.
///
/// The assertion that matters is `max_video_timestamp`. If anything in the path
/// truncated to 24 bits, the ingest would report 16,777,215 and a pile of backwards
/// steps. It reports 17,099,966 and none.
#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_four_hour_forty_five_minute_stream_crosses_the_24_bit_boundary_intact() {
    const STREAM_SECONDS: u64 = 4 * 3600 + 45 * 60; // 17,100
    const VIDEO_FRAMES: u64 = STREAM_SECONDS * 30;
    const AUDIO_BUNDLES: u64 = STREAM_SECONDS * 10;

    let (run, report) = publish(Policy::Accept, |tx| {
        tokio::spawn(async move {
            tx.send(config_chunk(0, 0)).await.unwrap();
            let mut seq = 1u32;
            let mut next_audio = 0u64;
            for frame in 0..VIDEO_FRAMES {
                let ts_us = frame * 1_000_000 / 30;
                // A keyframe every 2 s, as the encoder will send.
                if tx.send(video_chunk(seq, ts_us, frame % 60 == 0)).await.is_err() {
                    return;
                }
                seq = seq.wrapping_add(1);
                while next_audio < AUDIO_BUNDLES && next_audio * 100_000 <= ts_us {
                    if tx.send(audio_chunk(seq, next_audio * 100_000)).await.is_err() {
                        return;
                    }
                    seq = seq.wrapping_add(1);
                    next_audio += 1;
                }
            }
        })
    })
    .await;

    let run = run.expect("accepted");
    let stats = run.outcome.stats;
    assert_eq!(stats.video_tags, VIDEO_FRAMES, "every video frame was published");
    assert_eq!(stats.audio_tags, AUDIO_BUNDLES, "every audio bundle was published");
    assert_eq!(stats.clamped_timestamps, 0, "a synthetic stream never goes backwards");
    assert!(stats.past_24_bit_ceiling, "the sender knows it crossed the ceiling");

    // +1: the AVC sequence header is a video tag on the wire too.
    assert_eq!(report.video_tags, VIDEO_FRAMES + 1, "and every one of them arrived");
    assert_eq!(report.audio_tags, AUDIO_BUNDLES + 1, "audio likewise, plus its config");
    assert_eq!(report.backwards_timestamps, 0, "no timestamp went backwards at the boundary");

    // 4 h 39 m 37 s is at frame 503,316; everything after it needs an extended timestamp.
    let expected_max = ((VIDEO_FRAMES - 1) * 1_000_000 / 30 / 1_000) as u32;
    assert_eq!(
        report.max_video_timestamp, expected_max,
        "the last frame's timestamp survived the trip"
    );
    assert!(
        expected_max > MAX_INITIAL_TIMESTAMP_MS,
        "the fixture must actually cross the boundary or it proves nothing"
    );
    assert!(
        report.extended_timestamps > 9_000,
        "only {} tags past the ceiling — the boundary was barely crossed",
        report.extended_timestamps
    );
}

/// The same boundary, one layer down and byte-exact.
///
/// The end-to-end test above can only pass if extended timestamps are written and read
/// correctly, but it cannot show you the bytes. This one does: at 16,777,215 ms the
/// chunk header's 24-bit field is saturated to `FF FF FF` and a four-byte extended
/// timestamp follows it. That encoding is what the vendored serializer owns, and this
/// is the assertion that would notice if a future vendor bump changed it.
#[test]
fn the_chunk_header_saturates_and_then_carries_a_32_bit_extended_timestamp() {
    fn first_chunk_of(timestamp_ms: u32) -> Vec<u8> {
        let mut serializer = ChunkSerializer::new();
        let payload = MessagePayload::from_rtmp_message(
            RtmpMessage::VideoData { data: vec![0xAA].into() },
            RtmpTimestamp::new(timestamp_ms),
            1,
        )
        .unwrap();
        serializer.serialize(&payload, true, false).unwrap().bytes
    }

    // A type-0 chunk header: 1 byte basic header, 3 bytes timestamp, 3 length,
    // 1 type id, 4 stream id, then the extended timestamp when it is present.
    let below = first_chunk_of(MAX_INITIAL_TIMESTAMP_MS - 1);
    assert_eq!(&below[1..4], &[0xFF, 0xFF, 0xFE], "the timestamp fits in 24 bits");
    assert_eq!(below.len(), 12 + 1, "no extended timestamp field");

    let at = first_chunk_of(MAX_INITIAL_TIMESTAMP_MS);
    assert_eq!(&at[1..4], &[0xFF, 0xFF, 0xFF], "saturated");
    assert_eq!(&at[12..16], &0x00FF_FFFFu32.to_be_bytes(), "extended timestamp");

    let past = first_chunk_of(17_099_966);
    assert_eq!(&past[1..4], &[0xFF, 0xFF, 0xFF], "still saturated");
    assert_eq!(&past[12..16], &17_099_966u32.to_be_bytes(), "the real value, 32 bits wide");
}
