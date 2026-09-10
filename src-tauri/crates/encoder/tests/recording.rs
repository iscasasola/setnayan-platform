//! THE FILE ON THE LAPTOP, CHECKED AGAINST THE BYTES THAT WENT TO YOUTUBE.
//!
//! For a hosted-channel couple this `.flv` is the only recording that will ever exist
//! — they do not own the pool channel the broadcast went to (spec § 4k). So the
//! question these tests answer is not "did we write a file" but "is the file the same
//! wedding": every tag the ingest received, byte for byte, in the same order, at the
//! same timestamps.
//!
//! The file is read back with an INDEPENDENT parser (`common::parse_flv`) that walks
//! the tag headers itself rather than reusing `flv::wrap_tag`. A reader built from the
//! writer's own code would happily agree with a writer that was wrong.

mod common;

use std::time::Duration;

use common::{
    audio_chunk, config_chunk, destinations, fast_policy, parse_flv, video_chunk, Attempt, Policy,
    ScriptedConnector, TempDir, WireTag,
};
use setnayan_encoder::file_sink::{judge_disk, DiskVerdict, FlvFileWriter, DISK_REFUSE_BYTES};
use setnayan_encoder::flv::StreamMeta;
use setnayan_encoder::reconnect::{supervise, StopReason};
use setnayan_encoder::tagger::{Pipeline, Tagger};
use tokio::sync::mpsc;

const RUN_BUDGET: Duration = Duration::from_secs(60);

/// `keyframe_every` is how the gating tests stay DETERMINISTIC rather than lucky.
///
/// With a keyframe every 5th frame, whether the first video chunk after a connect is a
/// keyframe is a coin toss decided by scheduler timing — and under load it lands on
/// "keyframe" often enough that a test asserting the gate withheld something fails six
/// times out of six. Widening the GOP so the next keyframe is far away makes the
/// withholding a property of the construction instead of a property of the machine.
fn spawn_producer_gop(
    tx: mpsc::Sender<setnayan_encoder::contract::EncodedChunk>,
    frames: u64,
    keyframe_every: u64,
) {
    tokio::spawn(async move {
        if tx.send(config_chunk(0, 0)).await.is_err() {
            return;
        }
        let mut seq = 1u32;
        for index in 0..frames {
            let base_us = index * 1_000_000;
            let video = video_chunk(seq, base_us, index % keyframe_every == 0);
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

fn spawn_producer(tx: mpsc::Sender<setnayan_encoder::contract::EncodedChunk>, frames: u64) {
    spawn_producer_gop(tx, frames, 5);
}

/// Everything a supervised run produced: what the ingests saw, and what is on disk.
struct Run {
    wire: Vec<WireTag>,
    file: Vec<WireTag>,
    sessions: u32,
    /// Video frames `WireGate` withheld from the socket. The recording kept them.
    withheld: u64,
}

async fn run_with_recording(plan: Vec<Attempt>, frames: u64, label: &str) -> (Run, TempDir) {
    run_with_recording_gop(plan, frames, 5, label).await
}

async fn run_with_recording_gop(
    plan: Vec<Attempt>,
    frames: u64,
    keyframe_every: u64,
    label: &str,
) -> (Run, TempDir) {
    let temp = TempDir::new(label);
    let path = temp.join("wedding.flv");
    let connector = ScriptedConnector::new(plan);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, _event_rx) = mpsc::channel(512);
    spawn_producer_gop(tx, frames, keyframe_every);

    let writer = FlvFileWriter::create(&path).expect("open the recording");
    let mut pipeline = Pipeline::new(Tagger::new(), Box::new(writer));
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

    assert!(matches!(outcome.stop, StopReason::ProducerFinished), "got {:?}", outcome.stop);
    assert!(pipeline.recording_fault().is_none(), "the recording faulted: {:?}", pipeline.recording_fault());
    let withheld = pipeline.gate().dropped_awaiting_keyframe();
    drop(pipeline); // closes the file

    let wire: Vec<WireTag> =
        connector.reports().await.into_iter().flat_map(|report| report.tags).collect();
    let file = parse_flv(&std::fs::read(&path).expect("read the recording back"));
    (Run { wire, file, sessions: outcome.sessions, withheld }, temp)
}

/// Match every tag the ingest received to a tag in the recording, in order, byte for
/// byte. Returns the matched file indices, or `None` if some tag the ingest received is
/// not in the file at all — which is the recording and the broadcast being different
/// weddings, and the thing being asserted.
///
/// A SUBSEQUENCE, NOT A CONTIGUOUS RUN, and that distinction is the whole subtlety.
/// The recording legitimately holds tags the wire never got: the frames produced while
/// the TCP handshake was still in flight, and the inter-frames `WireGate` withholds
/// until the first keyframe of a session. An earlier version of this guard demanded a
/// contiguous run and passed locally purely because the first post-connect video chunk
/// happened to be a keyframe; on a slower CI runner an inter-frame landed in between
/// and it failed. The extras are not slack to be waved away, though — every one of
/// them is accounted for exactly, below.
fn matched_indices(file: &[WireTag], wire: &[WireTag]) -> Option<Vec<usize>> {
    let mut matched = Vec::with_capacity(wire.len());
    let mut cursor = 0usize;
    for tag in wire {
        let found = (cursor..file.len()).find(|&index| &file[index] == tag)?;
        matched.push(found);
        cursor = found + 1;
    }
    Some(matched)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn every_tag_the_ingest_received_is_in_the_recording_byte_for_byte_and_in_order() {
    // THE GUARD the whole "one tagger, two sinks" design exists for. Not "the same
    // number of tags", not "the same duration" — the same BYTES, in the same order, at
    // the same timestamps. Sabotage: skip audio tags on the way to the file, or re-tag
    // for the file instead of reusing the frame, and no match exists at all.
    let (run, _temp) =
        run_with_recording(vec![Attempt::Ingest(Policy::Accept)], 60, "clean").await;

    assert_eq!(run.sessions, 1, "no reconnect in this scenario");
    assert!(run.wire.len() > 30, "not enough of a stream to prove anything: {}", run.wire.len());

    let matched = matched_indices(&run.file, &run.wire).unwrap_or_else(|| {
        panic!(
            "the recording and the broadcast are not the same wedding — of the {} tags \
             the ingest received, one is not in the {} tags on disk at all",
            run.wire.len(),
            run.file.len()
        )
    });

    // ── EVERY EXTRA TAG ON DISK IS ACCOUNTED FOR, EXACTLY ────────────────────
    // The file may hold MORE than the wire, but only for two nameable reasons. Any
    // third reason is a defect, and this arithmetic is what refuses to let one hide.
    let first = matched[0];
    let unmatched_after_start: Vec<&WireTag> = (first..run.file.len())
        .filter(|index| !matched.contains(index))
        .map(|index| &run.file[index])
        .collect();

    assert_eq!(
        unmatched_after_start.len() as u64,
        run.withheld,
        "the recording holds {} tags the broadcast did not, but the gate only withheld \
         {} — the difference is unexplained",
        unmatched_after_start.len(),
        run.withheld
    );
    for tag in &unmatched_after_start {
        assert!(
            tag.track == 'v' && !tag.is_sequence_header() && !tag.is_video_keyframe(),
            "only a withheld INTER-FRAME may be in the file and not on the wire; found \
             {:?} at {} ms. Audio is never gated, so audio missing from the broadcast \
             but present on disk is a bug, not a policy.",
            tag.track,
            tag.timestamp_ms
        );
    }

    // And everything before the first match is the pre-broadcast head: produced while
    // the handshake was still in flight, so all of it is EARLIER than the broadcast.
    let first_broadcast = run.wire[0].timestamp_ms;
    for tag in &run.file[..first] {
        assert!(
            tag.timestamp_ms <= first_broadcast,
            "a pre-broadcast tag at {} ms sits after the broadcast began at {first_broadcast} ms",
            tag.timestamp_ms
        );
    }

    // Both tracks are actually present, so "identical" is not two empty lists or a
    // video-only stream agreeing with itself.
    let audio_tags = run.file.iter().filter(|tag| tag.track == 'a').count();
    let video_tags = run.file.iter().filter(|tag| tag.track == 'v').count();
    assert!(audio_tags >= 20, "only {audio_tags} audio tags reached the file");
    assert!(video_tags >= 20, "only {video_tags} video tags reached the file");
    // Audio is never gated, so the file and the wire must agree on it EXACTLY.
    let wire_audio = run.wire.iter().filter(|tag| tag.track == 'a').count();
    let file_audio_from_broadcast =
        run.file[first..].iter().filter(|tag| tag.track == 'a').count();
    assert_eq!(
        file_audio_from_broadcast, wire_audio,
        "audio is never withheld — the file and the broadcast must hold the same audio"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn a_slow_connect_still_leaves_the_recording_and_the_broadcast_the_same_wedding() {
    // THIS TEST IS A CI FAILURE, MADE PERMANENT. The guard above originally demanded
    // that the ingest's tags form a CONTIGUOUS run inside the file. It passed on this
    // machine only because the first video chunk after the handshake happened to be a
    // keyframe. On a slower runner the handshake took longer, an inter-frame landed
    // between the re-sent sequence headers and the first keyframe, `WireGate` correctly
    // withheld it — and the contiguity claim broke on a stream that was perfectly
    // correct. A 60 ms connect makes that ordering happen every time instead of
    // sometimes, so the guard is judged against the awkward case rather than the lucky
    // one.
    // Keyframes at index 0 and index 120 ONLY. The connect finishes at ~60 ms, which is
    // frame 20 at best and an earlier frame under load — always after frame 0 and always
    // long before frame 120. So there is ALWAYS at least one inter-frame between the
    // gate arming and the next keyframe, on any machine, at any load. Nothing here is
    // left to the scheduler.
    let (run, _temp) = run_with_recording_gop(
        vec![Attempt::IngestAfter(Policy::Accept, Duration::from_millis(60))],
        120,
        120,
        "slowconnect",
    )
    .await;

    assert_eq!(run.sessions, 1);
    assert!(
        run.withheld > 0,
        "the slow connect did not actually gate anything — this test is not exercising \
         the case it exists for"
    );

    let matched = matched_indices(&run.file, &run.wire)
        .expect("every broadcast tag must still be in the recording, byte for byte");
    let first = matched[0];
    assert!(
        first > 4,
        "a 60 ms handshake should leave a real pre-broadcast head on disk, got {first} tags"
    );

    // The extras are still exactly the withheld inter-frames — nothing else crept in.
    let unmatched: Vec<&WireTag> = (first..run.file.len())
        .filter(|index| !matched.contains(index))
        .map(|index| &run.file[index])
        .collect();
    assert_eq!(unmatched.len() as u64, run.withheld);
    assert!(unmatched.iter().all(|tag| tag.track == 'v' && !tag.is_video_keyframe()));

    // And the ingest still opened decodably, which is the thing the head could break.
    assert!(run.wire[0].is_sequence_header() && run.wire[1].is_sequence_header());
    // Audio was never gated even though every video frame was.
    assert!(run.wire.iter().any(|tag| tag.track == 'a' && !tag.is_sequence_header()));
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_very_first_publish_still_gets_both_sequence_headers() {
    // THE REGRESSION. The supervisor tags and records while the handshake is in
    // flight, so on a first connection the `Config` chunk is routinely consumed before
    // a socket exists — its sequence headers went to the recording and to nothing else.
    // Arming the resume only on RECONNECTS left the first session publishing pure media
    // with no avcC/asc in front of it: an undecodable stream, with no error anywhere.
    let (run, _temp) =
        run_with_recording(vec![Attempt::Ingest(Policy::Accept)], 60, "firstpublish").await;

    assert_eq!(run.sessions, 1);
    let opening: Vec<(char, bool)> =
        run.wire.iter().take(2).map(|tag| (tag.track, tag.is_sequence_header())).collect();
    assert_eq!(
        opening,
        vec![('v', true), ('a', true)],
        "the first publish opened without its decoder configuration — the ingest \
         received {} tags it could not decode",
        run.wire.len()
    );

    // And the first picture is a keyframe: a fresh publish cannot start on an
    // inter-frame any more than a resumed one can.
    let first_video = run
        .wire
        .iter()
        .find(|tag| tag.track == 'v' && !tag.is_sequence_header())
        .expect("video was published");
    assert!(
        first_video.is_video_keyframe(),
        "the first picture of a broadcast must be a keyframe, got {:#04x}",
        first_video.body[0]
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_recording_keeps_the_frames_the_wire_could_not_take_across_a_reconnect() {
    // After a reconnect the new ingest cannot decode inter-frames it has no reference
    // for, so they are withheld from the WIRE. The file is in the opposite position —
    // it holds every frame since the ceremony started, so they decode there. Dropping
    // them from the file too would punch a hole in the couple's only copy to solve a
    // problem the file does not have.
    let (run, _temp) = run_with_recording(
        vec![Attempt::Ingest(Policy::AcceptThenDrop(6)), Attempt::Ingest(Policy::Accept)],
        120,
        "reconnect",
    )
    .await;

    assert_eq!(run.sessions, 2);
    assert!(
        run.file.len() > run.wire.len(),
        "the file must hold MORE than the wire across a reconnect — file {} vs wire {}",
        run.file.len(),
        run.wire.len()
    );

    // Specifically: the file is continuous. Its media timestamps climb with no gap
    // wider than the producer's own frame spacing, on each track separately (video and
    // audio are interleaved and keep their own timelines).
    for track in ['v', 'a'] {
        let stamps: Vec<u32> = run
            .file
            .iter()
            .filter(|tag| tag.track == track && !tag.is_sequence_header())
            .map(|tag| tag.timestamp_ms)
            .collect();
        assert!(stamps.len() > 20, "too few {track} tags to judge continuity: {}", stamps.len());
        for pair in stamps.windows(2) {
            assert!(pair[1] >= pair[0], "{track} went backwards: {} then {}", pair[0], pair[1]);
            assert!(
                pair[1] - pair[0] <= 1_000,
                "{track} has a {} ms hole at {} ms — the recording lost the reconnect",
                pair[1] - pair[0],
                pair[0]
            );
        }
    }
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_recording_keeps_growing_while_nothing_is_connected_at_all() {
    // The encoders never stop. If the file only grew while a socket existed, the
    // couple's only copy would be missing exactly the minutes the broadcast was.
    let (run, _temp) = run_with_recording(
        vec![
            Attempt::Unreachable,
            Attempt::Unreachable,
            Attempt::Unreachable,
            Attempt::Ingest(Policy::Accept),
        ],
        150,
        "offline",
    )
    .await;

    assert_eq!(run.sessions, 1, "it got on air on the fourth attempt");
    let first_on_wire = run.wire.first().expect("something was published").timestamp_ms;
    let first_in_file = run
        .file
        .iter()
        .find(|tag| !tag.is_sequence_header())
        .expect("something was recorded")
        .timestamp_ms;
    assert!(
        first_in_file < first_on_wire,
        "the file starts at {first_in_file} ms and the broadcast at {first_on_wire} ms — the \
         recording did not capture the outage that preceded the first successful publish"
    );
    assert!(
        run.file.len() > run.wire.len(),
        "file {} vs wire {}",
        run.file.len(),
        run.wire.len()
    );
}

#[test]
fn a_disk_with_no_room_refuses_before_anyone_goes_live_rather_than_during_the_ceremony() {
    // The refusal threshold is the one guard here that cannot be tested by filling a
    // real disk, so it is tested where the decision is made.
    assert!(!judge_disk(0).may_record());
    assert!(!judge_disk(DISK_REFUSE_BYTES - 1).may_record());
    assert!(judge_disk(DISK_REFUSE_BYTES).may_record(), "the refusal is BELOW 2 GB, not at it");
    assert!(matches!(judge_disk(DISK_REFUSE_BYTES - 1), DiskVerdict::Refuse { .. }));

    // And the operator is told a sentence they can act on, not a number.
    let sentence = judge_disk(1_000_000_000).sentence();
    assert!(sentence.contains("free up space"), "got {sentence}");
    assert!(!sentence.is_empty());
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn a_recording_that_dies_mid_ceremony_does_not_take_the_broadcast_with_it() {
    // A disk that fills at 19:40 must cost the file, never the wedding.
    struct DiesAfter {
        remaining: usize,
        faulted: bool,
    }
    impl setnayan_encoder::tagger::TagSink for DiesAfter {
        fn accept(
            &mut self,
            _frame: &setnayan_encoder::tagger::TaggedFrame,
        ) -> std::io::Result<()> {
            if self.remaining == 0 {
                self.faulted = true;
                return Err(std::io::Error::from(std::io::ErrorKind::StorageFull));
            }
            self.remaining -= 1;
            Ok(())
        }

        fn fault(&self) -> Option<String> {
            self.faulted.then(|| "the disk filled".to_string())
        }
    }

    let connector = ScriptedConnector::new([Attempt::Ingest(Policy::Accept)]);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, _event_rx) = mpsc::channel(512);
    spawn_producer(tx, 90);

    let mut pipeline =
        Pipeline::new(Tagger::new(), Box::new(DiesAfter { remaining: 5, faulted: false }));
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

    // THE GUARD: the stream ran to a clean finish on ONE session. A recording failure
    // that reconnected, or ended the broadcast, would show up as either of these.
    assert!(matches!(outcome.stop, StopReason::ProducerFinished), "got {:?}", outcome.stop);
    assert_eq!(outcome.sessions, 1, "the broadcast was interrupted by a disk problem");
    assert_eq!(outcome.reconnects, 0);
    assert!(outcome.stats.video_tags > 10, "the wedding kept streaming after the disk died");

    // And the failure was not swallowed — the operator can be told.
    assert_eq!(outcome.recording_fault.as_deref(), Some("the disk filled"));

    let reports = connector.reports().await;
    assert!(reports[0].media().len() > 10);
}
