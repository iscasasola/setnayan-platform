/**
 * journal-move.test.ts — the Journal moves into Articles as ONE source, corrected, text and links only.
 *
 * Owner 2026-11-17 (DECISION_LOG "THE JOURNAL MOVES INTO DISCOVER'S ARTICLES"): *"Move them to articles. And
 * check their content and match them with our updated app."* The audit (`JOURNAL_CONTENT_AUDIT_2026-11-17.md`,
 * specs) listed the fixes; this file holds them so they cannot drift back in before or after the import:
 *
 *   1. `JOURNAL_SLUGS` (what the middleware forwards on) equals the source's 91 slugs exactly.
 *   2. Every renamed slug is gone from the source and forwards; no slug carries "vendor" or "website".
 *   3. The converted body is text and links only: no image path, every paragraph non-empty, every
 *      internal link written out as setnayan.com/…, no link back to a retired `/blog/` page.
 *   4. The house words the audit fixed: no "wedding website" anywhere in a post, and the two "free"
 *      posts no longer claim there is no paid tier.
 *   5. The three onboarding "Not sure yet" articles exist and carry their tag.
 *
 * 🔑 WHY A GUARD HERE AND NOT ONLY THE SWEEP: `app/public-copy-says-the-house-words.test.ts` EXEMPTS the
 * Journal (`lib/blog.ts`, `lib/blog-batches/`). Once the posts become rows they leave the tree entirely, so
 * this is the last place their words can be checked by a machine.
 *
 * SABOTAGE (run 2026-11-17, each turned this file red): putting "wedding website" back into guests-paper ·
 * restoring the slug `free-wedding-website-how-it-helps` · deleting one slug from `JOURNAL_SLUGS` · making
 * `journalBodyFromBlocks` keep the image `src`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { ALL_BLOG_ARTICLES } from '@/lib/blog';
import {
  ARTICLE_TAGS_MAX,
  JOURNAL_SLUGS,
  JOURNAL_SLUG_RENAMES,
  ONBOARDING_ARTICLE_TAGS,
  journalArticleSlug,
  journalBodyFromBlocks,
  journalLinkText,
  journalTags,
} from '@/lib/journal-move';
import { splitChapterParagraphs, CHAPTER_BODY_MAX } from '@/lib/creator-chapters';

const sourceSlugs = ALL_BLOG_ARTICLES.map((a) => a.slug);

test('1 · JOURNAL_SLUGS is exactly the source slugs — the redirect list cannot fall behind the posts', () => {
  assert.equal(new Set(sourceSlugs).size, sourceSlugs.length, 'two Journal posts share a slug');
  const missing = sourceSlugs.filter((s) => !JOURNAL_SLUGS.has(s));
  const extra = [...JOURNAL_SLUGS].filter((s) => !sourceSlugs.includes(s));
  assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
  assert.equal(sourceSlugs.length, 91, 'the drawing counts 91 posts — re-measure before changing this');
});

test('2 · a renamed slug is gone from the source and still forwards; no slug says vendor or website', () => {
  for (const [oldSlug, newSlug] of Object.entries(JOURNAL_SLUG_RENAMES)) {
    assert.ok(!sourceSlugs.includes(oldSlug), `${oldSlug} is still a slug in the source`);
    assert.ok(sourceSlugs.includes(newSlug), `${newSlug} is not a slug in the source`);
    assert.equal(journalArticleSlug(oldSlug), newSlug);
  }
  for (const s of sourceSlugs) {
    assert.doesNotMatch(s, /vendor|website/, `${s} carries a retired word`);
    assert.equal(journalArticleSlug(s), s);
  }
  assert.equal(journalArticleSlug('a-post-that-never-was'), null);
});

test('3 · every post converts to a text-and-links body that reads back as paragraphs', () => {
  for (const a of ALL_BLOG_ARTICLES) {
    const body = journalBodyFromBlocks(a.blocks);
    assert.ok(body.length > 0 && body.length <= CHAPTER_BODY_MAX, `${a.slug}: body length ${body.length}`);
    assert.doesNotMatch(body, /\.(webp|jpe?g|png|gif)\b/i, `${a.slug}: an image path survived`);
    assert.doesNotMatch(body, /setnayan\.com\/blog\/(?![^\s]*\.pdf)/, `${a.slug}: links a retired /blog page`);
    const paras = splitChapterParagraphs(body);
    const textBlocks = a.blocks.filter((b) => b.type !== 'image' && b.type !== 'chapter').length;
    assert.ok(paras.length >= textBlocks, `${a.slug}: ${paras.length} paragraphs for ${textBlocks} blocks`);
  }
  assert.equal(journalLinkText('/signup'), 'setnayan.com/signup');
  assert.equal(
    journalLinkText('/blog/holiday-season-vendor-booking-crunch'),
    'setnayan.com/articles/holiday-season-supplier-booking-crunch',
  );
  assert.equal(journalLinkText('https://pagasa.dost.gov.ph/x'), 'https://pagasa.dost.gov.ph/x');
});

test('4 · the audit’s house words: no "wedding website", and no free post says there is no paid tier', () => {
  for (const a of ALL_BLOG_ARTICLES) {
    const text = `${a.title} ${a.excerpt} ${journalBodyFromBlocks(a.blocks)}`;
    assert.doesNotMatch(text, /wedding website/i, `${a.slug} still says "wedding website"`);
    assert.doesNotMatch(text, /no premium tier|greyed out until you upgrade/i, `${a.slug} denies Event Pro`);
    assert.doesNotMatch(
      text,
      /the money never passes through Setnayan/i,
      `${a.slug}: couples do pay Setnayan for its own services — narrow it to payments to suppliers`,
    );
  }
});

test('5 · onboarding’s three "Not sure yet" articles exist and carry their tag', () => {
  for (const { tag, slug } of Object.values(ONBOARDING_ARTICLE_TAGS)) {
    const a = ALL_BLOG_ARTICLES.find((x) => x.slug === slug);
    assert.ok(a, `${slug} is not a Journal post`);
    const tags = journalTags(a!);
    assert.ok(tags.includes(tag), `${slug} lacks "${tag}"`);
    assert.ok(tags.length <= ARTICLE_TAGS_MAX);
  }
});

test('6 · the committed import migration is exactly what the corrected source generates', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { journalImportSql } = await import('@/lib/journal-import-sql');
  const file = path.resolve(
    __dirname,
    '../../../supabase/migrations/20271350850404_the_journal_moves_into_articles.sql',
  );
  assert.equal(
    fs.readFileSync(file, 'utf8'),
    journalImportSql(ALL_BLOG_ARTICLES),
    'a post changed and the import did not. Before it reaches production: (cd apps/web && npx tsx ' +
      'scripts/gen-journal-import.ts --write). AFTER it has been applied in production, write a NEW migration ' +
      '(an UPDATE) instead — an applied migration is never edited.',
  );
});

test('7 · Q4: no post carries a typed money figure (never guess money — "ask 3 suppliers for a quote")', () => {
  for (const a of ALL_BLOG_ARTICLES) {
    const text = `${a.title} ${a.excerpt} ${journalBodyFromBlocks(a.blocks)}`;
    assert.doesNotMatch(text, /₱\s?\d|\bPHP\s?\d|\d[\d,]*\s?pesos|thousands of pesos|five[- ]figure/i, `${a.slug} prints a price`);
  }
});
