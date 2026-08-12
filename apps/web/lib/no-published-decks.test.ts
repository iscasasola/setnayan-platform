/**
 * lib/no-published-decks.test.ts — the internal pitch decks stay off the open web.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * Anything under `apps/web/public/` is served by Next at the site root, with no
 * auth and no route to review. The dated internal decks (snapshot 2026-05-28)
 * lived there and were readable by anyone with a link: they quoted stale prices
 * for every paid add-on, listed the removed LED wall backdrop as "live", and —
 * the reason it mattered — told vendors in writing they could "purchase
 * Setnayan Productions services … and resell them", naming that same removed
 * product. Owner decision 2026-08-12: take them off the open web. They now live
 * in `internal-decks/` (kept, not deleted — see its README).
 *
 * ── WHY A TEST AND NOT A COMMENT ───────────────────────────────────────────
 * Republishing them is a single `git mv` away, and nothing about that move
 * looks dangerous in a diff — a folder appears under `public/` and the site
 * silently starts serving stale pricing again. `robots.ts` still disallows
 * `/keynote` and `/proto`, but that only asks crawlers politely; it never
 * stopped a person opening the link, which is exactly how this survived from
 * 2026-06-13 to 2026-08-12.
 *
 * This does not forbid republishing. It makes republishing a DECISION someone
 * takes deliberately, by deleting an assertion that says why not to.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PUBLIC_DIR = join(process.cwd(), 'public');

test('the public directory exists (the paths below are meaningful)', () => {
  // Without this, every assertion below passes vacuously if `process.cwd()` is
  // ever not apps/web — a guard that cannot see its target is not a guard.
  assert.equal(existsSync(PUBLIC_DIR), true, `expected a public dir at ${PUBLIC_DIR}`);
  assert.ok(readdirSync(PUBLIC_DIR).length > 0, 'public/ is unexpectedly empty');
});

for (const deck of ['keynote', 'proto']) {
  test(`public/${deck} is not published`, () => {
    assert.equal(
      existsSync(join(PUBLIC_DIR, deck)),
      false,
      `apps/web/public/${deck}/ is back, which republishes the dated internal decks to ` +
        `anyone with a link. They quote stale prices for every paid add-on and offer ` +
        `vendors the chance to resell a product that no longer exists. They live in ` +
        `internal-decks/ on purpose (owner decision 2026-08-12). If you are republishing ` +
        `deliberately, fix the pricing first, then delete this assertion.`,
    );
  });
}
