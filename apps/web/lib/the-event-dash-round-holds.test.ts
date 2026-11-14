/**
 * the-event-dash-round-holds.test.ts — the couple's event dashboard round (W1 full booking cycle + W2 sweep, 13–14 Nov),
 * one guard per fix. Run from apps/web: npx tsx --test lib/the-event-dash-round-holds.test.ts
 *
 * SABOTAGE — every test below was run against origin/main's files (the fix reverted) and went RED before commit.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { withPickedDate, readEventDate } from '@/lib/event-anchor';
import { inquireServiceList, inquireResumeOf, inquireClearedHref, withNewInquireEvent } from '@/lib/shop-inquire';
import { dealEntryFor } from '@/lib/deal-entry';

const WEB = join(import.meta.dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const GENERIC = 'app/onboarding/[type]/_components/generic-onboarding.tsx';

test('CYC-03 · one picked day is the event\'s date on every screen — a birthday\'s and a wedding\'s alike', () => {
  for (const event_type of ['birthday', 'wedding', 'simple_event']) {
    const row = { event_type, event_date: null, date_candidates: ['2026-12-19'] };
    assert.equal(withPickedDate(row).event_date, '2026-12-19', `${event_type}: the header still says "No date yet"`);
    assert.equal(readEventDate(row), '2026-12-19', event_type);
  }
  const two = { event_type: 'birthday', event_date: null, date_candidates: ['2026-12-19', '2026-12-26'] };
  assert.equal(withPickedDate(two), two, 'two picks are options, never a date');
  assert.match(code('app/dashboard/[eventId]/page.tsx'), /withPickedDate\(eventRes\.data\)/, 'Home no longer reads through the one rule');
});

test('CYC-02 · the celebrant follows "Who are we celebrating?" until the person types over it', () => {
  const src = code(GENERIC);
  assert.match(src, /const lastDerived = useRef<Record<string, unknown>>\(\{\}\);/);
  assert.match(
    src,
    /k in before && v\[k\] === before\[k\] && v\[k\] !== derivedSpecialty\[k\]/,
    'a value this flow filled in is treated as typed — step 3 keeps the account holder\'s name',
  );
});

test('CYC-04 · one tap is one step — a quick answer cannot carry the next card away unseen', async () => {
  const src = code(GENERIC);
  assert.match(src, /if \(now - lastForwardAt\.current < FORWARD_HOLD_MS\) return;/, 'two forward steps in one tap are both taken');
  const m = /export const FORWARD_HOLD_MS = (\d+);/.exec(src);
  assert.ok(m && Number(m[1]) >= 300 && Number(m[1]) <= 800, 'the hold is not a tap-sized window');
});

test('OWN-02 · Send says what is missing, and the event just started comes back picked', () => {
  const sheet = code('app/v/[slug]/_components/inquire-sheet.tsx');
  assert.match(sheet, /if \(!eventId\) \{\s*setNote\('Pick which event this is for first\.'\);\s*return;\s*\}/, 'Send is silent with no event picked');
  assert.doesNotMatch(sheet, /disabled=\{!eventId \|\|/, 'Send is disabled with no word on why');
  assert.match(sheet, /open\([^)]*ask\.serviceIds, ask\.eventId\)/, 'the way back does not hand the new event to the sheet');

  const back = withNewInquireEvent('/liwanag?inquire=1&isvc=a', 'ev-123');
  assert.equal(inquireResumeOf(back.slice(back.indexOf('?')))?.eventId, 'ev-123');
  assert.equal(withNewInquireEvent('/dashboard', 'ev-123'), '/dashboard', 'a plain next path is changed');
  assert.doesNotMatch(inquireClearedHref(`https://x.invalid${back}`), /ievent/, 'closing the sheet leaves the event in the address');
  assert.match(code(GENERIC), /withNewInquireEvent\(nextPath, res\.eventId\)/, 'the commit does not name the new event on the way back');
});

test('CYC-07 · "Which services?" lists one row per service — an older spelling of a carried card is not a 4th row', () => {
  const cards = ['Reception Lights & Sound', 'Ceremony Sound Kit', 'Ballroom Uplighting'].map((label, i) => ({
    serviceId: `c${i}`,
    label,
    price: '₱1',
    category: 'lights_sound',
  }));
  // Liwanag Lights & Sound, measured on prod 14 Nov: services = [lights_and_sound, lights_sound], every card lights_sound.
  const rows = inquireServiceList(cards, ['lights_and_sound', 'lights_sound'], (k) => k);
  assert.equal(rows.length, 3, 'the shop page shows 3 cards; the sheet listed a 4th');
  const other = inquireServiceList(cards, ['lights_and_sound', 'catering'], (k) => k);
  assert.deepEqual(other.filter((r) => r.provided).map((r) => r.category), ['catering'], 'a real other service is lost');
});

test('RW-278 · the "Send a deal" pill is the supplier\'s; the couple keeps its Deal-or-meeting door', () => {
  assert.equal(dealEntryFor({ side: 'couple', hasQuote: true }).offerDeal, false, 'the couple is offered "Send a deal"');
  assert.equal(dealEntryFor({ side: 'vendor', hasQuote: true }).offerDeal, true);
  assert.equal(dealEntryFor({ side: 'couple', hasQuote: true }).composer.label, 'Deal or meeting');
});

test('CYC-15 · the bench card: the badge never rides over "1 quote in"; "Not included" yields to a recorded price', () => {
  const bench = readFileSync(join(WEB, 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8');
  // The name keeps its 6ch floor (RW-89); the row's left part WRAPS, so the badge drops under the name, never over it.
  assert.match(bench, /\.slcat \.fold\.flat \.cat-l\{gap:12px;flex-wrap:wrap;row-gap:4px\}/, 'the badge spills over the row\'s state');
  assert.match(stripComments(bench), /svc && svc\.notIncluded\.length > 0 && !hasRecordedPrice \?/, '"Not included" shows beside a quote that charges it');
});

test('F-W2-23 · the guest card\'s camera pill never takes more than half the row', () => {
  assert.match(code('app/dashboard/[eventId]/guests/_components/guest-papic-camera.tsx'), /className=\{`\$\{FORM_PICK_CLASS\} \$\{width\} max-w-\[50%\]`\}/);
});
