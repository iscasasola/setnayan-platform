/**
 * 🔗 THE REGISTRY LINK IS A REAL LINK (owner 2026-10-07, "THE MISSING FIELDS ARE
 * APPROVED"; Studio › E-Gifts › "Paste a link to your registry").
 *
 * Holds: http(s) only, one line, ≤ 500 characters — the same rule the column's
 * CHECK holds; the writer refuses in words and writes only the fields its form
 * carries (the message box never clears the link); the guest page draws it only
 * through the same rule; and the Studio field saves on leaving the box.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { GIFT_REGISTRY_URL_MAX, cleanGiftRegistryUrl, giftRegistryHref } from './gift-registry';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

test('http(s) only; empty is none; anything else is refused, never repaired', () => {
  assert.equal(cleanGiftRegistryUrl('  https://www.registry.ph/maria-and-jose  '), 'https://www.registry.ph/maria-and-jose');
  assert.equal(cleanGiftRegistryUrl('http://example.com/x'), 'http://example.com/x');
  assert.equal(cleanGiftRegistryUrl(''), null);
  assert.equal(cleanGiftRegistryUrl(null), null);
  for (const bad of ['javascript:alert(1)', 'registry.ph/us', 'https://', 'https://localhost', 'https://a b.com', `https://x.com/${'a'.repeat(GIFT_REGISTRY_URL_MAX)}`, 'data:text/html,hi', 'ftp://x.com']) {
    assert.equal(cleanGiftRegistryUrl(bad), undefined, `${bad} was accepted`);
  }
  assert.equal(giftRegistryHref('javascript:alert(1)'), null, 'a stored value that does not pass is never drawn');
});

test('the column CHECK is the same rule: http(s), no spaces, ≤ 500', () => {
  const dir = join(ROOT, '..', '..', 'supabase', 'migrations');
  const sql = readFileSync(join(dir, readdirSync(dir).find((f) => f.endsWith('_studio_missing_fields.sql'))!), 'utf8');
  assert.match(sql, /gift_registry_url ~ '\^https\?:\/\/\[\^\[:space:\]\]\+\$'/);
  assert.match(sql, new RegExp(`char_length\\(gift_registry_url\\) <= ${GIFT_REGISTRY_URL_MAX}`));
});

test('the writer writes only what its form carries, and refuses in words', () => {
  const src = read('app/dashboard/[eventId]/pabuya/actions.ts');
  const fn = src.slice(src.indexOf('export async function savePabuyaMessage'));
  assert.match(fn, /if \(formData\.has\('pabuya_message'\)\) patch\.pabuya_message =/);
  assert.match(fn, /if \(formData\.has\('gift_registry_url'\)\) \{\s*const link = cleanGiftRegistryUrl/);
  assert.match(fn, /if \(link === undefined\) return \{ ok: false, error: GIFT_REGISTRY_URL_ERROR \}/);
  assert.match(fn, /\.update\(patch\)/);
});

test('guests see it through the same rule; the Studio field saves on leaving the box', () => {
  const page = read('app/[slug]/pabuya/page.tsx');
  assert.match(page, /const registryHref = giftRegistryHref\(event\.gift_registry_url\);/);
  assert.match(page, /\{registryHref \? \(\s*<p data-gift-registry=""/);
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  assert.match(tools, /onBlur=\{saveRegistry\}/);
  assert.match(tools, /savePabuyaMessage\(fd\(\{ gift_registry_url: next \?\? '' \}\)\)/);
});
