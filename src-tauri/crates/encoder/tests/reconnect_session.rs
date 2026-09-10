//! THE VENUE WIFI DROPS, THREE TIMES, AND THE BROADCAST SURVIVES IT.
//!
//! Every test here stages a real RTMP publish to a real `ServerSession` that hangs up
//! on cue, and asserts what the NEXT session looks like from the ingest's side. That
//! side is the only one that matters: a reconnect is correct when the ingest receives
//! a decodable stream whose timeline continues, and no amount of internal state
//! agreeing with itself proves that.
//!
//! The failure this file exists to catch is the quiet one. A reconnect that "works" —
//! socket up, tags flowing, no error anywhere — but restarts the timestamps at zero
//! produces a stream YouTube reads as jumping four hours backwards, and produces it
//! WITHOUT an error, in the middle of a ceremony, on the one recording that cannot be
//! re-shot.

mod common;

use std::time::Duration;

use common::{
    audio_chunk, config_chunk, destinations, fast_policy, video_chunk, Attempt, Policy,
    ScriptedConnector, BACKUP_HOST, PRIMARY_HOST,
};
use setnayan_encoder::flv::StreamMeta;
use setnayan_encoder::reconnect::{supervise, HealthEvent, Ingest, StopReason};
use setnayan_encoder::tagger::Pipeline;
use tokio::sync::mpsc;

/// A steady producer: one video and one audio chunk per second of stream time, a
/// keyframe every fifth video frame, paced at 3 ms of wall clock.
///
/// ⚠ `frames` MUST out-last the test's whole retry budget with room to spare, on a
/// LOADED runner and not just on a quiet laptop. A producer that finishes first ends
/// the supervisor with `ProducerFinished` before the reconnect it was staged to
/// exercise ever happens — and the test then fails on `sessions`, pointing at the
/// supervisor instead of at its own arithmetic. The backup test alone waits
/// 10+20+40+50 ms between attempts; the counts below are several times that.
fn spawn_producer(tx: mpsc::Sender<setnayan_encoder::contract::EncodedChunk>, frames: u64) {
    tokio::spawn(async move {
        if tx.send(config_chunk(0, 0)).await.is_err() {
            return;
        }
        let mut seq = 1u32;
        for index in 0..frames {
            let base_us = index * 1_000_000;
            let video = video_chunk(seq, base_us, index % 5 == 0);
            seq += 1;
            if tx.send(video).await.is_err() {
                return;
            }
            let audio = audio_chunk(seq, base_us + 500_000);
            seq += 1;
            if tx.send(audio).await.is_err() {
                return;
            }
            tokio::time::sleep(Duration::from_millis(3)).await;
        }
    });
}

const RUN_BUDGET: Duration = Duration::from_secs(60);

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_dropped_connection_resumes_with_both_headers_and_a_clock_that_never_restarts() {
    // Session one dies after six media tags. Session two takes the rest.
    let connector = ScriptedConnector::new([
        Attempt::Ingest(Policy::AcceptThenDrop(6)),
        Attempt::Ingest(Policy::Accept),
    ]);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, mut event_rx) = mpsc::channel(256);
    spawn_producer(tx, 120);

    let mut pipeline = Pipeline::streaming_only();
    let outcome = tokio::time::timeout(
        RUN_BUDGET,
        supervise(
            &connector,
            &destinations(false),
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &fast_policy(),
        ),
    )
    .await
    .expect("the supervisor stalled — an outage it never came out of");
    drop(events);

    assert!(matches!(outcome.stop, StopReason::ProducerFinished), "got {:?}", outcome.stop);
    assert_eq!(outcome.sessions, 2, "one drop, one recovery");
    assert_eq!(outcome.reconnects, 1);

    let reports = connector.reports().await;
    assert_eq!(reports.len(), 2);
    let (first, second) = (&reports[0], &reports[1]);
    assert!(first.accepted_publish && second.accepted_publish);
    assert!(!first.media().is_empty(), "the first session published before it died");
    assert!(!second.media().is_empty(), "the second session published something");

    // ── GUARD 1: the new ingest gets BOTH sequence headers, before any media. ──
    // It has never seen this stream's avcC/asc and cannot decode a single NALU
    // without them.
    let opening: Vec<(char, bool)> =
        second.tags.iter().take(2).map(|tag| (tag.track, tag.is_sequence_header())).collect();
    assert_eq!(
        opening,
        vec![('v', true), ('a', true)],
        "a resumed session must re-announce both decoder configurations first"
    );

    // ── GUARD 2: THE CLOCK CONTINUED. ────────────────────────────────────────
    // This is the sabotage target. Reset the clock on reconnect and the second
    // session's timestamps start near zero, which is a stream that jumps backwards.
    let first_max = first.max_timestamp();
    let second_first_media = second.media().first().expect("media in session two").timestamp_ms;
    assert!(first_max > 0, "the first session must have got somewhere: {first_max}");
    assert!(
        second_first_media >= first_max,
        "the timeline restarted: session one reached {first_max} ms, session two resumed at \
         {second_first_media} ms"
    );
    assert!(
        second.max_timestamp() > first_max,
        "session two must advance past session one, not sit on it"
    );

    // ── GUARD 3: video resumes on a KEYFRAME. ────────────────────────────────
    // An inter-frame references pictures the new ingest never received.
    let first_video = second
        .media()
        .into_iter()
        .find(|tag| tag.track == 'v')
        .expect("video resumed at all");
    assert!(
        first_video.is_video_keyframe(),
        "the first picture after a reconnect must be a keyframe, got body byte 0 = {:#04x}",
        first_video.body[0]
    );

    // ── the health log said so out loud ──────────────────────────────────────
    let mut seen = Vec::new();
    while let Ok(event) = event_rx.try_recv() {
        seen.push(event);
    }
    assert!(
        seen.iter().any(|event| matches!(event, HealthEvent::Reconnecting { .. })),
        "the operator was never told the stream had dropped: {seen:?}"
    );
    assert!(
        seen.iter().any(
            |event| matches!(event, HealthEvent::Publishing { resumed: true, .. })
        ),
        "the recovery was never announced: {seen:?}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_backup_ingest_enters_only_after_three_primary_failures() {
    // Four failures, then an accept. Attempts 1–3 must be the primary; the fourth is
    // the backup; the fifth is back on the primary.
    let connector = ScriptedConnector::new([
        Attempt::Unreachable,
        Attempt::Unreachable,
        Attempt::Unreachable,
        Attempt::Unreachable,
        Attempt::Ingest(Policy::Accept),
    ]);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, mut event_rx) = mpsc::channel(256);
    spawn_producer(tx, 250);

    let mut pipeline = Pipeline::streaming_only();
    let outcome = tokio::time::timeout(
        RUN_BUDGET,
        supervise(
            &connector,
            &destinations(true),
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &fast_policy(),
        ),
    )
    .await
    .expect("the supervisor stalled");
    drop(events);

    assert!(matches!(outcome.stop, StopReason::ProducerFinished));
    assert_eq!(outcome.sessions, 1, "it got on air once, on the fifth attempt");
    assert_eq!(outcome.failed_attempts, 4);
    assert!(outcome.used_backup);

    let hosts = connector.hosts();
    assert_eq!(
        hosts,
        vec![PRIMARY_HOST, PRIMARY_HOST, PRIMARY_HOST, BACKUP_HOST, PRIMARY_HOST],
        "three primary tries, THEN the backup, then back — a single blip must not \
         abandon the ingest YouTube gave us"
    );

    let mut ingests = Vec::new();
    while let Ok(event) = event_rx.try_recv() {
        if let HealthEvent::Connecting { ingest, .. } = event {
            ingests.push(ingest);
        }
    }
    assert_eq!(ingests[3], Ingest::Backup, "and the health log named it: {ingests:?}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_refused_publish_ends_the_broadcast_only_after_the_grace_window() {
    // A refusal is retried while YouTube might still be holding the broadcast open,
    // and only becomes "the broadcast is gone" once the grace window has passed. The
    // fast policy's grace is 400 ms and its retries are 10–50 ms, so several refusals
    // land inside the window before one lands outside it.
    let connector = ScriptedConnector::new(std::iter::repeat(Attempt::Ingest(Policy::RejectPublish)).take(60));
    let (tx, mut rx) = mpsc::channel(256);
    let (events, mut event_rx) = mpsc::channel(256);
    spawn_producer(tx, 400);

    let mut pipeline = Pipeline::streaming_only();
    let outcome = tokio::time::timeout(
        RUN_BUDGET,
        supervise(
            &connector,
            &destinations(false),
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &fast_policy(),
        ),
    )
    .await
    .expect("the supervisor stalled");
    drop(events);

    match &outcome.stop {
        StopReason::BroadcastEnded { detail } => {
            assert!(detail.contains("refused") || detail.contains("closed"), "got {detail}")
        }
        other => panic!("a refusal past the grace window must end the broadcast, got {other:?}"),
    }
    assert_eq!(outcome.sessions, 0, "it never got on air");
    assert!(
        outcome.failed_attempts > 1,
        "the FIRST refusal must not end the broadcast — YouTube may simply not be \
         ready for us again yet. Attempts: {}",
        outcome.failed_attempts
    );

    let mut seen = Vec::new();
    while let Ok(event) = event_rx.try_recv() {
        seen.push(event);
    }
    assert!(seen.iter().any(|event| matches!(event, HealthEvent::BroadcastEnded { .. })));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_operator_pressing_stop_during_an_outage_is_a_clean_end_not_a_failure() {
    // Nothing will ever connect. The producer stops on its own. That is a wedding that
    // ended, not an encoder that failed — and it must not be reported as one.
    let connector = ScriptedConnector::new(std::iter::repeat(Attempt::Unreachable).take(200));
    let (tx, mut rx) = mpsc::channel(16);
    let (events, _event_rx) = mpsc::channel(256);
    spawn_producer(tx, 8);

    let mut pipeline = Pipeline::streaming_only();
    let outcome = tokio::time::timeout(
        RUN_BUDGET,
        supervise(
            &connector,
            &destinations(false),
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &fast_policy(),
        ),
    )
    .await
    .expect("the supervisor stalled");

    assert!(
        matches!(outcome.stop, StopReason::ProducerFinished),
        "got {:?} — the producer finishing while off air is a normal stop",
        outcome.stop
    );
    assert_eq!(outcome.sessions, 0);
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_wedding_that_drops_three_times_still_ends_on_one_continuous_timeline() {
    // The acceptance scenario, in memory: three outages, four sessions, and the
    // timestamps must climb monotonically across every one of the joins.
    let connector = ScriptedConnector::new([
        Attempt::Ingest(Policy::AcceptThenDrop(4)),
        Attempt::Ingest(Policy::AcceptThenDrop(6)),
        Attempt::Unreachable,
        Attempt::Ingest(Policy::AcceptThenDrop(6)),
        Attempt::Ingest(Policy::Accept),
    ]);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, _event_rx) = mpsc::channel(512);
    spawn_producer(tx, 200);

    let mut pipeline = Pipeline::streaming_only();
    let outcome = tokio::time::timeout(
        RUN_BUDGET,
        supervise(
            &connector,
            &destinations(false),
            StreamMeta::defaults_720p30(),
            &mut rx,
            &mut pipeline,
            &events,
            &fast_policy(),
        ),
    )
    .await
    .expect("the supervisor stalled");

    assert!(matches!(outcome.stop, StopReason::ProducerFinished));
    assert_eq!(outcome.sessions, 4, "four publishes across three outages");
    assert_eq!(outcome.reconnects, 3);

    // Video and audio interleave — the producer puts audio 500 ms behind video — so
    // the guard is per JOIN, not per tag: no session may open BEHIND where the stream
    // had already reached, allowing one frame interval of interleave slack.
    const INTERLEAVE_SLACK_MS: u32 = 1_000;
    let reports = connector.reports().await;
    let mut furthest = 0u32;
    let mut joins = 0;
    for (index, report) in reports.iter().enumerate() {
        let Some(opened_at) = report.tags.iter().map(|tag| tag.timestamp_ms).min() else {
            continue;
        };
        if index > 0 {
            joins += 1;
            assert!(
                opened_at + INTERLEAVE_SLACK_MS >= furthest,
                "session {index} opened at {opened_at} ms after the stream had reached \
                 {furthest} ms — the clock restarted across a reconnect"
            );
        }
        assert!(
            report.max_timestamp() >= furthest,
            "session {index} never advanced past {furthest} ms"
        );
        furthest = furthest.max(report.max_timestamp());
    }
    assert!(joins >= 3, "only {joins} joins were exercised");
    assert!(furthest > 10_000, "the stream should have run well past ten seconds: {furthest}");
}
