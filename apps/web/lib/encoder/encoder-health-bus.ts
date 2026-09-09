/**
 * S18 · one reading, two components, no second decider.
 *
 * `DesktopEncoderHost` produces the encoder's health; `IngestHealthStrip`
 * renders it. They are siblings under a SERVER component (the controller page),
 * so neither can hold the other's state and there is no client parent to lift
 * it into.
 *
 * ── WHY A MODULE BUS AND NOT A CONTEXT ──────────────────────────────────────
 * A provider would have to wrap a large part of a server-rendered tree to put
 * two leaves in scope, turning page structure into a data-plumbing decision.
 * This is 40 lines, it is testable in Node with no React at all, and the
 * subscription is explicit.
 *
 * ── WHY IT IS KEYED BY EVENT ────────────────────────────────────────────────
 * A module-level singleton outlives a route change. Without the key, opening
 * one wedding's controller and then another's would show the FIRST one's
 * encoder reading over the second one's strip — a stale green over a stream
 * that was never started. Readers ask for their own event and get `null` for
 * anyone else's.
 *
 * `decideIngestHealth` remains the only thing that turns this into a state.
 * This module transports; it never judges (rule 24).
 */

import type { EncoderHealthInput } from '../live-studio-ingest-health';

type Listener = () => void;

const readings = new Map<string, EncoderHealthInput>();
const listeners = new Set<Listener>();

/**
 * Publish this event's reading, or clear it with `null` when the encoder stops.
 * Clearing matters: a strip that keeps rendering the last reading after the
 * broadcast ended is showing a measurement of nothing.
 */
export function publishEncoderHealth(eventId: string, input: EncoderHealthInput | null): void {
  if (input === null) readings.delete(eventId);
  else readings.set(eventId, input);
  for (const listener of listeners) listener();
}

/** This event's latest reading, or `null` when no desktop encoder is running. */
export function readEncoderHealth(eventId: string): EncoderHealthInput | null {
  return readings.get(eventId) ?? null;
}

/** Subscribe to any change. Returns the unsubscribe. */
export function subscribeEncoderHealth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test-only reset, so one test's publish cannot leak into the next. */
export function resetEncoderHealthBus(): void {
  readings.clear();
  listeners.clear();
}
