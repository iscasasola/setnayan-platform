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

use std::time::Duration;

use setnayan_desktop_lib::encoder::contract::{ChunkHeader, ChunkKind, DecoderConfig, EncodedChunk};
use setnayan_desktop_lib::encoder::flv::StreamMeta;
use setnayan_desktop_lib::encoder::rtmp::RtmpEndpoint;
use setnayan_desktop_lib::encoder::sender::{EndReason, RtmpSender};
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
    let mut arguments = std::env::args().skip(1);
    while let Some(argument) = arguments.next() {
        match argument.as_str() {
            "--url" => url = arguments.next().unwrap_or_default(),
            "--key" => key = arguments.next(),
            "--seconds" => seconds = arguments.next().unwrap_or_default().parse().unwrap_or(60),
            "--start-ms" => start_ms = arguments.next().unwrap_or_default().parse().unwrap_or(0),
            other => {
                eprintln!("unknown argument {other}");
                std::process::exit(2);
            }
        }
    }
    if url.is_empty() {
        eprintln!("usage: publish_probe --url rtmp[s]://host/app[/key] [--key K] [--seconds N] [--start-ms M]");
        std::process::exit(2);
    }

    let endpoint = match RtmpEndpoint::parse(&url, key.as_deref()) {
        Ok(endpoint) => endpoint,
        Err(error) => {
            eprintln!("bad destination: {error}");
            std::process::exit(2);
        }
    };
    // Note what is printed: the redacted URL. This tool holds a real stream key when
    // it is pointed at YouTube, and its output tends to end up pasted into a session log.
    println!("publishing to {} for {seconds}s of stream time", endpoint.redacted_url());
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
    let sender = match RtmpSender::connect(endpoint, StreamMeta::defaults_720p30()).await {
        Ok(sender) => sender,
        Err(error) => {
            println!("CONNECT FAILED after {:?}: {error}", began.elapsed());
            std::process::exit(1);
        }
    };
    println!("connected and publishing after {:?}", began.elapsed());

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

        let mut sent = 0u64;
        let mut loop_index = 0u64;
        loop {
            let loop_offset_ms = loop_index * media.loop_ms as u64;
            if loop_offset_ms >= seconds * 1_000 {
                return sent;
            }
            for (is_video, keyframe, timestamp_ms, payload) in &media.tags {
                let ts_us = base_us + (loop_offset_ms + *timestamp_ms as u64) * 1_000;
                let chunk = EncodedChunk {
                    header: ChunkHeader {
                        kind: if *is_video { ChunkKind::Video } else { ChunkKind::Audio },
                        keyframe: *keyframe,
                        seq,
                        ts_us,
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

    let outcome = sender.run(&mut rx).await;
    drop(rx);
    let sent = tokio::time::timeout(Duration::from_secs(30), producer)
        .await
        .map(|joined| joined.unwrap_or(0))
        .unwrap_or(0);

    println!("--------------------------------------------------");
    println!("wall clock            {:?}", began.elapsed());
    println!("chunks produced       {sent}");
    println!("video tags published  {}", outcome.stats.video_tags);
    println!("audio tags published  {}", outcome.stats.audio_tags);
    println!("bytes published       {}", outcome.stats.bytes_published);
    println!("dropped before config {}", outcome.stats.media_before_config);
    println!("clamped timestamps    {}", outcome.stats.clamped_timestamps);
    println!("past 24-bit ceiling   {}", outcome.stats.past_24_bit_ceiling);
    match outcome.reason {
        EndReason::ProducerFinished => println!("ended                 producer finished (clean)"),
        EndReason::Failed(error) => {
            println!("ended                 FAILED: {error}");
            std::process::exit(1);
        }
    }
}
