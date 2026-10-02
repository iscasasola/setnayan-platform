/**
 * apps/web/lib/maker-draft-store.ts
 *
 * ⚡ THE MAKER'S OWN COPY OF EVERY SCENE CANVAS IT WROTE — for the session.
 *
 * Owner, 2026-09-30: *"every edit alteration create forces the whole screen to
 * reload"* (DECISION_LOG "THE MAKER RE-PLAN — SPEED FIRST"). A pick the bridge
 * drew no longer asks the server for a whole-Maker render (`lib/maker-refresh.ts`),
 * so the canvases the page handed down stay as they were at the LAST render.
 * Building the next pick on them would silently undo the earlier ones — a second
 * part of the same scene, a sheet closed and opened again, the scene's own
 * Format tab. So every canvas a Maker panel writes is kept here, and every
 * panel reads a scene's canvas through `draftedCanvasOr(type, server)`.
 *
 * WHICH ONE WINS — decided by content, never by a clock:
 *   · the server's equals ours      → the server caught up: ours is dropped;
 *   · a write for it is still on its way (waiting for its beat or in flight)
 *                                     → ours (and the server's value then is
 *                                       remembered as the one ours was built on);
 *   · the server's is still the one ours was built on
 *                                     → ours (no render has brought anything newer);
 *   · the server's moved on to something else after our writes landed (Undo,
 *     Restore, a reset, another tab)  → the server's: ours is dropped.
 *
 * `createDraftedCanvases` is the pure core (`maker-draft-store.test.ts`);
 * `noteDraftedCanvas` / `draftedCanvasOr` are the one shared instance.
 */
import type { HubSectionCanvas } from './hub-canvas';
import { makerSavesInFlight, makerWritesPending } from './maker-refresh';

/** One canvas in one spelling — keys sorted, `undefined` dropped (absent = empty). */
export function canvasFingerprint(canvas: object | null | undefined): string {
  const sort = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(sort);
    if (v && typeof v === 'object') {
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as Record<string, unknown>).sort()) {
        const x = (v as Record<string, unknown>)[k];
        if (x !== undefined) out[k] = sort(x);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(sort(canvas ?? {}));
}

export type DraftedCanvases<T extends object = HubSectionCanvas> = {
  /** A panel wrote `canvas` for `type`, built on the server's `server`. */
  note(type: string, canvas: T, server: T | null | undefined): void;
  /** The canvas a panel must build on: ours while it is newer, else the server's. */
  read(type: string, server: T | null | undefined): T;
  /** Scenes held here — the test's probe. */
  size(): number;
};

export function createDraftedCanvases<T extends object = HubSectionCanvas>(pending: (type: string) => boolean): DraftedCanvases<T> {
  const mine = new Map<string, { canvas: T; fp: string; base: string }>();
  return {
    note(type, canvas, server) {
      const had = mine.get(type);
      const serverFp = canvasFingerprint(server);
      /* Built on OUR copy while one is kept: its base stays the server value it
         was first built on, until a render shows something else. */
      mine.set(type, { canvas, fp: canvasFingerprint(canvas), base: had ? had.base : serverFp });
    },
    read(type, server) {
      const own = mine.get(type);
      const theirs = server ?? ({} as T);
      if (!own) return theirs;
      const serverFp = canvasFingerprint(theirs);
      if (serverFp === own.fp) {
        mine.delete(type);
        return theirs;
      }
      if (pending(type)) {
        own.base = serverFp;
        return own.canvas;
      }
      if (serverFp === own.base) return own.canvas;
      mine.delete(type);
      return theirs;
    },
    size: () => mine.size,
  };
}

/** The write key a part's canvas save uses (`makerLatestWrite`). */
export const canvasWriteKey = (type: string) => `canvas:${type}`;

const shared = createDraftedCanvases(
  (type) => makerWritesPending(canvasWriteKey(type)) > 0 || makerSavesInFlight() > 0,
);

/** A Maker panel wrote this scene's canvas (on the canvas already; its save may still be on its way). */
export function noteDraftedCanvas(type: string, canvas: HubSectionCanvas, server: HubSectionCanvas | null | undefined): void {
  shared.note(type, canvas, server);
}

/** The scene canvas to build the next pick on — the Maker's own while it is newer than `server`. */
export function draftedCanvasOr(type: string, server: HubSectionCanvas | null | undefined): HubSectionCanvas {
  return shared.read(type, server);
}

/**
 * ✍ …AND EVERY SCENE OF THEIR OWN'S WORDS a typed heading or body wrote
 * (`type-in-place.tsx`). The draft replaces a scene's `custom` whole, so a
 * heading typed after its words must carry the words as just typed, not as the
 * last render had them — the same rule as the canvases, keyed by the words'
 * own write (`custom:<type>`).
 */
export type OwnWords = { title: string; body: string };
const ownWordsShared = createDraftedCanvases<OwnWords>(
  (type) => makerWritesPending(`custom:${type}`) > 0 || makerSavesInFlight() > 0,
);
export function noteDraftedOwnWords(type: string, words: OwnWords, server: OwnWords | null | undefined): void {
  ownWordsShared.note(type, words, server);
}
export function draftedOwnWordsOr(type: string, server: OwnWords | null | undefined): OwnWords {
  const w = ownWordsShared.read(type, server);
  return { title: w.title ?? '', body: w.body ?? '' };
}
