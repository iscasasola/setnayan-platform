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

/// Everything a supervised run produced: what the ingests saw, and what is on disk.
struct Run {
    wire: Vec<WireTag>,
    file: Vec<WireTag>,
    sessions: u32,
}

async fn run_with_recording(plan: Vec<Attempt>, frames: u64, label: &str) -> (Run, TempDir) {
    let temp = TempDir::new(label);
    let path = temp.join("wedding.flv");
    let connector = ScriptedConnector::new(plan);
    let (tx, mut rx) = mpsc::channel(256);
    let (events, _event_rx) = mpsc::channel(512);
    spawn_producer(tx, frames);

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
    drop(pipeline); // closes the file

    let wire: Vec<WireTag> =
        connector.reports().await.into_iter().flat_map(|report| report.tags).collect();
    let file = parse_flv(&std::fs::read(&path).expect("read the recording back"));
    (Run { wire, file, sessions: outcome.sessions }, temp)
}

/// Where the ingest's tags begin inside the recording — the recording starts EARLIER,
/// because the supervisor tags and records while the TCP handshake is still in flight.
///
/// Returns the offset of the byte-identical, order-identical, gap-free run. `None`
/// means the file is not the same wedding, which is the whole thing being asserted.
fn alignment(file: &[WireTag], wire: &[WireTag]) -> Option<usize> {
    if wire.is_empty() || wire.len() > file.len() {
        return None;
    }
    (0..=file.len() - wire.len()).find(|&start| &file[start..start + wire.len()] == wire)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn every_tag_the_ingest_received_is_in_the_recording_byte_for_byte_and_in_order() {
    // THE GUARD the whole "one tagger, two sinks" design exists for. Not "the same
    // number of tags", not "the same duration" — the same BYTES, contiguously, in the
    // same order, at the same timestamps. Sabotage: skip audio tags on the way to the
    // file, or re-tag for the file instead of reusing the frame, and no alignment
    // exists at all.
    //
    // It is a CONTIGUOUS RUN rather than whole-list equality because the file
    // legitimately starts earlier: the supervisor records while it is still connecting,
    // so a clean wedding has a short pre-broadcast head on disk. That head is asserted
    // below rather than waved away.
    let (run, _temp) =
        run_with_recording(vec![Attempt::Ingest(Policy::Accept)], 25, "clean").await;

    assert_eq!(run.sessions, 1, "no reconnect in this scenario");
    assert!(run.wire.len() > 40, "not enough of a stream to prove anything: {}", run.wire.len());

    let start = alignment(&run.file, &run.wire).unwrap_or_else(|| {
        panic!(
            "the recording and the broadcast are not the same wedding — the {} tags the \
             ingest received do not appear as a contiguous byte-identical run inside the \
             {} tags on disk",
            run.wire.len(),
            run.file.len()
        )
    });

    // The head on disk is exactly the frames produced before the publish began, and
    // every one of them is EARLIER than the first tag that made it to YouTube.
    let first_broadcast = run.wire[0].timestamp_ms;
    for tag in &run.file[..start] {
        assert!(
            tag.timestamp_ms <= first_broadcast,
            "a pre-broadcast tag at {} ms sits after the broadcast began at {first_broadcast} ms",
            tag.timestamp_ms
        );
    }
    // And nothing is appended past the broadcast in this scenario — the producer and
    // the session ended together.
    assert_eq!(
        start + run.wire.len(),
        run.file.len(),
        "the recording has {} tags after the broadcast ended",
        run.file.len() - start - run.wire.len()
    );

    // Both tracks are actually present, so "identical" is not two empty lists or a
    // video-only stream agreeing with itself.
    let audio_tags = run.file.iter().filter(|tag| tag.track == 'a').count();
    let video_tags = run.file.iter().filter(|tag| tag.track == 'v').count();
    assert!(audio_tags >= 25, "only {audio_tags} audio tags reached the file");
    assert!(video_tags >= 25, "only {video_tags} video tags reached the file");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
async fn the_very_first_publish_still_gets_both_sequence_headers() {
    // THE REGRESSION. The supervisor tags and records while the handshake is in
    // flight, so on a first connection the `Config` chunk is routinely consumed before
    // a socket exists — its sequence headers went to the recording and to nothing else.
    // Arming the resume only on RECONNECTS left the first session publishing pure media
    // with no avcC/asc in front of it: an undecodable stream, with no error anywhere.
    let (run, _temp) =
        run_with_recording(vec![Attempt::Ingest(Policy::Accept)], 25, "firstpublish").await;

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
        40,
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
        40,
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
    spawn_producer(tx, 30);

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
