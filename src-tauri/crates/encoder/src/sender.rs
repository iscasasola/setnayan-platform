//! THE SOCKET — RTMP inside TLS, to YouTube, for as long as the wedding lasts.
//!
//! Everything above this file is pure: bytes in, bytes out, testable without a
//! network. This is where that stops. It owns exactly four things — the TLS
//! connection, the RTMP handshake and publish negotiation, the order tags go out in,
//! and the promise that no string it produces contains the stream key.
//!
//! WHAT IT DELIBERATELY DOES NOT OWN — **reconnect is `reconnect.rs`'s**. When this
//! session ends it returns a [`SenderOutcome`] saying why and what it had sent, and
//! stops. It does not retry, does not fall back to the backup ingest, does not decide
//! whether losing the connection at 19:40 on a Saturday should interrupt the couple's
//! ceremony. Those are policy, and a reconnect loop grown quietly inside a send path is
//! the shape that makes them impossible to change later. The seam is `run()` returning
//! rather than looping.
//!
//! NOR DOES IT OWN THE BYTES ANY MORE (changed by S7). It used to hold the `RtmpClock`
//! and build every FLV tag itself. Both moved up into `tagger::Pipeline`, because a
//! reconnect is a NEW `RtmpSender` and a clock that died with the socket restarted the
//! stream's timeline at zero after four hours — and because the local recording has to
//! keep growing during exactly the window when no sender exists. This file now
//! receives finished [`TaggedFrame`]s and puts them on the wire in order.
//!
//! THE ONE ORDERING RULE. An ingest cannot decode a single frame until it has the
//! AVC and AAC sequence headers, so they go out before any media tag, always. Media
//! that arrives before the configuration is **dropped and counted**, not buffered and
//! not sent: it is undecodable by definition, and a buffer here would trade a counted
//! defect for an uncounted memory leak.

use std::sync::Arc;
use std::time::Duration;

use rml_rtmp::handshake::{Handshake, HandshakeProcessResult, PeerType};
use rml_rtmp::rml_amf0::Amf0Value;
use rml_rtmp::sessions::{
    ClientSession, ClientSessionConfig, ClientSessionEvent, ClientSessionResult, PublishRequestType,
};
use rml_rtmp::time::RtmpTimestamp;
use tokio::io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt, ReadHalf, WriteHalf};
use tokio::net::TcpStream;
use tokio::sync::mpsc;

use super::contract::EncodedChunk;
use super::flv::StreamMeta;
use super::rtmp::{Redactor, RtmpEndpoint, Track};
use super::tagger::{Pipeline, TaggedFrame};

/// Anything we can speak RTMP over: a plain TCP stream, a TLS stream, or — in tests —
/// an in-memory duplex pipe with a real `ServerSession` on the far end.
pub trait Io: AsyncRead + AsyncWrite + Unpin + Send {}
impl<T: AsyncRead + AsyncWrite + Unpin + Send> Io for T {}

/// How long any one negotiation step may take before we call it dead.
///
/// A live encoder must fail fast and say so: a stalled TCP connect with no timeout is
/// a "Connecting…" spinner that never resolves while a ceremony happens in front of
/// a camera nobody is watching. 15 s is generous for an ingest and short enough that
/// the operator still has time to react.
pub const NEGOTIATION_TIMEOUT: Duration = Duration::from_secs(15);

/// Read buffer for inbound RTMP. The server sends acknowledgements, pings and the
/// occasional command — small, but it MUST be drained: an undrained receive buffer
/// eventually stalls the peer's window and takes the outbound direction down with it.
const READ_BUFFER: usize = 8 * 1024;

#[derive(Debug)]
pub enum SenderError {
    Connect(String),
    Tls(String),
    Handshake(String),
    Protocol(String),
    /// The ingest said no. `description` is the server's own words — scrubbed, because
    /// some ingests echo the stream key back inside the rejection.
    Rejected { description: String },
    /// A negotiation step ran past [`NEGOTIATION_TIMEOUT`].
    Timeout { stage: &'static str },
    /// The peer closed while we were still negotiating.
    PeerClosed { stage: &'static str },
    Chunk(String),
}

impl std::fmt::Display for SenderError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SenderError::Connect(detail) => write!(f, "could not reach the ingest: {detail}"),
            SenderError::Tls(detail) => write!(f, "TLS to the ingest failed: {detail}"),
            SenderError::Handshake(detail) => write!(f, "RTMP handshake failed: {detail}"),
            SenderError::Protocol(detail) => write!(f, "RTMP error: {detail}"),
            SenderError::Rejected { description } => {
                write!(f, "the ingest refused to publish: {description}")
            }
            SenderError::Timeout { stage } => {
                write!(f, "the ingest did not answer in time ({stage})")
            }
            SenderError::PeerClosed { stage } => {
                write!(f, "the ingest closed the connection ({stage})")?;
                if *stage == "publish" {
                    // Measured against YouTube's real ingest on 2026-09-05: an
                    // unrecognised stream key is not refused with a message, it is a
                    // silent close at exactly this stage. Saying so is the difference
                    // between an operator checking their key and an operator checking
                    // the venue's Wi-Fi.
                    write!(f, " — most often an unrecognised, expired or already-live stream key")?;
                }
                Ok(())
            }
            SenderError::Chunk(detail) => write!(f, "malformed encoder chunk: {detail}"),
        }
    }
}

impl std::error::Error for SenderError {}

/// What one publishing session did. S7 reads this to decide what happens next.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct SenderStats {
    pub video_tags: u64,
    pub audio_tags: u64,
    pub bytes_published: u64,
    /// Media chunks that arrived before the decoder configuration and were dropped.
    /// Non-zero means the producer sent media before config — a bug upstream, not here.
    ///
    /// ⚠ CUMULATIVE ACROSS SESSIONS since S7, not per-session: it is counted by the
    /// `Tagger`, which outlives any one connection. Same for `clamped_timestamps` and
    /// `past_24_bit_ceiling`. The tag and byte counters below are still per-session —
    /// they are what THIS socket carried.
    pub media_before_config: u64,
    /// Chunks whose timestamp went backwards and were clamped (see `RtmpClock`).
    pub clamped_timestamps: u64,
    /// True once this stream has passed RTMP's 24-bit chunk-timestamp ceiling —
    /// 4 h 39 m 37 s — and is running on extended timestamps for real.
    pub past_24_bit_ceiling: bool,
}

/// Why a session stopped. **This enum is the reconnect seam.** S7 matches on it.
#[derive(Debug)]
pub enum EndReason {
    /// The producer closed the channel — a normal stop, the stream is over.
    ProducerFinished,
    /// The connection or the protocol failed. S7 decides whether to reconnect, and
    /// whether to move to the backup ingest.
    Failed(SenderError),
}

#[derive(Debug)]
pub struct SenderOutcome {
    pub stats: SenderStats,
    pub reason: EndReason,
}

/// What `run`'s `select!` resolved to. Named so the futures can be dropped before
/// the work happens — see the comment in `run`.
enum Step {
    Produced(Option<EncodedChunk>),
    Inbound(std::io::Result<usize>),
}

/// A connected, publishing RTMP session.
pub struct RtmpSender {
    read: ReadHalf<Box<dyn Io>>,
    write: WriteHalf<Box<dyn Io>>,
    session: ClientSession,
    endpoint: RtmpEndpoint,
    redactor: Redactor,
    meta: StreamMeta,
    stats: SenderStats,
}

impl RtmpSender {
    /// Open the connection and complete the RTMP handshake, `connect` and `publish`
    /// negotiation. Returns a session ready for [`run`](Self::run).
    pub async fn connect(endpoint: RtmpEndpoint, meta: StreamMeta) -> Result<RtmpSender, SenderError> {
        let redactor = endpoint.redactor();
        let address = endpoint.socket_address();

        let stream = tokio::time::timeout(NEGOTIATION_TIMEOUT, TcpStream::connect(&address))
            .await
            .map_err(|_| SenderError::Timeout { stage: "tcp connect" })?
            .map_err(|error| SenderError::Connect(redactor.scrub(&error.to_string())))?;
        // Live video in small tags: Nagle would hold frames back waiting for company.
        stream
            .set_nodelay(true)
            .map_err(|error| SenderError::Connect(redactor.scrub(&error.to_string())))?;

        let io: Box<dyn Io> = if endpoint.tls {
            Box::new(wrap_tls(stream, &endpoint.host, &redactor).await?)
        } else {
            Box::new(stream)
        };

        RtmpSender::negotiate(io, endpoint, meta, redactor).await
    }

    /// The transport-free half of `connect`, so the whole negotiation can be tested
    /// against a real `ServerSession` over an in-memory pipe — no sockets, no TLS,
    /// no network in the test suite.
    pub async fn negotiate(
        io: Box<dyn Io>,
        endpoint: RtmpEndpoint,
        meta: StreamMeta,
        redactor: Redactor,
    ) -> Result<RtmpSender, SenderError> {
        let (read, write) = tokio::io::split(io);

        let mut config = ClientSessionConfig::new();
        config.tc_url = Some(endpoint.tc_url());
        let (session, initial) = ClientSession::new(config)
            .map_err(|error| SenderError::Protocol(redactor.scrub(&format!("{error:?}"))))?;

        let mut sender = RtmpSender {
            read,
            write,
            session,
            endpoint,
            redactor,
            meta,
            stats: SenderStats::default(),
        };
        sender.write_results(initial).await?;
        sender.handshake().await?;

        let app = sender.endpoint.app.clone();
        let result = sender
            .session
            .request_connection(app)
            .map_err(|error| sender.protocol_error(&format!("{error:?}")))?;
        sender.write_results(vec![result]).await?;
        sender.await_event("connect", |event| match event {
            ClientSessionEvent::ConnectionRequestAccepted => Some(Ok(())),
            ClientSessionEvent::ConnectionRequestRejected { description } => {
                Some(Err(description.clone()))
            }
            _ => None,
        })
        .await?;

        let stream_key = sender.endpoint.stream_key.clone();
        let result = sender
            .session
            .request_publishing(stream_key, PublishRequestType::Live)
            .map_err(|error| sender.protocol_error(&format!("{error:?}")))?;
        sender.write_results(vec![result]).await?;
        sender.await_event("publish", |event| match event {
            ClientSessionEvent::PublishRequestAccepted => Some(Ok(())),
            ClientSessionEvent::ConnectionRequestRejected { description } => {
                Some(Err(description.clone()))
            }
            ClientSessionEvent::UnhandleableOnStatusCode { code } => Some(Err(code.clone())),
            // A REFUSED PUBLISH ARRIVES HERE, not as a named rejection event.
            // The ingest answers `_error` with transaction id 0, which belongs to no
            // outstanding transaction, so the session raises this instead. Measured
            // against a real `ServerSession` in `tests/publish_session.rs`: without
            // this arm a rejected stream key waits out the full 15 s timeout and is
            // reported as "the ingest did not answer in time" — the operator is told
            // the network is slow when in fact their key is wrong.
            ClientSessionEvent::UnknownTransactionResultReceived { additional_values, .. } => {
                Some(Err(describe_status(additional_values)))
            }
            _ => None,
        })
        .await?;

        let metadata = sender.meta.to_rml_metadata();
        let result = sender
            .session
            .publish_metadata(&metadata)
            .map_err(|error| sender.protocol_error(&format!("{error:?}")))?;
        sender.write_results(vec![result]).await?;

        Ok(sender)
    }

    /// The destination, in the only form that may be printed.
    pub fn redacted_url(&self) -> String {
        self.endpoint.redacted_url()
    }

    pub fn stats(&self) -> SenderStats {
        self.stats.clone()
    }

    /// Publish until the producer stops or the connection fails.
    ///
    /// One task owns both directions: the `select!` writes what the encoder produced
    /// and drains what the ingest sent, and because both branches run in the same task
    /// the RTMP session needs no lock. Draining is not optional — an ingest whose
    /// acknowledgements are never read will eventually stop reading ours.
    pub async fn run(
        mut self,
        chunks: &mut mpsc::Receiver<EncodedChunk>,
        pipeline: &mut Pipeline,
    ) -> SenderOutcome {
        let mut buffer = vec![0u8; READ_BUFFER];
        loop {
            // The `select!` resolves to a value and ENDS, so both futures — and the
            // borrows of `self` and `buffer` they hold — are gone before the step is
            // acted on. Doing the work inside a branch arm instead is what forces the
            // buffer copy that this shape avoids.
            let step = tokio::select! {
                received = chunks.recv() => Step::Produced(received),
                read = self.read.read(&mut buffer) => Step::Inbound(read),
            };

            match step {
                Step::Produced(Some(chunk)) => {
                    if let Err(error) = self.publish_chunk(&chunk, pipeline).await {
                        return self.finish(EndReason::Failed(error), pipeline);
                    }
                }
                Step::Produced(None) => return self.finish(EndReason::ProducerFinished, pipeline),
                Step::Inbound(Ok(0)) => {
                    return self.finish(
                        EndReason::Failed(SenderError::PeerClosed { stage: "publishing" }),
                        pipeline,
                    );
                }
                Step::Inbound(Ok(count)) => {
                    if let Err(error) = self.handle_inbound(&buffer[..count]).await {
                        return self.finish(EndReason::Failed(error), pipeline);
                    }
                }
                Step::Inbound(Err(error)) => {
                    let detail = self.redactor.scrub(&error.to_string());
                    return self
                        .finish(EndReason::Failed(SenderError::Connect(detail)), pipeline);
                }
            }
        }
    }

    /// One chunk from the producer → the recording, then the wire.
    ///
    /// The pipeline does the tagging and the recording and hands back only the frames
    /// THIS session may send — after a reconnect that is fewer than it recorded, because
    /// the new ingest cannot decode inter-frames it has no reference for. See
    /// `tagger::WireGate`.
    async fn publish_chunk(
        &mut self,
        chunk: &EncodedChunk,
        pipeline: &mut Pipeline,
    ) -> Result<(), SenderError> {
        let frames = pipeline
            .ingest(chunk)
            .map_err(|error| SenderError::Chunk(error.to_string()))?;
        for frame in &frames {
            self.publish_frame(frame).await?;
        }
        Ok(())
    }

    /// Put one finished tag on the wire, on its own track's chunk stream.
    async fn publish_frame(&mut self, frame: &TaggedFrame) -> Result<(), SenderError> {
        match frame.track {
            Track::Video => {
                self.publish_video(&frame.body, frame.timestamp_ms, frame.can_be_dropped)
                    .await?;
                if !frame.is_sequence_header() {
                    self.stats.video_tags += 1;
                }
            }
            Track::Audio => {
                self.publish_audio(&frame.body, frame.timestamp_ms).await?;
                if !frame.is_sequence_header() {
                    self.stats.audio_tags += 1;
                }
            }
        }
        Ok(())
    }

    async fn publish_video(
        &mut self,
        tag: &[u8],
        timestamp_ms: u32,
        can_be_dropped: bool,
    ) -> Result<(), SenderError> {
        let result = self
            .session
            .publish_video_data(
                bytes::Bytes::copy_from_slice(tag),
                RtmpTimestamp::new(timestamp_ms),
                can_be_dropped,
            )
            .map_err(|error| self.protocol_error(&format!("{error:?}")))?;
        self.write_results(vec![result]).await
    }

    /// Audio tags are **never** marked droppable. Video can lose a frame and recover;
    /// audio that goes missing is what the couple hears in the archive forever.
    async fn publish_audio(&mut self, tag: &[u8], timestamp_ms: u32) -> Result<(), SenderError> {
        let result = self
            .session
            .publish_audio_data(
                bytes::Bytes::copy_from_slice(tag),
                RtmpTimestamp::new(timestamp_ms),
                false,
            )
            .map_err(|error| self.protocol_error(&format!("{error:?}")))?;
        self.write_results(vec![result]).await
    }

    async fn handle_inbound(&mut self, bytes: &[u8]) -> Result<(), SenderError> {
        let results = self
            .session
            .handle_input(bytes)
            .map_err(|error| self.protocol_error(&format!("{error:?}")))?;
        self.write_results(results).await
    }

    async fn handshake(&mut self) -> Result<(), SenderError> {
        let mut handshake = Handshake::new(PeerType::Client);
        let opening = handshake
            .generate_outbound_p0_and_p1()
            .map_err(|error| self.handshake_error(&format!("{error:?}")))?;
        self.write_all(&opening).await?;

        let mut buffer = vec![0u8; READ_BUFFER];
        let leftover = loop {
            let count = tokio::time::timeout(NEGOTIATION_TIMEOUT, self.read.read(&mut buffer))
                .await
                .map_err(|_| SenderError::Timeout { stage: "handshake" })?
                .map_err(|error| self.read_error("handshake", &error))?;
            if count == 0 {
                return Err(SenderError::PeerClosed { stage: "handshake" });
            }
            match handshake
                .process_bytes(&buffer[..count])
                .map_err(|error| self.handshake_error(&format!("{error:?}")))?
            {
                HandshakeProcessResult::InProgress { response_bytes } => {
                    self.write_all(&response_bytes).await?;
                }
                HandshakeProcessResult::Completed { response_bytes, remaining_bytes } => {
                    self.write_all(&response_bytes).await?;
                    break remaining_bytes;
                }
            }
        };

        if !leftover.is_empty() {
            let results = self
                .session
                .handle_input(&leftover)
                .map_err(|error| self.protocol_error(&format!("{error:?}")))?;
            self.write_results(results).await?;
        }
        Ok(())
    }

    /// Read until `wanted` recognises an event. `Some(Ok)` accepts, `Some(Err)` is the
    /// ingest's own refusal text, `None` means keep waiting.
    async fn await_event<F>(&mut self, stage: &'static str, mut wanted: F) -> Result<(), SenderError>
    where
        F: FnMut(&ClientSessionEvent) -> Option<Result<(), String>>,
    {
        let mut buffer = vec![0u8; READ_BUFFER];
        loop {
            let count = tokio::time::timeout(NEGOTIATION_TIMEOUT, self.read.read(&mut buffer))
                .await
                .map_err(|_| SenderError::Timeout { stage })?
                .map_err(|error| self.read_error(stage, &error))?;
            if count == 0 {
                return Err(SenderError::PeerClosed { stage });
            }
            let results = self
                .session
                .handle_input(&buffer[..count])
                .map_err(|error| self.protocol_error(&format!("{error:?}")))?;

            let mut verdict = None;
            let mut outbound = Vec::new();
            for result in results {
                match result {
                    ClientSessionResult::RaisedEvent(event) => {
                        if verdict.is_none() {
                            verdict = wanted(&event);
                        }
                    }
                    other => outbound.push(other),
                }
            }
            self.write_results(outbound).await?;
            match verdict {
                Some(Ok(())) => return Ok(()),
                Some(Err(description)) => {
                    return Err(SenderError::Rejected {
                        description: self.redactor.scrub(&description),
                    })
                }
                None => continue,
            }
        }
    }

    async fn write_results(&mut self, results: Vec<ClientSessionResult>) -> Result<(), SenderError> {
        for result in results {
            if let ClientSessionResult::OutboundResponse(packet) = result {
                self.write_all(&packet.bytes).await?;
            }
        }
        Ok(())
    }

    async fn write_all(&mut self, bytes: &[u8]) -> Result<(), SenderError> {
        self.write
            .write_all(bytes)
            .await
            .map_err(|error| SenderError::Connect(self.redactor.scrub(&error.to_string())))?;
        self.stats.bytes_published += bytes.len() as u64;
        Ok(())
    }

    /// The tagger outlives this session, so the cumulative counters are read from it
    /// rather than from a clock this struct no longer owns.
    fn finish(mut self, reason: EndReason, pipeline: &Pipeline) -> SenderOutcome {
        let tagger = pipeline.tagger();
        self.stats.clamped_timestamps = tagger.clamped_count();
        self.stats.past_24_bit_ceiling = tagger.past_24_bit_ceiling();
        self.stats.media_before_config = tagger.media_before_config();
        SenderOutcome { stats: self.stats, reason }
    }

    // Every error string this type produces is built here, through the redactor.
    // Not because these particular formats are known to contain a key, but because a
    // single funnel is the only version of this promise that stays true when someone
    // adds the next error next month.
    fn protocol_error(&self, detail: &str) -> SenderError {
        SenderError::Protocol(self.redactor.scrub(detail))
    }

    fn handshake_error(&self, detail: &str) -> SenderError {
        SenderError::Handshake(self.redactor.scrub(detail))
    }

    fn connect_error(&self, detail: &str) -> SenderError {
        SenderError::Connect(self.redactor.scrub(detail))
    }

    /// A read failure during negotiation, named by what actually happened.
    ///
    /// An ingest that dislikes us does not always answer — plain RTMP gives a clean
    /// `read() == 0`, but the same close under TLS surfaces as an io error, and
    /// rustls's is `peer closed connection without sending TLS close_notify:
    /// https://docs.rs/rustls/...`. Measured on 2026-09-05: the same bad key against
    /// YouTube produced "the ingest closed the connection (publish)" over rtmp:// and
    /// that documentation URL over rtmps://. Two messages for one cause, and the one
    /// the product will actually ship is the useless one.
    fn read_error(&self, stage: &'static str, error: &std::io::Error) -> SenderError {
        match closed_by_peer(error.kind()) {
            true => SenderError::PeerClosed { stage },
            false => self.connect_error(&error.to_string()),
        }
    }
}

/// Whether this io error is the peer hanging up rather than the network failing.
fn closed_by_peer(kind: std::io::ErrorKind) -> bool {
    matches!(
        kind,
        std::io::ErrorKind::UnexpectedEof
            | std::io::ErrorKind::ConnectionReset
            | std::io::ErrorKind::ConnectionAborted
            | std::io::ErrorKind::BrokenPipe
    )
}

/// Pull an ingest's own words out of an AMF0 status object.
///
/// `description` when it is there (it carries the sentence a person can act on),
/// `code` otherwise (`NetStream.Publish.BadName`), and a plain statement of ignorance
/// rather than an empty string when the ingest sent neither — "the ingest refused to
/// publish: " with nothing after it is a support ticket with no information in it.
fn describe_status(values: &[Amf0Value]) -> String {
    for value in values {
        if let Amf0Value::Object(properties) = value {
            if let Some(Amf0Value::Utf8String(description)) = properties.get("description") {
                if !description.is_empty() {
                    return description.clone();
                }
            }
            if let Some(Amf0Value::Utf8String(code)) = properties.get("code") {
                if !code.is_empty() {
                    return code.clone();
                }
            }
        }
    }
    "the ingest gave no reason".to_string()
}

/// Wrap the socket in TLS for RTMPS.
///
/// Roots come from the pinned `webpki-roots` bundle rather than the platform store: a
/// stream that fails because of a keychain state we cannot see from a log is a support
/// call nobody can answer. The provider is `ring`, chosen explicitly rather than left
/// to a process default — see the note in `Cargo.toml` about what `aws-lc-rs` would
/// add to the Windows build.
async fn wrap_tls(
    stream: TcpStream,
    host: &str,
    redactor: &Redactor,
) -> Result<tokio_rustls::client::TlsStream<TcpStream>, SenderError> {
    let mut roots = rustls::RootCertStore::empty();
    roots.extend(webpki_roots::TLS_SERVER_ROOTS.iter().cloned());

    let config =
        rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
            .with_safe_default_protocol_versions()
            .map_err(|error| SenderError::Tls(redactor.scrub(&error.to_string())))?
            .with_root_certificates(roots)
            .with_no_client_auth();

    let server_name = rustls::pki_types::ServerName::try_from(host.to_string())
        .map_err(|_| SenderError::Tls(format!("ingest host {host} is not a valid TLS name")))?;

    let connector = tokio_rustls::TlsConnector::from(Arc::new(config));
    tokio::time::timeout(NEGOTIATION_TIMEOUT, connector.connect(server_name, stream))
        .await
        .map_err(|_| SenderError::Timeout { stage: "tls handshake" })?
        .map_err(|error| SenderError::Tls(redactor.scrub(&error.to_string())))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn an_abrupt_close_is_the_peer_hanging_up_and_a_timeout_is_not() {
        // rustls reports a TLS peer that vanished as UnexpectedEof; a plain socket
        // reports the same event as a clean `read() == 0`. Both are the ingest hanging
        // up, and the operator needs to hear the same sentence either way.
        assert!(closed_by_peer(std::io::ErrorKind::UnexpectedEof));
        assert!(closed_by_peer(std::io::ErrorKind::ConnectionReset));
        assert!(closed_by_peer(std::io::ErrorKind::ConnectionAborted));
        assert!(closed_by_peer(std::io::ErrorKind::BrokenPipe));
        // Not these: a refused connection or a dead network is a different sentence.
        assert!(!closed_by_peer(std::io::ErrorKind::ConnectionRefused));
        assert!(!closed_by_peer(std::io::ErrorKind::TimedOut));
        assert!(!closed_by_peer(std::io::ErrorKind::HostUnreachable));
    }

    #[test]
    fn a_close_during_publish_says_what_it_usually_means() {
        // Measured against YouTube on 2026-09-05: a bad key is a silent close here.
        let text = format!("{}", SenderError::PeerClosed { stage: "publish" });
        assert!(text.contains("closed the connection (publish)"));
        assert!(text.contains("stream key"), "the likely cause must be named: {text}");
        // But not everywhere — a close during the handshake is not a key problem.
        let handshake = format!("{}", SenderError::PeerClosed { stage: "handshake" });
        assert!(!handshake.contains("stream key"), "do not guess: {handshake}");
    }

    #[test]
    fn an_ingest_status_object_gives_up_its_description_then_its_code() {
        use std::collections::HashMap;
        let with_description = Amf0Value::Object(HashMap::from([
            ("code".to_string(), Amf0Value::Utf8String("NetStream.Publish.BadName".to_string())),
            ("description".to_string(), Amf0Value::Utf8String("key not authorised".to_string())),
        ]));
        assert_eq!(describe_status(&[with_description]), "key not authorised");

        let code_only = Amf0Value::Object(HashMap::from([(
            "code".to_string(),
            Amf0Value::Utf8String("NetStream.Publish.BadName".to_string()),
        )]));
        assert_eq!(describe_status(&[code_only]), "NetStream.Publish.BadName");

        // Silence must not become an error message that says nothing.
        assert_eq!(describe_status(&[]), "the ingest gave no reason");
        assert_eq!(describe_status(&[Amf0Value::Null]), "the ingest gave no reason");
    }
}
