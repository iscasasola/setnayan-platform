/**
 * lib/floor-items-merge.ts — THE SEAT PLAN'S BOOTHS AND SIGNS, SAVED FROM TWO SCREENS (owner 2026-10-18, round 3 of "two
 * hosts never overwrite each other"; the pattern is `lib/merge-from-base.ts`, lists of `{id}` items merged item by item).
 *
 * `saveBooths` / `saveSigns` were REPLACE-ALL: every row missing from the screen's list was DELETED and every row in it
 * written whole from the screen's copy. So a booth the other host added (or the 3D lab placed) while this editor was open
 * was deleted by the next save here, and a booth they moved went back. The seat lock narrows it but does not close it —
 * a lock taken over, the lab beside the editor, one host on two phones. Now a save also sends the list it STARTED FROM
 * (`MERGE_BASE_FIELD`, the same shape), and:
 *   · removed — only a row this screen had AND took out (a row it never saw is not its to delete);
 *   · inserted — a row with no id (new here);
 *   · updated — only the fields this screen changed on a row it had (a moved booth keeps the other host's new label).
 * A row both screens changed: the later save's fields win. No base (an older page, Auto arrange's own fresh read):
 * replace-all, exactly as before. Pure.
 */
import { changedFields } from './merge-from-base';

export type FloorItemWrites<T> = {
  remove: string[];
  inserts: T[];
  updates: Array<{ id: string; fields: Partial<T> }>;
};

export function floorItemsThisScreenChanged<T extends Record<string, unknown>>(idKey: keyof T & string, base: readonly T[], mine: readonly T[]): FloorItemWrites<T> {
  const idOf = (x: T): string | null => (typeof x[idKey] === 'string' && (x[idKey] as string) ? (x[idKey] as string) : null);
  const had = new Map<string, T>();
  for (const b of base) {
    const id = idOf(b);
    if (id) had.set(id, b);
  }
  const keep = new Set(mine.map(idOf).filter((id): id is string => id !== null));
  const out: FloorItemWrites<T> = { remove: [...had.keys()].filter((id) => !keep.has(id)), inserts: [], updates: [] };
  for (const m of mine) {
    const id = idOf(m);
    if (!id) {
      out.inserts.push(m);
      continue;
    }
    const b = had.get(id);
    const { [idKey]: _mid, ...mFields } = m;
    if (!b) {
      // A row this screen never started from (it arrived with a later render): written as sent.
      out.updates.push({ id, fields: mFields as Partial<T> });
      continue;
    }
    const { [idKey]: _bid, ...bFields } = b;
    const changed = changedFields(bFields, mFields);
    if (changed.size === 0) continue;
    out.updates.push({ id, fields: Object.fromEntries([...changed].map((k) => [k, (mFields as Record<string, unknown>)[k]])) as Partial<T> });
  }
  return out;
}
