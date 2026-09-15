/**
 * A BOOKING MUST KNOW WHICH SERVICE CARD IT IS FOR.
 *
 * ── THE DEFECT, MEASURED IN PRODUCTION 2026-09-16 ───────────────────────────
 * `event_vendors.service_id` was NULL on **48 of 48 rows**, including a
 * CONTRACTED booking. Not "mostly" — every row that exists.
 *
 * Both writers that set it (`startServiceInquiry`, `unlockCategoryWithInquiry`)
 * set it only when they INSERT. The branch that runs when the row ALREADY
 * EXISTS — the ordinary case, because a couple usually saves a shop to their
 * picks, or an auto-add creates the row, before they inquire — updated
 * `requested_service_ids` and nothing else. So the couple named the service,
 * the request was recorded, and the column everything joins on stayed empty.
 *
 * Proof it was that branch and not an unused feature: three rows carried
 * populated `requested_service_ids` (1–2 services each) with `service_id` NULL.
 * The information was there. The link was not.
 *
 * ── WHY IT MATTERED, AND WHY NOTHING REPORTED IT ────────────────────────────
 * 🔑 `setnayan_gift_offered_on` answers "does this booking carry the Setnayan
 * gift?" by joining `vendor_services` ON `event_vendors.service_id`. A NULL
 * join column matches nothing, so the answer was FALSE for every booking in
 * existence — and FALSE is exactly what an honest "this supplier didn't offer
 * a gift" looks like. A supplier could switch the gift on and no couple would
 * ever receive it, with no error, no empty state, and no log line: the system
 * would simply and quietly say no.
 *
 * That is this project's recurring disease in its purest form. Nothing failed.
 * Nothing rendered wrong. A question just became unreachable, and the honest
 * answer to an unreachable question is indistinguishable from a real one.
 *
 * ⚠ SO THIS GUARD IS ABOUT THE *UPDATE* PATH, NOT THE INSERT. Every test that
 * could have caught this would have exercised the insert, where the link was
 * always set correctly.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';

const read = (p: string) => stripComments(readFileSync(join(process.cwd(), p), 'utf8'));

const INQUIRY = 'app/v/[slug]/inquiry-actions.ts';
const UNLOCK = 'app/dashboard/[eventId]/vendors/_actions/unlock-category.ts';

test('🚨 the EXISTING-ROW path sets the service link, not just the requested list', () => {
  const src = read(INQUIRY);

  // It must READ the column before it can know whether to fill it.
  assert.match(
    src,
    /\.select\('vendor_id, requested_service_ids, service_id'\)/,
    'the existing-row lookup does not read service_id, so it cannot tell whether it is missing',
  );

  // …and it must WRITE it when absent.
  assert.match(
    src,
    /if \(!evRow\.service_id && initialServiceId\) patch\.service_id = initialServiceId;/,
    'the update branch no longer backfills service_id — bookings will go back to ' +
      'having no service card, and the Setnayan gift silently answers "no" for all of them',
  );
});

test('⚠ it fills the link ONLY when empty — a later inquiry must not move the booking', () => {
  // A couple may inquire about a second service. Overwriting would silently
  // change which card the booking is for, and that card is what the gift, the
  // quote and the bill all read.
  const src = read(INQUIRY);
  assert.ok(
    !/patch\.service_id = initialServiceId;\s*$/m.test(src.replace(/if \([^)]*\) /, '')) ||
      /!evRow\.service_id/.test(src),
    'service_id is being written unconditionally — it must be guarded on being empty',
  );
  assert.ok(
    !/\.update\(\{[^}]*service_id: initialServiceId[^}]*\}\)/.test(src),
    'service_id is written in an unconditional update object — use the guarded patch',
  );
});

test('the INSERT paths still set it — the original behaviour is not regressed', () => {
  assert.match(
    read(INQUIRY),
    /service_id: initialServiceId/,
    'the inquiry insert stopped setting the service link',
  );
  assert.match(
    read(UNLOCK),
    /service_id: serviceId/,
    'the unlock-category insert stopped setting the service link',
  );
});
