import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_BLOG_ARTICLES, blogPlainText, type BlogBlock } from './blog';

/**
 * A MISTYPED CHAPTER ID IS AN INVISIBLE NO-OP. THIS TURNS IT RED.
 *
 * The `{ type: 'chapter', publicId }` block (FABLE Public Marketplace § 3.4)
 * embeds a storyteller's chapter inside a Journal article. The id is HAND-TYPED
 * by an editor into an in-code constant, and `/blog/[slug]` renders NOTHING when
 * it does not resolve — which is the correct behaviour for a chapter that was
 * unpublished or whose owner went private, and is therefore also, byte for byte,
 * what a typo looks like. No error, no log line the editor will ever see, no
 * visible gap in the prose. It would simply never appear, forever.
 *
 * So the one thing a test CAN prove — that the id is at least the right SHAPE —
 * is worth proving. `public.generate_public_id('C')`
 * (supabase/migrations/20260512000000_setnayan_base.sql:26-40) emits
 * 'S89' || 'C' || '-' || 10 chars of Crockford base32 (no I/L/O/U), UPPERCASE.
 * The resolver matches with `.eq('public_id', …)`, which is case-sensitive, so a
 * lowercase paste is exactly as dead as a wrong character.
 *
 * 🚫 WHAT THIS CANNOT DO: prove the chapter EXISTS, is published, or that its
 * owner's profile is public. Only the database knows that, and a db test would
 * read the PGlite replay seed rather than production. Authoring one is therefore
 * a TWO-STEP: paste the id, then load the article and confirm the player is
 * actually on the page. This test only removes the dumbest failure from that
 * loop — it does not replace the look.
 *
 * 🪤 NON-VACUITY. There are ZERO chapter blocks authored today, so the scan over
 * the real article set asserts nothing on its own — a guard that cannot fail is
 * decoration. The two tests below fix that from both ends: one proves the WALKER
 * actually reaches real blocks (so it has not silently stopped matching), and
 * one proves the PREDICATE actually rejects the mistakes an editor will make.
 * The day the first chapter block is authored, this is already armed.
 */

/** The canonical S89C- public_id shape, per generate_public_id. */
const CHAPTER_PUBLIC_ID = /^S89C-[0-9ABCDEFGHJKMNPQRSTVWXYZ]{10}$/;

type ChapterBlock = Extract<BlogBlock, { type: 'chapter' }>;

/** Every chapter block in an article set, with enough context to name it. */
function chapterBlocksIn(
  articles: ReadonlyArray<{ slug: string; blocks: ReadonlyArray<BlogBlock> }>,
): Array<{ slug: string; index: number; block: ChapterBlock }> {
  const out: Array<{ slug: string; index: number; block: ChapterBlock }> = [];
  for (const article of articles) {
    article.blocks.forEach((block, index) => {
      if (block.type === 'chapter') {
        out.push({ slug: article.slug, index, block: block as ChapterBlock });
      }
    });
  }
  return out;
}

test('every authored chapter block carries a well-formed S89C- id', () => {
  // Non-vacuity, half 1: the walker must actually be reaching real content. If
  // ALL_BLOG_ARTICLES were empty, or `blocks` were renamed, the scan below would
  // "pass" by having nothing to look at.
  const totalBlocks = ALL_BLOG_ARTICLES.reduce(
    (n, a) => n + a.blocks.length,
    0,
  );
  assert.ok(
    ALL_BLOG_ARTICLES.length > 5 && totalBlocks > 100,
    `the article set looks empty (${ALL_BLOG_ARTICLES.length} articles, ${totalBlocks} blocks) — this scan would pass vacuously`,
  );

  const offenders = chapterBlocksIn(ALL_BLOG_ARTICLES).filter(
    ({ block }) => !CHAPTER_PUBLIC_ID.test(block.publicId),
  );
  assert.deepEqual(
    offenders.map((o) => `${o.slug} block#${o.index}: ${o.block.publicId}`),
    [],
    'a chapter block will render NOTHING and say nothing about why — fix the id',
  );
});

test('the id check rejects the mistakes an editor actually makes', () => {
  // Non-vacuity, half 2: the predicate must reject, not just accept.
  assert.ok(
    CHAPTER_PUBLIC_ID.test('S89C-3F7KMNPQRT'),
    'a genuine generate_public_id output must pass',
  );

  for (const bad of [
    '', // left blank
    's89c-3f7kmnpqrt', // pasted lowercase — .eq() is case-sensitive
    'S89U-3F7KMNPQRT', // a USER id, not a chapter id
    'S89C-3F7KMNPQR', // 9 chars — one short
    'S89C-3F7KMNPQRTX', // 11 chars — one long
    'S89C-3F7KMNPQRI', // 'I' is not in Crockford base32
    'S89C-3F7KMNPQRO', // nor is 'O'
    'S89C3F7KMNPQRT', // hyphen dropped
    ' S89C-3F7KMNPQRT', // stray whitespace from a copy-paste
    'https://www.setnayan.com/u/ana/c/S89C-3F7KMNPQRT', // the whole URL pasted
  ]) {
    assert.ok(
      !CHAPTER_PUBLIC_ID.test(bad),
      `${JSON.stringify(bad)} must be rejected — it would silently render nothing`,
    );
  }

  // And the walker must find a bad id when one is present, not just when the
  // list happens to be empty.
  const found = chapterBlocksIn([
    {
      slug: 'synthetic',
      blocks: [
        { type: 'p', text: 'prose' },
        { type: 'chapter', publicId: 'nope' },
      ],
    },
  ]);
  assert.equal(found.length, 1);
  const [only] = found;
  assert.ok(only, 'the walker found no chapter block in a set that has one');
  assert.equal(CHAPTER_PUBLIC_ID.test(only.block.publicId), false);
});

/**
 * A CHAPTER BLOCK MUST CONTRIBUTE ONLY THE EDITOR'S NOTE TO THE FLATTENED TEXT.
 *
 * `blogPlainText` feeds `blogPostingJsonLd.articleBody` and the meta
 * description on /blog/[slug] — an INDEXED page. A chapter's own canonical page
 * is `robots: { index: false }`. So folding the storyteller's display name or
 * their chapter's title in here would publish a real person's identity onto a
 * search-indexed surface they never agreed to, and it would do it invisibly, in
 * a JSON-LD blob nobody reads.
 *
 * This is exactly the kind of thing a later "improvement" reaches for — the
 * title is right there in the resolver — so the rule is pinned rather than
 * merely commented. If a future change starts including it, this goes red.
 */
test('a chapter block leaks no identity into articleBody or the meta description', () => {
  const withNote = blogPlainText([
    { type: 'p', text: 'Before.' },
    { type: 'chapter', publicId: 'S89C-3F7KMNPQRT', note: 'Their own cut.' },
    { type: 'p', text: 'After.' },
  ]);
  assert.equal(withNote, 'Before. Their own cut. After.');
  // The id itself must not travel either — it addresses a real person's page.
  assert.equal(withNote.includes('S89C-'), false);

  // No note ⇒ the block contributes nothing at all, and the prose either side
  // still joins cleanly (no doubled or leading space).
  const withoutNote = blogPlainText([
    { type: 'p', text: 'Before.' },
    { type: 'chapter', publicId: 'S89C-3F7KMNPQRT' },
    { type: 'p', text: 'After.' },
  ]);
  assert.equal(withoutNote, 'Before. After.');
});
