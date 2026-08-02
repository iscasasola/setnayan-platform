/**
 * stored-asset-render.test.ts — a raw storage ref must never reach a browser.
 *
 * THE BUG THIS EXISTS FOR (found in prod 2026-08-02, by the report-only CSP).
 * `vendor_profiles.logo_url` STORES a raw `r2://…` ref. That is the shipped
 * contract — `vendor-dashboard/actions.ts` writes `logo_url: logoRef` — and
 * `VendorAvatar`'s docblock states the half everyone forgets:
 *
 *   "`logoUrl` is a presigned display URL (resolve via displayUrlForStoredAsset
 *    server-side) — **a raw `r2://` ref will not render**, so pass the resolved
 *    URL or null."
 *
 * Two surfaces skipped the resolve and rendered the ref directly, producing an
 * image that cannot load:
 *   • the onboarding vendor picker (LIVE — prod has a vendor whose logo_url is
 *     `r2://setnayan-media/vendors/…/logo/…png`, and this is what fired the
 *     `img-src r2://setnayan-media` CSP reports), and
 *   • the public homepage Spotlight strip (latent only because the strip is
 *     double-gated and inert by default — it would have broken the day it was
 *     switched on).
 *
 * The failure is silent by nature: a broken <img> renders as nothing, no error
 * is thrown, and no test that mocks data with an https URL will ever see it.
 * Hence a source scan.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const code = (rel: string) =>
  readFileSync(resolve(WEB, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx$/.test(name) && !/\.test\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

/** Fields known to hold a STORED ASSET — a value that may be a raw `r2://` ref
 *  and must be resolved server-side before it is rendered. */
const STORED_ASSET_FIELDS = ['logo_url', 'primary_photo_url'];

/**
 * KNOWN-OUTSTANDING offenders, 2026-08-02. Every one of these renders a stored
 * asset raw and is therefore showing a broken image wherever the vendor's
 * `logo_url` holds an `r2://` ref — which is what the write path stores.
 *
 * They are allowlisted, NOT excused: this guard exists so the list can only
 * SHRINK. Two were fixed in the PR that added this file (onboarding — the live
 * one the CSP caught — and the homepage Spotlight builder); these were found by
 * the same scan and are larger than that PR, because each needs its own data
 * source traced and its resolves batched.
 *
 * ⚠ `folder-vendors-section.tsx` is the one to do next: it is the LIVE, public
 * Explore marketplace. Verified genuinely raw — `explore/page.tsx` selects
 * `logo_url` at its vendor query and its only `displayUrlForStoredAsset` call
 * resolves CATEGORY photos, not vendor logos.
 *
 * Delete an entry the moment its surface resolves properly. Do not add one
 * without tracing the data source first — a field named `logo_url` may already
 * hold a resolved URL, and this scan cannot tell.
 */
const KNOWN_UNRESOLVED = new Set([
  'app/explore/_components/folder-vendors-section.tsx', // 🔴 live public marketplace
  'app/explore/compare/page.tsx',
  'app/proposals/[publicId]/page.tsx',
  'app/vendor/lock/[token]/page.tsx',
  'app/vendor-invite/[slug]/page.tsx',
  'app/blog/[slug]/_components/journal-partner-credit.tsx',
  'app/_components/home/HomeSpotlightStrip.tsx', // reads the builder fixed here; component still takes the field name
  'app/admin/studio/_surfaces/journal-spotlights-surface.tsx',
  'app/admin/studio/_surfaces/spotlight-awards-surface.tsx',
]);

test('no component renders a stored-asset field straight into an image', () => {
  const offenders: string[] = [];
  let scanned = 0;

  for (const file of walk(resolve(WEB, 'app'))) {
    const rel = relative(WEB, file);
    const src = code(rel);
    scanned += 1;
    for (const field of STORED_ASSET_FIELDS) {
      // `src={x.logo_url}` / `url(${x.logo_url})` — the two shapes that put a
      // value in front of the browser as an image.
      const patterns = [
        new RegExp(`src=\\{[^}]*\\.${field}[^}]*\\}`),
        new RegExp(`url\\(\\$\\{[^}]*\\.${field}[^}]*\\}`),
      ];
      for (const re of patterns) {
        const m = re.exec(src);
        if (m && !KNOWN_UNRESOLVED.has(rel)) offenders.push(`${rel} → ${m[0].slice(0, 70)}`);
      }
    }
  }

  assert.ok(scanned > 200, `only ${scanned} tsx files scanned — the walk is wrong`);
  assert.deepEqual(
    offenders,
    [],
    'These render a stored-asset field directly. The value may be a raw `r2://` ' +
      'ref, which a browser cannot load — resolve it server-side with ' +
      '`displayUrlForStoredAsset` and pass the result:\n' +
      offenders.map((o) => `  • ${o}`).join('\n'),
  );
});

test('the two fixed producers resolve before returning', () => {
  // Onboarding — the LIVE offender that fired the CSP reports.
  const onboarding = code('app/onboarding/wedding/actions.ts');
  assert.match(onboarding, /displayUrlForStoredAsset\(v\.photoUrl\)/);
  assert.match(onboarding, /Promise\.all/, 'each resolve is a signing round trip — batch them');

  // The homepage Spotlight builder — latent, gated off, would break on switch-on.
  const spotlight = code('lib/spotlight-awards.ts');
  assert.match(spotlight, /displayUrlForStoredAsset\(r\.logo_url\)/);
  assert.match(spotlight, /Promise\.all/);
});

test('resolution failure degrades to null, never to a broken image', () => {
  // A signing hiccup must not put a raw ref on screen — both call sites catch
  // to null, and their surfaces already render an initials/placeholder tile.
  for (const rel of ['app/onboarding/wedding/actions.ts', 'lib/spotlight-awards.ts']) {
    assert.match(code(rel), /\.catch\(\(\) => null\)/, `${rel} must fail closed to null`);
  }
});

test('the known-unresolved list only shrinks — every entry still exists', () => {
  // An entry left behind after its file is deleted or fixed is a lie in the
  // codebase. Fail if one no longer matches, so the list is forced to shrink.
  const stale: string[] = [];
  for (const rel of KNOWN_UNRESOLVED) {
    let src: string;
    try {
      src = code(rel);
    } catch {
      stale.push(`${rel} (file is gone)`);
      continue;
    }
    const stillRaw = STORED_ASSET_FIELDS.some(
      (f) =>
        new RegExp(`src=\\{[^}]*\\.${f}[^}]*\\}`).test(src) ||
        new RegExp(`url\\(\\$\\{[^}]*\\.${f}[^}]*\\}`).test(src),
    );
    if (!stillRaw) stale.push(`${rel} (now resolves — remove it from the list)`);
  }
  assert.deepEqual(stale, [], `Stale allowlist entries:\n${stale.map((x) => `  • ${x}`).join('\n')}`);
});
