/**
 * root-map-waves-2-3.test.ts — Root map part 2, waves 2 + 3 (owner 2026-10-02,
 * "Fix them all"): "the same fact shown twice on one screen" and "numbers that
 * look live but are typed in".
 *
 * Every number made live gets "move the input, the output moves"
 * (`assertOutputMoves`, lib/ugat/output-moves.ts), and the sabotage at the end
 * proves the scanner would catch the typed literal if it came back — so a green
 * here means the number is read, not remembered.
 *
 * 🪤 `globalThis.React` before any component import (see
 * app/dashboard/[eventId]/home-numbers-move.test.ts).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { assertOutputMoves } from '@/lib/ugat/output-moves';
import { renderedTextIn, typedNumbersIn } from '@/lib/ugat/scan-shown-values';

(globalThis as unknown as { React: unknown }).React = React;

// `lib/payouts.ts` pulls a `server-only` module; the package has no runtime
// export for node. Same shim as app/dashboard/[eventId]/home-numbers-move.test.ts.
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
{
  const CjsModule = (createRequire(import.meta.url)('node:module') as { Module: CjsModuleCtor }).Module;
  const STUB = join(process.cwd(), '__server_only_stub_rm_waves__.js');
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const WEB = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/* ── Top N% badges: the tooltip is derived from the floor the badge is awarded at ── */

test('the Most Booked / Top Pick tooltips move with the percentile floor', async () => {
  const { topPercentLabel, MOST_BOOKING_PERCENTILE, TOP_PICK_PERCENTILE } = await import('@/lib/vendor-badges');
  await assertOutputMoves({
    what: 'badge tooltip · top N%',
    render: (floor: number) => `<p>${topPercentLabel(floor)}%</p>`,
    read: (h) => h.match(/>(\d+)%</)?.[1] ?? null,
    inputs: [0.9, 0.8],
    expect: ['10', '20'],
  });
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { VendorBadgeRow } = await import('@/app/(shell)/explore/_components/vendor-badge-row');
  const html = renderToStaticMarkup(React.createElement(VendorBadgeRow, { badges: ['most_booking', 'top_pick'] }));
  assert.ok(html.includes(`top ${topPercentLabel(MOST_BOOKING_PERCENTILE)}%`), 'Most Booked says the floor it is awarded at');
  assert.ok(html.includes(`top ${topPercentLabel(TOP_PICK_PERCENTILE)}%`), 'Top Pick says the floor it is awarded at');
});

/* ── Payout stages: one split, paid by it and worded by it ── */

test('the payout stages pay by PAYOUT_STAGE_PCT — move the split and the money moves', async () => {
  const { PAYOUT_STAGE_PCT, PAYOUT_STAGE_LABEL, planPayoutStages } = await import('@/lib/payouts');
  const plan = () =>
    planPayoutStages({
      verificationState: 'coming_soon',
      paidAt: new Date('2026-10-01T00:00:00Z'),
      eventDate: new Date('2027-01-01T00:00:00Z'),
      vendorNetCentavos: 100_000,
    }).map((s) => s.amount_centavos);
  assert.equal(PAYOUT_STAGE_PCT.stage_1_confirm + PAYOUT_STAGE_PCT.stage_2_event_start + PAYOUT_STAGE_PCT.stage_3_event_end, 100);
  const before = { ...PAYOUT_STAGE_PCT };
  try {
    await assertOutputMoves({
      what: 'payout stage amounts',
      render: (split: [number, number]) => {
        PAYOUT_STAGE_PCT.stage_1_confirm = split[0];
        PAYOUT_STAGE_PCT.stage_2_event_start = split[1];
        return `<p>${plan().join(',')}</p>`;
      },
      read: (h) => h.match(/<p>([^<]+)</)?.[1] ?? null,
      inputs: [[20, 60], [30, 50]],
      expect: ['20000,60000,20000', '30000,50000,20000'],
    });
  } finally {
    Object.assign(PAYOUT_STAGE_PCT, before);
  }
  assert.match(PAYOUT_STAGE_LABEL.stage_1_confirm, new RegExp(`\\(${before.stage_1_confirm}%\\)`), 'the label quotes the same split');
  const page = code('app/admin/payouts/page.tsx');
  assert.match(page, /PAYOUT_STAGE_PCT\.stage_2_event_start/, 'the admin stage tabs quote the split');
  assert.match(page, /BIR_WITHHOLDING_BPS \/ 100/, 'the BIR label is the rate the payout uses');
});

/* ── The social publish gate ── */

test('"posts after" moves with the event date, by the one gate length', async () => {
  const { shareConsentPostableFrom, SHARE_PUBLISH_GATE_DAYS } = await import('@/lib/social-sharing');
  await assertOutputMoves({
    what: 'social queue · postable from',
    render: (d: string) => `<p>${shareConsentPostableFrom(d)}</p>`,
    read: (h) => h.match(/<p>([^<]+)</)?.[1] ?? null,
    inputs: ['2026-01-01', '2026-02-01'],
  });
  // The gate is `event_date + SHARE_PUBLISH_GATE_DAYS` — read against the same clock the function uses.
  const expected = new Date(new Date('2026-01-01T00:00:00').getTime() + SHARE_PUBLISH_GATE_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  assert.equal(shareConsentPostableFrom('2026-01-01'), expected);
});

/* ── Guest counts are worked out WITH the read, once ── */

test('MeasuredGuests.stats follows the rows; an unread list is flagged, not zeroed', async () => {
  const { fetchGuestsByEventMeasured, unmeasuredGuests } = await import('@/lib/guests');
  const stub = (rows: unknown[], error: unknown = null) => {
    const chain: unknown = new Proxy(
      {},
      { get: (_t, prop) => (prop === 'then' ? (res: (v: unknown) => void) => res({ data: rows, error }) : () => chain) },
    );
    return { from: () => chain } as never;
  };
  const g = (rsvp_status: string) => ({ rsvp_status, role: 'guest', plus_one_count: 0, entry_source: 'host_seeded', passed_away: false });
  await assertOutputMoves({
    what: 'guest read · attending',
    render: async (rows: unknown[]) => `<p>${(await fetchGuestsByEventMeasured(stub(rows), 'e1')).stats.attending}</p>`,
    read: (h) => h.match(/<p>(\d+)</)?.[1] ?? null,
    inputs: [[g('attending'), g('pending')], [g('attending'), g('attending'), g('attending')]],
    expect: ['1', '3'],
  });
  const refused = await fetchGuestsByEventMeasured(stub([], { message: 'refused', code: '42501' }), 'e1');
  assert.equal(refused.measured, false, 'a refused read says so');
  assert.deepEqual(refused, unmeasuredGuests(), 'one shape for "not read"');
});

/* ── Screens quote their rule from ONE name ── */

test('a screen quotes each fixed rule by its name, not by a copy of the number', () => {
  const quotes: Array<[string, RegExp]> = [
    ['app/(shell)/refunds/page.tsx', /\{REFUND_REPORT_WINDOW_DAYS\} days/],
    ['app/(shell)/privacy/page.tsx', /\{ERROR_LOG_RETENTION_DAYS\} days/],
    ['app/admin/accounts/_surfaces/users-surface.tsx', /COMP_GRANT_CO_REVIEW_PESOS/],
    ['app/admin/users/actions.ts', /COMP_GRANT_CO_REVIEW_PESOS \* 100/],
    ['app/dashboard/[eventId]/launch/_components/details-date-clash.tsx', /\{DATE_CHANGE_DUE_DAYS\} days/],
    ['app/dashboard/[eventId]/studio/papic/_components/host-pool-meter-card.tsx', /\{POOL_METER_LOW_PCT\}%/],
    ['app/dashboard/[eventId]/story/_components/make-it-yours.tsx', /formatCount\(input\.poolCap\)/],
    ['app/vendor-dashboard/clients/[eventId]/editorial-media/page.tsx', /\{MAX_PER_TYPE\} photos/],
    ['app/vendor-dashboard/performance/_components/inquiry-handling-card.tsx', /\$\{REPLY_SPREAD_PCT\}% within/],
    ['app/onboarding/_shared/date-calendar.tsx', /\$\{MAXSPAN \+ 1\} days/],
    ['app/admin/custom-plans/_components/custom-composer.tsx', /CUSTOM_BASE\.seats\)\} seats included/],
    // The AI family's own discount card (and its "10% floor" sentence) was removed by the
    // one-sign-up-discount change (d18); the one card left quotes the floor by name.
    ['app/admin/pricing/_components/signup-discount-card.tsx', /min=\{PAPIC_DISCOUNT_FLOOR_PCT\}/],
    ['app/admin/studio/_surfaces/social-queue-surface.tsx', /SHARE_PUBLISH_GATE_DAYS/],
    ['app/for-suppliers/_components/vendor-grow-sections.tsx', /\{COMMISSION_PCT\}%/],
  ];
  for (const [file, re] of quotes) assert.match(code(file), re, `${file} no longer quotes its rule by name`);
  // …and the named rules are real, single definitions.
  const rules = code('lib/rule-constants.ts');
  for (const name of ['REFUND_REPORT_WINDOW_DAYS', 'ERROR_LOG_RETENTION_DAYS', 'COMP_GRANT_CO_REVIEW_PESOS', 'DATE_CHANGE_DUE_DAYS']) {
    assert.equal((rules.match(new RegExp(`export const ${name} = `, 'g')) ?? []).length, 1, `${name} must be defined once`);
  }
  assert.match(code('lib/date-change.ts'), /import \{ DATE_CHANGE_DUE_DAYS \} from '\.\/rule-constants'/, 'date-change.ts re-exports the one DATE_CHANGE_DUE_DAYS');
});

/* ── The same fact, drawn once ── */

test('one rendering per fact: the shared words and the shared reads', () => {
  // The RSVP answers' words — one list, every surface.
  for (const file of [
    'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx',
    // ⤷ Maker PR 4f: the filter row (roster-controls.tsx) and the page's counts
    // line are retired; the screen and its sections carry the words now.
    'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
    'lib/guest-roster-view.ts',
  ]) {
    const src = code(file);
    assert.match(src, /RSVP_ROW_WORDS/, `${file} must take the roster's RSVP words from lib/guests`);
    assert.doesNotMatch(src, /['"`]No reply['"`]/, `${file} spells "No reply" itself`);
  }
  // The Paid / Still owing read has one copy.
  const lens = code('app/dashboard/[eventId]/vendors/_components/merkado-budget-lens.tsx');
  assert.match(lens, /readBudgetLiveSummary\(/);
  assert.doesNotMatch(lens, /resolveEventMoney|buildBudgetLiveSummary|fetchBudgetSnapshot/, 'the lens re-derives the money');
  const home = code('app/dashboard/[eventId]/page.tsx');
  assert.match(home, /readBudgetLiveSummary\(/);
  // The customers' queue no longer restates days to go (the roster does).
  const queue = code('app/vendor-dashboard/bookings/surface.tsx');
  assert.doesNotMatch(queue, /days? ago|\bin \$\{d\} day/, 'the bookings queue states days to go again');
  // The two phrases the share-of-plan calculation owns are not used for other things.
  assert.doesNotMatch(code('app/dashboard/[eventId]/vendors/_components/lock-milestone.tsx'), /locked in/i);
  assert.doesNotMatch(code('app/vendor-dashboard/services/_components/service-card-face.tsx'), /locked in/i);
  assert.doesNotMatch(code('app/dashboard/[eventId]/_components/event-dashboard.tsx'), /\$\{formatCount\(datesCount\)\} \$\{[^}]*\} coming/);
});

/* ── Sabotage: a typed literal coming back is caught ── */

test('SABOTAGE — type the literal back and the shown-values scan finds it', () => {
  const cases: Array<[string, string, string]> = [
    ['app/dashboard/[eventId]/launch/_components/details-date-clash.tsx', '{DATE_CHANGE_DUE_DAYS} days to answer', '3 days to answer'],
    ['app/dashboard/[eventId]/studio/papic/_components/host-pool-meter-card.tsx', 'under {POOL_METER_LOW_PCT}% of your pool', 'under 10% of your pool'],
    ['app/vendor-dashboard/clients/[eventId]/editorial-media/page.tsx', '{MAX_PER_TYPE} photos</strong>', '3 photos</strong>'],
    ['app/(shell)/explore/_components/vendor-badge-row.tsx', 'top ${topPercentLabel(TOP_PICK_PERCENTILE)}% by', 'top 5% by'],
  ];
  for (const [file, from, to] of cases) {
    const real = code(file);
    assert.ok(real.includes(from), `${file}: the live form is gone`);
    const found = (src: string) => renderedTextIn(src).flatMap((t) => typedNumbersIn(t));
    assert.deepEqual(found(real).filter((h) => to.includes(h)), [], `${file}: the real file is clean`);
    assert.ok(found(real.replace(from, to)).length > 0, `${file}: a typed "${to}" was NOT caught`);
  }
});
