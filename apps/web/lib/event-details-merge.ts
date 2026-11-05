/**
 * lib/event-details-merge.ts — THE EVENT DETAILS FORM SAVES ONLY WHAT THIS SCREEN CHANGED (owner 2026-10-18, two hosts
 * never overwrite — round 2; the "merge from base" pattern, `lib/merge-from-base.ts`, in its row shape, exactly as the
 * guest card's `lib/guest-card-merge.ts`).
 *
 * 🔴 BEFORE: Event settings (`details-form.tsx`) posts every field it shows, and `updateEventMatchCriteria` writes them
 * all — region and feel always. A form left open on one phone while the other host changed the region, the feel or the
 * budget wrote every old value straight back when it saved its one change. Silently.
 *
 * 🔑 NOW the form posts, beside its fields, the fields it started from (`MERGE_BASE_FIELD`, in this file's spelling:
 * field → JSON of its posted values). Only the fields THIS screen changed reach the writer — every key it leaves out is
 * already "absent ⇒ untouched" there (region and feel too, from round 2). Fields that are ONE fact go together
 * (`EVENT_DETAILS_GROUPS`): a name is composed from all four boxes, the birth data is written with its consent. A field
 * both screens changed: this later save wins. A post without a base (an older page) is written whole, as before.
 *
 * Pure — no I/O; the client imports `formFieldsOf` too.
 */
import { changedFields } from './merge-from-base';
import { MERGE_BASE_FIELD } from './merge-base-field';

export { MERGE_BASE_FIELD };

/** Fields that are one fact together: a change to any one sends the whole group. */
export const EVENT_DETAILS_GROUPS: ReadonlyArray<readonly string[]> = [
  ['bride_first', 'bride_last', 'groom_first', 'groom_last'],
  ['bride_name', 'groom_name'],
  ['bazi_birthdata_consent', 'partner_a_birth_date', 'partner_a_birth_time', 'partner_b_birth_date', 'partner_b_birth_time'],
];

/** Plumbing, never a field — always kept, never compared. */
const PLUMBING = new Set(['event_id', MERGE_BASE_FIELD]);

/** A form's fields in the base's spelling: field → JSON of every posted value (`["ncr"]`). */
export function formFieldsOf(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of new Set(fd.keys())) {
    if (PLUMBING.has(key)) continue;
    out[key] = JSON.stringify(fd.getAll(key).map((v) => (typeof v === 'string' ? v : '')));
  }
  return out;
}

export type EventDetailsWrite = {
  /** The post said what it started from. False: the form is written whole, as before. */
  based: boolean;
  /** What the writer reads: the changed fields (and their groups) plus the plumbing — or the post itself, unbased. */
  fd: FormData;
  /** Fields left out because this screen did not change them (another screen's value stands). */
  kept: string[];
};

export function eventDetailsToWrite(posted: FormData): EventDetailsWrite {
  const raw = posted.get(MERGE_BASE_FIELD);
  let base: Record<string, string> | null = null;
  if (typeof raw === 'string' && raw) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).filter((e): e is [string, string] => typeof e[1] === 'string'));
      }
    } catch {
      base = null;
    }
  }
  if (!base) return { based: false, fd: posted, kept: [] };
  const mine = formFieldsOf(posted);
  const changed = changedFields(base, mine);
  for (const group of EVENT_DETAILS_GROUPS) if (group.some((f) => changed.has(f))) for (const f of group) changed.add(f);
  const fd = new FormData();
  const kept: string[] = [];
  for (const key of new Set(posted.keys())) {
    if (key === MERGE_BASE_FIELD) continue;
    if (!PLUMBING.has(key) && !changed.has(key)) {
      kept.push(key);
      continue;
    }
    for (const v of posted.getAll(key)) fd.append(key, v);
  }
  return { based: true, fd, kept };
}
