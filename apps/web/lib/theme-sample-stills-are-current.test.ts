/**
 * theme-sample-stills-are-current.test.ts — the Details theme gallery's stills
 * of the sample Event Hub cannot go stale silently (controller 2026-09-28, on
 * "THE THEME GALLERY SHOWS A CLEAN SAMPLE EVENT HUB": *"Add a staleness guard
 * so B can't rot silently"*).
 *
 * Each still in `theme-sample-stills.manifest.json` carries the look hash of
 * its theme at capture time. A theme whose definition or door CSS changed since
 * is RED here, and the message names the command that re-captures it. Every
 * still named in the manifest must exist on disk, and every file must be named.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_THEMES, isInviteThemeId, type InviteThemeId } from './invite-themes';
import { THEME_STILLS, THEME_STILL_CAPTURE_COMMAND, themeStillSrc, sampleHubTileSrc, type ThemeStillManifest } from './theme-sample-stills';
import { doorCssOf, themeLookHash } from './theme-sample-stills-hash';

const WEB = join(__dirname, '..');
const DIR = join(WEB, 'public', 'theme-samples');

/** The stale themes of a manifest — exported shape so the sabotage below can feed it a fake one. */
function staleThemes(m: ThemeStillManifest): string[] {
  return Object.entries(m)
    .filter(([id, e]) => !isInviteThemeId(id) || !e || e.look !== themeLookHash(id as InviteThemeId, doorCssOf(id as InviteThemeId, WEB)))
    .map(([id]) => id);
}

test('every still is of the theme as it is today — else re-capture', () => {
  const stale = staleThemes(THEME_STILLS);
  assert.deepEqual(
    stale,
    [],
    `the sample still of ${stale.join(', ')} was taken before its theme changed — run \`${THEME_STILL_CAPTURE_COMMAND}\` (apps/web) against a server with the real sample (prod), and commit the stills with the manifest`,
  );
  console.log(`[theme stills] current: ${Object.keys(THEME_STILLS).length} of ${Object.values(INVITE_THEMES).filter((t) => t.ready).length} ready themes (the rest use the live tile)`);
});

test('the check is not vacuous: a changed theme is caught', () => {
  const fake: ThemeStillManifest = { house: { look: '0000000000000000', sample: null, capturedAt: '2026-09-28' } };
  assert.deepEqual(staleThemes(fake), ['house']);
  const real: ThemeStillManifest = { house: { look: themeLookHash('house', doorCssOf('house', WEB)), sample: null, capturedAt: '2026-09-28' } };
  assert.deepEqual(staleThemes(real), []);
});

test('the manifest and the files agree — no still without a hash, no hash without a still', () => {
  for (const id of Object.keys(THEME_STILLS)) {
    assert.ok(existsSync(join(DIR, `${id}.webp`)), `the manifest names ${id} but public/theme-samples/${id}.webp is missing`);
  }
  const files = existsSync(DIR) ? readdirSync(DIR).filter((f) => f.endsWith('.webp')) : [];
  for (const f of files) assert.ok(f.replace(/\.webp$/, '') in THEME_STILLS, `${f} is not in the manifest — its freshness cannot be checked`);
});

test('a theme with no still falls back to the live sample page — never a couple’s', () => {
  assert.equal(themeStillSrc('no-such-theme'), null);
  assert.equal(sampleHubTileSrc('vintage'), '/maria-and-jose?theme=vintage');
});
