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

test('/{slug} and /{slug}/recap decide their metadata by the rule — not by visibility alone', () => {
  const page = stripComments(readFileSync(join(WEB, 'app', '[slug]', 'page.tsx'), 'utf8'));
  const meta = page.slice(page.indexOf('export async function generateMetadata'), page.indexOf('export default async function'));
  assert.match(meta, /const preview = linkPreviewFor\(visibility, shareState\.published\);/);
  assert.match(meta, /if \(!preview\.namesTheCouple\) \{/);
  assert.match(meta, /preview\.indexable \? \{\} : \{ robots: \{ index: false, follow: false \} \}/);
  assert.doesNotMatch(meta, /if \(visibility !== 'public'\) \{/, 'the old gate is back: an Unlisted published story loses its card');
  assert.match(meta, /ogCardUrlFor\(siteUrl, event\.slug, shareState\.versionAt\)/);

  const recap = stripComments(readFileSync(join(WEB, 'app', '[slug]', 'recap', 'page.tsx'), 'utf8'));
  const rmeta = recap.slice(recap.indexOf('export async function generateMetadata'), recap.indexOf('export default async function'));
  assert.match(rmeta, /const preview = linkPreviewFor\(resolveEffectiveVisibility\(event\), true\);/);
  assert.match(rmeta, /if \(!preview\.namesTheCouple\) \{/);
  assert.match(rmeta, /recapCardUrlFor\(SITE_URL, event\.slug, await readStoryVersionAt\(event\.event_id\)\)/, 'the recap card in the metadata must be the VERSIONED address');
});
