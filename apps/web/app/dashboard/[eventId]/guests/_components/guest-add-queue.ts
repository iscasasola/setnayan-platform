'use client';

/**
 * guest-add-queue.ts — A TYPED NAME IS ON THE LIST THE MOMENT ENTER IS PRESSED (owner 2026-10-19, adding guests on his
 * phone and laptop: *"why does it take a lot of seconds before the name. and need to enter button twice to add. … adding
 * multiple person needs to be fast and easy"*, then *"we want to see added name realtime and fast"*).
 *
 * ── What was measured (lab, `/dev/guests-lab?part=screen&addMs=1200`, before this file) ─────────────────────────────
 *   · the name was drawn only when the server answered — and the answer carried a redraw of the WHOLE Guests page
 *     (`revalidatePath`), so the wait was the write plus the page;
 *   · the box refused a second Enter while the first add was out (`if (pending) return`): of ten names typed in a row,
 *     ONE was saved, eight were dropped without a word and one came back cut ("un Yap" — the box was cleared under the
 *     host's typing when the first answer landed).
 *
 * ── What this does ─────────────────────────────────────────────────────────────────────────────────────────────────
 *   · `enqueue` puts the name on screen AT ONCE (status `saving`) — the List's "Just added" rows and the add sheet both
 *     read this store, so no spinner, no reload, no wait;
 *   · the writes go out ONE AT A TIME, IN THE ORDER TYPED — never two at once, never one skipped, never one twice;
 *   · a refused (or failed) write STAYS, with the plain reason and Retry · Remove — it never vanishes, and it never looks
 *     like a saved one (a failure must not render like success);
 *   · when nothing is left to write the list re-reads ONCE (`refresh`) — ten names, one redraw; the writes themselves ask
 *     for none (`{ refresh: false }`);
 *   · once the re-read list holds a saved guest (`reconcile`), its "Just added" row steps aside for the real one.
 *
 * Module-level (not component state) on purpose: closing the sheet, or the sheet and the List being separate trees, must
 * not lose a name still waiting to be written.
 *
 * 🔒 guests/_components/one-enter-adds-one-guest-at-once.test.ts
 */

import { useSyncExternalStore } from 'react';
import type { AddWriteOptions, QuickAddResult } from '../quick-add-actions';
import type { ParsedGuestDraft } from '@/lib/guest-parse';
import { parseGuestInput } from '@/lib/guest-parse';
import { normalizeGuestName } from '@/lib/guest-name';
import { takeGenderMark } from '@/lib/guest-title';
import type { GuestSide } from '@/lib/guests';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

export type PendingAddStatus = 'saving' | 'saved' | 'failed';

export type PendingAdd = {
  key: string;
  eventId: string;
  /** The name as the host will read it on the row ("Ana Cruz"). */
  name: string;
  status: PendingAddStatus;
  /** A refused write's plain sentence. */
  error: string | null;
  /** The saved guest's id — how the re-read list is matched. */
  guestId: string | null;
  /** True once the re-read list holds this guest: the List draws the real row and this one steps aside. */
  landed: boolean;
  /** When it was typed (`Date.now()`), so a sheet can show only its own. */
  at: number;
};

type Item = PendingAdd & { run: () => Promise<QuickAddResult>; started: boolean };

const FALLBACK = 'Couldn’t add that guest. Try again.';
/** Landed rows kept for a sheet's "Just added" list; older ones are let go. */
const KEEP_LANDED = 40;

export function createAddQueue(opts: { schedule?: (fn: () => void) => void } = {}) {
  const schedule = opts.schedule ?? ((fn: () => void) => void Promise.resolve().then(fn));
  let items: Item[] = [];
  let view: readonly PendingAdd[] = [];
  let seq = 0;
  let working = false;
  let savedSinceRefresh = 0;
  let refresher: (() => void) | null = null;
  const listeners = new Set<() => void>();

  const emit = () => {
    view = items.map(({ run: _run, started: _started, ...rest }) => rest);
    for (const l of listeners) l();
  };

  const patch = (key: string, next: Partial<Item>) => {
    items = items.map((it) => (it.key === key ? { ...it, ...next } : it));
    emit();
  };

  /** The worker: the oldest waiting name, then the next — one write in flight, ever. */
  const work = async () => {
    if (working) return;
    working = true;
    try {
      for (;;) {
        const next = items.find((it) => it.status === 'saving' && !it.started);
        if (!next) break;
        patch(next.key, { started: true });
        const res = await hearAction(next.run);
        if (res.ok) {
          savedSinceRefresh += 1;
          patch(next.key, { status: 'saved', guestId: res.guest.guest_id, error: null });
        } else {
          patch(next.key, { status: 'failed', error: plainRefusal(res.error, FALLBACK), started: false });
        }
      }
    } finally {
      working = false;
    }
    // Nothing left to write: the list re-reads ONCE for every name saved since the last re-read.
    if (savedSinceRefresh > 0 && !items.some((it) => it.status === 'saving')) {
      savedSinceRefresh = 0;
      refresher?.();
    }
  };

  return {
    /** Put a typed name on screen now and queue its write behind every earlier one. Returns its key. */
    enqueue(input: { eventId: string; name: string; run: () => Promise<QuickAddResult> }): string {
      seq += 1;
      const key = `add-${seq}`;
      items = [
        ...items,
        { key, eventId: input.eventId, name: input.name, status: 'saving', error: null, guestId: null, landed: false, at: Date.now(), run: input.run, started: false },
      ];
      emit();
      schedule(() => void work());
      return key;
    },
    /** A refused name, sent again — back in the queue, behind whatever is waiting. */
    retry(key: string) {
      const it = items.find((i) => i.key === key);
      if (!it || it.status !== 'failed') return;
      items = [...items.filter((i) => i.key !== key), { ...it, status: 'saving', error: null, started: false }];
      emit();
      schedule(() => void work());
    },
    /** The host lets a refused name go (only a refused one — a waiting or saved name is never dropped). */
    remove(key: string) {
      const it = items.find((i) => i.key === key);
      if (!it || it.status !== 'failed') return;
      items = items.filter((i) => i.key !== key);
      emit();
    },
    /** The re-read list: every saved name it now holds steps aside for its real row. */
    reconcile(serverGuestIds: Iterable<string>) {
      const ids = new Set(serverGuestIds);
      let changed = false;
      const next = items.map((it) => {
        if (it.status === 'saved' && !it.landed && it.guestId && ids.has(it.guestId)) {
          changed = true;
          return { ...it, landed: true };
        }
        return it;
      });
      if (!changed) return;
      const landed = next.filter((it) => it.landed);
      const drop = new Set(landed.slice(0, Math.max(0, landed.length - KEEP_LANDED)).map((it) => it.key));
      items = next.filter((it) => !drop.has(it.key));
      emit();
    },
    /** How the list re-reads (`router.refresh`) — set by whoever draws it. */
    setRefresher(fn: () => void) {
      refresher = fn;
    },
    subscribe(cb: () => void) {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    snapshot(): readonly PendingAdd[] {
      return view;
    },
    /** Test escape hatch. */
    reset() {
      items = [];
      seq = 0;
      savedSinceRefresh = 0;
      emit();
    },
  };
}

export type AddQueue = ReturnType<typeof createAddQueue>;

/** The page's one queue — the search box, the + sheet's name box and Quick add all write through it. */
export const guestAdds: AddQueue = createAddQueue();

const EMPTY: readonly PendingAdd[] = [];

export function useGuestAdds(): readonly PendingAdd[] {
  return useSyncExternalStore(guestAdds.subscribe, guestAdds.snapshot, () => EMPTY);
}

/** The name a waiting row reads — every part the host typed, the "(Woman)" / "(Man)" mark taken out (it is the title's). */
export function draftName(d: Pick<ParsedGuestDraft, 'prefix' | 'firstName' | 'middleName' | 'lastName' | 'suffix'>): string {
  const line = [d.prefix, d.firstName, d.middleName, d.lastName, d.suffix].filter((p) => p && p.trim()).join(' ');
  return takeGenderMark(line).text;
}

/** The same rule the server keeps (`runAddSingleGuest`): both a first and a last name, or nothing is sent. */
export const NEEDS_BOTH_NAMES = 'Add both a first and last name.';

/**
 * ONE typed line → ONE queued add (the search box's Enter, the + sheet's name box). Parsed by the shipped capture-bar
 * grammar (`parseGuestInput`). A line without both names is NOT queued — the box keeps it and says so, at once.
 */
export function queueTypedGuest(
  eventId: string,
  raw: string,
  defaultSide: GuestSide,
  addSingleGuest: (eventId: string, draft: ParsedGuestDraft, opts?: AddWriteOptions) => Promise<QuickAddResult>,
  queue: AddQueue = guestAdds,
): { ok: true; key: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: '' };
  const draft = parseGuestInput(raw, { defaultSide });
  if (!normalizeGuestName(draft.firstName) || !normalizeGuestName(draft.lastName)) return { ok: false, error: NEEDS_BOTH_NAMES };
  const key = queue.enqueue({ eventId, name: draftName(draft), run: () => addSingleGuest(eventId, draft, { refresh: false }) });
  return { ok: true, key };
}
