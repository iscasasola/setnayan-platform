/**
 * THE WHOLE STORY, AT ONCE — eleven indexes, and not one of them a second copy.
 *
 * `01_The_Story.md` §3.6 · `08` step 2.4 · prototype `story.html` §`#all`.
 *
 * Eleven tabs, each an honest index of ONE layer, every item linking back to
 * the minute it belongs to:
 *
 *   captures · voices · asked · letters · the team · films ·
 *   photo wall · the room · the look · made with · by the numbers
 *
 * ── WHY THIS IS AN INDEX AND NOT A SECTION ─────────────────────────────────
 * 🔑 IT POINTS AT THINGS. IT DOES NOT OWN THEM. Every entry carries an `href`
 * back to the minute (or the road fact) that already renders it further up the
 * page. The shipped sections under the clock are untouched — folding them in
 * here would have DELETED what a couple switched on, which is the exact loss
 * S6 exists to prevent. An index that re-renders its subjects is a second copy
 * of the day, and two copies disagree.
 *
 * ── THE PRIVACY ARGUMENT, WHICH IS THE WHOLE POINT OF THE FILE ─────────────
 * 🔴 THE INDEX WAS ONE OF THE SIX THINGS THE DESIGN REVIEW FOUND STILL PUBLIC
 * to a pre-publish stranger while the photographs themselves were correctly
 * withheld (`the-guests-layer-is-theirs-until-you-publish.ts`, the red note).
 * An index of 492 captures describes the guests' day precisely as the captures
 * do — in list form.
 *
 * So this module is **monotone by construction**, the same way `consent-veto.ts`
 * and `redactStoryLayers` are:
 *
 *   1. every guest-layer tab is derived ONLY from an array that
 *      `redactStoryLayers` empties. No branch invents an entry, and no branch
 *      reads a count from anywhere but those same arrays;
 *   2. every count goes through `countForLayer`, so a withheld one is `null` —
 *      an ABSENCE — and never `0`. "0 captures" is a claim about somebody's
 *      wedding and it is a false one while the photographs sit behind the gate
 *      (owner gate Q1, ruled 2026-09-09: no counts and no bar heights to a
 *      stranger before publish);
 *   3. a guest-layer tab with nothing in it and a WITHHELD layer is dropped
 *      entirely. A guest-layer tab with nothing in it and an OPEN layer keeps
 *      its place and says so in words. Those are different sentences and the
 *      page must not print the second one when the first is true.
 *
 * ⚠ AND THAT IS WHY FIND-IN-THIS-DAY IS BUILT FROM THE DOM. The search reads
 * the rendered page (`§8`), so the payload this function was handed decides
 * what can ever be found. There is no second index for the search to consult
 * and no server route it can ask — a stranger cannot search what a stranger
 * cannot read, because it was never written down.
 *
 * Pure + total — no network, no `server-only`, no React. Imported by the render
 * path and by its own guard, so the test can assert the real payload instead of
 * a class name in a stylesheet.
 */

import { SMALL_COUNTS_ARE_A_VERDICT } from './story-room';
import { countForLayer } from './the-guests-layer-is-theirs-until-you-publish';

/** Which of the three layers (`01` §2, owner lock 1) an entry belongs to. */
export type IndexLayer = 'host' | 'guest';

/** The eleven, in the order the design lists them. */
export const STORY_INDEX_TABS = [
  'captures',
  'voices',
  'asked',
  'letters',
  'team',
  'films',
  'wall',
  'room',
  'look',
  'made',
  'numbers',
] as const;
export type StoryIndexTabKey = (typeof STORY_INDEX_TABS)[number];

/** One line of one index. */
export type IndexEntry = {
  /** Stable within a tab. Used as a React key and as the search's own id. */
  key: string;
  /** The big mono stamp on the left — `7:12`, `NOV 16`, `TEAM`, `PHOTO WALL`. */
  stamp: string;
  /** The thing itself, as a reader should see it. */
  label: string;
  /** A second line — a byline, a category, a caption. Never a name that was
   *  not consented; the loader strips those before they reach here. */
  note: string | null;
  /** Back to the minute this belongs to. Null when it belongs to no minute. */
  href: string | null;
  /** For the guard, and for the markup's `data-layer` marker. */
  layer: IndexLayer;
  /** A picture to show in a grid tab, when the tab draws one. */
  imageUrl?: string | null;
  /** The hour filter this capture answers to — `pre`, `vendors`, or `0`…`23`. */
  hour?: string | null;
};

/** One tab. */
export type IndexTab = {
  key: StoryIndexTabKey;
  /** The tab's own word — "Captures", "The team". */
  title: string;
  /**
   * The number on the chip, or NULL for "this reader has no number".
   *
   * ⚠ NULL IS NOT ZERO AND THE CHIP MUST NOT PRINT ONE. See the header.
   */
  count: number | null;
  layer: IndexLayer;
  entries: IndexEntry[];
  /** What the panel says when it has entries but the tab is mostly prose. */
  note: string | null;
  /** What the panel says when it is genuinely, measurably empty. */
  empty: string | null;
};

/** A minute (or road fact) the page has already placed, and its anchor. */
export type IndexAnchor = {
  /** The `id` attribute of the rendered entry — where an item links to. */
  id: string;
  /** Epoch ms. Used to file a voice under the minute it is about. */
  atMs: number;
  /** `7:12`, `NOV 16`. */
  stamp: string;
  /** `PM`, `2026`. */
  suffix: string;
  /** The entry's own title. */
  label: string;
  /** Hour of the Manila day, 0…23. Null for a road fact. */
  hour: number | null;
};

export type StoryIndexInput = {
  /** May this reader read the guests' layer? Decided upstream, never here. */
  guestOpen: boolean;
  /** The minutes and road facts, already placed by the spine. */
  anchors: readonly IndexAnchor[];
  /** How wide a net a voice casts when it looks for its minute, in ms. */
  windowMs: number;
  /** THE REDACTED PAYLOAD. Everything guest-made is already gone if it must be. */
  captures: ReadonlyArray<{
    url: string;
    atMs: number | null;
    caption: string | null;
    /**
     * An hour chip decided by the CALLER rather than by the clock.
     *
     * The only value that uses it today is `vendors` — day-of media a shop
     * submitted, which `01` §3.6 lists as the captures tab's third filter
     * ("from the suppliers") and which carries no shutter time of its own. A
     * capture with a time leaves this undefined and is filed by its hour.
     */
    hour?: string | null;
  }>;
  voices: ReadonlyArray<{
    body: string;
    atMs: number | null;
    author: string | null;
    role: string | null;
  }>;
  asked: ReadonlyArray<{ prompt: string; atMs: number | null; byline: string | null }>;
  letters: ReadonlyArray<{ title: string; body: string; author: string | null; role: string | null }>;
  team: ReadonlyArray<{ name: string; category: string | null; isFirstPick: boolean }>;
  films: ReadonlyArray<{ title: string; stamp: string; atMs: number; anchorId: string | null }>;
  wall: ReadonlyArray<{ url: string }>;
  wallActive: boolean;
  room: { tables: ReadonlyArray<{ id: string; label: string }>; seatsAssigned: boolean };
  /** The saved reception palette — the look. */
  palette: readonly string[];
  /** "Made with" — the Setnayan surfaces this celebration actually used. */
  madeWith: ReadonlyArray<{ name: string; note: string; stamps: readonly string[] }>;
  /** By the numbers, already gated: a withheld figure arrives as null. */
  numbers: ReadonlyArray<{ value: string; label: string; note: string | null }>;
  /** The counts the cover already resolved. Guest-layer ones may be null. */
  captureCount: number | null;
  /** The host's own words for this celebration. */
  words: { host: string; occasion: string };
};

/** The stamp for something that belongs to no single minute. */
const NO_MINUTE = '—';

/**
 * A COUNT THIS STORY WILL NOT STATE — because a small number is a verdict.
 *
 * ⚖ OWNER RULING 2026-09-09, relayed from the session that put it to him. He
 * was asked whether a table with one or two photographs should show its count,
 * as a PRIVACY question, and answered no for a different reason entirely:
 *
 *     "this will subconsciously tell them they did not create enough
 *      memories for the story"
 *
 * 🔑 SO IT IS NOT A PRIVACY FLOOR AND IT IS NOT ABOUT SEATING. It is the rule
 * that THE STORY NEVER PASSES JUDGEMENT ON THE DAY IT IS TELLING, and it
 * generalises to any small number anywhere on this page — which is why the
 * threshold is imported from `story-room.ts` rather than re-picked here. A
 * session that reads it as k-anonymity will relax it; the reason is the
 * load-bearing half.
 *
 * ⚠ THE CHIP LOSES ITS NUMBER; THE TAB KEEPS ITS ROWS. The floor plan takes a
 * quiet table out of the room entirely, and that is right there — a faintly
 * drawn table still says "this table barely shot anything". It is NOT right
 * here: two letters are two letters somebody wrote, and deleting them to avoid
 * printing "2" would take the story away to protect a feeling about it. What
 * this withholds is the STATEMENT of the number, which is the part that reads
 * as a verdict. The rows are the story; the chip is a score.
 */
function countWorthStating(n: number | null): number | null {
  if (n == null) return null;
  return n >= SMALL_COUNTS_ARE_A_VERDICT ? n : null;
}

/**
 * The minute an instant belongs to, or null.
 *
 * ⚠ NEAREST WITHIN A WINDOW, NEVER JUST NEAREST. `nearestBy` on the road had to
 * learn the same lesson: without the bound, every voice in the payload claims
 * the one minute the page happens to have written up, however many hours away
 * it is, and the index reads as though the whole day happened at 7:12.
 */
function anchorFor(
  atMs: number | null,
  anchors: readonly IndexAnchor[],
  windowMs: number,
): IndexAnchor | null {
  if (atMs == null || !Number.isFinite(atMs)) return null;
  let best: IndexAnchor | null = null;
  let bestD = Infinity;
  for (const a of anchors) {
    const d = Math.abs(a.atMs - atMs);
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best && bestD <= windowMs ? best : null;
}

function stampOf(a: IndexAnchor | null): string {
  if (!a) return NO_MINUTE;
  return a.suffix ? `${a.stamp} ${a.suffix}` : a.stamp;
}

/**
 * The hour bucket a capture answers to, in the filter's own vocabulary.
 *
 * `pre` is everything before the first placed minute of the day — the prenup,
 * the despedida, the months of making it. That is a real answer for the one
 * published story in production, whose fourteen captures ALL fall outside its
 * own day (measured 2026-09-09): the day's index is empty and the road's is
 * full, which is `S2`'s bound working, not a fault to route around.
 */
function hourOf(atMs: number | null, dayStartMs: number | null, dayEndMs: number | null): string {
  if (atMs == null || !Number.isFinite(atMs)) return 'pre';
  if (dayStartMs != null && atMs < dayStartMs) return 'pre';
  if (dayEndMs != null && atMs > dayEndMs) return 'pre';
  // Manila is UTC+8 with no DST, ever — the same arithmetic `story-day-window`
  // uses, and the reason it is safe to do here without a timezone library.
  return String(Math.floor((((atMs + 8 * 3_600_000) % 86_400_000) + 86_400_000) % 86_400_000 / 3_600_000));
}

/**
 * Build the eleven.
 *
 * A tab that this reader has nothing in — and no prospect of anything, because
 * the layer is withheld — is not in the returned list at all. The tab strip is
 * therefore an honest statement of what the page holds for THIS reader, and a
 * chip reading "Captures · 0" cannot be printed for somebody the photographs
 * are simply not shown to.
 */
export function buildStoryIndex(input: StoryIndexInput): IndexTab[] {
  const { guestOpen, anchors, windowMs, words } = input;
  const tabs: IndexTab[] = [];

  const dayAnchors = anchors.filter((a) => a.hour != null);
  const dayStartMs = dayAnchors.length ? Math.min(...dayAnchors.map((a) => a.atMs)) : null;
  const dayEndMs = dayAnchors.length ? Math.max(...dayAnchors.map((a) => a.atMs)) : null;

  // ── 1 · CAPTURES ──────────────────────────────────────────────────────────
  const captureEntries: IndexEntry[] = input.captures.map((c, i) => {
    const a = anchorFor(c.atMs, anchors, windowMs);
    return {
      key: `cap-${i}`,
      stamp: stampOf(a),
      label: c.caption ?? (a ? a.label : 'A capture from this day'),
      note: null,
      href: a ? `#${a.id}` : null,
      layer: 'guest' as const,
      imageUrl: c.url,
      hour: c.hour ?? hourOf(c.atMs, dayStartMs, dayEndMs),
    };
  });
  /*
    ── THE CHIP CARRIES A NUMBER ONLY WHEN IT IS THE COVER'S NUMBER ──────────

    🔴 THE PAGE ALREADY SHIPPED TWO COUNTS OF ONE THING — the cover said "14
    captures" and the older By the Numbers block said "15 Photos & moments"
    (fixed in this same change: the clip was inside the photo count and was
    being added to it again). A third number, in the tab strip, disagreeing with
    both because the gallery read is capped, would have been the same defect
    with one more instance.

    So: the chip prints the cover's count when the index actually holds every
    capture the cover counted, and prints NOTHING when it holds fewer. On a
    curated sample where everything resolves it reads exactly like the
    prototype's "492 captures". On a real celebration whose gallery slice is
    capped — or whose clips fall outside the day the timeline read is bounded to
    — the strip says "Captures" and the page keeps exactly one capture count.

    ⚠ It is NOT the entry count instead. "Captures · 13" beside a cover reading
    "14 captures" is a smaller lie in the same shape.
  */
  const captureChip =
    input.captureCount != null && captureEntries.length === input.captureCount
      ? countWorthStating(countForLayer(input.captureCount, guestOpen))
      : null;

  pushGuestTab(tabs, guestOpen, {
    key: 'captures',
    title: 'Captures',
    count: captureChip,
    layer: 'guest',
    entries: captureEntries,
    note: `A guest who asked not to be shown is not here, or appears blurred — and is never named as the one who shot a photo. Their choice beats the ${words.host}'s curation.`,
    empty: `Nothing was shot at this ${words.occasion}, or nothing has cleared the screen yet.`,
  });

  // ── 2 · VOICES ────────────────────────────────────────────────────────────
  const voiceEntries: IndexEntry[] = input.voices.map((v, i) => {
    const a = anchorFor(v.atMs, anchors, windowMs);
    return {
      key: `voice-${i}`,
      stamp: stampOf(a),
      label: v.body,
      /*
        🔒 THE ROLE RIDES THE SAME CONSENT AS THE NAME — owner gate Q2, ruled
        2026-09-09. There is exactly one maid of honour, so a role badge over an
        unnamed voice identifies her to everybody who was at the wedding. The
        loader already strips an unconsented role to null; this line must never
        put one back by deriving it from anything else.
      */
      note: v.author ? [v.author, v.role].filter(Boolean).join(' · ') : 'Chose not to be named',
      href: a ? `#${a.id}` : null,
      layer: 'guest' as const,
    };
  });
  pushGuestTab(tabs, guestOpen, {
    key: 'voices',
    title: 'Voices',
    count: countWorthStating(countForLayer(voiceEntries.length, guestOpen)),
    layer: 'guest',
    entries: voiceEntries,
    note: null,
    empty: 'Nobody has left words yet.',
  });

  // ── 3 · ASKED ─────────────────────────────────────────────────────────────
  const askedEntries: IndexEntry[] = input.asked.map((q, i) => {
    const a = anchorFor(q.atMs, anchors, windowMs);
    return {
      key: `asked-${i}`,
      stamp: stampOf(a),
      label: q.prompt,
      note: q.byline,
      href: a ? `#${a.id}` : null,
      layer: 'guest' as const,
    };
  });
  pushGuestTab(tabs, guestOpen, {
    key: 'asked',
    title: 'Asked',
    count: countWorthStating(countForLayer(askedEntries.length, guestOpen)),
    layer: 'guest',
    entries: askedEntries,
    note:
      'Every answer here passed five separate yeses: share this answer · my captures may be ' +
      'public · screened clean · not opted out of photos · and a name only where the guest ' +
      'asked to be named.',
    empty: 'No questions were answered on camera.',
  });

  // ── 4 · LETTERS ───────────────────────────────────────────────────────────
  const letterEntries: IndexEntry[] = input.letters.map((l, i) => ({
    key: `letter-${i}`,
    stamp: 'LETTER',
    label: l.title,
    // Same Q2 rule as the voices above, and the same reason.
    note: l.author ? [l.author, l.role].filter(Boolean).join(' · ') : 'Not named, by choice',
    href: null,
    layer: 'guest' as const,
  }));
  pushGuestTab(tabs, guestOpen, {
    key: 'letters',
    title: 'Letters',
    count: countWorthStating(countForLayer(letterEntries.length, guestOpen)),
    layer: 'guest',
    entries: letterEntries,
    note: 'Letters carry a byline only if the writer agreed to be named. The role rides the same consent as the name.',
    empty: 'No letters were written.',
  });

  // ── 5 · THE TEAM ──────────────────────────────────────────────────────────
  //
  // The host's OWN layer: who they booked is theirs, and it is public as the
  // day is made. It is NOT gated with the captures, and never has been.
  const teamEntries: IndexEntry[] = input.team.map((v, i) => ({
    key: `team-${i}`,
    stamp: 'TEAM',
    label: v.name,
    note: [v.category, v.isFirstPick ? 'our #1 match' : null].filter(Boolean).join(' · ') || null,
    href: null,
    layer: 'host' as const,
  }));
  if (teamEntries.length > 0) {
    tabs.push({
      key: 'team',
      title: 'The team',
      count: countWorthStating(teamEntries.length),
      layer: 'host',
      entries: teamEntries,
      note: 'Paying never changes whether a shop is credited — only how richly.',
      empty: null,
    });
  }

  // ── 6 · FILMS ─────────────────────────────────────────────────────────────
  //
  // One card per BROADCAST SESSION, not one per film (`01` §6): a single 2h48
  // file cannot span 2:38 to 9:47 PM.
  const filmEntries: IndexEntry[] = input.films.map((f, i) => ({
    key: `film-${i}`,
    stamp: f.stamp,
    label: f.title,
    note: 'Live broadcast',
    href: f.anchorId ? `#${f.anchorId}` : null,
    layer: 'host' as const,
  }));
  if (filmEntries.length > 0) {
    tabs.push({
      key: 'films',
      title: 'Films',
      count: countWorthStating(filmEntries.length),
      layer: 'host',
      entries: filmEntries,
      note: "A minute's timecode is its clock time minus the moment that session went live.",
      empty: null,
    });
  }

  // ── 7 · PHOTO WALL ────────────────────────────────────────────────────────
  const wallEntries: IndexEntry[] = input.wall.map((p, i) => ({
    key: `wall-${i}`,
    stamp: 'WALL',
    label: 'On the screen in the room',
    note: null,
    href: null,
    layer: 'guest' as const,
    imageUrl: p.url,
  }));
  if (input.wallActive) {
    pushGuestTab(tabs, guestOpen, {
      key: 'wall',
      title: 'Photo wall',
      count: countWorthStating(countForLayer(wallEntries.length, guestOpen)),
      layer: 'guest',
      entries: wallEntries,
      note: 'The wall as the room saw it — minus anything a guest has un-posted since.',
      empty: 'The wall ran, and nothing on it has been kept.',
    });
  }

  // ── 8 · THE ROOM ──────────────────────────────────────────────────────────
  //
  // 🔒 TABLE LABELS ONLY, AND NEVER A NAME. `story-room.ts` is the privacy
  // boundary — the only string it will emit is `event_tables.table_label` —
  // and this index does not widen it. Who sat where is shown to ONE person, on
  // their own account, in "Were you there?" and nowhere else.
  const roomEntries: IndexEntry[] = input.room.tables.map((t) => ({
    key: `table-${t.id}`,
    stamp: t.label,
    label: `Table ${t.label}`,
    note: null,
    href: null,
    layer: 'host' as const,
  }));
  if (roomEntries.length > 0) {
    tabs.push({
      key: 'room',
      title: 'The room',
      count: countWorthStating(roomEntries.length),
      layer: 'host',
      entries: roomEntries,
      note: 'No names on the plan. A guest sees their own table — and only their own — on their own account.',
      empty: null,
    });
  }

  // ── 9 · THE LOOK ──────────────────────────────────────────────────────────
  const lookEntries: IndexEntry[] = input.palette.map((hex, i) => ({
    key: `look-${i}`,
    stamp: ['DOMINANT', 'SUPPORTING', 'ACCENT', 'NEUTRAL', 'ACCENT 2'][i] ?? 'COLOUR',
    label: hex,
    note: null,
    href: null,
    layer: 'host' as const,
  }));
  if (lookEntries.length > 0) {
    tabs.push({
      key: 'look',
      title: 'The look',
      count: null, // A palette is not a quantity. Five swatches is not "5".
      layer: 'host',
      entries: lookEntries,
      note: 'Their saved theme — shown because they made and kept one. It is the light this page is lit by.',
      empty: null,
    });
  }

  // ── 10 · MADE WITH ────────────────────────────────────────────────────────
  const madeEntries: IndexEntry[] = input.madeWith.map((m, i) => ({
    key: `made-${i}`,
    stamp: m.stamps[0] ?? 'SETNAYAN',
    label: m.name,
    note: m.note,
    href: null,
    layer: 'host' as const,
  }));
  if (madeEntries.length > 0) {
    tabs.push({
      key: 'made',
      title: 'Made with',
      count: countWorthStating(madeEntries.length),
      layer: 'host',
      entries: madeEntries,
      note: null,
      empty: null,
    });
  }

  // ── 11 · BY THE NUMBERS ───────────────────────────────────────────────────
  //
  // Whatever survived the gate upstream. A withheld figure never arrives here,
  // so there is no branch in this file that could print one as a zero.
  const numberEntries: IndexEntry[] = input.numbers.map((n, i) => ({
    key: `num-${i}`,
    stamp: n.value,
    label: n.label,
    note: n.note,
    href: null,
    layer: 'host' as const,
  }));
  if (numberEntries.length > 0) {
    tabs.push({
      key: 'numbers',
      title: 'By the numbers',
      count: null, // The tab IS numbers. A count of counts is noise.
      layer: 'host',
      entries: numberEntries,
      note: null,
      empty: null,
    });
  }

  return tabs;
}

/**
 * Add a guest-layer tab — or don't, and the difference is the whole rule.
 *
 * Empty AND withheld  → the tab is not there. There is nothing to say about a
 *                       part of the day this reader was not invited into, and
 *                       an empty tab is itself a statement about it.
 * Empty AND open      → the tab stays and says so. A real zero is a real
 *                       answer, and the commonest one early in a day.
 */
function pushGuestTab(tabs: IndexTab[], guestOpen: boolean, tab: IndexTab): void {
  if (tab.entries.length === 0 && !guestOpen) return;
  tabs.push(tab);
}

/**
 * Every entry of the index, flattened — what the search would find if it were
 * asking this module instead of the DOM.
 *
 * It is not what the search actually uses (`§8`: the index is rebuilt from the
 * live page). It exists so the guard can count guest-layer entries across all
 * eleven tabs in one expression, and so a future caller that needs the whole
 * list does not write a second flattener that forgets a tab.
 */
export function allIndexEntries(tabs: readonly IndexTab[]): IndexEntry[] {
  return tabs.flatMap((t) => t.entries);
}
