/**
 * THE SAVE-THE-DATE FILM PLAYS IN FULL ONCE PER PHONE.
 *
 * A guest's walk, 2026-10-11 (fault N08): the film stood in front of the page
 * on EVERY visit. Owner the same day ("ok all"): once per phone; after that the
 * guest gets the page straight away, with "Watch our film again" (already on
 * the page) to bring it back.
 *
 * WHAT "ONCE PER PHONE" IS. The browser's own `localStorage`, one key per
 * event — no account, no cookie, nothing sent to us. So:
 *   · it is per BROWSER on that phone (Safari and the Messenger in-app browser
 *     each see the film once);
 *   · clearing the browser's site data, or a private window, shows the film
 *     once more;
 *   · a browser that refuses storage shows the film every visit — exactly what
 *     every guest got before this.
 *
 * WHEN IT COUNTS AS SEEN. When the film is LEFT by the guest's own press ("See
 * our page") or by its own end (the stage carries on) — never when the page
 * lifted it for them: a guest who lands part-way down the page (back from Find
 * your seat) or whose phone already remembers it has not just watched it.
 * A film abandoned half-way (the tab closed) plays again next time.
 *
 * Pure, with the storage handed in, so every branch is run by
 * `lib/std-film-seen.test.ts`. Storage can throw on read AND on write (private
 * mode, blocked site data): both are caught, and "could not tell" is "not seen".
 */
export const STD_FILM_SEEN_PREFIX = 'sn:std-film-seen:';

type Readable = Pick<Storage, 'getItem'>;
type Writable = Pick<Storage, 'setItem'>;

/** The key for one event — its public id, never a guest's. */
export function stdFilmSeenKey(eventKey: string | null | undefined): string | null {
  const k = (eventKey ?? '').trim();
  return k ? `${STD_FILM_SEEN_PREFIX}${k}` : null;
}

export function stdFilmSeen(storage: Readable | null | undefined, key: string | null): boolean {
  if (!storage || !key) return false;
  try {
    return storage.getItem(key) === '1';
  } catch {
    return false;
  }
}

export function markStdFilmSeen(storage: Writable | null | undefined, key: string | null): void {
  if (!storage || !key) return;
  try {
    storage.setItem(key, '1');
  } catch {
    // A phone that will not remember simply shows the film again.
  }
}

/** Why the film is lifted the moment the page loads — or null when it plays. */
export type FilmLiftAtLanding = 'landed-down-the-page' | 'seen-before' | null;

export function filmLiftAtLanding(input: {
  /** The Maker's canvas: the film is a slide there; nothing is lifted or remembered. */
  asSlide: boolean;
  /** `filmLiftedOnLanding` — the guest arrived at a section, not at the front door. */
  landedDownThePage: boolean;
  /** `stdFilmSeen` on this phone. */
  seen: boolean;
}): FilmLiftAtLanding {
  if (input.asSlide) return null;
  if (input.landedDownThePage) return 'landed-down-the-page';
  return input.seen ? 'seen-before' : null;
}

/**
 * Does THIS exit make the film "seen"? Only one the guest or the film made —
 * not the lift the page itself just sent at landing.
 */
export function exitCountsAsSeen(input: { asSlide: boolean; liftedAtLanding: boolean }): boolean {
  return !input.asSlide && !input.liftedAtLanding;
}

/**
 * The one line of script that runs before paint: a phone that remembers the
 * film marks the document, and the film (still in the server's HTML) is not
 * drawn while the page's script loads — the guest gets the page straight away,
 * not a film that vanishes a second later. Returns '' with no key.
 */
export const STD_FILM_SEEN_ATTR = 'data-std-film-seen';
export function stdFilmSeenBootScript(key: string | null): string {
  if (!key) return '';
  // The key is quoted as data, and a `<` in it can never close the tag it is written into.
  const quoted = JSON.stringify(key).replace(/</g, '\\u003c');
  return `(function(){try{if(localStorage.getItem(${quoted})==='1'){document.documentElement.setAttribute('${STD_FILM_SEEN_ATTR}','1')}}catch(e){}})()`;
}
