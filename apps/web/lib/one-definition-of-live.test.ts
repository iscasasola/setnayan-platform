/**
 * one-definition-of-live.test.ts — a shop is "live" in exactly one way.
 *
 * ─── The bug this exists to prevent ──────────────────────────────────────
 * There were TWO definitions of "this vendor's shop is live", and one of them
 * was dead:
 *
 *   • `public_visibility = 'verified' AND verification_state = 'verified'` —
 *     what `/admin/verify` writes, what `/explore` filters on, and what the
 *     database's own `vendor_profiles_public_read` policy enforces
 *     (migration 20271013500000).
 *   • `is_published = TRUE` — a legacy column whose ONLY writer in the entire
 *     app is a tick-box on `/admin/vendors/[id]/edit`. Approving a shop does
 *     not set it. Measured 2026-08-11: the owner's own fully-verified shop sat
 *     at `is_published = false`.
 *
 * Seven live code paths still gated on the dead one. Approving a shop listed it
 * on /explore and left all seven refusing:
 *
 *   1 · `/vendor-invite/[slug]` — 404 for EVERY vendor. The vendor's own QR,
 *       the whole "import your customers" on-ramp, sent couples to a dead page.
 *   2 · the same invite's claim action — the identical refusal one step later.
 *   3 · the couple's add-a-vendor-by-name search — found nothing, ever. (It
 *       also still named `coming_soon`, retired 2026-07-27 for exposing
 *       unapproved shops.)
 *   4 · ghost-listing detection — scanned an EMPTY set and reported "0 scanned".
 *   5 · fraud detection — the same empty set.
 *   6 · the admin population count — "vendors published" pinned at 0.
 *   7 · the admin Published/Draft tabs — Published always empty, Draft = all.
 *
 * 🔑 NONE OF THE SEVEN ERRORED. A dead gate and a genuinely empty result are
 * the same value. Same disease as the phantom column, the phantom enum value
 * and the phantom RPC argument: the read is refused or returns nothing, and the
 * only symptom is an absence.
 *
 * 🔑 It is also the 2026-08-09 outage again — two definitions of "is a vendor"
 * pointed the two dashboards at each other. Here, two definitions of "this shop
 * is live" pointed a vendor's own customers at a 404.
 *
 * ─── Why the check is a source scan ──────────────────────────────────────
 * The hazard is a query that runs perfectly and matches nothing. There is no
 * throw to catch and no behaviour to assert on — a unit test of the invite page
 * against a stubbed client returns whatever the stub was told to return. Only
 * the source text distinguishes "asked the right column" from "asked a dead
 * one".
 *
 * ─── ⚠ THE DETECTOR IS PROVEN, NOT ASSUMED ──────────────────────────────
 * `vendor-publish-guard.test.ts` shipped broken once because its sensitivity
 * was assumed: three evasions (a stray `accept="image/*"` opening a fake
 * comment, a quoted key, and shorthand) all left it green. So:
 *   • Comment-stripping goes through `lib/strip-comments.ts`, a real lexer.
 *     Do NOT inline a regex here.
 *   • The detector is a pure function exercised against KNOWN-BAD input in the
 *     battery at the bottom. Any new evasion you think of belongs there FIRST.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');

const toPosix = (p: string) => p.split('\\').join('/');

/**
 * Files allowed to filter on `is_published`, each with the reason it is not the
 * hazard. A NEW path must add itself here and say why — that is the point of a
 * list rather than a blanket ban.
 *
 * ⚠ `lib/background-videos.ts` is a DIFFERENT TABLE (`background_videos`) that
 * has its own real `is_published` column with a real admin writer. Sharing a
 * column name with the dead vendor one is a coincidence, and treating it as the
 * same thing would break a working feature.
 */
const ALLOWED_FILTERS: ReadonlyMap<string, string> = new Map([
  [
    'lib/background-videos.ts',
    'Different table (background_videos). Its is_published is real, written by ' +
      'app/admin/background-videos/actions.ts, and read here. Not the vendor column.',
  ],
  [
    'app/admin/background-videos/actions.ts',
    'The writer for that other table.',
  ],
  [
    'app/admin/integrity-watch/actions.ts',
    'Writes is_published = false as one belt-and-braces half of taking a shop ' +
      'down. Harmless while the column is inert, and removing a takedown lever ' +
      'is not this guard\'s call — it must never be the thing a shop is READ by.',
  ],
]);

// ── THE DETECTOR ───────────────────────────────────────────────────────────
// Pure, exported to the battery below. Accepts COMMENT-STRIPPED source.

/**
 * Does this source use `is_published` to decide whether a row is readable?
 *
 * Matches the filter/predicate spellings, not the mere appearance of the word —
 * naming the column inside a `.select()` column list is harmless (the admin
 * accounts surface still displays it), and a guard that cries wolf on a select
 * teaches you to skim past the one time it is right.
 *
 * Covered spellings, each proven in the battery:
 *   .eq('is_published', …)          .eq("is_published", …)
 *   .is('is_published', …)          .neq / .not('is_published', …)
 *   row.is_published                !vendor.is_published
 *   row['is_published']             { is_published } destructuring-then-test
 *   is_published === true / !== false
 */
export function usesIsPublishedAsGate(strippedSource: string): boolean {
  // PostgREST filter operators taking the column as their first argument.
  if (/\.\s*(?:eq|neq|is|not|in|filter)\s*\(\s*['"`]is_published['"`]/.test(strippedSource)) {
    return true;
  }
  // Property access used as a truth test: `x.is_published` or `x?.is_published`
  // or `x['is_published']`, EXCLUDING a bare mention inside a quoted column
  // list (which has no leading dot or bracket-access shape).
  if (/[.?]\s*is_published\b/.test(strippedSource)) return true;
  if (/\[\s*['"`]is_published['"`]\s*\]/.test(strippedSource)) return true;
  // A comparison against the bare identifier — reachable after destructuring.
  if (/\bis_published\s*(?:===|!==|==|!=)/.test(strippedSource)) return true;
  return false;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next' || entry === '.git') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

test('nothing decides a vendor is live by the dead column', () => {
  const offenders: string[] = [];
  for (const file of [...walk(resolve(WEB, 'app')), ...walk(resolve(WEB, 'lib'))]) {
    const rel = toPosix(relative(WEB, file));
    if (ALLOWED_FILTERS.has(rel)) continue;
    // The admin edit page renders `name="is_published"` — a WRITE control,
    // pinned in place by vendor-publish-guard.test.ts. Writing it is not the
    // hazard this file guards; reading it to decide visibility is.
    if (rel === 'app/admin/vendors/[vendorProfileId]/edit/page.tsx') continue;
    const stripped = stripComments(readFileSync(file, 'utf8'));
    if (usesIsPublishedAsGate(stripped)) offenders.push(rel);
  }
  assert.deepEqual(
    offenders,
    [],
    'These decide whether a shop is live by `is_published`, which NOTHING in the ' +
      'approval flow sets — /admin/verify writes public_visibility + ' +
      'verification_state and never touches it. The query will run, match nothing, ' +
      'and report an empty result as a fact. Use `isShopLive` from ' +
      'lib/vendor-visibility.ts, or add the file to ALLOWED_FILTERS with a reason:\n  ' +
      offenders.join('\n  '),
  );
});

test('the doors that were dead now ask the one definition', () => {
  // Pin the three USER-FACING ones by name. The scan above proves nothing uses
  // the dead column; this proves these three ask the right question rather than
  // having had the gate deleted, which would also pass the scan and would let
  // an unapproved shop publish its name, logo and services to anyone.
  const doors = [
    'app/vendor-invite/[slug]/page.tsx',
    'app/vendor-invite/[slug]/actions.ts',
  ];
  for (const rel of doors) {
    const src = stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
    assert.ok(
      /isShopLive\s*\(/.test(src),
      `${rel} no longer calls isShopLive. The gate must REFUSE an unapproved ` +
        `shop — this screen publishes a business name, logo, tagline and services ` +
        `to anyone holding the slug. Deleting the check is not the fix.`,
    );
  }

  const search = stripComments(
    readFileSync(resolve(WEB, 'app/dashboard/[eventId]/vendors/actions.ts'), 'utf8'),
  );
  assert.ok(
    /['"`]public_visibility['"`]\s*,\s*['"`]verified['"`]/.test(search) &&
      /['"`]verification_state['"`]\s*,\s*['"`]verified['"`]/.test(search),
    'The couple\'s add-a-vendor-by-name search must filter on BOTH verified ' +
      'columns. One alone is not the definition — that is exactly why the RLS ' +
      'policy requires both.',
  );
  assert.ok(
    !/['"`]coming_soon['"`]/.test(search),
    'coming_soon is retired (20271013500000). Under the old rules it made an ' +
      'unapproved shop\'s name, contact email and phone readable by anyone ' +
      'holding the anon key. It must not come back through a search filter.',
  );
});

test('every door SELECTS both columns the predicate needs', async () => {
  // 🔑 THE QUIET FAILURE THIS CATCHES: `isShopLive` fails closed on an absent
  // column, which is right — but a `.select()` that forgot one turns a live shop
  // into a 404 with no error anywhere, which is the ORIGINAL BUG wearing a
  // different hat. So the required list is DERIVED from SHOP_LIVE_COLUMNS, not
  // re-typed here: change the predicate's inputs and this test changes with it.
  const { SHOP_LIVE_COLUMNS } = await import('./vendor-visibility');
  const required = SHOP_LIVE_COLUMNS.split(',').map((c) => c.trim());
  assert.ok(required.length >= 2, 'SHOP_LIVE_COLUMNS collapsed to fewer than two columns.');

  for (const rel of [
    'app/vendor-invite/[slug]/page.tsx',
    'app/vendor-invite/[slug]/actions.ts',
  ]) {
    const src = stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
    // Only the select CALLS — a column named in a comment or a type does not
    // put it on the wire.
    const selects = src.match(/\.select\(\s*['"`][\s\S]*?['"`]\s*\)/g) ?? [];
    const joined = selects.join(' ');
    for (const col of required) {
      assert.ok(
        new RegExp(`\\b${col}\\b`).test(joined),
        `${rel} calls isShopLive but never SELECTs \`${col}\`. An absent column is ` +
          `undefined, the predicate fails closed, and an approved shop 404s with ` +
          `nothing logged — the original bug in a new costume.`,
      );
    }
  }
});

test('isShopLive fails closed on every half-answer', async () => {
  const { isShopLive } = await import('./vendor-visibility');
  // Both verified — the ONLY true case.
  assert.equal(isShopLive({ public_visibility: 'verified', verification_state: 'verified' }), true);
  // Each half alone must be false: the whole point of two columns is that no
  // single mis-set one exposes an unapproved shop.
  assert.equal(isShopLive({ public_visibility: 'verified', verification_state: 'unverified' }), false);
  assert.equal(isShopLive({ public_visibility: 'hidden', verification_state: 'verified' }), false);
  // Absent columns — the shape a `.select()` that forgot SHOP_LIVE_COLUMNS
  // produces. Must not read as live.
  assert.equal(isShopLive({}), false);
  assert.equal(isShopLive({ public_visibility: 'verified' }), false);
  assert.equal(isShopLive({ verification_state: 'verified' }), false);
  // Null/garbage — parseVisibility falls back to `hidden`, never to exposed.
  assert.equal(isShopLive(null), false);
  assert.equal(isShopLive(undefined), false);
  assert.equal(isShopLive({ public_visibility: 'VERIFIED', verification_state: 'verified' }), false);
  assert.equal(isShopLive({ public_visibility: 'coming_soon', verification_state: 'verified' }), false);
});

// ── THE DETECTOR BATTERY ───────────────────────────────────────────────────
// A scan whose sensitivity is assumed rather than proven is how three evasions
// survived review on the sibling guard. Every spelling below is KNOWN-BAD and
// must be caught; every spelling in the second list is KNOWN-GOOD and must not
// be, or the guard cries wolf and gets skimmed past.

test('the detector catches what it is for', () => {
  const mustCatch = [
    `q.eq('is_published', true)`,
    `q.eq("is_published", true)`,
    `q.eq(\`is_published\`, true)`,
    `q .eq( 'is_published' , true )`,
    `q.neq('is_published', false)`,
    `q.is('is_published', null)`,
    `q.not('is_published', 'is', null)`,
    `q.filter('is_published', 'eq', true)`,
    `if (!vendor.is_published) notFound();`,
    `if (!vendor?.is_published) notFound();`,
    `const ok = row['is_published'];`,
    `const { is_published } = row; if (is_published === true) show();`,
    `if (is_published !== false) show();`,
  ];
  for (const bad of mustCatch) {
    assert.ok(
      usesIsPublishedAsGate(stripComments(bad)),
      `EVASION — the detector missed: ${bad}`,
    );
  }

  const mustNotCatch = [
    // A column list in a select. Displaying the value is fine; deciding by it is not.
    `.select('vendor_profile_id,business_name,is_published,public_visibility')`,
    // The admin write control.
    `<input type="checkbox" name="is_published" />`,
    // The right answer.
    `if (!vendor || !isShopLive(vendor)) notFound();`,
    `.eq('public_visibility', 'verified').eq('verification_state', 'verified')`,
  ];
  for (const good of mustNotCatch) {
    assert.ok(
      !usesIsPublishedAsGate(stripComments(good)),
      `CRIES WOLF — the detector flagged a safe line: ${good}`,
    );
  }
});
