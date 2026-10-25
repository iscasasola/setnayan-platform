/**
 * A COUPLE MAY LEAVE THE SAME-DATE COUNT.
 *
 * ⚖ DPO ruling 2026-10-23 (corpus DECISION_LOG, "OWNER ANSWERS ON THE BUILD
 * TRACKER"): *"couples may opt out of the same-date count"*. /privacy used to
 * say "You cannot switch this one off", and RoPA DPS-17 carried the missing
 * opt-out as the open DPO question.
 *
 * THE PROPERTY, end to end:
 *   1. an opted-out event contributes NOTHING to another couple's count — the
 *      pure counter drops it before the floor, so it cannot tip a count to 3;
 *   2. the one place the count is computed reads the flag on the same row it
 *      already reads, and hands it to the counter;
 *   3. the couple has the switch in their event privacy settings, using the
 *      same pill-and-button control as "Who can watch on the day", written
 *      only after the host check;
 *   4. the column is born readable (its own SELECT grant) and is not writable
 *      by `authenticated` (no UPDATE grant — row-level RLS);
 *   5. /privacy says the switch exists, in the switch's own words.
 *
 * SABOTAGE (run when written): drop `|| h.optedOut` from groupHoldsByVendor →
 * RED (1); drop `same_date_count_opt_out` from the vendors-page select → RED
 * (2); point the settings form's `setting` elsewhere → RED (3).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  countInquiringCouples,
  groupHoldsByVendor,
  allHoldingEventIds,
  inquiryPairKey,
  type SameDateHold,
} from './same-date-demand';
import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SWITCH_WORDS = 'Count us for other couples';

test('1 · an opted-out event is never counted — not even toward the floor', () => {
  const holds: SameDateHold[] = [
    { marketplaceVendorId: 'v1', eventId: 'e1' },
    { marketplaceVendorId: 'v1', eventId: 'e2' },
    { marketplaceVendorId: 'v1', eventId: 'e3', optedOut: true },
  ];
  const grouped = groupHoldsByVendor(holds);
  assert.deepEqual([...(grouped.get('v1') ?? [])].sort(), ['e1', 'e2']);
  assert.deepEqual(allHoldingEventIds(holds).sort(), ['e1', 'e2'], 'the thread read never even asks about it');
  const inquired = new Set(['e1', 'e2', 'e3'].map((e) => inquiryPairKey(e, 'v1')));
  assert.equal(countInquiringCouples(grouped, inquired).get('v1'), undefined, 'two counted couples are below the floor of 3');
  // Without the opt-out the same three would show.
  const all = groupHoldsByVendor(holds.map((h) => ({ ...h, optedOut: false })));
  assert.equal(countInquiringCouples(all, inquired).get('v1'), 3);
});

test('2 · the vendors page reads the flag and hands it to the counter', () => {
  const page = code('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /events!event_vendors_event_id_fkey!inner\(event_date, same_date_count_opt_out\)/);
  assert.match(page, /optedOut: h\.event\?\.same_date_count_opt_out === true/);
  assert.match(page, /groupHoldsByVendor\(holdRows\)/);
});

test('3 · the couple has the switch, in the existing control, behind the host check', () => {
  const page = code('app/dashboard/[eventId]/website/privacy/page.tsx');
  // One route for both switches on this page (server-action budget): the form
  // posts to setLiveMediaAudience with setting=same_date_count.
  assert.match(page, /<SafeForm action=\{setLiveMediaAudience\}>\s*<input type="hidden" name="setting" value="same_date_count" \/>/);
  assert.match(page, /name="opt_out"/);
  assert.ok(page.includes(SWITCH_WORDS), 'the settings tile carries the switch’s name');
  const actions = code('app/dashboard/[eventId]/website/privacy/actions.ts');
  assert.match(
    actions,
    /if \(formData\.get\('setting'\) === 'same_date_count'\) return setSameDateCountOptOut\(formData\);/,
    'the shared action routes the setting to the opt-out writer',
  );
  const start = actions.indexOf('async function setSameDateCountOptOut');
  assert.ok(start > 0, 'the opt-out writer exists');
  const body = actions.slice(start);
  const check = body.indexOf('await requireVisibilityHost(eventId)');
  const write = body.indexOf('.update({ same_date_count_opt_out: optOut })');
  assert.ok(check > 0 && write > check, 'the write must come after the host check');
});

test('4 · the column is readable by its owner and not writable from a browser', () => {
  const sql = readFileSync(
    join(WEB, '..', '..', 'supabase/migrations/20271285020592_couples_may_leave_the_same_date_count.sql'),
    'utf8',
  );
  assert.match(sql, /ADD COLUMN IF NOT EXISTS same_date_count_opt_out boolean NOT NULL DEFAULT false/);
  assert.match(sql, /GRANT SELECT \(same_date_count_opt_out\) ON public\.events TO authenticated/);
  assert.doesNotMatch(sql.replace(/--.*$/gm, ''), /GRANT UPDATE/i);
});

test('5 · /privacy says the switch exists, by its own name', () => {
  const privacy = readFileSync(join(WEB, 'app/(shell)/privacy/page.tsx'), 'utf8').replace(/\s+/g, ' ');
  assert.doesNotMatch(privacy, /You cannot switch this one off/);
  assert.ok(privacy.includes(`<em>${SWITCH_WORDS}</em>`), '/privacy names the switch as the settings page does');
});
