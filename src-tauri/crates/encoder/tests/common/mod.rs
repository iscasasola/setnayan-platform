//! A REAL RTMP SERVER THAT CAN DIE ON CUE.
//!
//! `publish_session.rs` proves one healthy publish against `rml_rtmp`'s own
//! `ServerSession` over an in-memory pipe. S7's subject is what happens when that pipe
//! BREAKS, so this harness adds the two things the reconnect tests need and the
//! original did not: an ingest that hangs up after a chosen number of media tags, and
//! a report that keeps every tag body rather than just the opening few — because the
//! recording guard compares the file's bytes against the wire's bytes, and "equal" is
//! not a claim you can make about a summary.
//!
//! It is still a genuine RTMP peer: real handshake, real chunk deserialisation, real
//! events. What a socket test would prove, minus the socket.

#![allow(dead_code)]

use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use rml_rtmp::handshake::{Handshake, HandshakeProcessResult, PeerType};
use rml_rtmp::sessions::{
    ServerSession, ServerSessionConfig, ServerSessionEvent, ServerSessionResult, StreamMetadata,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt, DuplexStream};
use tokio::task::JoinHandle;

use setnayan_encoder::contract::{ChunkHeader, ChunkKind, DecoderConfig, EncodedChunk};
use setnayan_encoder::flv::StreamMeta;
use setnayan_encoder::reconnect::Connector;
use setnayan_encoder::rtmp::{Redactor, RtmpEndpoint};
use setnayan_encoder::sender::{RtmpSender, SenderError};

pub const STREAM_KEY: &str = "abcd-efgh-ijkl-mnop-qrst";
pub const AVC_C: &[u8] = &[1, 0x42, 0xC0, 0x1F, 0xFF, 0xE1, 0x00, 0x04, 0x67, 0x42, 0xC0, 0x1F];
pub const ASC: &[u8] = &[0x11, 0x90];

pub const PRIMARY_HOST: &str = "a.rtmps.youtube.com";
pub const BACKUP_HOST: &str = "b.rtmps.youtube.com";

/// One tag as the ingest received it: track, timestamp, and the FULL body.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WireTag {
    pub track: char,
    pub timestamp_ms: u32,
    pub body: Vec<u8>,
}

impl WireTag {
    pub fn is_sequence_header(&self) -> bool {
        self.body.get(1) == Some(&0)
    }

    pub fn is_video_keyframe(&self) -> bool {
        self.track == 'v' && !self.is_sequence_header() && self.body.first().map(|b| b >> 4) == Some(1)
    }
}

#[derive(Debug, Default)]
pub struct IngestReport {
    pub tags: Vec<WireTag>,
    pub metadata: Option<StreamMetadata>,
    pub accepted_publish: bool,
}

impl IngestReport {
    pub fn media(&self) -> Vec<&WireTag> {
        self.tags.iter().filter(|tag| !tag.is_sequence_header()).collect()
    }

    pub fn sequence_headers(&self) -> Vec<&WireTag> {
        self.tags.iter().filter(|tag| tag.is_sequence_header()).collect()
    }

    pub fn max_timestamp(&self) -> u32 {
        self.tags.iter().map(|tag| tag.timestamp_ms).max().unwrap_or(0)
    }
}

/// What the fake ingest does with the publish request, and how long it lives.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Policy {
    /// Accept and stay up until the client goes away.
    Accept,
    /// Accept, then hang up after this many MEDIA tags — a venue's wifi dropping
    /// mid-ceremony, which is the event this whole session exists for.
    AcceptThenDrop(usize),
    /// Refuse the publish, the way an ingest answers a key it does not know or a
    /// broadcast that has already ended.
    RejectPublish,
}

/// The server side: handshake, `ServerSession`, accept or reject, record, maybe die.
pub async fn fake_ingest(mut io: DuplexStream, policy: Policy) -> IngestReport {
    let mut report = IngestReport::default();
    let mut buffer = vec![0u8; 64 * 1024];
    let mut media_seen = 0usize;

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
    // A QUEUE, NOT A STACK — RTMP compresses chunk headers against the previously sent
    // chunk on the same stream, so reordering the session's own output is
    // undeserialisable at the far end. (Learned the hard way in publish_session.rs.)
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
                            Policy::RejectPublish => session.reject_request(
                                request_id,
                                "NetStream.Publish.BadName",
                                // Real ingests echo the key back in the refusal; it is
                                // the string most likely to leak.
                                &format!("stream key {STREAM_KEY} is not authorised"),
                            ),
                            _ => {
                                report.accepted_publish = true;
                                session.accept_request(request_id)
                            }
                        };
                        pending.extend(results.expect("answer publish"));
                    }
                    ServerSessionEvent::StreamMetadataChanged { metadata, .. } => {
                        report.metadata = Some(metadata);
                    }
                    ServerSessionEvent::VideoDataReceived { data, timestamp, .. } => {
                        let tag = WireTag {
                            track: 'v',
                            timestamp_ms: timestamp.value,
                            body: data.to_vec(),
                        };
                        let is_media = !tag.is_sequence_header();
                        report.tags.push(tag);
                        if is_media {
                            media_seen += 1;
                            if let Policy::AcceptThenDrop(limit) = policy {
                                if media_seen >= limit {
                                    // THE WIFI DROPS. Returning drops `io`, the client's
                                    // next read returns 0, and the sender ends with
                                    // PeerClosed — exactly what a real cable-pull does.
                                    return report;
                                }
                            }
                        }
                    }
                    ServerSessionEvent::AudioDataReceived { data, timestamp, .. } => {
                        let tag = WireTag {
                            track: 'a',
                            timestamp_ms: timestamp.value,
                            body: data.to_vec(),
                        };
                        let is_media = !tag.is_sequence_header();
                        report.tags.push(tag);
                        if is_media {
                            media_seen += 1;
                            if let Policy::AcceptThenDrop(limit) = policy {
                                if media_seen >= limit {
                                    return report;
                                }
                            }
                        }
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

/// What one connection attempt should do.
#[derive(Clone, Copy, Debug)]
pub enum Attempt {
    /// The connect itself fails — no route, no DNS, no wifi.
    Unreachable,
    /// A live ingest with this policy.
    Ingest(Policy),
}

/// A `Connector` that follows a script, so a test can stage an outage precisely.
///
/// It records the HOST of every attempt, which is how the backup-alternation guard is
/// asserted without a second YouTube account.
pub struct ScriptedConnector {
    plan: Mutex<VecDeque<Attempt>>,
    pub attempted_hosts: Arc<Mutex<Vec<String>>>,
    ingests: Arc<Mutex<Vec<JoinHandle<IngestReport>>>>,
}

impl ScriptedConnector {
    pub fn new(plan: impl IntoIterator<Item = Attempt>) -> ScriptedConnector {
        ScriptedConnector {
            plan: Mutex::new(plan.into_iter().collect()),
            attempted_hosts: Arc::new(Mutex::new(Vec::new())),
            ingests: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn hosts(&self) -> Vec<String> {
        self.attempted_hosts.lock().unwrap().clone()
    }

    /// Every ingest that ran, in the order they were opened.
    pub async fn reports(&self) -> Vec<IngestReport> {
        let handles: Vec<_> = std::mem::take(&mut *self.ingests.lock().unwrap());
        let mut reports = Vec::new();
        for handle in handles {
            reports.push(handle.await.expect("ingest task"));
        }
        reports
    }
}

impl Connector for ScriptedConnector {
    async fn connect(
        &self,
        endpoint: RtmpEndpoint,
        meta: StreamMeta,
    ) -> Result<RtmpSender, SenderError> {
        // Both guards are scoped so neither is held across an await — a
        // `std::sync::MutexGuard` alive over one would make this future non-Send and
        // the trait's `+ Send` bound would refuse it.
        let attempt = { self.plan.lock().unwrap().pop_front() };
        self.attempted_hosts.lock().unwrap().push(endpoint.host.clone());

        match attempt.unwrap_or(Attempt::Unreachable) {
            Attempt::Unreachable => {
                Err(SenderError::Connect("no route to the ingest (scripted)".to_string()))
            }
            Attempt::Ingest(policy) => {
                let (client_io, server_io) = tokio::io::duplex(256 * 1024);
                let handle = tokio::spawn(fake_ingest(server_io, policy));
                self.ingests.lock().unwrap().push(handle);
                RtmpSender::negotiate(
                    Box::new(client_io),
                    endpoint,
                    meta,
                    Redactor::new(STREAM_KEY),
                )
                .await
            }
        }
    }
}

// ── chunk builders ──────────────────────────────────────────────────────────

pub fn config_chunk(seq: u32, ts_us: u64) -> EncodedChunk {
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Config, keyframe: false, seq, ts_us },
        payload: DecoderConfig { avc_c: AVC_C.to_vec(), asc: ASC.to_vec() }.encode_payload(),
    }
}

pub fn video_chunk(seq: u32, ts_us: u64, keyframe: bool) -> EncodedChunk {
    // An avcC-form access unit: 4-byte big-endian length, then the NALU.
    let payload = vec![0, 0, 0, 4, if keyframe { 0x65 } else { 0x41 }, 1, 2, 3];
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Video, keyframe, seq, ts_us },
        payload,
    }
}

pub fn audio_chunk(seq: u32, ts_us: u64) -> EncodedChunk {
    EncodedChunk {
        header: ChunkHeader { kind: ChunkKind::Audio, keyframe: false, seq, ts_us },
        payload: vec![0x21, 0x10, 0x05, 0x00],
    }
}

pub fn destinations(with_backup: bool) -> setnayan_encoder::reconnect::Destinations {
    let primary =
        RtmpEndpoint::parse(&format!("rtmp://{PRIMARY_HOST}/live2"), Some(STREAM_KEY)).unwrap();
    match with_backup {
        true => setnayan_encoder::reconnect::Destinations::with_backup(
            primary,
            RtmpEndpoint::parse(&format!("rtmp://{BACKUP_HOST}/live2"), Some(STREAM_KEY)).unwrap(),
        ),
        false => setnayan_encoder::reconnect::Destinations::new(primary),
    }
}

/// A retry policy with the same SHAPE as production and a hundredth of the wall clock,
/// so a test that stages four outages finishes in milliseconds. The real 1/2/4/5 s
/// sequence and the 5 s cap are asserted directly in `reconnect.rs`'s unit tests —
/// this exists so the integration tests exercise the state machine, not the sleeps.
pub fn fast_policy() -> setnayan_encoder::reconnect::RetryPolicy {
    setnayan_encoder::reconnect::RetryPolicy {
        base: std::time::Duration::from_millis(10),
        cap: std::time::Duration::from_millis(50),
        grace: std::time::Duration::from_millis(400),
        give_up_after: Some(std::time::Duration::from_secs(20)),
    }
}

// ── reading a recording back ────────────────────────────────────────────────

/// Parse an `.flv` the way a player would, so the recording guard checks the FILE
/// rather than the writer's opinion of the file.
///
/// Deliberately independent of `flv::wrap_tag`: it walks `PreviousTagSize` and
/// re-derives each timestamp from the 24-bit field plus the extended byte. A parser
/// that reused the writer's code would agree with a writer that was wrong.
pub fn parse_flv(bytes: &[u8]) -> Vec<WireTag> {
    assert_eq!(&bytes[..3], b"FLV", "not an FLV file");
    let data_offset = u32::from_be_bytes([bytes[5], bytes[6], bytes[7], bytes[8]]) as usize;
    let mut cursor = data_offset + 4; // skip PreviousTagSize0
    let mut tags = Vec::new();
    while cursor + 11 <= bytes.len() {
        let tag_type = bytes[cursor];
        let size =
            u32::from_be_bytes([0, bytes[cursor + 1], bytes[cursor + 2], bytes[cursor + 3]]) as usize;
        if cursor + 11 + size + 4 > bytes.len() {
            break;
        }
        let timestamp_ms = u32::from_be_bytes([
            bytes[cursor + 7], // TimestampExtended is the HIGH byte
            bytes[cursor + 4],
            bytes[cursor + 5],
            bytes[cursor + 6],
        ]);
        let body = bytes[cursor + 11..cursor + 11 + size].to_vec();
        let track = match tag_type {
            9 => 'v',
            8 => 'a',
            _ => 's',
        };
        if track != 's' {
            tags.push(WireTag { track, timestamp_ms, body });
        }
        cursor += 11 + size + 4;
    }
    tags
}

/// A temporary directory that removes itself, so a failed assertion does not leave a
/// pile of `.flv` files in the temp dir for the next month.
pub struct TempDir {
    pub path: std::path::PathBuf,
}

impl TempDir {
    pub fn new(label: &str) -> TempDir {
        let path = std::env::temp_dir().join(format!(
            "s7-{label}-{}-{:?}",
            std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()
        ));
        std::fs::create_dir_all(&path).expect("temp dir");
        TempDir { path }
    }

    pub fn join(&self, name: &str) -> std::path::PathBuf {
        self.path.join(name)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}
