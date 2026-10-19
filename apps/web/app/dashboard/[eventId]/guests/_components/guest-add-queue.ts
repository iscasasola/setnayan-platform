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
import { GROUP_CATEGORY_LABELS, guestRoleLabel, type GuestGroupCategory, type GuestRole, type GuestSide } from '@/lib/guests';
import type { RoleNames } from '@/lib/role-names';
import { hearAction } from './hear-action';
import { plainRefusal } from './plain-refusal';

export type PendingAddStatus = 'saving' | 'saved' | 'failed';

export type PendingAdd = {
  key: string;
  eventId: string;
  /** The name as the host will read it on the row ("Ana Cruz"). */
  name: string;
  /** What it is being added WITH, in the card's words ("Guest · Friends · Out of town · +1"); '' = nothing picked. */
  detail: string;
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
          // A request that never answered (offline, a throw) says so by name; a refusal says its own plain sentence.
          const error = res.error ? plainRefusal(res.error, FALLBACK) : `Couldn’t add ${next.name} — no connection.`;
          patch(next.key, { status: 'failed', error, started: false });
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
    enqueue(input: { eventId: string; name: string; detail?: string; run: () => Promise<QuickAddResult> }): string {
      seq += 1;
      const key = `add-${seq}`;
      items = [
        ...items,
        { key, eventId: input.eventId, name: input.name, detail: input.detail ?? '', status: 'saving', error: null, guestId: null, landed: false, at: Date.now(), run: input.run, started: false },
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
  picks: TypedPicks = {},
): { ok: true; key: string } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: false, error: '' };
  const draft = withPicks(keepTheHonorific(raw, parseGuestInput(raw, { defaultSide })), picks);
  if (!normalizeGuestName(draft.firstName) || !normalizeGuestName(draft.lastName)) return { ok: false, error: NEEDS_BOTH_NAMES };
  const detail = picks.describe ? picks.describe(draft) : (picks.detail ?? '');
  const key = queue.enqueue({ eventId, name: draftName(draft), detail, run: () => addSingleGuest(eventId, draft, { refresh: false }) });
  return { ok: true, key };
}

/**
 * "NINANG ROSE" IS A NAME, NOT A ROLE AND HALF A NAME. The shipped grammar reads ninong · ninang · sponsor as a role
 * word and drops it, so a two-word line like "Ninang Rose" kept ONE name word and was refused ("Add both a first and
 * last name.") — the prototype's B4 adds it. When taking the role word leaves no last name, the word stays in the name,
 * exactly as "Tita Cora" is kept (first "Tita", last "Cora"), and no role is guessed from it.
 */
function keepTheHonorific(raw: string, d: ParsedGuestDraft): ParsedGuestDraft {
  if (!d.roleHint || d.lastName || !d.firstName) return d;
  const word = raw.split(/\s+/).find((w) => /^(ninong|ninang|sponsor)$/i.test(w));
  if (!word) return d;
  return { ...d, firstName: word, lastName: d.firstName, roleHint: null };
}

/**
 * The add card's four sticky picks (owner 2026-10-20: *"they can set the Role, Group, Side, and Plus"*). The SIDE is the
 * `defaultSide` already; these are the other three, plus the row's words. What the host TYPED wins over a pick
 * ("Ana Cruz vip +2 #Choir" keeps VIP, +2 and Choir), and the picked own groups join any typed ones.
 */
export type TypedPicks = {
  role?: GuestRole | null;
  groupCategory?: GuestGroupCategory | null;
  /** Own groups by NAME — the shipped find-or-make path (`#Group`) adds them; the first seeds the seat clustering. */
  groupLabels?: readonly string[];
  plusOnes?: number;
  /** The row's words for the picks ("Guest · Friends · +1"). */
  detail?: string;
  /** The row's words for what is ACTUALLY sent (a typed "vip" or "+2" wins over a pick) — preferred over `detail`. */
  describe?: (draft: ParsedGuestDraft) => string;
};

export function withPicks(draft: ParsedGuestDraft, picks: TypedPicks): ParsedGuestDraft {
  const groups = [...draft.groups];
  for (const g of picks.groupLabels ?? []) if (!groups.some((x) => x.toLowerCase() === g.toLowerCase())) groups.push(g);
  return {
    ...draft,
    roleHint: draft.roleHint ?? (picks.role && picks.role !== 'guest' ? picks.role : null),
    groups,
    plusOnes: draft.plusOnes || Math.min(4, Math.max(0, picks.plusOnes ?? 0)),
    groupCategory: picks.groupCategory ?? draft.groupCategory ?? null,
  };
}

/** The Add card's four sticky picks (search-add-card.tsx draws them; the Guests screen holds them). */
export type AddPicks = {
  side: GuestSide;
  role: GuestRole;
  /** The standard group; null = not picked (stored as 'other', as every quick add was). */
  category: GuestGroupCategory | null;
  /** Own groups ticked, by id. */
  groupIds: string[];
  plus: number;
};

/** What the queue sends with a name, and the row's words for it ("Guest · Friends · Out of town · +1"). */
export function picksForAdd(
  picks: AddPicks,
  groups: readonly { group_id: string; label: string }[],
  roleNames: RoleNames | null | undefined,
): TypedPicks {
  const own = picks.groupIds.map((id) => groups.find((g) => g.group_id === id)?.label).filter((l): l is string => Boolean(l));
  const say = (role: GuestRole, cat: GuestGroupCategory | null, names: readonly string[], plus: number) =>
    [guestRoleLabel(role, roleNames), ...(cat ? [GROUP_CATEGORY_LABELS[cat]] : []), ...names, ...(plus > 0 ? [`+${plus}`] : [])].join(' · ');
  return {
    role: picks.role,
    groupCategory: picks.category,
    groupLabels: own,
    plusOnes: picks.plus,
    detail: say(picks.role, picks.category, own, picks.plus),
    describe: (d) => say(d.roleHint ?? 'guest', d.groupCategory ?? null, d.groups, d.plusOnes),
  };
}
