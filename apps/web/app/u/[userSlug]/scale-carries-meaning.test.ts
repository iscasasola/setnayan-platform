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
/** A guard must read the code, not the comment that explains it. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;

test('the page renders THREE sizes, not one', () => {
  const src = code(page());
  for (const cls of ['uprof-lead', 'uprof-med', 'uprof-line']) {
    assert.match(
      src,
      new RegExp(`className="${cls}"`),
      `The ${cls} size is gone. With one size this is a card grid, which is what ` +
        'every competitor already ships.',
    );
  }
});

test('🔑 the size is DERIVED — nothing on the page chooses it', () => {
  const src = code(page());
  assert.match(
    src,
    /weighYearWithFloor\(/,
    'The derived weight is gone. If a human has to decide which chapter is big, ' +
      'it stops happening after the first week and the page becomes a list.',
  );
  assert.match(
    src,
    /hasPicture: pictures\.has\(item\.chapter_id\)[\s\S]{0,120}hasWriting: !!chapterExcerpt\(/,
    'The size is no longer derived from "has a picture" and "has writing" — the ' +
      'two facts the product already holds.',
  );
});

test('the size rule never asks what KIND of celebration it was', () => {
  // Ranking by event type is the product deciding a wedding matters more than a
  // graduation, on a page about somebody else's life.
  const src = code(page());
  const weighCall = /weighYearWithFloor\(([\s\S]{0,400}?)\)\;/.exec(src)?.[1] ?? '';
  assert.doesNotMatch(weighCall, /kind|event_type/, 'the weight is keyed on the kind of event');
});

test('the lead carries a photograph AND one sentence — never an essay', () => {
  const src = code(page());
  assert.match(
    src,
    /uprof-lead-x[\s\S]{0,60}chapterExcerpt\(c\.body, 190\)/,
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
