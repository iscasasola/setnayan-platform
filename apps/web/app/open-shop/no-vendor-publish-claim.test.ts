/**
 * GUARD — no vendor-facing screen may tell a vendor to PUBLISH THEIR SHOP.
 *
 * A vendor cannot publish their own shop. There is no such control for them
 * anywhere in the app: the only `name="is_published"` input lives on the ADMIN
 * vendor edit page, the one vendor-side action that ever wrote the column has no
 * caller, and `/admin/verify` — the thing that actually makes a shop public —
 * writes `public_visibility` + `verification_state` and never touches it.
 * **Approval is what publishes a shop.**
 *
 * WHY A TEST AND NOT A NOTE. This same false idea shipped in THREE separate
 * places and was removed from two of them on 2026-08-09 — the invite QR page and
 * the My Customers QR section, both of which refused the vendor's own customer
 * QR with "Publish your business profile first" and pointed at a button that
 * does not exist. The third survived that sweep and reached the owner's screen
 * during testing the same day, because the sweep searched for "publish your
 * profile" / "publish your page" and this one said "publish your **shop**".
 *
 * 🔑 A sweep is only as good as the phrasing you guessed. That is exactly the
 * kind of miss a cheap standing check catches and a careful grep does not.
 *
 * SCOPE — deliberately narrow, so it cannot cry wolf. A vendor genuinely CAN
 * publish a **service card** and a **package**, and those surfaces say so
 * correctly ("Required to publish"). This only forbids telling them to publish
 * the SHOP itself.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Vendor-facing trees: what a vendor reads about their own shop. */
const ROOTS = ['app/open-shop', 'app/vendor-dashboard'];

/**
 * The claim, in the shapes it has actually appeared in. Matches the VERB
 * attached to the SHOP/BUSINESS-PROFILE noun — never a bare "publish", which
 * would hit the legitimate service-card and package copy.
 */
const FORBIDDEN =
  /publish(ing)?\s+(your|the|my)\s+(shop|business\s+profile|vendor\s+profile|page\b)/i;

function walk(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(full) && !/\.test\.tsx?$/.test(full)) out.push(full);
  }
  return out;
}

/**
 * Strip comments before matching. The two fixed files carry the phrase inside
 * explanatory comments recording WHY it was removed — deleting those notes to
 * satisfy a regex would throw away the reason and invite the third recurrence.
 */
function visibleCopy(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/.*$/gm, '$1 ');
}

test('no vendor-facing screen asks a vendor to publish their own shop', () => {
  const offenders: string[] = [];
  for (const root of ROOTS) {
    for (const file of walk(root)) {
      const copy = visibleCopy(readFileSync(file, 'utf8'));
      const hit = copy.match(FORBIDDEN);
      if (hit) offenders.push(`${file} → "${hit[0]}"`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'A vendor cannot publish their own shop — approval is what makes it public. ' +
      'Say what is true ("before your shop can be approved") instead:\n  ' +
      offenders.join('\n  '),
  );
});

test('the matcher is not vacuous — it catches the exact copy that shipped', () => {
  // The real string from open-shop step 1, live until 2026-08-09. Without this
  // the suite above passes just as happily against a broken regex.
  assert.ok(
    FORBIDDEN.test("you'll need it to publish your shop and to get verified"),
    'the matcher no longer catches the copy it was written for',
  );
  assert.ok(FORBIDDEN.test('Publish your business profile first'));
  assert.ok(FORBIDDEN.test('Publish your page first'));
});

test('the matcher leaves legitimate publish copy alone', () => {
  // A vendor really can publish these. Flagging them would be crying wolf, and a
  // guard that cries wolf teaches you to skim past the one time it is right.
  for (const ok of [
    'The first thing couples see on this card. Required to publish.',
    'Publish to my page',
    'Publish service',
    'Publish a new package instead.',
  ]) {
    assert.equal(FORBIDDEN.test(ok), false, `false positive on: ${ok}`);
  }
});
