/**
 * DSK-1 · the ingest address the own-channel paste field SHOWS the couple when
 * they leave the server box empty.
 *
 * ── THIS IS A LABEL, NOT THE DECISION ───────────────────────────────────────
 * The decision lives in Rust, once: `YOUTUBE_RTMPS_PRIMARY` in
 * src-tauri/src/stream_key.rs is what a key with no address is actually held
 * against. `pasteSubmit` deliberately returns `rtmpsUrl: null` for an empty
 * field rather than filling this in, so the web half cannot become a second
 * source of truth for where a wedding publishes.
 *
 * But a couple staring at an empty box needs to be told what empty MEANS, and
 * telling them requires the string. So it is duplicated here for display — and
 * `live-studio-encoder-ingest-default.test.ts` reads the Rust file and fails if
 * the two ever stop matching. A displayed default that has drifted from the real
 * one is worse than no default shown at all: it is a promise about where the
 * ceremony is going.
 */
export const YOUTUBE_RTMPS_PRIMARY_LABEL = 'rtmps://a.rtmps.youtube.com/live2';
