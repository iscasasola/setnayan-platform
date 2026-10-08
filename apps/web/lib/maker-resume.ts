/**
 * lib/maker-resume.ts — 🔁 A NEW VERSION ARRIVING MID-SESSION NEVER THROWS THE COUPLE OUT OF WHAT THEY WERE DOING.
 *
 * Owner, 08 Oct, on the live Maker (Studio › Look, a background pick in his draft), verbatim: *"clicking on music
 * reset the maker and reloaded"*. Measured: production went from one build to the next in that same minute.
 *
 * ── WHAT RELOADED ───────────────────────────────────────────────────────────
 * A page that is open across a deploy is reloaded by code that is not ours to edit, and silently:
 *   · Next's router — any page data it fetches (a `router.refresh()` after a save, which the Maker does after every
 *     pick) that is answered by a newer build: `next/dist/client/components/router-reducer/fetch-server-response.js`
 *     compares build ids (`getAppBuildId() !== response.b`) and answers `doMpaNavigation(res.url)`, which
 *     `app-router.js` turns into `location.assign(canonicalUrl)` — a hard navigation to the page it is on;
 *   · `app/error.tsx` — a lazy chunk the new build no longer serves (`lib/stale-bundle.ts`, `location.reload()`).
 *
 * ── WHAT "RESET" WAS ────────────────────────────────────────────────────────
 * The reload itself lost nothing (the draft is on the server). The MAKER then put him somewhere else: its address
 * still said `?tool=details&item=music`, and in the new Maker every door into Event Details lands on Studio's HOME
 * (`maker-shell.tsx`, DECISION_LOG 2026-10-07 rule 3) — so a reload of the page he was on was treated as a cold door.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * The Maker keeps a small note of where it is (`noteMakerResume`, this tab's session storage — a convenience: lost,
 * the Maker opens as it always did). On the next load of THE SAME PAGE BY ITSELF — a reload, or a hard navigation
 * from this very page to itself (`makerCameBackToItself`) — the note is honoured once (`takeMakerResume`) and the
 * Maker opens where it was. From anywhere else it is a cold door: the note is thrown away and rule 3 stands.
 * The note is not the address: an address can be pasted, linked and bookmarked; only this tab can have written this.
 *
 * And where the browser can say so beforehand (the Navigation API), the reload is announced in words first
 * (`makerLeavingWords`, drawn by `maker-updating.tsx`).
 *
 * Pure but for `makerLoadNow`. No React.
 */

/** Where the Maker is: its side, the Studio tool open (`home`: the tiles), and the Event Details item showing. */
export type MakerResume = { side: 'stages' | 'studio'; at: string; item: string | null };

/** The note's key beside the Maker's own memory (`sn-maker:<event>`). */
export function makerResumeKey(memoryKey: string): string {
  return `${memoryKey}:at`;
}

/** How this document was loaded, as the browser reports it. */
export type MakerLoad = {
  /** `PerformanceNavigationTiming.type` — 'navigate' · 'reload' · 'back_forward' · 'prerender' (null: not reported). */
  type: string | null;
  /** The address the DOCUMENT was loaded at (`PerformanceNavigationTiming.name`). */
  loaded: string | null;
  /** `document.referrer` — the page that navigated here. */
  referrer: string;
  /** The address now. */
  href: string;
};

const pathOf = (url: string | null | undefined): string | null => {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return null;
  }
};

/**
 * Did this page come back to ITSELF? Only when the document was loaded AT this page (never a page reached later
 * without a load — its "reload" would be some other page's) and either it was reloaded, or the page that navigated
 * here was this same page (Next's build-mismatch reload is `location.assign` of its own address).
 */
export function makerCameBackToItself(load: MakerLoad): boolean {
  const here = pathOf(load.href);
  if (!here || pathOf(load.loaded) !== here) return false;
  if (load.type === 'reload') return true;
  return load.type === 'navigate' && pathOf(load.referrer) === here;
}

/** One answer per document: a Maker reached again WITHOUT a load (Home and back) is a cold door. */
const ONCE = { done: false };

/**
 * The note, read ONCE and always thrown away — answered only for a page that came back to itself. Anything that
 * is not a note this version wrote is no note.
 */
export function takeMakerResume(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  key: string,
  cameBack: boolean,
  once: { done: boolean } = ONCE,
): MakerResume | null {
  const first = !once.done;
  once.done = true;
  let raw: string | null = null;
  try {
    raw = storage.getItem(key);
    storage.removeItem(key);
  } catch {
    return null;
  }
  if (!first || !cameBack || !raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<MakerResume> | null;
    if (!v || (v.side !== 'stages' && v.side !== 'studio') || typeof v.at !== 'string' || v.at.length > 40) return null;
    return { side: v.side, at: v.at, item: typeof v.item === 'string' && v.item.length <= 60 ? v.item : null };
  } catch {
    return null;
  }
}

/** Keep where the Maker is. A convenience: storage that refuses is not an error. */
export function noteMakerResume(storage: Pick<Storage, 'setItem'>, key: string, where: MakerResume): void {
  try {
    storage.setItem(key, JSON.stringify(where));
  } catch {
    /* private mode / blocked storage: a reload opens the Maker as a cold door */
  }
}

/**
 * 🚪 WHERE A DETAILS SELECTION LANDS WHILE THE STAGES SIDE IS ON (the new Maker, DECISION_LOG 2026-10-07 rule 3:
 * *every door into Event Details lands on Studio's home, never over the Stages page*).
 *
 *   a cold door (`back` null — the address, Home's next-step card, the tab's remembered tool)
 *       → Studio's HOME, the selection dropped. Rule 3, unchanged.
 *   the page's own reload, and it was on the STAGES side
 *       → it stays on the stage; the address's old `?tool=details` is not a door. Selection dropped.
 *   the page's own reload, and a Studio tool was open (`tiles` has it)
 *       → that tool, the selection KEPT (its item is the address's / the note's).
 *   …a tool this event no longer has → Studio's home, as a cold door.
 */
export function makerDoorLanding(
  back: Pick<MakerResume, 'side' | 'at'> | null,
  tiles: readonly string[],
): { side: 'stages' | 'studio'; at: string; keep: boolean } {
  if (back?.side === 'stages') return { side: 'stages', at: 'home', keep: false };
  if (back && back.at !== 'home' && tiles.includes(back.at)) return { side: 'studio', at: back.at, keep: true };
  return { side: 'studio', at: 'home', keep: false };
}

/** How this document was loaded — read from the browser. */
export function makerLoadNow(): MakerLoad {
  let type: string | null = null;
  let loaded: string | null = null;
  try {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    type = nav?.type ?? null;
    loaded = nav?.name ?? null;
  } catch {
    /* not reported: the page is treated as a cold door */
  }
  return { type, loaded, referrer: document.referrer, href: window.location.href };
}

/** What the page says while Next reloads it onto a newer version (its build-mismatch navigation). */
export const MAKER_UPDATING_WORDS = 'Updating Setnayan…';
/** …and while it reloads itself for any other reason (a chunk that moved, a request the phone cut off, the
 *  updated-site bar's Reload) — it says what it does, never an update it cannot know happened. */
export const MAKER_RELOADING_WORDS = 'Reloading Setnayan…';

/**
 * The words to show as the page starts to leave — or null: say nothing. Only for the page reloading ITSELF by
 * script (Next's build-mismatch navigation, a stale-bundle reload, the "Reload" of the updated-site bar): never
 * for a link or the browser's own buttons (`userInitiated`), a move inside the page, Back / Forward, or a
 * navigation to any other page — each of those is the person going somewhere, not the site updating under them.
 */
export function makerLeavingWords(nav: {
  userInitiated: boolean;
  /** `NavigateEvent.navigationType`. */
  type: string;
  /** `NavigateEvent.destination.url`. */
  to: string;
  sameDocument: boolean;
  here: string;
}): string | null {
  if (nav.userInitiated || nav.sameDocument) return null;
  if (nav.type !== 'push' && nav.type !== 'replace' && nav.type !== 'reload') return null;
  const here = pathOf(nav.here);
  if (here === null || pathOf(nav.to) !== here) return null;
  return nav.type === 'reload' ? MAKER_RELOADING_WORDS : MAKER_UPDATING_WORDS;
}
