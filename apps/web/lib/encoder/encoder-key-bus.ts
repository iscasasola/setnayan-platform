/**
 * DSK-1 · "A KEY IS NOW HELD" — the signal that makes a pasted key reach the
 * encoder without reloading the page.
 *
 * ── WHY IT HAS TO EXIST ─────────────────────────────────────────────────────
 * `DesktopEncoderHost` starts the moment the event is on air (`isLive`), and on
 * the own-channel route that is BEFORE the couple has had anywhere to paste a
 * key. Its start attempt therefore throws `no_stream_key`, lands in its own
 * `catch`, sets `rtmp = 'idle'` and gives up — its effect is keyed on
 * `[shouldRun, eventId]`, neither of which changes when a key arrives. So the
 * couple pasted a key, was told "Saved to your desktop encoder", and nothing
 * ever tried again. Pasting a key has to be an EVENT the encoder hears, not a
 * fact it happens never to re-read.
 *
 * This is the same lesson as `panood-controller-never-re-renders`: a correct
 * answer that nothing re-asks is still a wrong screen.
 *
 * ── WHY A MODULE BUS AND NOT A CONTEXT ──────────────────────────────────────
 * Identical reasoning to `encoder-health-bus.ts` beside it, and deliberately the
 * same shape so there is one pattern here rather than two: the paste panel and
 * the encoder host are siblings under a SERVER component (the controller page),
 * so neither can hold the other's state and there is no client parent to lift it
 * into. This is ~40 lines, testable in Node with no React at all.
 *
 * ── WHAT IT DOES NOT CARRY ──────────────────────────────────────────────────
 * NOT THE KEY, and not the address either. The key crosses the Tauri IPC
 * boundary exactly once, from the submit handler straight into Rust
 * (`stream_key.rs`'s threat model, and `live-studio-encoder-key-paste.ts`'s
 * clearing guarantee). Putting it on a module-level singleton would keep it
 * alive in the renderer for the life of the page — the precise thing that whole
 * design exists to prevent. Rust already holds the key; all the host needs to
 * know is that the holding HAPPENED, so this carries a count and nothing else.
 */

type Listener = () => void;

/**
 * How many keys have been successfully handed to Rust for this event. A count
 * rather than a boolean so a RE-paste — the couple fixed a typo'd key — is a
 * distinguishable new event and not a no-op against an already-true flag.
 */
const handedOver = new Map<string, number>();
const listeners = new Set<Listener>();

/**
 * Announce that Rust is now holding a key for this event. Call it ONLY after the
 * invoke resolves: announcing on submit would wake the encoder for a key Rust
 * went on to refuse, and its retry would fail for a reason the couple was never
 * shown.
 */
export function announceStreamKeyHeld(eventId: string): void {
  handedOver.set(eventId, (handedOver.get(eventId) ?? 0) + 1);
  for (const listener of listeners) listener();
}

/** How many times a key has been handed to Rust for this event this session. */
export function readStreamKeyHandoffs(eventId: string): number {
  return handedOver.get(eventId) ?? 0;
}

/** Subscribe to any handoff. Returns the unsubscribe. */
export function subscribeStreamKeyHeld(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset, so one test's handoff cannot leak into the next. */
export function resetStreamKeyBus(): void {
  handedOver.clear();
  listeners.clear();
}
