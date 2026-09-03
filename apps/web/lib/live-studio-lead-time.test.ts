/**
 * ⏳ THE LEAD-TIME NOTICE — the buy surface must warn before it takes money.
 *
 * Setnayan is apply-then-pay with MANUAL reconciliation on a 24-hour SLA. Every other
 * SKU absorbs that latency; a wedding cannot. An unlock bought the night before may
 * still be unapproved when the ceremony starts, and an unapproved order is an
 * un-entitled event — one camera on the day they were promised several, on a date that
 * cannot move.
 *
 * These tests pin the three things that make the warning real rather than decorative:
 * it exists, the buy surface passes it, and the sheet renders it PROMINENTLY (above
 * the plans) instead of burying it in the 11px footnote beneath them.
 *
 * Its own file so it cannot conflict with a concurrent PR (same reason `changelog.d/`
 * fragments are per-PR files).
 *
 * Run: `pnpm test:unit`
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE } from './live-studio-readiness';

const HERE = dirname(fileURLToPath(import.meta.url));
const repoFile = (p: string) => readFileSync(resolve(HERE, '..', p), 'utf8');

const BUY_PAGE = 'app/dashboard/[eventId]/studio/live-studio-control/page.tsx';
const SHEET = 'app/_components/app-store/choose-plan-sheet.tsx';

test('the notice states the LEAD TIME, the REASON, and that buying early is free', () => {
  // All three or it does not work: a lead time with no reason reads arbitrary, and a
  // reason with no "costs you nothing" is an argument for buying LATE.
  assert.match(LEAD_TIME_NOTICE, /2 days before/i, 'no concrete lead time');
  assert.match(LEAD_TIME_NOTICE, /by hand/i, 'never says why — manual verification');
  assert.match(LEAD_TIME_NOTICE, /24 hours/i, 'omits the SLA the lead time derives from');
  assert.match(
    LEAD_TIME_NOTICE,
    /costs you nothing/i,
    'without this, "buy earlier" reads as "burn your day earlier"',
  );
  assert.match(
    LEAD_TIME_NOTICE,
    /when you first go live, not when you pay/i,
    'the anchor promise is the whole reason buying early is safe',
  );
});

test('⭐ the notice is only TRUE while the anchor is gated on entitlement', () => {
  // "your broadcast day starts when you first go live, not when you pay" is a claim
  // about `stampFirstLiveAt`. It became true on 2026-07-27 when the stamp started
  // refusing an un-entitled press. If that gate is ever removed, this copy is a LIE —
  // so the copy and the gate are pinned together, here, on purpose.
  const stamp = repoFile('lib/live-studio-window-server.ts');
  const fn = stamp.slice(stamp.indexOf('export async function stampFirstLiveAt'));
  assert.match(
    fn,
    /if \(!entitled\.multiCam\) return;/,
    'the entitlement gate is gone — LEAD_TIME_NOTICE now promises something false',
  );
});

test('⭐ the Live Studio buy surface actually passes the notice', () => {
  // A constant nobody renders is not a warning.
  const page = repoFile(BUY_PAGE);
  // Shape changed 2026-09-02 when YouTube's own lead time joined ours: the prop now
  // takes an array. Same fact pinned, matched through the new shape rather than
  // loosened — the constant must still reach the sheet by name.
  // Shape changed again 2026-09-02 when the LAPTOP requirement joined the two clocks —
  // the one pre-purchase fact with no recovery at all. Same facts still pinned by name;
  // matched through the new shape rather than loosened to a substring.
  assert.match(
    page,
    /notice: \[LEAD_TIME_NOTICE, YOUTUBE_READY_NOTICE, ENCODER_BUY_NOTICE\]/,
    'the buy sheet never receives all THREE pre-purchase facts',
  );
  assert.match(page, /from '@\/lib\/live-studio-readiness'/, 'not imported from the shared module');
});

test('the sheet renders the notice ABOVE the plans, not as footnote fine print', () => {
  // The footnote is 11px muted text under the price — right for refund policy, wrong
  // for a fact that decides whether the buyer should pay today at all.
  const sheet = repoFile(SHEET);
  const noticeAt = sheet.indexOf('{notice ? (');
  const listAt = sheet.indexOf('<ul className="flex-1 divide-y');
  const footnoteAt = sheet.indexOf('{footnote ? (');
  assert.ok(noticeAt > -1, 'the sheet does not render a notice at all');
  assert.ok(listAt > -1 && footnoteAt > -1);
  assert.ok(noticeAt < listAt, 'the notice must render BEFORE the plan list');
  assert.ok(noticeAt < footnoteAt, 'the notice must not be buried with the footnote');
});

test('the notice prop is ADDITIVE — every other caller is unchanged', () => {
  // Optional with no default, so the ~dozen other SKUs that mount ChoosePlanSheet
  // render byte-for-byte as before.
  const sheet = repoFile(SHEET);
  assert.match(sheet, /notice\?: string \| readonly string\[\];/, 'the prop must be optional');
  assert.ok(
    !/notice = /.test(sheet),
    'a default value would opt every other SKU into a Live-Studio-specific warning',
  );
});

/* ─────────────────────────────────────────────────────────────────────────────
   YOUTUBE'S LEAD TIME — the second clock, and the tick box that gates the sale.
   Owner ruling 2026-09-02. These pin the three ways this silently stops working:
   the sentence loses a clause, the box stops gating, or the box stops being once.
   ───────────────────────────────────────────────────────────────────────────── */

test('the YouTube notice states the WAIT, the CHECK, and kills the 50-subscriber myth', () => {
  assert.match(YOUTUBE_READY_NOTICE, /24 hours/i, 'omits the activation wait — the whole point');
  assert.match(
    YOUTUBE_READY_NOTICE,
    /youtube\.com\/features/i,
    'never says WHERE to check, so "make sure" is an instruction nobody can follow',
  );
  // Load-bearing, not trivia: a couple who searches this finds "you need 50
  // subscribers" everywhere, concludes they are ineligible, and does not buy. The
  // threshold is mobile-app streaming only; encoder streaming from a computer — the
  // only path Live Studio uses — has none.
  assert.match(YOUTUBE_READY_NOTICE, /50 subscribers/i, 'the myth is not pre-empted');
  assert.match(YOUTUBE_READY_NOTICE, /phone app/i, 'never says the 50 applies only to the phone');
});

test('⭐ the tick box GATES checkout — a notice nobody must act on is decoration', () => {
  const sheet = repoFile(SHEET);
  assert.match(sheet, /const checkoutLocked = !!acknowledgement && !accepted;/,
    'the gate is gone — the plans are buyable without the acknowledgement');
  assert.match(sheet, /\{checkoutLocked \? \(/,
    'checkoutLocked is computed but never used to withhold the checkout trigger');
});

test('🔒 the box is AFFIRMATIVE — starts unticked, never seeded from a prop', () => {
  // Same rule as app/signup/consent-is-affirmative.test.ts, which exists because a
  // door was found posting a hidden value="yes" and opting every couple in silently.
  const sheet = repoFile(SHEET);
  assert.match(sheet, /const \[accepted, setAccepted\] = useState\(false\);/,
    'the tick box must start UNTICKED and must not be seeded from a prop');
  assert.ok(
    !/type="hidden"[^>]*youtube_live_ready/.test(sheet),
    'consent by hidden field — the exact defect consent-is-affirmative.test.ts bans',
  );
});

test('⭐ asked ONCE, ever — the stamp lives on the person, not the event or the order', () => {
  // Owner, verbatim: "If they have accepted at least once, then the next time they
  // purchase, no more tick box. since that account is already confirmed." An
  // event-scoped or order-scoped column re-asks the same human at their second
  // celebration or their second purchase, which is what was ruled out.
  const action = repoFile('app/dashboard/[eventId]/studio/live-studio-control/actions.ts');
  assert.match(action, /\.from\('users'\)/, 'the ack must be stamped on the PERSON');
  assert.match(action, /youtube_live_ready_ack_at/, 'the column is not written');
  assert.match(action, /\.eq\('user_id', user\.id\)/, 'the write is not scoped to the actor');

  const page = repoFile(BUY_PAGE);
  assert.match(page, /youtubeLiveReadyAcked\s*\n?\s*\?\s*undefined/,
    'an already-acknowledged buyer must not be shown the box again');
});
