/**
 * GUARD — one shelf, three voices, and the council lock that survives it.
 *
 * ─── WHY THIS EXISTS NOW ─────────────────────────────────────────────────
 * On 2026-08-13 the owner merged this page onto one shelf ("option B"). The
 * two headed sections that used to separate the voices — "From Our
 * Storytellers" and "From our articles" — are gone.
 *
 * Those headings were, in practice, the only thing enforcing the council lock
 * of 2026-07-16: that an editorial, a storyteller's chapter and a Journal
 * piece **never blur into one grammar**. Nothing tested it. Now that the
 * headings are gone, the next person to touch this shelf will see three card
 * shapes in one grid and reasonably "tidy them up" — which is precisely the
 * uniform grid the lock forbids, and it would look like an improvement.
 *
 * So the lock moves from a layout accident into an assertion.
 *
 * ⚠ THIS TEST IS NOT THE DESIGN. It pins what fails SILENTLY: a voice
 * redrawn, a kind tag dropped, a search that quietly covers one third of the
 * shelf, or the `/storytellers` redirect landing on nothing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const WEB = resolve(APP, '..');

const GALLERY = readFileSync(join(HERE, '_components', 'gallery.tsx'), 'utf8');
/*
  ⚠ page.tsx IS NOT BESIDE THIS TEST ANY MORE (2026-08-15). Only `page.tsx` and
  `loading.tsx` moved into `app/(shell)/realstories/` — so the shell is mounted
  once by the group layout and survives navigation — while `_components/`,
  `[slug]/` and this test stayed put. That split is deliberate:
  `app/realstories/[slug]` is `revalidate = false` and must remain statically
  generated, which the group layout's force-dynamic would have taken away.
*/
const PAGE = readFileSync(
  join(HERE, '..', '(shell)', 'realstories', 'page.tsx'),
  'utf8',
);

/** Strip comments so a rule described in prose can never satisfy a check. */
function code(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '');
}
const G = code(GALLERY);
const P = code(PAGE);

/* ── 1 · THE LOCK: THREE VOICES, NONE OF THEM REDRAWN ────────────────────
   Each kind must render through the component its own surface ships. A
   lookalike written inline here is the fork the lock exists to prevent. */
test('each kind renders in its own shipped grammar, not a lookalike', () => {
  const voices: Array<[string, RegExp]> = [
    ['the editorial (Chronicle)', /<Tile\s/],
    ['the storyteller chapter (byline)', /<StorytellerTile\s/],
    ['the Journal piece', /<StoryCard\s/],
  ];
  for (const [label, re] of voices) {
    assert.ok(re.test(G), `${label} must render through its own component`);
  }
  // …and they must be IMPORTED, not defined here — a local redefinition would
  // satisfy the check above while forking the grammar.
  assert.ok(
    /import\s*\{[^}]*StorytellerTile[^}]*\}\s*from/.test(G) &&
      /import\s*\{[^}]*StoryCard[^}]*\}\s*from/.test(G),
    'the two companion voices must be imported, never redefined here',
  );
  assert.ok(
    !/function StorytellerTile\b/.test(G) && !/function StoryCard\b/.test(G),
    'a second copy of a card grammar is the fork the council lock forbids',
  );
});

/* ── 2 · THE CARD SAYS WHICH KIND IT IS ──────────────────────────────────
   This is the whole price of removing the headings. Without it a planning
   guide and somebody's wedding are two photos in a row. */
test('every voice on the shelf declares its kind', () => {
  assert.ok(
    /tag="Their story"/.test(G),
    'editorial tiles must carry a kind tag now that the heading is gone',
  );
  assert.ok(
    />\s*Article\s*</.test(G),
    'Journal cards must be labelled Article on the card itself',
  );
});

/* ── 3 · ONE SHELF, NOT TWO REBUILT ONE LEVEL DOWN ───────────────────────
   The companions must be grid CHILDREN. Wrapping them in their own grid
   recreates the two-shelf layout inside the one shelf, and it would look
   almost right. */
test('the companions are children of the shelf, not a second grid', () => {
  assert.ok(/<Companions\s/.test(G), 'the shelf must render the companions');
  const fn = G.slice(G.indexOf('function Companions'), G.indexOf('export function RealStoriesGallery'));
  assert.ok(fn.length > 0, 'Companions not found');
  assert.ok(
    !/className="[^"]*\bgrid\b/.test(fn),
    'Companions must return grid children, never its own grid',
  );
});

/* ── 4 · THE RETIRED SECTIONS ARE GONE, NOT HIDDEN ───────────────────────
   Retired means deleted here. A component left importable is a component
   somebody re-mounts. */
test('the two retired shelves are deleted, and nothing still imports them', () => {
  for (const f of ['storytellers-shelf.tsx', 'journal-rail.tsx']) {
    assert.equal(
      existsSync(join(HERE, '_components', f)),
      false,
      `${f} still exists — the merge left a component that can be re-mounted`,
    );
  }
  assert.ok(
    !/StorytellersShelf|JournalRail/.test(P),
    'the page must not reference the retired shelves',
  );
});

/* ── 5 · THE `/storytellers` REDIRECT STILL LANDS ON SOMETHING ───────────
   `/storytellers` is a 302 to `/realstories#storytellers`. The anchor lived
   on the deleted section. Losing it turns a live redirect into a scroll to
   nowhere, with nothing anywhere reporting it. */
test('the #storytellers anchor survived the merge — and only when there ARE storytellers', () => {
  assert.ok(
    /'storytellers'/.test(G),
    'the anchor the /storytellers redirect targets is gone from the shelf',
  );

  /*
    \u{1F6A8} EXISTENCE IS NOT CORRECTNESS — this assertion is the one that was
    missing, and its absence shipped a real bug into CI.

    The first cut put the id on the companions CONTAINER, which renders when
    EITHER kind is present. At today's real numbers — 0 featured chapters, 6
    articles — the anchor existed and pointed at the Journal, so somebody
    following "storytellers" landed on our own writing. The old assertion
    checked the anchor was THERE. It was.
    `creator-public-surfaces.spec.ts` caught it by asserting the ABSENCE at
    zero chapters, which is the rule this shelf runs on: deny-by-default,
    publish is not listed.
  */
  assert.ok(
    /id=\{chapterMatches\.length > 0 \? 'storytellers' : undefined\}/.test(G),
    'the anchor must be gated on the CHAPTER count — with none, /storytellers ' +
      'points a visitor at whatever else happens to be on the shelf',
  );
  assert.ok(
    !/id="storytellers"/.test(G),
    'an unconditional id="storytellers" is exactly the bug the e2e caught',
  );

  // ANCHOR THE PREMISE: prove the redirect still points here, so this test
  // cannot quietly become moot.
  const cfg = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  if (/\/storytellers/.test(cfg)) {
    assert.ok(
      /realstories#storytellers/.test(cfg),
      'the redirect target changed — update this guard with it',
    );
  }
});

/* ── 6 · THE SEARCH COVERS THE WHOLE SHELF ───────────────────────────────
   A search that silently covers one third of a shelf is worse than none: a
   visitor typing a storyteller's name is told "nothing matches" while their
   chapter sits two rows below. */
test('the search box filters all three voices, not only the editorials', () => {
  assert.ok(/chapterMatches/.test(G), 'chapters must be searchable');
  assert.ok(/articleMatches/.test(G), 'articles must be searchable');
  // THE CONSEQUENCE: the empty-state may only appear when ALL THREE are empty.
  const emptyGuard = G.slice(
    Math.max(0, G.indexOf('Nothing matches yet') - 400),
    G.indexOf('Nothing matches yet'),
  );
  assert.ok(
    /chapterMatches\.length === 0/.test(emptyGuard) &&
      /articleMatches\.length === 0/.test(emptyGuard),
    'the "nothing matches" message must require all three voices to be empty',
  );
});

/* ── 7 · THE PAGE FEEDS THE SHELF ────────────────────────────────────────
   The shelf can only merge what it is handed. A prop that nothing passes
   renders the old layout with new code and looks completely fine. */
test('the page passes all three voices into the one shelf', () => {
  const call = P.slice(P.indexOf('<RealStoriesGallery'), P.indexOf('/>', P.indexOf('<RealStoriesGallery')));
  assert.ok(call.length > 0, 'the gallery is not rendered');
  for (const prop of ['items=', 'chapters=', 'articles=']) {
    assert.ok(call.includes(prop), `the shelf is missing ${prop}`);
  }
});
