/**
 * Who sees the link preview — owner ruling 2026-09-11 (NEEDS_THE_OWNER item 13 → A): a PUBLISHED
 * story shows its own card on an UNLISTED site; nothing that is not public-or-published ever names
 * the couple. Both halves: the rule, row by row; and that `/{slug}` and `/{slug}/recap` actually
 * ask it (a rule nobody calls is decoration). Run: `pnpm test:unit`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { linkPreviewFor } from './who-sees-the-link-preview';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

test('a published story on an Unlisted site shows its card — and stays out of search', () => {
  assert.deepEqual(linkPreviewFor('unlisted', true), { namesTheCouple: true, indexable: false });
});

test('a Public site names the couple and may be indexed, published or not', () => {
  assert.deepEqual(linkPreviewFor('public', true), { namesTheCouple: true, indexable: true });
  assert.deepEqual(linkPreviewFor('public', false), { namesTheCouple: true, indexable: true });
});

test('nothing else names the couple — unlisted-unpublished, private, invited, unknown', () => {
  for (const [v, p] of [
    ['unlisted', false],
    ['private', true],
    ['private', false],
    ['invited_accounts', true],
    ['invited_accounts', false],
    [null, true],
    ['', true],
    ['PUBLIC', true],
  ] as const) {
    assert.deepEqual(linkPreviewFor(v, p), { namesTheCouple: false, indexable: false }, `${v} / ${p}`);
  }
});

test('/{slug} decides its metadata by the rule — not by visibility alone (and /{slug}/recap has none of its own)', () => {
  const page = stripComments(readFileSync(join(WEB, 'app', '[slug]', 'page.tsx'), 'utf8'));
  const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default async function'));
  assert.match(meta, /const preview = linkPreviewFor\(visibility, shareState\.published\);/);
  assert.match(meta, /if \(!preview\.namesTheCouple\) \{/);
  // (+ 2026-10-04: a personal link's preview is never indexed — lib/guest-pass-hop.test.ts § 6.)
  assert.match(meta, /preview\.indexable && !personalLink \? \{\} : \{ robots: \{ index: false, follow: false \} \}/);
  assert.doesNotMatch(meta, /if \(visibility !== 'public'\) \{/, 'the old gate is back: an Unlisted published story loses its card');
  // (+ 2026-10-20: a fourth argument, the look of the mark it draws — lib/social/the-link-preview-wears-the-logo.test.ts.)
  assert.match(meta, /ogCardUrlFor\(\s*siteUrl,\s*event\.slug,\s*shareState\.versionAt\s*[,)]/);

  // `/{slug}/recap` has no metadata of its own since 2026-11-13 — it sends to `/{slug}` (the story), whose metadata is
  // the one held above (owner, "POST EVENT = A STORY" (5)); `a-sample-says-what-it-is.test.ts` holds that it stays so.
  assert.doesNotMatch(stripComments(readFileSync(join(WEB, 'app', '[slug]', 'recap', 'page.tsx'), 'utf8')), /generateMetadata/);
});
