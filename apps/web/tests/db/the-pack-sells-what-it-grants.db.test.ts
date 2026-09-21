/**
 * THE ₱500 SUPPLIER PACK SELLS WHAT IT GRANTS — executed against real Postgres.
 *
 * ── THE DEFECT THIS EXISTS TO OUTLIVE ──────────────────────────────────────
 * `vendor_billing_catalog.sku_code = 'vendor_papic_portfolio_pack'` was seeded
 * on 2026-09-05 with the title "… 25 Papic credits …". On 2026-09-06 the owner
 * raised what one ₱500 buys to 100 — `VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS` moved
 * and the shop window did not. Measured in production 2026-09-22, the row's
 * `updated_at` was STILL the seed timestamp: a supplier had been told, for over
 * a year, that they were buying a quarter of what they got.
 *
 * 🔑 IT ERRS IN THE CUSTOMER'S FAVOUR, WHICH IS WHY IT SURVIVED. A generous lie
 * raises no support ticket. Nothing was going to report this — it had to be
 * measured, and then something had to stop it drifting back.
 *
 * ── WHY A DB TEST AND NOT A UNIT TEST ──────────────────────────────────────
 * The number is in TypeScript and the sentence is in a TABLE. A unit test can
 * only see the first, and `/admin/pricing` cannot even edit the second
 * (`saveVendorRow` writes price/description/is_active only — "Title stays
 * migration-owned"). The PGlite replay applies every migration, so this is the
 * only place in the repo where both halves are visible at once.
 *
 * ── WHAT IS ASSERTED, AND WHY IT IS SHAPED THIS WAY ────────────────────────
 * The title must contain the LIVE constant, read from the module — never the
 * literal 100. Hard-coding the expected number would make this test agree with
 * whatever the migration happened to write, and the next time the owner reprices
 * the pack it would go green against a title that once again contradicts the
 * grant. The constant is the single source; this asserts the sentence tracks it.
 *
 * 🛑 AND ONE NEGATIVE THAT CANNOT BE REACHED BY A POSITIVE. A title reading
 * "25 Papic credits" contains no "100", so the positive assertion alone would
 * catch today's bug — but a title reading "100 credits (was 25)" would pass it
 * while still quoting a dead number at a paying supplier. So a stale figure is
 * refused explicitly.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';
// ⚠ RELATIVE, NOT `@/lib/…`. Exactly one other db test reaches into lib and it
// does so with `import type`, which never has to resolve at run time. This is a
// VALUE import — the whole point is to read the live constant — so it takes the
// path the runner can definitely follow. `vendor-papic-credits` imports nothing
// itself, so nothing server-side is dragged into the replay.
import {
  VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS,
  VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE,
} from '../../lib/vendor-papic-credits';

let replay: ReplayResult;
let db: PGlite;

/**
 * Figures the pack has been sold at before. A title may not quote one of these
 * as the credits it grants — see the negative case above. 25 is the seeded
 * original; add a rung here whenever the pack is repriced, so the wording can
 * never quietly fall back to a number somebody used to get.
 */
const RETIRED_CREDIT_FIGURES = [25];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

async function packTitle(): Promise<string | null> {
  const r = await db.query<{ title: string }>(
    `SELECT title FROM public.vendor_billing_catalog WHERE sku_code = $1`,
    [VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE],
  );
  return r.rows[0]?.title ?? null;
}

test('the pack row exists at all', async () => {
  const title = await packTitle();
  assert.ok(
    title,
    `${VENDOR_PAPIC_PORTFOLIO_PACK_SKU_CODE} is not in vendor_billing_catalog. ` +
      'It is seeded by migration — if it has been dropped, the supplier can no ' +
      'longer buy portfolio credits at all and that is the real finding.',
  );
});

test('the title quotes the credits the code actually grants', async () => {
  const title = (await packTitle())!;
  assert.match(
    title,
    new RegExp(`\\b${VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS}\\b`),
    `The pack grants ${VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS} credits but its title ` +
      `does not say so: ${JSON.stringify(title)}. The title is migration-owned ` +
      '(/admin/pricing cannot edit it), so fix it in a migration against ' +
      'vendor_billing_catalog — not by changing the constant to match the sentence.',
  );
});

test('the title does not still quote a figure the pack no longer grants', async () => {
  const title = (await packTitle())!;
  for (const stale of RETIRED_CREDIT_FIGURES) {
    if (stale === VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS) continue; // re-adopted; not stale
    assert.doesNotMatch(
      title,
      new RegExp(`\\b${stale}\\b\\s*Papic credits`),
      `The pack title still offers ${stale} Papic credits: ${JSON.stringify(title)}. ` +
        `It grants ${VENDOR_PAPIC_PORTFOLIO_PACK_CREDITS}. A supplier reading this ` +
        'is being quoted a number nobody has received since 2026-09-06.',
    );
  }
});
