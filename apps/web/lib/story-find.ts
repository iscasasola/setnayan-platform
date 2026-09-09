/**
 * FIND IN THIS DAY — the arithmetic, with no DOM in it.
 *
 * `01_The_Story.md` §8 · `08` step 2.4 · prototype `story.html` `#findQ`.
 *
 * One search over every layer the CURRENT VIEWER MAY SEE. The searchable index
 * is rebuilt from the live page on every keystroke (`find-in-this-day.tsx`), so
 * what a reader may not read was never written into the document and can never
 * be a hit. THIS file holds only the parts that are arithmetic — matching, the
 * snippet, and reading a time out of what somebody typed — because those are
 * the parts that can be wrong in a way a screenshot does not show, and they are
 * testable without a browser.
 *
 * 🔑 NOTHING HERE TOUCHES A PAYLOAD. It is handed strings that are already on
 * the page. There is no route to ask, no fetch, and no second index — which is
 * the entire safety argument for the search, stated as a property of the code
 * rather than as a promise in a comment.
 *
 * Pure + total — no network, no `server-only`, no React, no `document`.
 */

/** One thing on the page that can be found. Scraped from the DOM, never fetched. */
export type Findable = {
  /** Unique within one scrape. */
  id: string;
  /** Which group it lands under in the results. */
  group: FindGroup;
  /** The mono stamp — `7:12 PM`, `NOV 16`, `TEAM`. */
  stamp: string;
  /** The headline of the hit. */
  label: string;
  /** Everything else worth matching on — the prose, a category, a byline. */
  text: string;
  /** The element id to scroll to. */
  targetId: string | null;
  /** The index tab to open first, when the hit lives inside one. */
  panel: string | null;
  /** The hour filter to apply after opening that tab. */
  hour: string | null;
};

export const FIND_GROUPS = [
  'Minutes',
  'Voices',
  'Captures',
  'Letters',
  'Questions',
  'The team',
] as const;
export type FindGroup = (typeof FIND_GROUPS)[number];

/** How many hits one group shows before it says how many more there are. */
export const FIND_GROUP_CAP = 8;

/** Below this, the search does not run at all — a one-letter query matches the day. */
export const FIND_MIN_LEN = 2;

/**
 * A TIME, READ OUT OF WHAT SOMEBODY TYPED. Minutes past midnight, or null.
 *
 * Accepts `7:12`, `7:12 PM`, `9:47pm`, `19:12`, and the Filipino words a guest
 * at a Philippine wedding actually types — `3 hapon`, `3 ng hapon`, `8 gabi`,
 * `10 umaga`, `12 tanghali`, `2 madaling araw`.
 *
 * ⚠ A BARE `3` MEANS THREE IN THE AFTERNOON, AND THAT IS A DECISION, NOT A BUG.
 * The prototype makes it and it is right: a celebration's written-up minutes sit
 * in the afternoon and evening, so a reader who types `3` wants 3 PM. Hours 10,
 * 11 and 12 are left alone (10 and 11 read as morning, 12 as noon), which is
 * where the ambiguity actually stops hurting.
 *
 * ⚠ AND `19:12` IS NOT `7:12 PM` BY THE SAME RULE — it is already past twelve,
 * so no suffix is applied to it at all. Applying the bare-hour rule to a
 * 24-hour clock would have pushed it to 31:12 and returned null on a query that
 * is perfectly clear.
 */
export function parseStoryTime(raw: string): number | null {
  const q = raw.trim().toLowerCase();
  const m = q.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(?:ng\s+)?(am|pm|a\.m\.|p\.m\.|umaga|tanghali|hapon|gabi|madaling araw)?$/,
  );
  if (!m) return null;
  let h = Number(m[1]);
  const mm = m[2] ? Number(m[2]) : 0;
  const word = (m[3] ?? '').replace(/\./g, '').trim();
  if (!Number.isFinite(h) || h > 23 || mm > 59) return null;

  if (word === 'pm' || word === 'hapon' || word === 'gabi') {
    if (h < 12) h += 12;
  } else if (word === 'am' || word === 'umaga' || word === 'madaling araw') {
    if (h === 12) h = 0;
  } else if (word === 'tanghali') {
    // Noon. "12 tanghali" is twelve; "1 tanghali" is one in the afternoon.
    if (h < 12) h += 12;
  } else if (h >= 1 && h <= 9) {
    // The bare-hour rule. See the note above — and note it cannot fire on a
    // 24-hour reading, because those are all >= 10 or already carry a suffix.
    h += 12;
  }
  if (h > 23) return null;
  return h * 60 + mm;
}

/** `7:12 PM` from minutes past midnight. The dial's own formatter's twin. */
export function formatFoundTime(minuteOfDay: number): { t: string; ap: string } {
  const h24 = Math.floor(minuteOfDay / 60) % 24;
  const m = minuteOfDay % 60;
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return { t: `${h}:${String(m).padStart(2, '0')}`, ap: h24 < 12 ? 'AM' : 'PM' };
}

/** The words a query is made of. Empty when there is nothing to search for. */
export function findTokens(raw: string): string[] {
  return raw.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Which findables match — EVERY token must appear somewhere in the item.
 *
 * ⚠ EVERY, NOT ANY. A two-word query that matched on either word turns "lolo
 * ben" into every hit containing the word "ben" and every hit containing the
 * word "lolo", which on a page of Filipino names is most of them. Narrowing by
 * adding a word is the behaviour the results panel promises in its own copy
 * ("add a word to narrow it"), so it has to be true.
 */
export function matchFindables(items: readonly Findable[], raw: string): Findable[] {
  const toks = findTokens(raw);
  if (toks.length === 0) return [];
  return items.filter((it) => {
    const hay = `${it.label} ${it.text} ${it.stamp}`.toLowerCase();
    return toks.every((t) => hay.includes(t));
  });
}

/** The hits of one group, capped, plus how many were left out. */
export function groupHits(
  hits: readonly Findable[],
  group: FindGroup,
): { shown: Findable[]; more: number } {
  const all = hits.filter((h) => h.group === group);
  return { shown: all.slice(0, FIND_GROUP_CAP), more: Math.max(0, all.length - FIND_GROUP_CAP) };
}

/**
 * A readable window of a long body, centred on the first match.
 *
 * Returns the head of the string when the match is already near the start —
 * an ellipsis in front of the first four words reads as though something was
 * cut off when nothing was.
 */
export function findSnippet(body: string, raw: string, width = 120): string {
  const s = body.replace(/\s+/g, ' ').trim();
  const toks = findTokens(raw);
  if (s.length <= width) return s;
  let first = Infinity;
  const lower = s.toLowerCase();
  for (const t of toks) {
    const k = lower.indexOf(t);
    if (k >= 0 && k < first) first = k;
  }
  if (first === Infinity || first < 40) return `${s.slice(0, width)}…`;
  return `…${s.slice(first - 40, first + width - 40)}…`;
}

/**
 * Split a string around every token, so the caller can mark the matches
 * WITHOUT building HTML out of user-supplied text.
 *
 * 🔴 THE PROTOTYPE BUILDS `<mark>` INTO AN HTML STRING AND ASSIGNS IT TO
 * `innerHTML`. That is fine in a demo whose content is hard-coded and wrong on
 * a page whose content is a guest's message: a wish reading `<img onerror=…>`
 * would execute. This returns SEGMENTS and React renders them as text, so
 * nothing on this page can be injected by anybody who wrote anything on it.
 */
export function markSegments(text: string, raw: string): Array<{ text: string; hit: boolean }> {
  const toks = findTokens(raw).filter((t) => t.length > 0);
  if (toks.length === 0) return [{ text, hit: false }];
  const lower = text.toLowerCase();
  const covered = new Array<boolean>(text.length).fill(false);
  for (const t of toks) {
    let from = 0;
    for (;;) {
      const k = lower.indexOf(t, from);
      if (k < 0) break;
      for (let i = k; i < k + t.length; i += 1) covered[i] = true;
      from = k + t.length;
    }
  }
  const out: Array<{ text: string; hit: boolean }> = [];
  let start = 0;
  for (let i = 1; i <= text.length; i += 1) {
    if (i === text.length || covered[i] !== covered[start]) {
      out.push({ text: text.slice(start, i), hit: covered[start] === true });
      start = i;
    }
  }
  return out.length > 0 ? out : [{ text, hit: false }];
}
