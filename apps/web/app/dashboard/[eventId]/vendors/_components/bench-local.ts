'use client';

/**
 * WHAT A CARD PRESS CHANGED ON THIS PAGE, KEPT FOR THE VISIT (owner
 * 2026-10-12: Save and Remove on a supplier card answer at once, without
 * refreshing the whole page — "a press answers at once", 2026-10-08).
 *
 * Remove takes the card off the bench the moment the couple confirms; Save in
 * "More to compare" turns the card into "Saved to your …" the moment the write
 * answers. Neither asks for the page again: the write is sent with
 * `answer_in_place=1` (`lib/answer-in-place.ts`), so the action does not ship a
 * whole-page render back either.
 *
 * Kept per EVENT in a module map, not in component state, because the bench
 * remounts (Back from a supplier's workspace serves the router's cached page,
 * drawn before the press) and a removed supplier must not come back, nor a
 * saved one ask to be saved again.
 *
 * THE DEBT. The Build and Booked bodies are drawn on the server and did not see
 * the press. `dirty` records that one `router.refresh()` is owed; the bench pays
 * it ONCE — when the couple leaves Find, or on its next mount — however many
 * presses there were.
 */
import { createContext, useContext } from 'react';
import type { ShortlistFolder } from '@/lib/shortlist-taxonomy';
import type { SaveVendorResult } from '@/app/(shell)/explore/actions';
import type { removeBuildPick, setBuildPick } from '../build-pick-actions';

/** A supplier saved from "More to compare": its new pick, and whether Undo may remove it. */
export type SavedFromMore = { eventVendorId: string; undoable: boolean };

type BenchLocalStore = {
  /** `event_vendors` ids removed in place. They never come back (the row is gone). */
  gone: Set<string>;
  /** `${tile}|${vendorProfileId}` → the save made from that category's list. */
  saved: Map<string, SavedFromMore>;
  /** What a refused Remove said, handed to the card when it comes back. */
  said: Map<string, string>;
  /** One `router.refresh()` is owed (see THE DEBT above). */
  dirty: boolean;
  /** "Add to build" answered in place: `${groupId}|${pickId}` → in the build or not. */
  built: Map<string, boolean>;
  /** A single-pick category whose pin was changed in place: group → the one pick in it (null = none). */
  groupPick: Map<string, string | null>;
};

const STORES = new Map<string, BenchLocalStore>();

export function benchLocalStore(eventId: string): BenchLocalStore {
  let s = STORES.get(eventId);
  if (!s) {
    s = { gone: new Set(), saved: new Map(), said: new Map(), dirty: false, built: new Map(), groupPick: new Map() };
    STORES.set(eventId, s);
  }
  return s;
}

export function savedKey(tile: string, vendorProfileId: string): string {
  return `${tile}|${vendorProfileId}`;
}

/** A write answered in place: the server-drawn bodies now owe one refresh. */
export function markBenchDirty(eventId: string): void {
  benchLocalStore(eventId).dirty = true;
}

/** Pays the debt once. Returns true when a refresh is due now. */
export function payBenchDebt(eventId: string): boolean {
  const s = benchLocalStore(eventId);
  if (!s.dirty) return false;
  s.dirty = false;
  return true;
}

/**
 * What the bench gives a card's verb row. Null outside the bench — the card
 * then behaves exactly as it shipped (write, then refresh the page).
 */
export type BenchLocal = {
  /** Takes the card off the page now. Returns the put-back for a refusal, which
   *  the card says when it reappears. */
  removeInPlace: (vendorId: string) => (refusal: string) => void;
  /** What a refused Remove said, once — read by the card that comes back. */
  takeSaid: (vendorId: string) => string | null;
  /**
   * Whether a pick is in the build NOW: what the press made it, else what the
   * page was drawn with. In a single-pick category a pin moves the one place,
   * so a sibling drawn "In your build" reads "Add to build" at once too.
   */
  builtNow: (vendorId: string, groupId: string, drawn: boolean) => boolean;
  /** A pin / unpin answered in place (`multi` = the category keeps several). */
  setBuilt: (vendorId: string, groupId: string, on: boolean, multi: boolean) => void;
  /** The ONE toast of the page (it peeks from the top) — a press's result. */
  say: (tone: 'ok' | 'bad', text: string, retry?: () => void) => void;
};

export const BenchLocalCtx = createContext<BenchLocal | null>(null);

export function useBenchLocal(): BenchLocal | null {
  return useContext(BenchLocalCtx);
}

/**
 * A STAND-IN FOR THE TWO WRITES — `/dev/suppliers-lab` only (the lab has no
 * session, so the real actions would send it to sign in). `null` everywhere
 * else: the bench always calls `deleteVendor` and `saveVendorToPicks`.
 */
export type BenchWrites = {
  remove: (fd: FormData) => Promise<void>;
  save: (fd: FormData) => Promise<SaveVendorResult>;
  pin: typeof setBuildPick;
  unpin: typeof removeBuildPick;
};
export const BenchWritesStandInCtx = createContext<BenchWrites | null>(null);

/**
 * The page's folders without the suppliers removed in place this visit. The
 * SAME objects when nothing was removed, so nothing downstream re-derives.
 */
export function withoutRemoved(folders: ShortlistFolder[], gone: ReadonlySet<string>): ShortlistFolder[] {
  if (gone.size === 0) return folders;
  return folders.map((f) => {
    let dropped = 0;
    const tiles = f.tiles.map((t) => {
      const vendors = t.vendors.filter((v) => !gone.has(v.vendorId));
      dropped += t.vendors.length - vendors.length;
      return vendors.length === t.vendors.length ? t : { ...t, vendors };
    });
    return dropped === 0 ? f : { ...f, tiles, pickCount: Math.max(0, f.pickCount - dropped) };
  });
}

/** The decision `builtNow` makes, pure (the bench's store is its only input). */
export function builtNowIn(
  store: Pick<BenchLocalStore, 'built' | 'groupPick'>,
  vendorId: string,
  groupId: string,
  drawn: boolean,
): boolean {
  const own = store.built.get(`${groupId}|${vendorId}`);
  if (own !== undefined) return own;
  if (store.groupPick.has(groupId)) return store.groupPick.get(groupId) === vendorId;
  return drawn;
}

/** The write `setBuilt` makes, pure. */
export function setBuiltIn(
  store: Pick<BenchLocalStore, 'built' | 'groupPick'>,
  vendorId: string,
  groupId: string,
  on: boolean,
  multi: boolean,
): void {
  store.built.set(`${groupId}|${vendorId}`, on);
  if (multi) return;
  // One place in the category: whoever held it is out (their own entry is
  // dropped so the group's answer speaks for them).
  for (const key of [...store.built.keys()]) {
    if (key.startsWith(`${groupId}|`) && key !== `${groupId}|${vendorId}`) store.built.delete(key);
  }
  store.groupPick.set(groupId, on ? vendorId : null);
}
