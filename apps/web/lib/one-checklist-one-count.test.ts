/**
 * one-checklist-one-count.test.ts — walk W1-B10, 16 Nov 2026.
 *
 * One shop read two different "N of 6": Today's "Get your shop live" (name · details · logo · offer · documents · QR)
 * and Your details' "4 of 6 done" + its strip's "3/6 details done" (name · what · where · contact · documents · pay).
 * Held as properties:
 *   1 · ONE assembly — Today and Your details both call `shopSetupView` (lib/supplier-setup.ts), and Your details'
 *       headline, bar and strip count draw ITS done/of, never `detailsProgress`'s;
 *   2 · Today's "Send your documents" ticks by the SAME rule the paper rows tick (a paper is in = `isSlotComplete`,
 *       `paperState(...).isIn`): all papers in → ✓ with "Send them" still named; "All done" never claims Setnayan is
 *       checking papers nobody sent.
 *
 * SABOTAGE (each seen red): Your details back on `detailsFigures({ … done: p.done` → 1 · Today back on its own
 * `assembleSetup({` → 1 · the docs ✓ back on "sent only" → 2 · `papersSent` dropped from the headline → 2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { buildFirstStepsRail } from '@/lib/vendor-first-steps';
import { setupHeadline, setupLine, shopSetupView } from '@/lib/supplier-setup';
import { detailsFigures } from '@/lib/shop-section-figures';
import { countCompleteRequiredSlots } from '@/lib/vendor-verification';
import { paperState } from '@/lib/paper-intake-shared';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const CHECKLIST = ['logo', 'business_name', 'business_owner_name', 'in_business_since_year', 'services', 'maps_pin', 'contact_phone', 'contact_email'].map(
  (key) => ({ key, label: key, surface: 'profile' as const, ok: true }),
);

function rail(docs: 'none' | 'draft' | 'pending_review') {
  return buildFirstStepsRail({
    verified: false,
    profileDone: 7,
    profileTotal: 7,
    hasLogo: true,
    serviceCount: 1,
    docsStatus: docs,
    docsIn: 0,
    docsTotal: 3,
    submitMissing: [],
    customerCount: 0,
    notAvailableCount: 0,
    offer: { services: [{ service: 'catering', cards: [{ id: 'c', service: 'catering', title: 'x', pricePhp: 1 }], toGo: 0, target: 1 }], toGo: 0 },
  });
}

test('1 · Today and Your details draw ONE six from ONE call', () => {
  const today = code('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  assert.match(today, /const view = shopSetupView\(\{ d, rail,/, 'Today assembles its six on its own');
  assert.doesNotMatch(today, /assembleSetup\(/, 'Today assembles its six on its own');

  const page = code('app/vendor-dashboard/profile/page.tsx');
  assert.match(page, /shopSetupView\(\{ d, rail, qrSaved, serviceLabel: displayServiceLabel \}\)/, 'Your details does not count Today’s six');
  assert.match(page, /fetchVendorFirstStepsState\(supabase, profile\)/, 'Your details does not read the same rail as Today');
  assert.match(page, /readTourSeen\(supabase, user\.id, SETUP_TOUR_KEY\)/, 'Your details does not read step 6’s record');
  assert.match(page, /live=\{live\}/);

  const screen = code('app/vendor-dashboard/profile/_components/details-screen.tsx');
  assert.match(screen, /done: count \? count\.done : null, of: count \? count\.of : null, steps: live !== null/, 'the strip counts a second six');
  assert.match(screen, /: setupLine\(steps\)/, 'the headline is not Today’s six');
  assert.doesNotMatch(screen, /done: p\.done, of: p\.of \}\)/, 'the strip is back on the details count');

  // The words agree: Your details' line opens with Today's headline.
  const v = shopSetupView({
    d: { checklist: CHECKLIST, verify: { status: null }, docsIn: 1, docsTotal: 3, businessName: 'Sample Blooms', slug: 'sample' },
    rail: rail('draft'),
    qrSaved: false,
    serviceLabel: (k) => k,
  });
  assert.equal(setupLine(v).split(' · left: ')[0], setupHeadline(v));
  assert.match(setupLine(v), /left: Send your documents · Download your QR$/);
  const fig = detailsFigures({ verified: false, docsIn: 1, docsTotal: 3, done: v.done, of: v.of }).find((f) => f.key === 'done')!;
  assert.equal(fig.value, `${v.done}/${v.of}`);
  // A verified shop: Today counts nothing, and neither does the strip.
  assert.equal(detailsFigures({ verified: true, docsIn: 3, docsTotal: 3, done: null, of: 6, steps: false }).some((f) => f.key === 'done'), false);
});

test('2 · "Send your documents" ticks only once the papers are SENT, and names the Send while they are in (W1-B36)', () => {
  const uploads = {
    dti_certificate: { r2_key: 'r2://a', attempts: 0, evidence: { model: {} } },
    bir_2303: { r2_key: 'r2://b', attempts: 3, manual: true },
    mayors_permit: { r2_key: 'r2://c', attempts: 0, evidence: { model: {} } },
  };
  const rowsIn = Object.values(uploads).filter((u) => paperState(u, null).isIn).length;
  const docsIn = countCompleteRequiredSlots(uploads as never);
  assert.equal(rowsIn, docsIn, 'the paper rows and the step count papers by different rules');

  const all = shopSetupView({
    d: { checklist: CHECKLIST, verify: { status: 'draft' }, docsIn, docsTotal: 3, businessName: 'x' },
    rail: rail('draft'),
    qrSaved: true,
    serviceLabel: (k) => k,
  });
  const docs = all.folds.find((f) => f.key === 'docs')!;
  // W1-B36 / B33 (live walk, 18 Nov 2026): a tick beside "Send them" looked finished while it still asked for the
  // Send, and the tick moved the folds on to step 6 on the third upload. Papers IN are not papers SENT.
  assert.equal(docs.done, false, 'step 5 ticks before the papers are sent');
  assert.equal(docs.badge?.word, 'Send them', 'the Send is no longer named');
  assert.equal(all.firstOpen, 'docs', 'the folds leave step 5 before its papers are sent');
  assert.doesNotMatch(setupHeadline(all), /All done/, '"All done" while the papers are not sent');

  const sent = shopSetupView({
    d: { checklist: CHECKLIST, verify: { status: 'pending_review' }, docsIn, docsTotal: 3, businessName: 'x' },
    rail: rail('pending_review'),
    qrSaved: true,
    serviceLabel: (k) => k,
  });
  assert.equal(setupHeadline(sent), 'All done — Setnayan checks you next');

  const two = shopSetupView({
    d: { checklist: CHECKLIST, verify: { status: 'draft' }, docsIn: 2, docsTotal: 3, businessName: 'x' },
    rail: rail('draft'),
    qrSaved: true,
    serviceLabel: (k) => k,
  });
  assert.equal(two.folds.find((f) => f.key === 'docs')!.done, false);
});

test('audit #7898 · the "of" is the READ\'s — an unread checklist shows "—", never a typed 6', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const screen = readFileSync(join(process.cwd(), 'app/vendor-dashboard/profile/_components/details-screen.tsx'), 'utf8');
  assert.match(screen, /of: count \? count\.of : null,/);
  assert.doesNotMatch(screen, /of: count \? count\.of : 6/, 'a typed 6 stands in for an unread count again');
  const unread = detailsFigures({ verified: false, docsIn: 0, docsTotal: 3, done: null, of: null }).find((f) => f.key === 'done')!;
  assert.equal(unread.value, null, 'an unread checklist drew a number');
  assert.equal(unread.hot, false);
});
