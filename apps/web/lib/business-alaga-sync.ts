/**
 * business-alaga-sync.ts — a renamed shop renames its business alaga.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * Opening a shop writes the business a `dependents` row (`business-alaga.ts`,
 * written by `becomeVendor`) whose `name` is the shop's name AT OPEN TIME.
 * Nothing kept it in step afterwards: no writer of `vendor_profiles.business_name`
 * touched `dependents`, and no trigger copies one into the other. So a supplier
 * who renamed their shop kept seeing the OLD name in the event picker's "For ▾"
 * dropdown and on People — the one name they had just told us was wrong.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * Every writer of `vendor_profiles.business_name` on a shop that HAS an owner
 * calls `ensureBusinessAlaga` (`lib/business-alaga-ensure.ts`) after its write
 * succeeds — which renames through THIS function when the record exists, and
 * writes the record when it does not (2026-10-22: a shop first named on My Shop,
 * or claimed from a couple's link, had none to rename). Held by
 * `lib/business-alaga-sync.test.ts`, which finds those writers by their code,
 * not by a list somebody has to remember to extend.
 *
 * ── THE ROW IT TOUCHES ─────────────────────────────────────────────────────
 * Exactly the row `becomeVendor` wrote: `owner_user_id` = the shop's owner,
 * `vendor_profile_id` = the shop, `dependent_kind` = 'business'. That pair is
 * the partial UNIQUE key `dependents_owner_vendor_profile_key`, so this is at
 * most one row. A hand-typed business alaga (no `vendor_profile_id`) is never
 * matched — it was named by its carer, not by a shop.
 *
 * ⚠ ZERO ROWS IS A LEGITIMATE OUTCOME, NOT A SILENT FAILURE. A shop opened
 * while the People gates were off, or before the alaga existed at all, simply
 * has no record to rename. The rename itself already succeeded; this is
 * record-keeping that follows it.
 *
 * ⚠ THIS MUST NEVER BECOME A WAY TO FAIL A RENAME. Same posture as the open-shop
 * insert: it returns nothing, never throws, never redirects. A refused write is
 * logged, not surfaced — the supplier's shop name is theirs; keeping the record
 * in step is ours, and ours failing must not cost them theirs.
 *
 * ⚠ THE CALLER PASSES AN ADMIN CLIENT AND AN OWNER IT DID NOT READ FROM A FORM.
 * RLS is off for that client, so `ownerUserId` IS the ownership boundary — the
 * authenticated caller for a supplier rename, `vendor_profiles.user_id` for an
 * admin-applied correction. Never a form value.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { businessAlagaName } from './business-alaga';
import { logQueryError } from './supabase/error-detect';

export type BusinessAlagaRenameInput = {
  ownerUserId: string | null | undefined;
  vendorProfileId: string | null | undefined;
  /** The `vendor_profiles.business_name` that was just written. */
  shopName: string | null | undefined;
};

export async function syncBusinessAlagaName(
  client: Pick<SupabaseClient, 'from'>,
  input: BusinessAlagaRenameInput,
): Promise<void> {
  const ownerUserId = (input.ownerUserId ?? '').trim();
  const vendorProfileId = (input.vendorProfileId ?? '').trim();
  // The same normalisation the open-shop insert used, so a name written by one
  // path and renamed by the other can never be stored two different lengths.
  const name = businessAlagaName(input.shopName);
  // A blank name is refused upstream by every rename path; if one ever slips
  // through, leave the old name rather than blank the record — a nameless alaga
  // is the one row the People surface refuses to draw.
  if (!ownerUserId || !vendorProfileId || !name) return;
  try {
    const { error } = await client
      .from('dependents')
      .update({ name, updated_at: new Date().toISOString() })
      .eq('owner_user_id', ownerUserId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('dependent_kind', 'business');
    if (error) {
      logQueryError('lib/business-alaga-sync.ts: syncBusinessAlagaName dependents.update', error, {
        vendor_profile_id: vendorProfileId,
      });
    }
  } catch (err) {
    console.error('[syncBusinessAlagaName] business alaga rename failed:', err);
  }
}
