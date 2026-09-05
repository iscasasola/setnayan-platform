//! THE VENUE WIFI DROPS — and the wedding does not stop for it.
//!
//! **RTMP HAS NO RESUME.** There is no sequence number to restart from and no "continue
//! where we left off" message in the protocol. A reconnect is a brand-new TCP
//! connection, a brand-new handshake, a brand-new `connect`/`createStream`/`publish` —
//! to a broadcast that YouTube is holding open for a grace window while it waits for
//! an encoder to come back. Everything hard about this file follows from that one
//! sentence:
//!
//! · **The encoders never stop.** The webview keeps producing chunks through the
//!   outage. If nothing drains them the channel fills and the producer blocks, so the
//!   loops below keep consuming — and keep RECORDING — while there is no socket at all.
//!   That is why `Pipeline` is passed through the offline paths too.
//! · **The clock must not restart.** A new `RtmpSender` used to mean a new `RtmpClock`
//!   at zero. `tagger::Tagger` now outlives the session for exactly this reason.
//! · **The new ingest has seen nothing.** Both sequence headers go again, and video
//!   waits for the next keyframe (`tagger::WireGate`). The RECORDING waits for
//!   nothing — it has every frame since the ceremony started.
//! · **A refused publish means two different things.** Inside the grace window it is
//!   usually YouTube not yet ready for us again. Outside it, the broadcast is gone and
//!   retrying forever would be a spinner over a wedding that has ended. Same error,
//!   different answer, and the only thing separating them is elapsed time.
//!
//! ⚠ THE GRACE WINDOW IS UNVERIFIED. YouTube documents "a minute or two" and does not
//! give a number. [`DEFAULT_GRACE`] is 120 s — the generous end of that phrase, chosen
//! because being too patient costs a spinner and being too impatient ends a broadcast
//! that was coming back. **S13 measures it.** Until then this constant is a guess and
//! is labelled as one; do not cite it as a measurement anywhere.
//!
//! WHAT THIS FILE DOES NOT DO: it does not decide the operator-facing sentence for the
//! stream's health. `apps/web/lib/live-studio-ingest-health.ts` (`decideIngestHealth`)
//! is that decider and there is not going to be a second one — YouTube's own
//! `noData`/stale reading always beats a local "publishing", because this process can
//! be cheerfully writing into a socket that reaches nobody. [`HealthEvent`] is an
//! INPUT to that surface, never a replacement for it.

use std::time::{Duration, Instant};

use tokio::sync::mpsc;

use super::contract::EncodedChunk;
use super::flv::StreamMeta;
use super::rtmp::RtmpEndpoint;
use super::sender::{EndReason, RtmpSender, SenderError, SenderStats};
use super::tagger::Pipeline;

/// First retry delay. The sequence is 1 s, 2, 4, then 5 s forever — fast enough that a
/// blink is invisible to viewers, and bounded so a long outage does not decay into a
/// retry every several minutes when the wifi comes back.
pub const DEFAULT_RETRY_BASE: Duration = Duration::from_secs(1);

/// The ceiling on that backoff. **The reconnect guard is written against this**: a
/// stream that resumes must resume inside 5 s of the network returning.
pub const RETRY_CAP: Duration = Duration::from_secs(5);

/// Primary-ingest failures tolerated before the backup enters the rotation.
///
/// Three, not one: the overwhelmingly common outage is the venue's wifi, which takes
/// BOTH ingests down and for which switching is pure churn. Moving on the first
/// failure would abandon the primary — the one YouTube gave us — for a transient blip
/// most of the time.
pub const PRIMARY_FAILURES_BEFORE_BACKUP: u32 = 3;

/// See the ⚠ in this module's header. A GUESS, not a measurement. S13 measures it.
pub const DEFAULT_GRACE: Duration = Duration::from_secs(120);

/// Which of YouTube's two ingest endpoints an attempt is aimed at.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ingest {
    Primary,
    Backup,
}

impl Ingest {
    pub fn label(self) -> &'static str {
        match self {
            Ingest::Primary => "primary",
            Ingest::Backup => "backup",
        }
    }
}

/// Where this stream may be published. The backup is optional because the default
/// tier is a couple pasting their OWN key from their OWN channel
/// (`lib/live-studio-manual-air.ts`) — that route often has only the one address, and
/// a missing backup must degrade to "keep retrying the primary", never to a refusal.
#[derive(Debug, Clone)]
pub struct Destinations {
    pub primary: RtmpEndpoint,
    pub backup: Option<RtmpEndpoint>,
}

impl Destinations {
    pub fn new(primary: RtmpEndpoint) -> Destinations {
        Destinations { primary, backup: None }
    }

    pub fn with_backup(primary: RtmpEndpoint, backup: RtmpEndpoint) -> Destinations {
        Destinations { primary, backup: Some(backup) }
    }

    pub fn has_backup(&self) -> bool {
        self.backup.is_some()
    }

    pub fn endpoint(&self, ingest: Ingest) -> &RtmpEndpoint {
        match ingest {
            Ingest::Backup => self.backup.as_ref().unwrap_or(&self.primary),
            Ingest::Primary => &self.primary,
        }
    }
}

/// Which ingest attempt number `attempt` goes to. 1-based, counting consecutive
/// failures since the last successful publish.
///
/// Attempts 1–3 are the primary. From the fourth they alternate, so a genuinely dead
/// primary does not strand the wedding on it and a genuinely dead BACKUP does not
/// strand the wedding on that either.
pub fn ingest_for_attempt(attempt: u32, has_backup: bool) -> Ingest {
    if !has_backup || attempt <= PRIMARY_FAILURES_BEFORE_BACKUP {
        return Ingest::Primary;
    }
    if (attempt - PRIMARY_FAILURES_BEFORE_BACKUP) % 2 == 1 {
        Ingest::Backup
    } else {
        Ingest::Primary
    }
}

/// How long to wait, and when to stop calling it a blip.
#[derive(Debug, Clone)]
pub struct RetryPolicy {
    pub base: Duration,
    pub cap: Duration,
    /// How long the broadcast is assumed to survive without an encoder.
    pub grace: Duration,
    /// Stop retrying after this long. `None` — the default — means never stop while
    /// the producer is still producing: the recording keeps growing either way, and a
    /// supervisor that gave up would also stop writing the couple's only copy.
    pub give_up_after: Option<Duration>,
}

impl Default for RetryPolicy {
    fn default() -> RetryPolicy {
        RetryPolicy {
            base: DEFAULT_RETRY_BASE,
            cap: RETRY_CAP,
            grace: DEFAULT_GRACE,
            give_up_after: None,
        }
    }
}

impl RetryPolicy {
    /// 1 s, 2 s, 4 s, then the cap. Doubling from `base`, clamped — the shape is in the
    /// arithmetic rather than in a table, so the cap cannot be edited out of one branch.
    pub fn delay_for(&self, attempt: u32) -> Duration {
        let doublings = attempt.saturating_sub(1).min(16);
        let scaled = self.base.saturating_mul(1u32 << doublings);
        scaled.min(self.cap)
    }
}

/// What the supervisor tells the health surface. **An input to
/// `decideIngestHealth`, not a substitute for it** — see this module's header.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HealthEvent {
    /// A connection attempt is starting.
    Connecting { attempt: u32, ingest: Ingest },
    /// On air. `resumed` distinguishes the first publish from a recovery, which is the
    /// difference between "we are live" and "we are live again".
    Publishing { ingest: Ingest, resumed: bool },
    /// Off air and trying. `for_ms` is how long the stream has been down — the number
    /// the operator actually wants, and the reason this is not just an error string.
    Reconnecting { for_ms: u64, attempt: u32, next_attempt_in_ms: u64, detail: String },
    /// Down longer than the grace window: the broadcast may not survive this. Emitted
    /// ONCE per outage, not per attempt — a health surface that repeats itself every
    /// five seconds is one people stop reading.
    Down { for_ms: u64, detail: String },
    /// The broadcast is gone: a publish was refused after the grace window elapsed.
    /// W1 consumes this.
    BroadcastEnded { detail: String },
    /// The local recording stopped — a full disk, an unmounted volume. The BROADCAST
    /// is unaffected and continues; this exists so the operator finds out now rather
    /// than when they look for the file.
    RecordingStopped { detail: String },
    /// Free space at start was below the warning threshold. Not a refusal.
    DiskLow { free_bytes: u64 },
}

/// Why the whole supervised stream ended.
#[derive(Debug)]
pub enum StopReason {
    /// The producer closed the channel — the operator pressed stop.
    ProducerFinished,
    BroadcastEnded { detail: String },
    GaveUp { detail: String },
}

#[derive(Debug)]
pub struct SupervisorOutcome {
    /// Successful publishes. 1 means a wedding that never dropped.
    pub sessions: u32,
    pub reconnects: u32,
    pub failed_attempts: u32,
    /// Summed across every session. The cumulative tagger counters
    /// (`media_before_config`, `clamped_timestamps`) are taken from the last session
    /// rather than added, because the tagger already counts them once for the stream.
    pub stats: SenderStats,
    pub longest_outage_ms: u64,
    pub used_backup: bool,
    pub recording_fault: Option<String>,
    pub stop: StopReason,
}

/// How a session is opened. A trait so the tests can put a real `ServerSession` on the
/// other end of an in-memory pipe — the supervisor's whole job is what it does when a
/// connection fails, and proving that against a real network would mean a test that
/// unplugs a cable.
pub trait Connector {
    fn connect(
        &self,
        endpoint: RtmpEndpoint,
        meta: StreamMeta,
    ) -> impl std::future::Future<Output = Result<RtmpSender, SenderError>> + Send;
}

/// The real one: a TCP socket, TLS when the scheme says so.
pub struct NetworkConnector;

impl Connector for NetworkConnector {
    async fn connect(
        &self,
        endpoint: RtmpEndpoint,
        meta: StreamMeta,
    ) -> Result<RtmpSender, SenderError> {
        RtmpSender::connect(endpoint, meta).await
    }
}

/// Health events are announced, never awaited.
///
/// `try_send` and not `send`: this runs on the live publishing path, and a full or
/// abandoned event channel must never be able to stall a wedding. A dropped health
/// event costs one line in a status panel; a blocked send costs the ceremony.
fn announce(events: &mpsc::Sender<HealthEvent>, event: HealthEvent) {
    let _ = events.try_send(event);
}

/// Whether this failure means "the broadcast said no", as opposed to "the network
/// failed". Inside the grace window both are retried; outside it, only this one ends
/// the stream — a dead network at minute 40 must NOT be mistaken for a finished
/// wedding.
fn is_publish_refusal(error: &SenderError) -> bool {
    matches!(
        error,
        SenderError::Rejected { .. } | SenderError::PeerClosed { stage: "publish" }
    )
}

/// Keep tagging and RECORDING while there is nothing to send.
///
/// Returns `false` when the producer finished — the operator pressed stop during the
/// outage, which is a normal end and not a failure.
fn record_only(pipeline: &mut Pipeline, chunk: Option<EncodedChunk>) -> bool {
    match chunk {
        Some(chunk) => {
            // A malformed chunk is dropped here rather than ending the stream: there is
            // no session to fail, and the next chunk is very likely fine.
            let _ = pipeline.ingest(&chunk);
            true
        }
        None => false,
    }
}

/// Sleep, but keep recording. A plain `sleep` here would let the chunk channel fill
/// and block the producer — which on this pipeline means stalling the webview's
/// encoder output for the length of the backoff.
async fn wait_while_recording(
    delay: Duration,
    chunks: &mut mpsc::Receiver<EncodedChunk>,
    pipeline: &mut Pipeline,
) -> bool {
    let deadline = tokio::time::sleep(delay);
    tokio::pin!(deadline);
    loop {
        tokio::select! {
            _ = &mut deadline => return true,
            received = chunks.recv() => {
                if !record_only(pipeline, received) {
                    return false;
                }
            }
        }
    }
}

/// Publish for as long as the wedding lasts, across as many connections as that takes.
pub async fn supervise<C: Connector>(
    connector: &C,
    destinations: &Destinations,
    meta: StreamMeta,
    chunks: &mut mpsc::Receiver<EncodedChunk>,
    pipeline: &mut Pipeline,
    events: &mpsc::Sender<HealthEvent>,
    policy: &RetryPolicy,
) -> SupervisorOutcome {
    let mut sessions = 0u32;
    let mut reconnects = 0u32;
    let mut failed_attempts = 0u32;
    let mut consecutive_failures = 0u32;
    let mut totals = SenderStats::default();
    let mut longest_outage_ms = 0u64;
    let mut used_backup = false;
    let mut outage_started: Option<Instant> = None;
    let mut announced_down = false;

    macro_rules! finish {
        ($stop:expr) => {{
            if let Some(started) = outage_started {
                longest_outage_ms = longest_outage_ms.max(started.elapsed().as_millis() as u64);
            }
            let fault = pipeline.recording_fault();
            return SupervisorOutcome {
                sessions,
                reconnects,
                failed_attempts,
                stats: totals,
                longest_outage_ms,
                used_backup,
                recording_fault: fault,
                stop: $stop,
            };
        }};
    }

    loop {
        let attempt = consecutive_failures + 1;
        let ingest = ingest_for_attempt(attempt, destinations.has_backup());
        if ingest == Ingest::Backup {
            used_backup = true;
        }
        let endpoint = destinations.endpoint(ingest).clone();
        announce(events, HealthEvent::Connecting { attempt, ingest });

        // RACE THE CONNECT AGAINST THE PRODUCER. Connecting takes up to
        // NEGOTIATION_TIMEOUT (15 s) per stage, and the webview is producing video the
        // whole time. Draining into the recording here is what keeps the couple's file
        // continuous across an outage — and what stops a full channel from blocking the
        // encoder in the page.
        let connect = connector.connect(endpoint, meta.clone());
        tokio::pin!(connect);
        let attempted = loop {
            tokio::select! {
                result = &mut connect => break Some(result),
                received = chunks.recv() => {
                    if !record_only(pipeline, received) {
                        break None;
                    }
                }
            }
        };

        let sender = match attempted {
            // The producer stopped while we were off air. The recording holds
            // everything it produced; there is nothing left to publish.
            None => finish!(StopReason::ProducerFinished),
            Some(Ok(sender)) => sender,
            Some(Err(error)) => {
                consecutive_failures += 1;
                failed_attempts += 1;
                let started = *outage_started.get_or_insert_with(Instant::now);
                let down_for = started.elapsed();
                let detail = error.to_string();

                // A refused publish after the grace window is the broadcast being gone
                // rather than the network being broken. Inside the window the same
                // refusal is YouTube not being ready for us yet, and is retried.
                if is_publish_refusal(&error) && down_for >= policy.grace {
                    announce(events, HealthEvent::BroadcastEnded { detail: detail.clone() });
                    finish!(StopReason::BroadcastEnded { detail });
                }

                if let Some(limit) = policy.give_up_after {
                    if down_for >= limit {
                        finish!(StopReason::GaveUp { detail });
                    }
                }

                if down_for >= policy.grace && !announced_down {
                    announced_down = true;
                    announce(
                        events,
                        HealthEvent::Down {
                            for_ms: down_for.as_millis() as u64,
                            detail: detail.clone(),
                        },
                    );
                }

                let delay = policy.delay_for(consecutive_failures);
                announce(
                    events,
                    HealthEvent::Reconnecting {
                        for_ms: down_for.as_millis() as u64,
                        attempt: consecutive_failures,
                        next_attempt_in_ms: delay.as_millis() as u64,
                        detail,
                    },
                );
                if !wait_while_recording(delay, chunks, pipeline).await {
                    finish!(StopReason::ProducerFinished);
                }
                continue;
            }
        };

        // ── ON AIR ─────────────────────────────────────────────────────────────
        let resumed = sessions > 0;
        // EVERY session gets this, INCLUDING THE FIRST — and that is not belt and
        // braces, it is a defect this line exists to fix. The connect above races the
        // producer, so chunks are tagged and recorded WHILE the handshake is still in
        // flight. On a first connection those drained chunks routinely include the
        // `Config` one, and the sequence headers it produced went to the recording and
        // to a socket that did not exist yet. Arming the resume only on reconnects left
        // the ingest receiving a first session of pure media with no `avcC`/`asc` in
        // front of it: an undecodable stream, published without a single error, on
        // every wedding whose config arrived before the TCP handshake finished.
        // `tests/recording.rs` caught it; the gate also makes that session start on a
        // keyframe, which a fresh publish needs anyway.
        pipeline.resume_session();
        if resumed {
            reconnects += 1;
        }
        sessions += 1;
        announced_down = false;
        // NOT `consecutive_failures = 0` here: every path out of the session below
        // sets it explicitly (1 on a failure, unreachable on a clean finish), and the
        // compiler correctly calls the zeroing dead. The counter is reset by the `= 1`
        // that starts the next outage, which is also what makes attempt 1 the primary.
        if let Some(started) = outage_started.take() {
            longest_outage_ms = longest_outage_ms.max(started.elapsed().as_millis() as u64);
        }
        announce(events, HealthEvent::Publishing { ingest, resumed });

        let outcome = sender.run(chunks, pipeline).await;
        totals.video_tags += outcome.stats.video_tags;
        totals.audio_tags += outcome.stats.audio_tags;
        totals.bytes_published += outcome.stats.bytes_published;
        totals.media_before_config = outcome.stats.media_before_config;
        totals.clamped_timestamps = outcome.stats.clamped_timestamps;
        totals.past_24_bit_ceiling = outcome.stats.past_24_bit_ceiling;

        // The recording may have died quietly during that session. Say so once — the
        // broadcast is fine and must not be interrupted for it.
        if let Some(fault) = pipeline.recording_fault() {
            announce(events, HealthEvent::RecordingStopped { detail: fault });
        }

        match outcome.reason {
            EndReason::ProducerFinished => finish!(StopReason::ProducerFinished),
            EndReason::Failed(error) => {
                consecutive_failures = 1;
                failed_attempts += 1;
                let started = *outage_started.get_or_insert_with(Instant::now);
                let detail = error.to_string();
                let delay = policy.delay_for(1);
                announce(
                    events,
                    HealthEvent::Reconnecting {
                        for_ms: started.elapsed().as_millis() as u64,
                        attempt: 1,
                        next_attempt_in_ms: delay.as_millis() as u64,
                        detail,
                    },
                );
                if !wait_while_recording(delay, chunks, pipeline).await {
                    finish!(StopReason::ProducerFinished);
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn endpoints() -> Destinations {
        Destinations::with_backup(
            RtmpEndpoint::parse("rtmps://a.rtmps.youtube.com/live2", Some("k")).unwrap(),
            RtmpEndpoint::parse("rtmps://b.rtmps.youtube.com/live2", Some("k")).unwrap(),
        )
    }

    #[test]
    fn the_backoff_is_one_two_four_then_five_forever() {
        let policy = RetryPolicy::default();
        assert_eq!(policy.delay_for(1), Duration::from_secs(1));
        assert_eq!(policy.delay_for(2), Duration::from_secs(2));
        assert_eq!(policy.delay_for(3), Duration::from_secs(4));
        assert_eq!(policy.delay_for(4), Duration::from_secs(5), "capped, not 8");
        assert_eq!(policy.delay_for(5), Duration::from_secs(5));
        // THE GUARD IN THE PROMPT: a stream resumes within 5 s of the network coming
        // back, however long the outage was. An hour of failures must not decay the
        // retry into minutes.
        for attempt in 1..=5_000 {
            assert!(
                policy.delay_for(attempt) <= RETRY_CAP,
                "attempt {attempt} would wait {:?}, past the 5 s cap",
                policy.delay_for(attempt)
            );
        }
    }

    #[test]
    fn the_backup_enters_only_after_three_primary_failures_and_then_alternates() {
        assert_eq!(ingest_for_attempt(1, true), Ingest::Primary);
        assert_eq!(ingest_for_attempt(2, true), Ingest::Primary);
        assert_eq!(ingest_for_attempt(3, true), Ingest::Primary, "three, not one");
        assert_eq!(ingest_for_attempt(4, true), Ingest::Backup);
        assert_eq!(ingest_for_attempt(5, true), Ingest::Primary, "and back — alternating");
        assert_eq!(ingest_for_attempt(6, true), Ingest::Backup);
        assert_eq!(ingest_for_attempt(7, true), Ingest::Primary);

        // Over a long outage neither endpoint is abandoned.
        // Attempts 4, 6, 8 … 40 — nineteen of the first forty, i.e. neither endpoint
        // is abandoned however long the outage runs.
        let backup_share =
            (1..=40).filter(|n| ingest_for_attempt(*n, true) == Ingest::Backup).count();
        assert_eq!(backup_share, 19);
    }

    #[test]
    fn without_a_backup_every_attempt_is_the_primary() {
        // The DEFAULT tier: the couple's own key, often one address. A missing backup
        // must degrade to "keep trying", never to a refusal.
        for attempt in 1..=20 {
            assert_eq!(ingest_for_attempt(attempt, false), Ingest::Primary);
        }
        let solo = Destinations::new(endpoints().primary);
        assert!(!solo.has_backup());
        assert_eq!(solo.endpoint(Ingest::Backup), &solo.primary, "falls back, does not panic");
    }

    #[test]
    fn a_refused_publish_is_told_apart_from_a_broken_network() {
        // These two end the stream after the grace window.
        assert!(is_publish_refusal(&SenderError::Rejected {
            description: "NetStream.Publish.BadName".to_string()
        }));
        assert!(is_publish_refusal(&SenderError::PeerClosed { stage: "publish" }));

        // These NEVER do, however long they last — a dead network at minute 40 is not
        // a finished wedding, and treating it as one would end a broadcast that was
        // still coming back.
        assert!(!is_publish_refusal(&SenderError::Connect("no route to host".to_string())));
        assert!(!is_publish_refusal(&SenderError::Tls("handshake failed".to_string())));
        assert!(!is_publish_refusal(&SenderError::Timeout { stage: "tcp connect" }));
        assert!(!is_publish_refusal(&SenderError::PeerClosed { stage: "publishing" }));
        assert!(!is_publish_refusal(&SenderError::PeerClosed { stage: "handshake" }));
    }

    #[test]
    fn the_grace_window_is_labelled_as_the_guess_it_is() {
        // If S13 measures it, this constant changes and this assertion is what tells
        // whoever changes it that the docblock above needs changing too.
        assert_eq!(DEFAULT_GRACE, Duration::from_secs(120));
        assert_eq!(PRIMARY_FAILURES_BEFORE_BACKUP, 3);
    }
}
