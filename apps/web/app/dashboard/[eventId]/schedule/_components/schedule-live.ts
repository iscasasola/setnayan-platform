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
 *     name, place or note is ON the stage canvases as it is typed
 *     (`schedulePreviewMessage` through the editor bridge);
 *   · typing and − / + taps are ONE save after the pause (`makerLatestWrite`);
 *   · what the bridge cannot draw (a moment shown or hidden, moved, re-timed,
 *     removed) reloads the canvases ONCE after its save landed, double
 *     buffered (`markMakerCanvasStale`);
 *   · a refused save puts back the last value that DID save and says which.
 */
import { MAKER_QUIET_FIELD, markMakerCanvasStale } from '@/lib/maker-live-preview';
import { makerLatestWrite, makerSave, requestMakerRefresh, type Superseded } from '@/lib/maker-refresh';
import type { DayActions } from './day-types';

/** Fields the bridge lays on the canvas itself, or that no guest sees — no reload owed. */
const DRAWN_OR_UNSEEN = new Set([
  'event_id',
  'block_id',
  'label',
  'location',
  'notes',
  'responsible_party',
  'responsible_vendor_ids',
  MAKER_QUIET_FIELD,
]);

/** Does this write change what the canvas draws in a way the bridge cannot lay? */
export function scheduleWriteRedraws(fd: FormData): boolean {
  for (const k of fd.keys()) if (!DRAWN_OR_UNSEEN.has(k)) return true;
  return false;
}

/**
 * The rail's actions, as the Maker sends them: quiet (no revalidate → no render
 * of the Maker), counted as held Maker saves, and followed by ONE canvas reload
 * when the bridge could not draw the change. A removed moment is taken off the
 * rail by `onGone` once its delete has landed.
 */
export function quietDayActions(actions: DayActions, onGone: (blockId: string) => void): DayActions {
  const quiet =
    (run: (fd: FormData) => Promise<unknown>, after?: (fd: FormData) => void) =>
    async (fd: FormData) => {
      fd.set(MAKER_QUIET_FIELD, '1');
      const r = await makerSave(() => run(fd), requestMakerRefresh, { held: true, ok: () => true });
      after?.(fd);
      if (scheduleWriteRedraws(fd)) markMakerCanvasStale();
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

/** One moment's field, typed or stepped: the newest value is the ONE save after the pause. */
export function momentLatestWrite(blockId: string, field: string, send: () => Promise<unknown>): Promise<unknown | Superseded> {
  return makerLatestWrite(`schedule:${blockId}:${field}`, send);
}
