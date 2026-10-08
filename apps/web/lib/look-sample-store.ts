/**
 * lib/look-sample-store.ts — WHAT A LOOK CONTROL JUST PICKED, FOR THE SAMPLE SCREEN.
 *
 * Studio › Look's sample screen (`look-sample.tsx`) is drawn in the browser from
 * the values in hand, and it answers every control AT THE TAP — before the
 * pick's one draft write has answered, and with no server render at all (owner
 * 2026-10-08, DECISION_LOG "THE LOOK PREVIEW IS A SAMPLE OF WHAT IS BEING
 * EDITED"; the minimum-request rules: a pick = one write, zero renders).
 *
 * A held save owes no Maker render, so the values the server handed down stay as
 * they were at the last one. Each control therefore TELLS this store what it
 * drew (`tellLookSample`), and the sample reads the server's values with those
 * laid over (`readLookSample`).
 *
 * WHICH ONE WINS, per value — by content, never by a clock (the rule of
 * `lib/maker-draft-store.ts`):
 *   · the server's equals ours                         → it caught up: ours is dropped;
 *   · the server's is still the one ours was told over → ours;
 *   · the server's moved on to something else (Undo, Restore, another tab)
 *                                                      → the server's: ours is dropped.
 * A refused save tells the old value again — the sample goes back with the control.
 *
 * No timers, no polls: a tell notifies the listeners once; nothing asks when
 * nothing happened.
 */
import type { HubMainGround } from './hub-canvas';

/** The values a Look control can change — each exactly as the draft holds it. */
export type LookSampleValues = {
  /** `widgets.hero.main` — the main background. */
  main: HubMainGround | null;
  /** `events.site_bg_color` — a hex, or an encoded blend (`lib/ombre.ts`). */
  bg: string | null;
  /** `events.site_art_direction`. */
  art: 'daylight' | 'candlelight' | null;
  /** `events.role_palette.reception` — the Mood Board's five. */
  five: readonly string[];
  /** `events.site_font_key` — the Headings face. */
  fontKey: string | null;
  /** `events.site_button_style` / `events.site_button_color`. */
  buttonStyle: string | null;
  buttonColour: string | null;
};

type Told = { value: unknown; fp: string; base: string | null };

const fingerprint = (v: unknown): string => JSON.stringify(v ?? null);

/** The pure core — `lib/the-look-sample-answers-at-once.test.ts` drives it. */
export function createLookSampleStore() {
  const told = new Map<string, Map<string, Told>>();
  const listeners = new Set<() => void>();
  let version = 0;
  return {
    /** A control drew this — the sample wears it from now, until the server shows the same or something newer. */
    tell(eventId: string, patch: Partial<LookSampleValues>): void {
      let mine = told.get(eventId);
      if (!mine) told.set(eventId, (mine = new Map()));
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) continue;
        const had = mine.get(key);
        /* `base` is filled by the first read after the tell: the server's value this one was told over. */
        mine.set(key, { value, fp: fingerprint(value), base: had ? had.base : null });
      }
      version += 1;
      for (const hear of listeners) hear();
    },
    /** The values the sample draws: the server's, with every pick still newer than it laid over. */
    read<T extends Partial<LookSampleValues>>(eventId: string, server: T): T {
      const mine = told.get(eventId);
      if (!mine || mine.size === 0) return server;
      const out: Record<string, unknown> = { ...server };
      for (const [key, own] of [...mine]) {
        const theirs = fingerprint((server as Record<string, unknown>)[key]);
        if (theirs === own.fp) {
          mine.delete(key);
          continue;
        }
        if (own.base === null) own.base = theirs;
        if (theirs !== own.base) {
          mine.delete(key);
          continue;
        }
        out[key] = own.value;
      }
      return out as T;
    },
    subscribe(hear: () => void): () => void {
      listeners.add(hear);
      return () => {
        listeners.delete(hear);
      };
    },
    /** Moves with every tell — `useSyncExternalStore`'s snapshot. */
    version: () => version,
    /** Values still held for an event — the test's probe. */
    held: (eventId: string) => told.get(eventId)?.size ?? 0,
  };
}

const shared = createLookSampleStore();

/** A Look control drew a pick: tell the sample screen (and nothing else — this writes nowhere). */
export function tellLookSample(eventId: string, patch: Partial<LookSampleValues>): void {
  shared.tell(eventId, patch);
}

export const readLookSample: typeof shared.read = (eventId, server) => shared.read(eventId, server);
export const subscribeLookSample = shared.subscribe;
export const lookSampleVersion = shared.version;

/* ── ✨ what the sample is drawing its effect over ─────────────────────────────────────────────────────────────
   The Effects carousel's miniatures (`background-effects.tsx`) must be the SAME drawing as the sample screen —
   the same ground colour (so the same light/dark variant and the same pulled colour) and the same five. The
   sample measures those once per render it changes on, and says so here; the cards read it. One measure, two
   readers: a card can never show an effect the sample would draw differently. Told from an effect (never
   during a render); asks for nothing; no timer. */
export type LookSampleWorn = {
  /** `ambientGround(…)` — the average of what the effect lies on, as the page draws it. */
  ground: string;
  /** The palette's five, in slot order, with every pick laid over. */
  five: readonly string[];
  /** What lies over the picture, as a CSS colour (a Fade's veil, or the page's paper scrim) — null: nothing. */
  veil: string | null;
  /** The couple's names, for a card's two small lines of words. */
  names: string | null;
};
const worn = new Map<string, LookSampleWorn>();
const wornHears = new Set<() => void>();

export function tellLookSampleWorn(eventId: string, value: LookSampleWorn): void {
  if (fingerprint(worn.get(eventId)) === fingerprint(value)) return;
  worn.set(eventId, value);
  for (const hear of wornHears) hear();
}
/** The same object until it changes — `useSyncExternalStore`'s snapshot. */
export function readLookSampleWorn(eventId: string): LookSampleWorn | null {
  return worn.get(eventId) ?? null;
}
export function subscribeLookSampleWorn(hear: () => void): () => void {
  wornHears.add(hear);
  return () => {
    wornHears.delete(hear);
  };
}
