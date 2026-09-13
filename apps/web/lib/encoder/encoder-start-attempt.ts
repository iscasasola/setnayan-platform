/**
 * DSK-1 · MAY THE ENCODER TRY TO START RIGHT NOW?
 *
 * `DesktopEncoderHost` now has two things that can ask it to start — the effect
 * itself when the event goes on air, and a stream key reaching Rust afterwards
 * (`encoder-key-bus.ts`). Two callers into one start path is exactly where the
 * mistakes are, and the component is a `.tsx` with no test harness in this repo,
 * so the decision lives here where a plain Node test can pin it.
 *
 * Each field earns its place by naming a failure that would otherwise ship:
 *
 * · `started` — without it, a key pasted after a SUCCESSFUL start would open a
 *   second `encoder_start`, i.e. a second RTMP publish of the same wedding to
 *   the same key. YouTube drops one of the two, mid-ceremony.
 * · `starting` — without it, a couple who pastes twice quickly (or pastes while
 *   the first attempt's token mint is still in flight) gets two concurrent
 *   starts, because `started` is not true yet. This is the in-flight half of the
 *   same defect and a boolean-per-attempt cannot see it.
 * · `cancelled` — the effect's teardown ran: the broadcast ended, or the page
 *   navigated. Starting after that publishes from a component nothing will ever
 *   stop.
 *
 * It deliberately does NOT take "is a key held". This side cannot know that:
 * Rust holds the key and `destinations()` never hands it back (`stream_key.rs`'s
 * threat model forbids a `-> String` accessor). Asking is the attempt — Rust
 * answers `no_stream_key` — which is why a refused attempt must leave `started`
 * false rather than being prevented by a guess about the key.
 */

export type StartAttemptState = {
  /** The effect's teardown has run. */
  cancelled: boolean;
  /** A previous attempt reached `encoder_start` and it resolved. */
  started: boolean;
  /** An attempt is in flight right now. */
  starting: boolean;
};

export function shouldAttemptStart(state: StartAttemptState): boolean {
  return !state.cancelled && !state.started && !state.starting;
}
