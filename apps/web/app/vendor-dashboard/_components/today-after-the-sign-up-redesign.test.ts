/**
 * today-after-the-sign-up-redesign.test.ts — Today for a shop that has just come through the redesigned door (owner
 * 2026-11-06, DECISION_LOG "SUPPLIER SIGN-UP REDESIGN — FOUR CALLS ANSWERED" / "REDESIGN APPROVED"; the prototype's
 * Today frame):
 *
 *   · a step's ✓ is its OWN meter, full — "Your details · 7 of 8 in" is never ticked;
 *   · "In business since" left the door, so it counts under "Your details", not under "Name your shop" (which a
 *     just-named shop must be able to see ✓);
 *   · the Shop row names the service ("Photography · no card yet"), and does not repeat the details count the
 *     checklist already shows;
 *   · "Since 2021" — the ordinal only on the anniversary itself;
 *   · from 768px the open step is the shipped SidePanel (third pane), each editor mounted once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { assembleSetup } from '@/lib/supplier-setup';
import { buildFirstStepsRail } from '@/lib/vendor-first-steps';
import { todayMilestoneWord } from '@/lib/vendor-milestone';

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const KEYS = ['logo', 'business_name', 'business_owner_name', 'in_business_since_year', 'services', 'venue_size', 'maps_pin', 'contact_phone', 'contact_email'];
const checklist = (missing: readonly string[]) =>
  KEYS.map((key) => ({ key, label: key, surface: 'profile' as const, ok: !missing.includes(key) }));
const rail = buildFirstStepsRail({
  verified: false,
  profileDone: 7,
  profileTotal: 8,
  hasLogo: false,
  serviceCount: 0,
  docsStatus: 'none',
  docsIn: 0,
  docsTotal: 4,
  submitMissing: ['Finish your business profile'],
  customerCount: 0,
  offer: { services: [{ service: 'photography', cards: [], toGo: 3, target: 3 }], toGo: 3 },
});
const view = (missing: readonly string[]) =>
  assembleSetup({
    checklist: checklist(missing),
    rail,
    offer: rail.offer,
    docs: { status: null, docsIn: 0, docsTotal: 4 },
    shopName: 'Banawe Florals',
    slug: 'banaweflorals',
    serviceLabel: 'Photography',
    qrSaved: false,
  });

test('a just-named shop sees "Name your shop" ✓ — the year it was never asked does not hold it open', () => {
  const v = view(['in_business_since_year', 'logo']);
  const name = v.folds.find((f) => f.key === 'name')!;
  assert.equal(name.done, true, 'the door asked the name; the step is done');
  assert.equal(name.line, 'Banawe Florals · setnayan.com/banaweflorals');
});

test('"Your details" is ✓ only when its own meter is full — and the meter is on the row', () => {
  const short = view(['in_business_since_year', 'logo']).folds.find((f) => f.key === 'details')!;
  assert.equal(short.done, false, 'ticked while its own count says one is missing');
  assert.deepEqual(short.badge, { word: '5 of 6 in', tone: 'quiet' });
  assert.equal(short.line, 'Address, contact, the year you started');
  const full = view(['logo']).folds.find((f) => f.key === 'details')!;
  assert.equal(full.done, true);
  assert.equal(full.badge, null, 'a full meter is said by the ✓, not repeated');
  // Every fold that shows a count: never ✓ beside a count that is not full.
  for (const f of [...view([]).folds, ...view(['contact_email', 'logo']).folds]) {
    const m = f.badge?.word.match(/^(\d+) of (\d+) in$/);
    if (m && f.done) assert.equal(m[1], m[2], `${f.key} is ✓ beside "${f.badge!.word}"`);
  }
});

test('the prototype’s words on the other steps', () => {
  const v = view(['logo']);
  const at = (k: string) => v.folds.find((f) => f.key === k)!;
  assert.equal(at('logo').line, 'Shows on your page and your QR');
  // 2026-11-14 (DECISION_LOG "VERIFICATION IS THREE PAPERS AND ONE SUBMIT"; profile gate "Yes, remove it"): the logo
  // no longer gates going live, so its step carries no "Needed to go live" badge.
  assert.equal(at('logo').badge, null);
  assert.equal(at('offer').line, 'Photography · no card yet');
  assert.equal(at('docs').line, 'Setnayan checks them before you go live');
  assert.equal(at('docs').badge?.word, 'none sent yet');
    // Step 6 follows open-shop v21 (#7369, folded into THE ONE BUILD by lane C1): "Download your QR"; the days-off row
  // still sits under the QR in the step's body.
  assert.equal(at('qr').title, 'Download your QR');
  assert.equal(at('qr').line, 'Scan it → your page · put it on your photos, posts and cards');
});

test('"Since 2021" — the ordinal only on the anniversary itself', () => {
  assert.equal(todayMilestoneWord({ label: '6th year in business', daysUntil: 0 }, 2021), 'your 6th year in business today');
  assert.equal(todayMilestoneWord({ label: '6th year in business', daysUntil: 40 }, 2021), 'Since 2021');
  assert.equal(todayMilestoneWord({ label: '6th year in business', daysUntil: 1 }, 2021), 'Since 2021', 'a countdown is back');
  assert.equal(todayMilestoneWord(null, null, '2019-03-04'), 'Since 2019');
  assert.equal(todayMilestoneWord(null, null, null), null, 'the Setnayan join date is not when a business started');
  const page = code('app/vendor-dashboard/page.tsx');
  assert.match(page, /const milestoneWord = todayMilestoneWord\(/);
  assert.doesNotMatch(page, /in \$\{milestone\.daysUntil\} days/);
});

test('the Shop row names the service and leaves the details count to the checklist', () => {
  const v = code('lib/supplier-today-view.ts');
  assert.match(v, /\[input\.shop\.categoryWord, cardMeter\]\.filter\(Boolean\)\.join\(' · '\)/);
  assert.match(v, /'no card yet'/);
  assert.doesNotMatch(v, /'No service yet'/);
  assert.match(v, /input\.firstSteps \|\| input\.shop\.details\.complete \? null : `details /);
});

test('from 768px the open step is the shipped SidePanel — each editor mounted once', () => {
  const folds = code('app/vendor-dashboard/_components/supplier-setup-folds.tsx');
  assert.match(folds, /<SidePanel[\s\S]*?size="wide"[\s\S]*?phone="sheet"/);
  assert.match(folds, /useMediaQuery\('\(min-width: 768px\)'\)/);
  assert.match(folds, /\{wide \? null : bodies\[f\.key\]\}/, 'the fold mounts the body while the pane does too');
  assert.match(folds, /open=\{wide \? false : open === f\.key\}/);
});
