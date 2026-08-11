import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/**
 * REACHABILITY GUARDS — every public address a person can be HOLDING must reach
 * the forwarding resolver.
 *
 * The first cut of this feature wired the resolver into the two routes that were
 * obvious and missed the two that carry the real printed artefacts:
 *
 *   · the personal invitation QR encodes `/{slug}?invite={token}`, and the page
 *     short-circuits every tokened URL to `/{slug}/redeem` BEFORE forwarding
 *     runs — so the one URL actually printed on a card never reached it;
 *   · the legacy `/v/{slug}` shop form was published and indexed before the
 *     bare-root cutover, and hard-404'd after a corrected address.
 *
 * Both were found by an adversarial pass, not by the tests written alongside the
 * feature — which is why these assert REACH rather than behaviour. A resolver
 * nothing calls is the recurring defect in this repo.
 */
test('the tokened invitation URL reaches forwarding', () => {
  const src = read('app/[slug]/redeem/route.ts');
  assert.match(
    src,
    /\bresolveRenamedEventSlug\(/,
    'the redeem route drops the invite token when the event is not at that slug — a guest ' +
      'scanning a printed QR after a rename lands as a stranger on a lock screen',
  );
  // The token must be CARRIED, not just the slug resolved.
  const branch = src.slice(src.indexOf('resolveRenamedEventSlug('));
  assert.match(
    branch.slice(0, 500),
    /searchParams\.set\('token', token\)/,
    'the forward must carry the invite token — resolving the new address without it is the ' +
      'same lock screen by a longer route',
  );
});

test('the legacy /v/[slug] shop route reaches forwarding', () => {
  const src = read('app/v/[slug]/page.tsx');
  assert.match(
    src,
    /\bresolveRenamedPath\([\s\S]{0,120}?\['vendor'\]\s*\)/,
    'a corrected shop address forwards on the bare root but 404s on /v/{slug} — the form the ' +
      'shop was shared and indexed under before the bare-root cutover',
  );
});

test('a hidden profile is not disclosed by a forward', () => {
  const src = read('lib/slug-forwarding.ts');
  assert.match(
    src,
    /public_profile_enabled/,
    'a 307 discloses in its Location header: forwarding a hidden account’s old handle ' +
      'publishes both that the word was somebody’s and what their handle is now',
  );
});

test('the shop-address correction matches an exact address, never a pattern', () => {
  const src = read('app/admin/corrections/actions.ts');
  assert.ok(
    !/\.ilike\('business_slug', currentSlug\)/.test(src),
    'the shop being moved is selected with a LIKE pattern — a % or _ in the admin’s input ' +
      'can permanently move a DIFFERENT shop’s address',
  );
  assert.match(
    src,
    /SLUG_FORMAT\.test\(currentSlug\)/,
    'the address being moved FROM must be format-checked, not only the destination',
  );
});
