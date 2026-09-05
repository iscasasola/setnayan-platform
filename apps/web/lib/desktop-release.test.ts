/**
 * desktop-release.test.ts
 *
 * S10's release channel replaced a hardcoded object pointing at ONE committed
 * `.dmg` under a relative `/downloads/<file>` path with a manifest fetched from
 * R2. The one invariant that matters is the one the old shape violated by
 * construction: every URL `/download` and `/api/download/*` hand to a visitor
 * MUST be absolute, because they now point off-origin at `setnayan-media`'s
 * public host, not at a file co-hosted with the page.
 *
 * `parseDesktopRelease` is the pure boundary where that gets enforced (no
 * network — `resolveDesktopRelease` just fetches JSON and hands it here), so
 * these tests exercise it directly rather than mocking `fetch`.
 *
 * Run from apps/web: `npx tsx --test lib/desktop-release.test.ts`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parseDesktopRelease } from './desktop-release';

const VALID_MANIFEST = {
  version: '0.1.0',
  publishedAt: '2026-09-05',
  mac: {
    aarch64: {
      url: 'https://media.setnayan.com/desktop/latest/Setnayan_0.1.0_aarch64.dmg',
      sizeBytes: 1_900_000,
      signed: true,
    },
  },
  windows: {
    url: 'https://media.setnayan.com/desktop/latest/Setnayan_0.1.0_x64_en-US.msi',
    sizeBytes: 2_100_000,
    signed: false,
    filename: 'Setnayan_0.1.0_x64_en-US.msi',
  },
};

test('⭐ a well-formed manifest resolves, and every URL is absolute', () => {
  const release = parseDesktopRelease(VALID_MANIFEST);
  assert.ok(release, 'a valid manifest must not be rejected');
  assert.match(release.mac.aarch64.url, /^https:\/\//, 'the mac URL must be absolute');
  assert.ok(release.windows, 'windows must resolve when present in the manifest');
  assert.match(release.windows.url, /^https:\/\//, 'the windows URL must be absolute');
});

test('🔒 a RELATIVE mac URL is rejected, not silently accepted', () => {
  // This is the exact shape the old DESKTOP_RELEASE constant had —
  // `/downloads/Setnayan_0.0.1_aarch64.dmg` — which only ever worked because the
  // file was co-hosted with the page. Guard against ever rendering that shape
  // again now that the file lives on a different origin (R2).
  const sabotaged = {
    ...VALID_MANIFEST,
    mac: { aarch64: { ...VALID_MANIFEST.mac.aarch64, url: '/downloads/Setnayan_0.1.0_aarch64.dmg' } },
  };
  assert.equal(parseDesktopRelease(sabotaged), null, 'a relative mac URL must be rejected');
});

test('🔒 a relative windows URL is rejected the same way', () => {
  const sabotaged = {
    ...VALID_MANIFEST,
    windows: { ...VALID_MANIFEST.windows, url: '/downloads/Setnayan_0.1.0_x64.msi' },
  };
  const release = parseDesktopRelease(sabotaged);
  assert.ok(release, 'an invalid windows block must not sink the whole release — mac still resolves');
  assert.equal(release.windows, null, 'the rejected windows block must resolve to null, not a bad URL');
});

test('a manifest with no windows build resolves mac-only, not an error', () => {
  const { windows: _windows, ...withoutWindows } = VALID_MANIFEST;
  const release = parseDesktopRelease({ ...withoutWindows, windows: null });
  assert.ok(release);
  assert.equal(release.windows, null);
});

test('missing required fields reject the whole manifest', () => {
  assert.equal(parseDesktopRelease(null), null);
  assert.equal(parseDesktopRelease({}), null);
  assert.equal(parseDesktopRelease({ ...VALID_MANIFEST, version: '' }), null);
  assert.equal(parseDesktopRelease({ ...VALID_MANIFEST, mac: null }), null);
  assert.equal(
    parseDesktopRelease({ ...VALID_MANIFEST, mac: { aarch64: { ...VALID_MANIFEST.mac.aarch64, sizeBytes: 0 } } }),
    null,
    'a zero/invalid size must not resolve — it would render "0.0 MB"',
  );
});
