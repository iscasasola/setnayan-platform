import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * SUP-31 · A SHOP IS TOLD WHEN SETNAYAN MOVES IT.
 *
 * Measured on origin/main 2026-09-15: four admin surfaces change whether a shop
 * is visible to couples, and only `/admin/verify` ever told it. A shop whose
 * vouched badge was withdrawn by hand, or whose listing was un-published off an
 * integrity flag, learned by finding its own page gone.
 *
 * 🔑 THE FIRST TEST IS THE ONE THAT MATTERS. In this repo a notification and its
 * EMAIL ALLOWLIST entry are two halves of one mechanism: a type that is emitted
 * but not allowlisted is a tray badge reaching nobody who is away from the
 * console, and having one half is indistinguishable from having neither. So the
 * allowlist is asserted, not assumed.
 */

const WEB = process.cwd();
const EMIT = join(WEB, 'lib/notification-emit.ts');
const BYPASS = join(WEB, 'app/admin/vendors/verification-bypass-actions.ts');
const INTEGRITY = join(WEB, 'app/admin/integrity-watch/actions.ts');
const NOTIFY = join(WEB, 'lib/vendor-status-notify.ts');

function code(path: string): string {
  const raw = readFileSync(path, 'utf8');
  const stripped = stripComments(raw);
  assert.ok(stripped.length > raw.length * 0.15, `stripping ${path} removed too much`);
  return stripped;
}

/** The contents of a `new Set([...])` assigned to `name`. */
function setBody(src: string, name: string): string {
  const at = src.indexOf(name);
  assert.ok(at > -1, `${name} is gone — re-aim this guard`);
  const open = src.indexOf('[', at);
  const close = src.indexOf(']', open);
  assert.ok(open > -1 && close > open, `${name} is no longer a Set literal`);
  return src.slice(open, close);
}

test('the type it emits is on the EMAIL allowlist — half a mechanism is none', () => {
  /*
    ⚠ THE FIRST VERSION OF THIS TEST ALSO DEMANDED THE PUSH ALLOWLIST, AND WAS
    WRONG. I had "measured" push membership with a line-range grep that swept in
    the COMMENT above `EMAIL_ENABLED_TYPES` — "(vendor_status_change,
    dispute_resolved) are transactional and belong on the allowlist" — and
    counted prose as membership. This test strips comments, so it disagreed with
    me and it was right.

    `vendor_status_change` is email-enabled and deliberately NOT push-enabled:
    that comment says these types are TRANSACTIONAL and belong on the email
    list. Asserting push would have demanded a change nobody wanted.

    Email is the half that matters here anyway — a tray badge reaches nobody who
    is away from the console, which is exactly how this repo has shipped a
    notification that reached no one before.
  */
  const src = code(EMIT);
  assert.match(
    setBody(src, 'EMAIL_ENABLED_TYPES'),
    /'vendor_status_change'/,
    'vendor_status_change left the EMAIL allowlist — the shop gets a tray badge and no email',
  );
  assert.doesNotMatch(
    setBody(src, 'PUSH_ENABLED_TYPES'),
    /'vendor_status_change'/,
    'vendor_status_change gained PUSH; it is transactional and was deliberately email-only — ' +
      'if that is now intended, change this assertion deliberately rather than deleting it',
  );
});

test('withdrawing a vouched badge tells the shop', () => {
  const src = code(BYPASS);
  assert.match(
    src,
    /notifyVendorStatusChange\(\{ vendorProfileId: vendorId, decision: 'hidden' \}\)/,
    'revoking a vouch hides the shop and no longer tells it',
  );
});

test('granting a vouch tells the shop it is live', () => {
  const src = code(BYPASS);
  assert.match(
    src,
    /notifyVendorStatusChange\(\{ vendorProfileId: vendorId, decision: 'listed' \}\)/,
  );
});

test('an integrity flag taking a listing down tells the shop', () => {
  const src = code(INTEGRITY);
  assert.match(
    src,
    /notifyVendorStatusChange\(\{ vendorProfileId: vendorId, decision: 'unpublished' \}\)/,
  );
});

test('the un-publish notice sits INSIDE the idempotency guard', () => {
  // The un-publish only runs when THIS click transitioned a still-open flag.
  // A notice outside that guard would re-notify on every re-hide of an
  // already-resolved flag — the shop told twice about one takedown.
  const src = code(INTEGRITY);
  const guard = src.indexOf("action === 'hide_listing' && transitioned");
  const notify = src.indexOf("decision: 'unpublished'");
  const close = src.indexOf('\n  }', guard);
  assert.ok(guard > -1, 'the idempotency guard moved — re-aim this guard');
  assert.ok(
    notify > guard && notify < close,
    'the un-publish notice escaped the idempotency guard and can fire on a no-op',
  );
});

test('every listing decision reaches My Shop, not the retired verify route', () => {
  // /vendor-dashboard/verify is a redirect now; a listing decision should land
  // on the page where the listing state actually lives.
  const src = code(NOTIFY);
  assert.match(src, /'\/vendor-dashboard\/shop'/);
  for (const decision of ['listed', 'hidden', 'unpublished']) {
    assert.match(
      src,
      new RegExp(`args\\.decision === '${decision}'`),
      `the '${decision}' decision is not handled`,
    );
  }
});
