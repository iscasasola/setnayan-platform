//! A REAL SOCKET, FOR THE EVIDENCE THE TESTS CANNOT GIVE.
//!
//! `tests/publish_session.rs` proves the protocol against an in-memory peer. This
//! proves it against something that writes a file you can `ffprobe`: it replays the
//! committed 2-second FLV fixture through the actual `RtmpSender` — TLS and all when
//! the URL says `rtmps` — advancing timestamps on each loop, so a few seconds of
//! wall-clock produces hours of stream time.
//!
//! ```sh
//! # a local ingest, no install: ffmpeg itself will listen
//! ffmpeg -loglevel warning -listen 1 -f flv -i rtmp://127.0.0.1:1935/live/test \
//!        -c copy -y /tmp/dump.flv &
//! cargo run --example publish_probe -- --url rtmp://127.0.0.1:1935/live/test --seconds 600
//! ffprobe -show_packets /tmp/dump.flv
//!
//! # start near the 24-bit chunk-timestamp ceiling (4 h 39 m 37 s) and walk over it
//! cargo run --example publish_probe -- --url rtmp://…/live/test --start-ms 16770000 --seconds 60
//! ```
//!
//! `--start-ms` is the point: it is how you watch a real ingest accept extended
//! timestamps without waiting four and a half hours to find out that it does not.
//!
//! S7 ADDED `--realtime`, AND THE RECONNECT EVIDENCE NEEDS IT. Without it the producer
//! runs flat out and twenty minutes of stream time is over in seconds — there is no
//! window in which to pull a cable. `--realtime` paces the fixture to the wall clock,
//! which is what makes this the tool for the acceptance run:
//!
//! ```sh
//! cargo run --example publish_probe -- \
//!   --url rtmps://a.rtmps.youtube.com/live2 --key "$YT_KEY" \
//!   --backup-url rtmps://b.rtmps.youtube.com/live2?backup=1 \
//!   --realtime --seconds 1200 --record /tmp/s7-evidence.flv
//! # …and toggle the wifi off and on three times while it runs.
//! ffprobe -show_packets /tmp/s7-evidence.flv
//! ```
//!
//! Every health event is printed with the wall-clock time it happened, so the log this
//! prints IS the evidence — `Reconnecting for_ms=…` beside `Publishing resumed=true`
//! is what "it survived" looks like.

use std::time::Duration;

use setnayan_encoder::contract::{ChunkHeader, ChunkKind, DecoderConfig, EncodedChunk};
use setnayan_encoder::flv::StreamMeta;
use setnayan_encoder::rtmp::RtmpEndpoint;
use setnayan_encoder::file_sink::{judge_disk_for, CivilDate, FlvFileWriter};
use setnayan_encoder::reconnect::{
    supervise, Destinations, HealthEvent, NetworkConnector, RetryPolicy, StopReason,
};
use setnayan_encoder::tagger::{NoRecording, Pipeline, TagSink, Tagger};
use tokio::sync::mpsc;

const FIXTURE: &[u8] = include_bytes!("../tests/fixtures/two-seconds-h264-aac.flv");

struct Media {
    avc_c: Vec<u8>,
    asc: Vec<u8>,
    /// `(is_video, keyframe, timestamp_ms, payload)` — payload with the FLV tag
    /// header already stripped, which is the form the encoder produces.
    tags: Vec<(bool, bool, u32, Vec<u8>)>,
    loop_ms: u32,
}

fn read_fixture() -> Media {
    let data_offset = u32::from_be_bytes([FIXTURE[5], FIXTURE[6], FIXTURE[7], FIXTURE[8]]) as usize;
    let mut cursor = data_offset + 4;
    let mut media = Media { avc_c: Vec::new(), asc: Vec::new(), tags: Vec::new(), loop_ms: 0 };
    while cursor + 11 <= FIXTURE.len() {
        let tag_type = FIXTURE[cursor];
        let size = u32::from_be_bytes([0, FIXTURE[cursor + 1], FIXTURE[cursor + 2], FIXTURE[cursor + 3]])
            as usize;
        let timestamp = u32::from_be_bytes([
            FIXTURE[cursor + 7],
            FIXTURE[cursor + 4],
            FIXTURE[cursor + 5],
            FIXTURE[cursor + 6],
        ]);
        let body = &FIXTURE[cursor + 11..cursor + 11 + size];
        match tag_type {
            9 if body[1] == 0 => media.avc_c = body[5..].to_vec(),
            // AVCPacketType 2 is end-of-sequence: an empty tag that closes the stream.
            // Replaying it once per loop would publish 295 tags a demuxer discards, and
            // make this tool's own "video tags published" count disagree with what
            // `ffprobe` sees on the far end by exactly the number of loops. Skip it.
            9 if body[1] == 2 => {}
            9 => media.tags.push((true, body[0] >> 4 == 1, timestamp, body[5..].to_vec())),
            8 if body[1] == 0 => media.asc = body[2..].to_vec(),
            8 => media.tags.push((false, false, timestamp, body[2..].to_vec())),
            _ => {}
        }
        media.loop_ms = media.loop_ms.max(timestamp);
        cursor += 11 + size + 4;
    }
    // One frame interval past the last tag, so a loop does not repeat a timestamp.
    media.loop_ms += 33;
    media
}

#[tokio::main(flavor = "multi_thread", worker_threads = 2)]
async fn main() {
    let mut url = String::new();
    let mut key: Option<String> = None;
    let mut seconds = 60u64;
    let mut start_ms = 0u64;
    let mut backup_url: Option<String> = None;
    let mut record: Option<std::path::PathBuf> = None;
    let mut realtime = false;
    let mut arguments = std::env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--url" => url = arguments.next().unwrap_or_default(),
            "--key" => key = arguments.next(),
            "--seconds" => seconds = arguments.next().unwrap_or_default().parse().unwrap_or(60),
            "--start-ms" => start_ms = arguments.next().unwrap_or_default().parse().unwrap_or(0),
            "--backup-url" => backup_url = arguments.next(),
            "--realtime" => realtime = true,
            // `--record` with no path writes where the app will: ~/Movies/Setnayan.
            "--record" => {
                record = Some(match arguments.next() {
                    Some(path) if !path.starts_with("--") => std::path::PathBuf::from(path),
                    _ => {
                        let home = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
                        setnayan_encoder::file_sink::recording_path(
                            std::path::Path::new(&home),
                            "S89EV-PROBE",
                            CivilDate::today_utc(),
                        )
                    }
                });
            }
            other => {
                eprintln!("unknown argument {other}");
                std::process::exit(2);
            }
        }
    }
    if url.is_empty() {
        eprintln!(
            "usage: publish_probe --url rtmp[s]://host/app[/key] [--key K] [--seconds N] \
             [--start-ms M] [--backup-url URL] [--record [PATH]] [--realtime]"
        );
        std::process::exit(2);
    }

    let endpoint = match RtmpEndpoint::parse(&url, key.as_deref()) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            eprintln!("bad destination: {error}");
            std::process::exit(2);
        }
    };
    let backup = match &backup_url {
        Some(address) => match RtmpEndpoint::parse(address, key.as_deref()) {
            Ok(endpoint) => Some(endpoint),
            Err(error) => {
                eprintln!("bad backup destination: {error}");
                std::process::exit(2);
            }
        },
        None => None,
    };
    // Note what is printed: the redacted URL. This tool holds a real stream key when
    // it is pointed at YouTube, and its output tends to end up pasted into a session log.
    println!("publishing to {} for {seconds}s of stream time", endpoint.redacted_url());
    if let Some(backup) = &backup {
        println!("backup ingest {}", backup.redacted_url());
    }
    if realtime {
        println!("pacing to the wall clock — cut the network while this runs");
    }
    if start_ms > 0 {
        println!("starting the clock at {start_ms} ms ({:.2} h)", start_ms as f64 / 3_600_000.0);
    }

    let media = read_fixture();
    println!(
        "fixture: {} tags, {} ms per loop, avcC {} bytes, asc {} bytes",
        media.tags.len(),
        media.loop_ms,
        media.avc_c.len(),
        media.asc.len()
    );

    let began = std::time::Instant::now();

    // ── the recording ──────────────────────────────────────────────────────
    let (sink, recording_path): (Box<dyn TagSink>, Option<std::path::PathBuf>) = match &record {
        Some(path) => {
            match judge_disk_for(path) {
                Ok(verdict) => {
                    println!("disk: {} — {}", verdict.free_bytes(), verdict.sentence());
                    if !verdict.may_record() {
                        eprintln!("refusing to record to a disk this full");
                        std::process::exit(1);
                    }
                }
                Err(error) => println!("disk: could not be read ({error}) — recording anyway"),
            }
            match FlvFileWriter::create(path) {
                Ok(writer) => {
                    println!("recording to {}", writer.path().display());
                    (Box::new(writer), Some(path.clone()))
                }
                Err(error) => {
                    eprintln!("could not open the recording at {}: {error}", path.display());
                    std::process::exit(1);
                }
            }
        }
        None => (Box::new(NoRecording), None),
    };
    let mut pipeline = Pipeline::new(Tagger::new(), sink);

    // ── the producer, started BEFORE the connect ───────────────────────────
    // The supervisor records while it is connecting, which is the whole point of S7 —
    // so the chunks must already be flowing when it starts.
    let (tx, mut rx) = mpsc::channel(256);
    let producer = tokio::spawn(async move {
        let base_us = start_ms * 1_000;
        let mut seq = 0u32;
        let config = EncodedChunk {
            header: ChunkHeader { kind: ChunkKind::Config, keyframe: false, seq, ts_us: base_us },
            payload: DecoderConfig { avc_c: media.avc_c.clone(), asc: media.asc.clone() }
                .encode_payload(),
        };
        if tx.send(config).await.is_err() {
            return 0u64;
        }
        seq += 1;

        let started = std::time::Instant::now();
        let mut sent = 0u64;
        let mut loop_index = 0u64;
        loop {
            let loop_offset_ms = loop_index * media.loop_ms as u64;
            if loop_offset_ms >= seconds * 1_000 {
                return sent;
            }
            for (is_video, keyframe, timestamp_ms, payload) in &media.tags {
                let stream_ms = loop_offset_ms + *timestamp_ms as u64;
                if realtime {
                    // Pace to the wall clock so there is a real twenty minutes in which
                    // to unplug something.
                    let due = Duration::from_millis(stream_ms);
                    let elapsed = started.elapsed();
                    if due > elapsed {
                        tokio::time::sleep(due - elapsed).await;
                    }
                }
                let chunk = EncodedChunk {
                    header: ChunkHeader {
                        kind: if *is_video { ChunkKind::Video } else { ChunkKind::Audio },
                        keyframe: *keyframe,
                        seq,
                        ts_us: base_us + stream_ms * 1_000,
                    },
                    payload: payload.clone(),
                };
                seq = seq.wrapping_add(1);
                if tx.send(chunk).await.is_err() {
                    return sent;
                }
                sent += 1;
            }
            loop_index += 1;
        }
    });

    // ── the health-event log, which is the evidence ────────────────────────
    let (events, mut event_rx) = mpsc::channel(256);
    let printer = tokio::spawn(async move {
        let clock = std::time::Instant::now();
        while let Some(event) = event_rx.recv().await {
            let at = clock.elapsed().as_secs_f64();
            match event {
                HealthEvent::Connecting { attempt, ingest } => {
                    println!("[{at:8.2}s] connecting    attempt={attempt} ingest={}", ingest.label())
                }
                HealthEvent::Publishing { ingest, resumed } => println!(
                    "[{at:8.2}s] PUBLISHING    ingest={} resumed={resumed}",
                    ingest.label()
                ),
                HealthEvent::Reconnecting { for_ms, attempt, next_attempt_in_ms, detail } => println!(
                    "[{at:8.2}s] reconnecting  for_ms={for_ms} attempt={attempt} \
next_in_ms={next_attempt_in_ms} — {detail}"
                ),
                HealthEvent::Down { for_ms, detail } => {
                    println!("[{at:8.2}s] DOWN          for_ms={for_ms} — {detail}")
                }
                HealthEvent::BroadcastEnded { detail } => {
                    println!("[{at:8.2}s] BROADCAST ENDED — {detail}")
                }
                HealthEvent::RecordingStopped { detail } => {
                    println!("[{at:8.2}s] RECORDING STOPPED — {detail}")
                }
                HealthEvent::DiskLow { free_bytes } => {
                    println!("[{at:8.2}s] disk low      free_bytes={free_bytes}")
                }
            }
        }
    });

    let destinations = match backup {
        Some(backup) => Destinations::with_backup(endpoint, backup),
        None => Destinations::new(endpoint),
    };
    let outcome = supervise(
        &NetworkConnector,
        &destinations,
        StreamMeta::defaults_720p30(),
        &mut rx,
        &mut pipeline,
        &events,
        &RetryPolicy::default(),
    )
    .await;

    drop(rx);
    drop(events);
    let sent = tokio::time::timeout(Duration::from_secs(30), producer)
        .await
        .map(|joined| joined.unwrap_or(0))
        .unwrap_or(0);
    let _ = tokio::time::timeout(Duration::from_secs(5), printer).await;

    let recorded_frames = pipeline.recorded_frames();
    let fault = pipeline.recording_fault();
    drop(pipeline);

    println!("--------------------------------------------------");
    println!("wall clock            {:?}", began.elapsed());
    println!("chunks produced       {sent}");
    println!("sessions              {}", outcome.sessions);
    println!("reconnects            {}", outcome.reconnects);
    println!("failed attempts       {}", outcome.failed_attempts);
    println!("longest outage        {} ms", outcome.longest_outage_ms);
    println!("used backup ingest    {}", outcome.used_backup);
    println!("video tags published  {}", outcome.stats.video_tags);
    println!("audio tags published  {}", outcome.stats.audio_tags);
    println!("bytes published       {}", outcome.stats.bytes_published);
    println!("dropped before config {}", outcome.stats.media_before_config);
    println!("clamped timestamps    {}", outcome.stats.clamped_timestamps);
    println!("past 24-bit ceiling   {}", outcome.stats.past_24_bit_ceiling);
    println!("frames recorded       {recorded_frames}");
    if let Some(path) = &recording_path {
        println!("recording             {}", path.display());
    }
    match fault {
        Some(detail) => println!("recording fault       {detail}"),
        None if recording_path.is_some() => println!("recording fault       none"),
        None => {}
    }
    match outcome.stop {
        StopReason::ProducerFinished => println!("ended                 producer finished (clean)"),
        StopReason::BroadcastEnded { detail } => {
            println!("ended                 BROADCAST ENDED: {detail}");
            std::process::exit(1);
        }
        StopReason::GaveUp { detail } => {
            println!("ended                 GAVE UP: {detail}");
            std::process::exit(1);
        }
    }
}
