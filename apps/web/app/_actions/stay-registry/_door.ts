import 'server-only';
import type { DelegateArea } from '@/lib/delegate-areas';
import { inPlaceAnswer, type StayResult, type StayWords } from '@/lib/save-in-place';

/**
 * 📍 ONE ENTRY OF THE STAY-DOOR REGISTRY (`app/_actions/save-in-place.ts`, owner 2026-10-26 "A SAVE NEVER RESETS THE
 * SCREEN — APP-WIDE"): the action it runs, how its redirect is read, and the limited-helper area it changes.
 *
 * `area` is the SAME area the action's own first gate names (`refuseLimitedHelper(eventId, <area>)`, mapped by
 * `AREA_RULES` in `every-action-refuses-a-limited-helper.test.ts`). The door asks the gate BEFORE the action runs; the
 * action asks again on its own. `lib/a-save-never-resets-the-screen.test.ts` reads both and fails when they disagree.
 * A supplier-side door names `null` — it carries no `event_id`, so the event gate has nothing to ask.
 */
export type Run = (fd: FormData) => Promise<unknown>;
export type Door = { run: Run; read: (url: string) => StayResult | 'navigate'; area: DelegateArea | null };

/** An action bound to its event on the plain form (`.bind(null, eventId)`) reads the event from the form instead. */
export const onEvent =
  (fn: (eventId: string, fd: FormData) => Promise<unknown>): Run =>
  (fd) =>
    fn(String(fd.get('event_id') ?? ''), fd);

/** A kind of door: one area's words and its limited-helper area. `const sponsors = kind(SPONSORS, null);` */
export const kind =
  (words: StayWords, area: DelegateArea | null) =>
  (run: Run): Door => ({ run, read: (url) => inPlaceAnswer(url, words), area });

/** A kind of door that reads its redirect with its own reader (Papic keeps `papicInPlaceAnswer`, unchanged). */
export const kindRead =
  (read: (url: string) => StayResult | 'navigate', area: DelegateArea | null) =>
  (run: Run): Door => ({ run, read, area });
