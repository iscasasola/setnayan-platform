/**
 * ⚡ THE PROGRAMME, INSTANT IN THE EVENT HUB MAKER (Details › Schedule).
 *
 * Owner, 2026-09-30: *"editing Our Story and the Programme … so hard to edit …
 * Takes so long to edit both. the delay of response is terrible"*. MEASURED in
 * the code before this file: every rail edit — a name, a time step, the eye, a
 * drag — called its server action, and every one of them ended with two
 * `revalidatePath` calls. Inside an action ANY revalidate makes the answer
 * carry a whole render of the page it was sent from — here the whole Maker
 * (3–6 s on production) — and Next runs actions one at a time, so the next
 * step waited behind it; when it landed, the render changed the canvases'
 * stamp and every stage canvas loaded again. A name saved only on blur, so the
 * canvas never saw it being typed.
 *
 * NOW, in the Maker only (the standalone Schedule page is untouched):
 *   · every write is sent with `maker_quiet` (`quietDayActions`): the action
 *     writes and revalidates nothing — no render of the Maker;
 *   · the rail shows the change at once (its own overrides, as before) and a
 *     name, place or note is ON the stage canvases as it is typed (the editor
 *     bridge's `scheduleMoment`, `lib/maker-live-preview.ts`);
 *   · typing and − / + taps are ONE save after the pause (`momentLatestWrite`);
 *   · what the bridge cannot draw (a moment shown or hidden, moved, re-timed,
 *     removed) reloads the canvases ONCE after its save landed, double
 *     buffered;
 *   · a refused save puts back the last value that DID save and says which.
 *
 * 📦 WHY THIS FILE IMPORTS NOTHING OF THE MAKER'S. The rail is also the
 * standalone Schedule page's; a module the Schedule page and the Maker's first
 * load both import is split into a chunk of its own, and every new chunk grows
 * the webpack runtime every page downloads (the shared bundle has 0 bytes to
 * spare). So the quiet field, the two window events and the one-save-per-pause
 * rule are spelled here — the SAME strings as `lib/maker-live-preview.ts`
 * (`the-love-story-and-programme-are-instant.test.ts` holds them equal) and the
 * same rule as `makerLatestWrite` (`lib/maker-refresh.ts`).
 */
import type { DayActions } from './day-types';

/** = `MAKER_QUIET_FIELD` (lib/maker-live-preview.ts). */
export const SCHEDULE_QUIET_FIELD = 'maker_quiet';
/** = `MAKER_CANVAS_POST_EVENT` / `MAKER_CANVAS_STALE_EVENT` (lib/maker-live-preview.ts). */
export const SCHEDULE_CANVAS_POST_EVENT = 'setnayan:maker-canvas-post';
export const SCHEDULE_CANVAS_STALE_EVENT = 'setnayan:maker-canvas-stale';

/** One moment's new words on every stage canvas (the bridge's `scheduleMoment`). */
export function postMomentToCanvas(moment: { id: string; label?: string; time?: string; location?: string }): void {
  window.dispatchEvent(
    new CustomEvent(SCHEDULE_CANVAS_POST_EVENT, { detail: { source: 'setnayan-editor', t: 'scheduleMoment', moment } }),
  );
}

/** Fields the bridge lays on the canvas itself, or that no guest sees — no reload owed. */
const DRAWN_OR_UNSEEN = new Set([
  'event_id',
  'block_id',
  'label',
  'location',
  'notes',
  'responsible_party',
  'responsible_vendor_ids',
  SCHEDULE_QUIET_FIELD,
]);

/** Does this write change what the canvas draws in a way the bridge cannot lay? */
export function scheduleWriteRedraws(fd: FormData): boolean {
  for (const k of fd.keys()) if (!DRAWN_OR_UNSEEN.has(k)) return true;
  return false;
}

/**
 * The rail's actions, as the Maker sends them: quiet (no revalidate → no render
 * of the Maker), and followed by ONE canvas reload when the bridge could not
 * draw the change. A removed moment is taken off the rail by `onGone` once its
 * delete has landed.
 */
export function quietDayActions(actions: DayActions, onGone: (blockId: string) => void): DayActions {
  const quiet =
    (run: (fd: FormData) => Promise<unknown>, after?: (fd: FormData) => void) =>
    async (fd: FormData) => {
      fd.set(SCHEDULE_QUIET_FIELD, '1');
      const r = await run(fd);
      after?.(fd);
      if (scheduleWriteRedraws(fd)) window.dispatchEvent(new Event(SCHEDULE_CANVAS_STALE_EVENT));
      return r;
    };
  return {
    ...actions,
    updateScheduleBlock: quiet(actions.updateScheduleBlock),
    toggleBlockVisibility: quiet(actions.toggleBlockVisibility),
    setBlockResponsibleParty: quiet(actions.setBlockResponsibleParty),
    setBlockPrepVisibility: quiet(actions.setBlockPrepVisibility),
    bulkRetimeScheduleBlocks: quiet(actions.bulkRetimeScheduleBlocks),
    deleteScheduleBlock: quiet(actions.deleteScheduleBlock, (fd) => onGone(String(fd.get('block_id') ?? ''))),
  };
}

/** How long a typed or stepped value waits for the next one — `MAKER_WRITE_BEAT_MS`. */
export const MOMENT_WRITE_BEAT_MS = 350;
/** What a write a LATER value carried resolves to: that later write answers for both. */
export const CARRIED: unique symbol = Symbol('schedule-write-carried');

type Slot = { timer: ReturnType<typeof setTimeout> | null; flying: boolean; next: { send: () => Promise<unknown>; done: (v: unknown) => void; fail: (e: unknown) => void } | null };
const slots = new Map<string, Slot>();

function go(key: string): void {
  const s = slots.get(key);
  if (!s || s.flying || !s.next) return;
  const { send, done, fail } = s.next;
  s.next = null;
  s.flying = true;
  const land = () => {
    s.flying = false;
    if (s.next && s.timer === null) go(key);
    if (!s.flying && !s.next && s.timer === null) slots.delete(key);
  };
  Promise.resolve()
    .then(send)
    .then(
      (v) => {
        land();
        done(v);
      },
      (e) => {
        land();
        fail(e);
      },
    );
}

/**
 * One moment's field, typed or stepped: the newest value is the ONE save after
 * the pause — never two in flight for one field. A value a later one replaced
 * resolves to `CARRIED`.
 */
export function momentLatestWrite(blockId: string, field: string, send: () => Promise<unknown>): Promise<unknown> {
  const key = `${blockId}:${field}`;
  let s = slots.get(key);
  if (!s) {
    s = { timer: null, flying: false, next: null };
    slots.set(key, s);
  }
  const slot = s;
  return new Promise((done, fail) => {
    slot.next?.done(CARRIED);
    slot.next = { send, done, fail };
    if (slot.timer !== null) clearTimeout(slot.timer);
    slot.timer = setTimeout(() => {
      slot.timer = null;
      go(key);
    }, MOMENT_WRITE_BEAT_MS);
  });
}
