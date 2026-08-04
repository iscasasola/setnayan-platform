/**
 * GUARD — the sign-in hero is retired, and `readHeroRefs` hard-codes an empty
 * reference set because of it.
 *
 * That empty set is the only hand-asserted "nothing references this" in the
 * website-media module. Everywhere else the verdict comes from a real read; a
 * hard-coded one is precisely the shape that deletes live files once the world
 * changes underneath it. So the claim is made machine-checked here:
 *
 *   if anyone reintroduces a reader, a surface, or a route for the sign-in hero,
 *   these tests fail, and whoever does it is forced to replace the empty set
 *   with a resolver that actually reads their new reference.
 *
 * Retired 2026-08-02 at the owner's instruction. `/login` renders only the
 * sign-in card; the public reader `fetchPublishedHeroVideo` had ZERO callers and
 * the admin reader was called solely by the uploader reading back its own
 * uploads — a closed loop that wrote files nobody ever saw.
 *
 * `homepage_hero_config` is left in the database, inert and unread (same posture
 * as the retired `token_burn_bands`). Dropping a production table is a separate,
 * owner-gated decision — not a side effect of deleting a screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

const WEB_ROOT = path.resolve(import.meta.dirname, '..');

/** Files whose existence would mean the feature came back. */
const MUST_NOT_EXIST = [
  'lib/hero-video.ts',
  'app/admin/hero-video/page.tsx',
  'app/admin/hero-video/actions.ts',
  'app/admin/studio/_surfaces/hero-video-surface.tsx',
];

/**
 * Symbols that only ever existed to serve the retired screen. `grep` over the
 * tree rather than an import check: a reintroduction might not import anything
 * this module knows about, but it will name one of these.
 */
const MUST_NOT_APPEAR = [
  'fetchPublishedHeroVideo',
  'fetchHeroVideoConfigForAdmin',
  'HeroVideoSurface',
];

test('the retired sign-in hero files stay deleted', () => {
  for (const rel of MUST_NOT_EXIST) {
    assert.equal(
      existsSync(path.join(WEB_ROOT, rel)),
      false,
      `${rel} is back. website-media's readHeroRefs() returns an EMPTY reference set on the ` +
        'premise that nothing reads hero media — which would now be false, making every ' +
        'hero-videos/ and hero-frames/ object look deletable on /admin/website-media. ' +
        'Replace readHeroRefs with a real resolver before restoring this.',
    );
  }
});

test('no symbol from the retired sign-in hero is referenced anywhere', () => {
  for (const symbol of MUST_NOT_APPEAR) {
    let hits = '';
    try {
      // -I skips binaries; the test file itself is excluded below.
      hits = execFileSync(
        'git',
        ['grep', '-I', '-l', symbol, '--', 'apps/web'],
        { cwd: path.resolve(WEB_ROOT, '../..'), encoding: 'utf8' },
      );
    } catch {
      // git grep exits 1 when there are no matches — that is the pass case.
      continue;
    }
    const offenders = hits
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((f) => !f.endsWith('website-media-retired-hero.test.ts'));

    assert.deepEqual(
      offenders,
      [],
      `${symbol} is referenced again. See the message on the previous test: the empty ` +
        'reference set in readHeroRefs() is only safe while nothing reads hero media.',
    );
  }
});
