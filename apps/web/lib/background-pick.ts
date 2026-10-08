/**
 * lib/background-pick.ts — A BACKGROUND PICK SHOWS AT ONCE, AND SAYS WHAT IT IS
 * WAITING FOR.
 *
 * Owner, 2026-10-08, live on Studio › Look › Background (a video card,
 * "Cinderella moonlit frost"): *"took 8 seconds before a background shows"* —
 * and, a minute later: *"when i press, and it has a loading state, we want to
 * know something is pressed and loading files... applying to your Hub."*
 *
 * WHAT THE 8 SECONDS WERE (measured in the lab with production's latencies,
 * `LOOK_RESTUDY_BUILD_STATUS_2026-10-08.md`): never the files. The pick waited
 * on its draft save, the save owed a WHOLE-MAKER render, and that render
 * reloaded the canvas page — three round trips before one pixel changed, with
 * nothing on screen to say a tap had been heard.
 *
 * NOW, one pick is four things, in this order:
 *   1 · the tapped card is ringed and wears a progress mark (`backgroundCardLooks`)
 *       — from the tap, not from the save;
 *   2 · the canvas wears the pick (`backgroundLayOf` → the editor bridge's
 *       `mainGround` message → `app/[slug]/_components/main-ground-preview.ts`):
 *       its still first, its clip when it can play;
 *   3 · the draft save runs behind it — HELD (`makerRedrawSave`): no whole-Maker
 *       render, the canvas page re-renders itself in place once it lands;
 *   4 · ONE line says what is still on its way (`backgroundPickStep`):
 *       "Loading files…", then "Applying to your Hub…" — only if it takes longer
 *       than a blink (`BACKGROUND_PICK_QUIET_MS`), and gone when the canvas shows it.
 * A refused save or a picture that could not be read puts the OLD background
 * back (`createLookGroundStore`) and says so in place, with Try again.
 *
 * 🔑 A SECOND TAP WINS. Every pick has a number; an answer for an older number
 * moves nothing on screen.
 *
 * Pure. Held by `lib/a-background-pick-shows-at-once.test.ts`.
 */
import { isHubMainFollow, isHubMainLoop, isHubMainOwn, mainGroundPosition, type HubMainGround, type HubMainFocus } from './hub-canvas';
import { createDraftedCanvases } from './maker-draft-store';
import { MAIN_GROUND_PATTERN_CSS } from './main-ground-patterns';
import { ombreCss, parseSiteBackground } from './ombre';

/* ── 1 · what a pick is waiting for ─────────────────────────────────────── */

/** A wait shorter than this is never said — a line that flashes is noise (owner: "do not flash the line"). */
export const BACKGROUND_PICK_QUIET_MS = 300;

/** The owner's own words, in the order they happen. */
export const BACKGROUND_PICK_LINE = { loading: 'Loading files…', applying: 'Applying to your Hub…' } as const;
export type BackgroundPickStep = keyof typeof BACKGROUND_PICK_LINE;

/** What a refused pick says when the refusal brought no words of its own — never an empty alert. */
export const BACKGROUND_PICK_FAILED = 'Your background could not be changed. Please try again.';

/**
 * How long a pick whose save HAS landed still waits for the canvas to say it is
 * on screen. The draft holds it by then, so nothing false is being said; a
 * canvas that never answers (a page with no bridge, a frame mid-load) must not
 * leave "Applying to your Hub…" up for ever.
 */
export const BACKGROUND_PICK_CANVAS_WAIT_MS = 8000;

export type BackgroundPick = {
  /** This pick's number — a later pick has a higher one, and wins. */
  seq: number;
  /**
   * `data-bg-card` of the tapped card, when the pick cannot be drawn in the
   * panel yet (a picture whose colours are still being read). Null = the pick
   * is already drawn: the ringed card IS the one on its way.
   */
  card: string | null;
  /** The Maker is still reading the picture (its colours are measured before it may be saved). */
  reading: boolean;
  /** The pick was laid on the canvas at the tap (false: the canvas waits for its own render — a Shade, a Blur). */
  laid: boolean;
  /** The canvas has it on screen: the laid pick is painted, or (nothing laid) the page has redrawn itself. */
  shown: boolean;
  /** The draft write has answered, and it was taken. */
  saved: boolean;
  /** The words of a failure: this pick did not happen, and the old background is back. */
  failed: string | null;
};

/**
 * What is still on its way — `'loading'` (the files), `'applying'` (the draft
 * write, and the page redrawing with it), `'failed'`, or null: nothing, done.
 */
export function backgroundPickStep(pick: BackgroundPick | null): BackgroundPickStep | 'failed' | null {
  if (!pick) return null;
  if (pick.failed) return 'failed';
  if (pick.reading || (pick.laid && !pick.shown)) return 'loading';
  return pick.saved && pick.shown ? null : 'applying';
}

/** The pick with `patch` laid on it — or null once nothing is on its way any more. Another pick's news changes nothing. */
export function backgroundPickAfter(pick: BackgroundPick | null, seq: number, patch: Partial<BackgroundPick>): BackgroundPick | null {
  if (!pick || pick.seq !== seq) return pick;
  const next = { ...pick, ...patch };
  return backgroundPickStep(next) === null ? null : next;
}

/**
 * Is this card ringed, and does it wear the progress mark? The ring is on the
 * tapped card FROM THE TAP — it never waits for the save — and that card wears
 * the mark until the pick is done. A failed pick leaves the ring where the
 * stored background is.
 */
export function backgroundCardLooks(data: string, storedOn: boolean, pick: BackgroundPick | null): { on: boolean; busy: boolean } {
  const step = backgroundPickStep(pick);
  if (!pick || step === 'failed' || step === null) return { on: storedOn, busy: false };
  if (pick.card !== null) return { on: pick.card === data, busy: pick.card === data };
  return { on: storedOn, busy: storedOn };
}

/* ── 2 · what the canvas is told ────────────────────────────────────────── */

/** What the bridge lays (`main-ground-preview.ts` checks every field again on its side). */
export type MainGroundLay = {
  still: string | null;
  clip: string | null;
  position: 'center' | 'center top' | 'center bottom';
  color: string | null;
  image: string | null;
  size: string | null;
};

export const MAIN_GROUND_PREVIEW = 'mainGround';

/** `lay: null` takes the preview off — the save was refused, the page's own ground is the truth again. */
export function mainGroundPreviewMessage(seq: number, lay: MainGroundLay | null) {
  return { source: 'setnayan-editor', t: MAIN_GROUND_PREVIEW, seq, lay } as const;
}

/** The page's background as Look › Background holds it: the main background, the page colour, the art direction. */
export type LookGround = { main: HubMainGround | null; bg: string | null; art: 'daylight' | 'candlelight' | null };

export type LookGroundPictures = {
  /** A moving background of ours, by id: its public still and loop. */
  loop: (id: string) => { still: string | null; clip: string | null } | null;
  /** A stored picture or clip of the couple's (or a ready-made scene), by ref: an address the browser can load. */
  media: (ref: string) => string | null;
  /** The cover photo's address (a follow draws it). */
  cover: string | null;
  /** The theme the page wears (`{ ground: 'theme' }` draws ITS loop). */
  themeId: string;
};

/**
 * What the canvas wears for this background, before the server has drawn it —
 * or null when there is nothing honest to lay (a picture whose address is not
 * known here): the canvas then waits for its own render, and the line says so.
 */
export function backgroundLayOf(next: Pick<LookGround, 'main' | 'bg'>, pictures: LookGroundPictures): MainGroundLay | null {
  const m = next.main;
  const picture = (still: string | null, clip: string | null, focus?: HubMainFocus | null): MainGroundLay | null =>
    still ? { still, clip, position: mainGroundPosition(focus ?? null), color: null, image: null, size: null } : null;
  if (isHubMainOwn(m)) {
    const focus = (m as { focus?: HubMainFocus }).focus ?? null;
    return m.kind === 'photo' ? picture(pictures.media(m.media), null, focus) : picture(m.poster ? pictures.media(m.poster) : null, pictures.media(m.media));
  }
  if (isHubMainFollow(m)) return picture(pictures.cover, null, (m as { focus?: HubMainFocus }).focus ?? null);
  if (isHubMainLoop(m) || (m && 'ground' in m && m.ground === 'theme')) {
    const l = pictures.loop(isHubMainLoop(m) ? m.loop : pictures.themeId);
    return l ? picture(l.still, l.clip) : null;
  }
  if (!m) return null;
  /* No picture: the page's colour — plain, blended, or under a pattern. */
  const bg = parseSiteBackground(next.bg);
  const layers: string[] = [];
  const sizes: string[] = [];
  if ('ground' in m && m.ground === 'pattern') {
    layers.push(MAIN_GROUND_PATTERN_CSS[m.pattern].image);
    sizes.push(MAIN_GROUND_PATTERN_CSS[m.pattern].size);
  }
  if (bg?.kind === 'ombre') {
    layers.push(ombreCss(bg.ombre));
    sizes.push('auto');
  }
  return {
    still: null,
    clip: null,
    position: 'center',
    color: bg ? (bg.kind === 'plain' ? bg.hex : bg.ombre.base) : null,
    image: layers.length > 0 ? layers.join(', ') : null,
    size: layers.length > 0 ? sizes.join(', ') : null,
  };
}

/**
 * WHICH PICTURE this background is — what a card stands for, without how it is
 * worn (Shade · Blur · Focus · Motion · Match colours · Candlelight). A change
 * that keeps the picture has nothing new to lay: the canvas waits for its own
 * render, which brings the measured veil with it.
 */
export function backgroundPictureKey(g: Pick<LookGround, 'main' | 'bg'>): string {
  const m = g.main;
  if (isHubMainOwn(m)) return `own:${m.kind}:${m.media}`;
  if (isHubMainFollow(m)) return `follow:${m.of}`;
  if (isHubMainLoop(m)) return `loop:${m.loop}`;
  if (m && 'ground' in m) return `${m.ground}:${m.ground === 'pattern' ? m.pattern : ''}:${m.ground === 'theme' ? '' : (g.bg ?? '')}`;
  return `stored-nothing:${g.bg ?? ''}`;
}

/* ── 3 · what the Maker shows while the server has not caught up ─────────── */

/**
 * The Maker's own copy of the page's background — `lib/maker-draft-store.ts`'s
 * store (which decides, by content, whether the server has caught up), plus the
 * one thing a refusal needs: what the LAST LANDED save left, to draw again.
 *
 * A held save owes no Maker render, so the panel's props stay as they were at
 * the last one; without this the ring would go back to the old card the moment
 * the panel is closed and opened.
 */
export function createLookGroundStore() {
  let flying = 0;
  const store = createDraftedCanvases<LookGround>(() => flying > 0);
  const landed = new Map<string, LookGround>();
  return {
    /** What the panel draws: ours while it is newer than the server's, else the server's. */
    read: (key: string, server: LookGround): LookGround => store.read(key, server),
    /** A pick is drawn NOW, before its save: with nothing in flight, what was on screen is what the draft holds. */
    draw(key: string, next: LookGround, server: LookGround): void {
      if (flying === 0) landed.set(key, store.read(key, server));
      store.note(key, next, server);
    },
    sent(): void {
      flying += 1;
    },
    /**
     * A save answered. Taken → that is what the draft holds. Refused → if it was
     * the LATEST pick, what the last landed save left is drawn again (an older
     * pick's refusal moves nothing: a newer pick is on screen).
     */
    answered(key: string, result: { ok: boolean; latest: boolean; value: LookGround }, server: LookGround): void {
      flying = Math.max(0, flying - 1);
      if (result.ok) landed.set(key, result.value);
      else if (result.latest) store.note(key, landed.get(key) ?? server, server);
    },
    /** Saves still in flight — the test's probe. */
    flying: () => flying,
  };
}
