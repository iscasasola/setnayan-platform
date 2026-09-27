/**
 * apps/web/lib/maker-refresh.ts
 *
 * ⚡ ONE REFRESH PER BURST OF PICKS — after the LAST save in flight.
 *
 * Owner, 2026-09-28: *"picking something takes a lot of time before the
 * website reacts"*. A pick in the Maker is drawn on the canvas at once (the
 * bridge), then saved into the draft with `hubDraftAction`. The toolbar's
 * Apply · Undo · Restore count and every server-drawn prop read the draft, so
 * the Maker still has to be re-rendered once the save lands.
 *
 * 🔴 WHAT IT COST BEFORE. The action ended with `revalidatePath`, which made
 * its response carry a full render of the Maker route — and every caller then
 * threw that away and asked for the same render again with `router.refresh()`.
 * Two whole-Maker renders per tap. And three quick taps raced: the refresh for
 * tap 1 came back while tap 3 was already on the canvas, the canvas hold saw a
 * render that did not match what it showed, and reloaded the canvas — twice.
 *
 * 🔑 NOW: the action revalidates nothing (a draft reaches no guest), and every
 * Maker save goes through `makerSave`, which counts saves in flight and
 * refreshes ONCE, a beat after the last one lands. The render that comes back
 * holds every tap, so the hold (`element-preview.ts`) matches it and the
 * canvas keeps its page.
 *
 * A refused save owes no refresh of its own (nothing changed on the server);
 * if another save in the same burst succeeded, the burst still refreshes.
 *
 * `createMakerRefresher` is the pure core (`maker-refresh.test.ts` drives it
 * with a fake clock); `makerSave` is the one shared instance the Maker uses.
 */

/** How long after the last save lands the refresh waits for another tap. */
export const MAKER_REFRESH_COALESCE_MS = 180;

/**
 * 🔓 A write the bridge did NOT draw is under way — the canvas must reload for
 * the render it brings (`editor-shell.tsx` drops its hold). Fired by `makerSave`
 * for every save not marked `held`, and by the Maker shell for every form it
 * submits (`maker-shell.tsx`), so no write can land inside a hold unnoticed.
 */
export const MAKER_UNHELD_WRITE_EVENT = 'setnayan:maker-unheld-write';

export type MakerSaveOptions<T> = {
  /** The bridge already drew this change on the canvas (the hold covers it). */
  held?: boolean;
  /** How to read success from the result (default: `result.ok === true`). */
  ok?: (result: T) => boolean;
};

type Timer = unknown;
type Clock = {
  set: (fn: () => void, ms: number) => Timer;
  clear: (t: Timer) => void;
};

export type MakerRefresher = {
  /** Run one save; refresh once when it and every other save in flight have landed. */
  save<T>(send: () => Promise<T>, refresh: () => void, ok?: (result: T) => boolean): Promise<T>;
  /** Saves still in flight — the shell's "saving" state, and the test's probe. */
  inFlight(): number;
};

const okOf = (r: unknown): boolean =>
  Boolean(r && typeof r === 'object' && (r as { ok?: unknown }).ok === true);

export function createMakerRefresher(clock: Clock): MakerRefresher {
  let inFlight = 0;
  let owed = false;
  let timer: Timer | null = null;
  let refreshFn: (() => void) | null = null;

  const settle = () => {
    if (inFlight > 0 || !owed) return;
    if (timer !== null) clock.clear(timer);
    timer = clock.set(() => {
      timer = null;
      // A tap that started during the wait extends the burst.
      if (inFlight > 0 || !owed) return;
      owed = false;
      refreshFn?.();
    }, MAKER_REFRESH_COALESCE_MS);
  };

  return {
    async save(send, refresh, ok = okOf) {
      inFlight += 1;
      if (timer !== null) {
        clock.clear(timer);
        timer = null;
      }
      try {
        const result = await send();
        if (ok(result)) owed = true;
        return result;
      } finally {
        inFlight -= 1;
        refreshFn = refresh;
        settle();
      }
    },
    inFlight: () => inFlight,
  };
}

const shared = createMakerRefresher({
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
});

/**
 * Every Maker draft save: `await makerSave(() => draftAction(eventId, fd), () => router.refresh(), { held })`.
 * Returns the action's own result, unchanged. `held` = the bridge already drew
 * it; anything else tells the canvas to reload for the render it brings.
 */
export function makerSave<T>(send: () => Promise<T>, refresh: () => void, options: MakerSaveOptions<T> = {}): Promise<T> {
  if (!options.held) announceUnheldWrite();
  return shared.save(send, refresh, options.ok);
}

/**
 * 🔁 For a Maker control rendered where no router is mounted (a server-rendered
 * settings panel, and its render test): ask the Maker to refresh. The toolbar's
 * draft bar — mounted once in every Maker with a work area — hears it and
 * refreshes the route (`hub-draft-bar.tsx`).
 */
export const MAKER_REFRESH_EVENT = 'setnayan:maker-refresh';
export function requestMakerRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MAKER_REFRESH_EVENT));
}

/** Maker saves still in flight — the canvas warms no stage while one is (it could miss the save). */
export function makerSavesInFlight(): number {
  return shared.inFlight();
}

/** Tell the Maker's canvas a write it did not draw is on its way. */
export function announceUnheldWrite(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(MAKER_UNHELD_WRITE_EVENT));
}
