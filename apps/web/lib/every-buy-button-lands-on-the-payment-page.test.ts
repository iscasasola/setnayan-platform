/**
 * EVERY PAID PURCHASE ENDS ON THE ONE PAYMENT PAGE — AND NO FREE ONE DOES.
 *
 * Owner, 2026-08-21: *"this can apply to all purchasable buttons."*
 *
 * Two invariants, and the second is the one that would embarrass us:
 *
 *  1. A path that takes money redirects to `/pay/<reference>` — the only screen
 *     that carries the amount inside the QR and can take a screenshot and a
 *     reference number. The panels these replaced quoted a code and left the
 *     buyer to work the rest out.
 *
 *  2. 🔒 A ₱0 GRANT MUST NEVER LAND THERE. `compOrderRowFor` stamps
 *     `status: 'paid'`, which `statusOf` reads as SETTLED — so a shop that just
 *     switched a feature on for FREE would be greeted with *"This one is
 *     settled — there's nothing left to send."* Every one of these files has a
 *     free branch, and every one must return before the redirect.
 *
 * Both are structural checks over source, deliberately paired with the shape of
 * the real regression: a later edit that moves a `return` or adds a redirect
 * inside the free arm.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = process.cwd();
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/** Paid purchase paths that must end on the payment page. */
const PAID_PATHS = [
  'app/vendor-dashboard/subscription/actions.ts', // the plan itself
  'app/vendor-dashboard/team/actions.ts', // extra seat
  'app/vendor-dashboard/branches/actions.ts', // additional branch (buy + renew)
  'app/vendor-dashboard/subscription/ai-addon-actions.ts', // Vendor AI
  'app/vendor-dashboard/subscription/booth-addon-actions.ts', // 3D Booth
  'app/vendor-dashboard/deep-search/actions.ts', // one Deep Search
  'app/vendor-dashboard/subscription/custom/actions.ts', // negotiated plan
] as const;

test('every shop purchase ends on the payment page', () => {
  const missing = PAID_PATHS.filter((rel) => {
    const src = read(rel);
    // The plan path builds its own URL because the order mint is fail-soft and
    // it must be able to fall back; everything else uses the shared helper.
    return !/redirect\(payPath\(/.test(src) && !/'\/pay\/'/.test(src);
  });
  assert.deepEqual(missing, [], 'these take money and never send the buyer anywhere to pay it');
});

test('a free grant is never sent to a payment page', () => {
  for (const rel of PAID_PATHS) {
    const src = read(rel);
    const compAt = src.lastIndexOf('compOrderRowFor(');
    if (compAt === -1) continue; // no free branch in this path
    const payAt = src.indexOf('redirect(payPath(');
    assert.ok(payAt > compAt, `${rel}: the paid redirect must come AFTER the free branch`);
    const between = src.slice(compAt, payAt);
    assert.match(
      between,
      /\n\s*return \{/,
      `${rel}: the free branch must RETURN before the paid redirect — a ₱0 order lands on ` +
        '"this one is settled", which is what a shop sees after being given something free',
    );
  }
});

test('the shared helper is what builds the address', () => {
  // One place to encode a reference, so a later route change is one edit and
  // not a hunt through a dozen call sites.
  const helper = read('lib/pay-path.ts');
  assert.match(helper, /encodeURIComponent/);
  const users = PAID_PATHS.filter((rel) => /payPath\(/.test(read(rel)));
  assert.ok(users.length >= 6, `expected the helper to be used widely, saw ${users.length}`);
});

test('the dead panels those redirects replaced are gone, not left behind', () => {
  // A panel nothing can reach is a screen that still reads as current to the
  // next person editing it, and the strings drift out of true unnoticed.
  assert.doesNotMatch(read('app/vendor-dashboard/team/page.tsx'), /search\.bought/);
});
