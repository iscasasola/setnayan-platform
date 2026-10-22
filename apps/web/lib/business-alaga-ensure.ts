/**
 * business-alaga-ensure.ts — a shop that is somebody's has its business alaga.
 *
 * ── THE RULING (owner 2026-09-30, DECISION_LOG "ONLY PEOPLE CAN BE INVITED…") ─
 * "if you create a business. it also creates a beloved that is your business."
 * The record is what lets the owner pick "For · <shop>" when they create an
 * event, and what People draws as the business they care for.
 *
 * ── THE DEFECT ─────────────────────────────────────────────────────────────
 * The record was written in ONE place — inline in `becomeVendor`
 * (`app/open-shop/actions.ts`). A shop can become an account's by other doors:
 * the claim flow (`/vendor/claim/[token]/finalize` — the couple's link, the
 * admin pre-staged transfer, the stub create) and a vendor sign-up whose
 * database trigger opens an EMPTY shop that is named later on My Shop. None of
 * them wrote the record, so those owners had no business to pick and People
 * said they cared for nothing.
 *
 * ── THE RULE ───────────────────────────────────────────────────────────────
 * Every door that makes an account own a shop, or names a shop an account
 * already owns, calls `ensureBusinessAlaga` after its own write succeeds. Held
 * by `lib/business-alaga-ensure.test.ts` (behaviour + a code scan that finds the
 * doors by their writes, not by a list) and `lib/business-alaga-sync.test.ts`
 * (the naming doors).
 *
 * ── WHAT IT DOES ───────────────────────────────────────────────────────────
 *   · The shop's record EXISTS → its name follows the shop's
 *     (`syncBusinessAlagaName`). Ungated, exactly as the rename shipped: a row
 *     that exists is kept true whatever the switches say.
 *   · It does not exist, and the People gates are open → it is written, once.
 *   · It does not exist and the gates are closed → nothing. Writing a row nobody
 *     can see is worse than not writing it; the next door that names the shop
 *     writes it once the gates open.
 *   · No owner, no shop, or a blank name → nothing. A nameless record is the one
 *     row People refuses to draw, so a trigger-opened EMPTY shop gets its record
 *     the moment it is named, not before.
 *
 * ── THE GATE IS THE SAME PAIR EVERY WRITE TO `dependents` READS ────────────
 * `dependentPeopleEnabled()` AND the `dependent_minor_profiles` control, as
 * `addDependent` gates and as `becomeVendor` gated the inline write this
 * replaces. A business row carries no minor's data, but the surface that renders
 * it AND-gates the same pair.
 *
 * ── EXACTLY ONE, EVER ──────────────────────────────────────────────────────
 * Read-then-write loses a concurrent double submit (both read nothing), so the
 * guarantee lives in the database: `dependents_owner_vendor_profile_key`
 * (partial UNIQUE on (owner_user_id, vendor_profile_id), migration
 * 20271186070892). The loser gets 23505, which `isAlreadyRecorded` reads as the
 * success it is. A REFUSED READ IS NOT "NO RECORD YET": an unreadable table
 * skips the write, because writing on a failed read is the duplicate this
 * exists to prevent.
 *
 * ⚠ THIS MUST NEVER BECOME A WAY TO FAIL A DOOR. It never throws and never
 * redirects; it returns what happened, for tests and logs only. Opening,
 * claiming or naming a shop is the supplier's business; keeping a record in
 * step is ours, and ours failing must never cost them theirs.
 *
 * ⚠ THE CALLER PASSES AN ADMIN CLIENT AND AN OWNER IT DID NOT READ FROM A FORM.
 * RLS is off for that client, so `ownerUserId` IS the ownership boundary — the
 * authenticated caller, or `vendor_profiles.user_id` read from the shop row.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildBusinessAlagaInsert, isAlreadyRecorded } from './business-alaga';
import { syncBusinessAlagaName } from './business-alaga-sync';
import { dependentPeopleEnabled } from './dependent-people-flag';
import { isDataPrivacyControlActive } from './data-privacy-controls';

export type BusinessAlagaEnsureInput = {
  ownerUserId: string | null | undefined;
  vendorProfileId: string | null | undefined;
  /** The shop's `business_name` as it now stands (after the caller's write). */
  shopName: string | null | undefined;
};

/** What happened — for tests and logs. No caller branches on it. */
export type BusinessAlagaEnsureOutcome =
  | 'created'
  | 'renamed'
  | 'nothing_to_record'
  | 'gated'
  | 'unread'
  | 'failed';

/**
 * The People gates — injectable so the behaviour is testable without env or a
 * table. The control is read through the ONE remembered list every caller reads
 * (`isDataPrivacyControlActive`, fail-closed), never a per-call table read.
 */
export type PeopleGate = () => Promise<boolean>;

export const peopleGateOpen: PeopleGate = async () =>
  dependentPeopleEnabled() && (await isDataPrivacyControlActive('dependent_minor_profiles'));

export async function ensureBusinessAlaga(
  admin: SupabaseClient,
  input: BusinessAlagaEnsureInput,
  gate: PeopleGate = peopleGateOpen,
): Promise<BusinessAlagaEnsureOutcome> {
  try {
    const alaga = buildBusinessAlagaInsert({
      ownerUserId: input.ownerUserId,
      vendorProfileId: input.vendorProfileId,
      shopName: input.shopName,
    });
    if (!alaga) return 'nothing_to_record';

    if (!(await gate())) {
      // Closed gates write nothing new — but a record that already exists still
      // follows the shop's name (zero rows when there is none).
      await syncBusinessAlagaName(admin, input);
      return 'gated';
    }

    const { data: already, error: readErr } = await admin
      .from('dependents')
      .select('dependent_id')
      .eq('owner_user_id', alaga.owner_user_id)
      .eq('vendor_profile_id', alaga.vendor_profile_id)
      .maybeSingle();
    if (readErr) {
      console.error('[supabase-error] lib/business-alaga-ensure.ts · from:dependents.select', readErr);
      return 'unread';
    }
    if (already) {
      await syncBusinessAlagaName(admin, input);
      return 'renamed';
    }

    const { error: insErr } = await admin.from('dependents').insert(alaga);
    if (insErr && !isAlreadyRecorded(insErr)) {
      // Not fatal, and not silent: the shop is fine, the record is not.
      console.error('[ensureBusinessAlaga] business alaga insert failed:', insErr.message);
      return 'failed';
    }
    return 'created';
  } catch (err) {
    console.error('[ensureBusinessAlaga] business alaga write threw:', err);
    return 'failed';
  }
}
