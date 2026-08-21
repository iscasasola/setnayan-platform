/**
 * Scale carries meaning on a person's public page — and nobody art-directs it.
 *
 * ── WHY THIS GUARD EXISTS ───────────────────────────────────────────────────
 * The owner rejected the first two drafts: a typographic one ("looks like a
 * text") and a card grid ("looks like every other app"). Research across the
 * field measured why the card grid is the wrong answer: **Zola ships 1,618
 * designs and two layouts**, and **Appy Couple's "Stories" is six identical
 * polaroids** where a first date and an engagement are the same rectangle.
 * Nobody varies size, so varying it is the one thing that makes this page not
 * look like everyone's.
 *
 * 🔑 AND THE RESEARCH WAS EQUALLY BLUNT ABOUT HOW IT DIES. The two publications
 * measured with the least per-item authoring both abandoned variation entirely
 * rather than decide it by hand. **A rule that needs a person to say "this one
 * is big" stops happening in week two** — so the size must come from what the
 * product already knows. That is what these assertions hold.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const page = () =>
  readFileSync(join(process.cwd(), 'app', 'u', '[userSlug]', 'page.tsx'), 'utf8');
/**
 * ⚠ THE RULE MOVED, AND THAT IS THE POINT. The three sizes were born inside
 * this page and could be reached by nothing else — which the 2026-08-21 site
 * audit named as the reason no other surface matched it. They now live in a
 * shared tile, so these assertions follow them there and protect EVERY page
 * that adopts it, not just this one.
 */
const tile = () =>
  readFileSync(join(process.cwd(), 'app', '_components', 'scaled-tile.tsx'), 'utf8');
/** A guard must read the code, not the comment that explains it. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the shared tile renders THREE sizes, not one', () => {
  const src = code(tile());
  for (const cls of ['sn-lead', 'sn-med', 'sn-line']) {
    assert.match(
      src,
      new RegExp(`className="${cls}"`),
      `The ${cls} size is gone. With one size this is a card grid, which is what ` +
        'every competitor already ships — Zola: 1,618 designs, two layouts.',
    );
  }
});

test('🔑 the tile is SHARED — its styles are not private to one route', () => {
  // A shared component whose CSS lives inside one page is the 107th bespoke
  // card. The audit counted 106 of those, plus 717 files hand-drawing the
  // same shape, and named it as the reason fixing one page never helps the next.
  const globals = readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8');
  // 🪤 ANCHORED, NOT `includes`. '.sn-lead' is a substring of '.sn-lead-a', so a
  // plain includes() stays true after the rule itself is deleted — the same
  // prefix trap this repo has been bitten by before. Proven: deleting the
  // `.sn-lead` rule left the naive version green.
  for (const cls of ['sn-lead', 'sn-med', 'sn-line', 'sn-shot']) {
    assert.match(
      globals,
      new RegExp(`\\.${cls}\\s*[,{]`),
      `.${cls} itself is not in the shared stylesheet, so only one route can use the tile.`,
    );
  }
});

test('🔑 the size is DERIVED — no caller chooses it', () => {
  const src = code(tile());
  assert.match(
    src,
    /weighYearWithFloor\(items\.map\(factsOf\)\)/,
    'The tile stopped deriving its own sizes. If a caller can pass a size in, a ' +
      'human decides which item is big — and that stops happening in week two.',
  );
  assert.match(
    src,
    /hasPicture: !!item\.imageUrl[\s\S]{0,160}hasWriting: !!\(item\.excerpt/,
    'The size is no longer derived from "has a picture" and "has writing".',
  );
});

test('🔑 NO PICTURE MEANS NO FRAME — never an empty box', () => {
  const src = code(tile());
  // The audit counted six blank bordered frames on the page selling
  // photography and called them worse than nothing. The element must be
  // ABSENT, not empty.
  // 🪤 COUNT, DO NOT MATCH. There are TWO tiers with a frame (lead and strip).
  // A `match` passes while one of them renders unconditionally — proven: the
  // mutation that removed the lead's guard left this green.
  assert.equal(
    count(src, /\{item\.imageUrl \? \(/g),
    2,
    'One of the two picture tiers renders its frame unconditionally, so an item ' +
      'without a photograph gets a hole instead of being smaller.',
  );
});

test('the size rule never asks what KIND of thing it is', () => {
  // Ranking by type is the product deciding a wedding matters more than a
  // graduation, on a page about somebody else's life — and it is also what
  // would stop the tile being reusable by surfaces with no event at all.
  const src = code(tile());
  assert.doesNotMatch(
    src,
    /kind|event_type|sponsor|vendor|chapter_id/,
    'The shared tile learned a caller’s vocabulary. It must know only whether an ' +
      'item has a picture and whether it has writing.',
  );
});

test('the lead carries ONE SENTENCE — never an essay', () => {
  assert.match(
    code(page()),
    /excerpt: chapterExcerpt\(c\.body, 190\)/,
    'The lead slot changed shape. It is built for somebody with two sentences and ' +
      'four hundred photographs — a slot expecting a long read is the slot she is ' +
      'least able to fill, in the most prominent place on her own page.',
  );
});

test('🔒 only PUBLIC-SAFE pictures reach this page', () => {
  const src = code(page());
  assert.match(
    src,
    /loadChapterPictures\(/,
    'The page is resolving its own images. Pictures must come through the loader ' +
      'that reads only face-blurred, NSFW-screened, fail-closed copies — a public ' +
      'page must never reach an unblurred master.',
  );
  assert.equal(
    count(src, /r2_object_key/g),
    0,
    'The page names the ORIGINAL object key. That is the unblurred master.',
  );
});

test('🪤 one snapshot per celebration, not one per chapter', () => {
  // The event page's measured defect was 95 questions per visitor, 78 of them
  // repeats. A per-chapter photo read would rebuild it here.
  const lib = code(
    readFileSync(join(process.cwd(), 'lib', 'chapter-picture.ts'), 'utf8'),
  );
  assert.match(
    lib,
    /new Set\(chapters\.map\(\(c\) => c\.event_id\)/,
    'Chapters are no longer grouped by celebration before fetching, so a page ' +
      'costs one wall snapshot per chapter instead of one per day.',
  );
});

test('the retired spine is GONE, not left to rot', () => {
  assert.equal(
    count(page(), /uprof-tl-/g),
    0,
    'Dead rules from the old one-size spine are back in the stylesheet. Nothing ' +
      'renders them, so they can only mislead the next reader.',
  );
});
