import type { SupabaseClient } from '@supabase/supabase-js';
import { isVendorSignupCoverageSuggestEnabled } from '@/lib/vendor-signup-coverage-suggest-flag';
import { isDataPrivacyControlActiveWith } from './data-privacy-controls';
import { runDeepSearchOrLite, type DeepSearchInputs } from './vendor-deep-search';

/**
 * vendor-signup-coverage-suggest-server.ts — C5, 2026-08-28: TRIGGER the
 * free, Setnayan-initiated read of a shop's OWN public website that
 * suggests coverage trades. The READ side (turning a finished dossier back
 * into suggestions, and the apply/dismiss write path) lives in
 * `vendor-signup-coverage-suggest-reader.ts` — split out on PURPOSE, the
 * same way `service-trade-aliases.ts` is split from `service-trade-aliases-db.ts`:
 * this file has NO `server-only`-tagged imports (directly or transitively),
 * which is what lets `vendor-signup-coverage-suggest-server.test.ts` import
 * it under plain `node:test` — that package genuinely is not installed in
 * this repo outside the Next.js build, so anything reachable from a unit
 * test must stay clear of it (see
 * [[feedback_server_only_is_not_installed_here]]). The reader file needs
 * `getOpenShopServiceTree` / `getReviewedTradeAliasRows`, both `server-only`,
 * so it stays untestable by node:test the same way its Rule-0 siblings are —
 * covered by reuse of already-tested modules instead.
 *
 * ⛔ THIS IS NOT A SECOND READER. `runDeepSearchOrLite` (the AI dossier when
 * `ANTHROPIC_API_KEY` is set, else the free keyless Lite pass) and the
 * `vendor_web_dossiers` STORE are exactly the engine + store
 * `lib/vendor-deep-search-run.ts` already uses for the vendor-run and
 * admin-verification Deep Search flows. Nothing here fetches a page or calls
 * Claude a second way.
 *
 * 🔑 IT IS A SEPARATE WRITER, DELIBERATELY, NOT A REUSE OF
 * `runAndRecordVendorDeepSearch`. That function's whole reason to exist is
 * the vendor's PAID / free-per-cycle ALLOWANCE — every successful run writes
 * a `vendor_deep_search_uses` row that counts against it. This run is
 * Setnayan-initiated and free in a completely different sense: it must never
 * consume or interact with a shop's own manual-run allowance, so it writes
 * `vendor_web_dossiers` directly and never touches `vendor_deep_search_uses`
 * at all. Rows this function writes are tagged `kind = 'signup_suggestion'`
 * so they are never confused with an admin due-diligence dossier or a
 * vendor's own paid/free run — distinct purposes stay in distinct rows,
 * on purpose (purpose limitation, RA 10173).
 *
 * 🔒 THREE CONDITIONS FROM THE 2026-08-28 RULING, each enforced here:
 *   1. The `/privacy` notice edit ships in the SAME PR as this code (see
 *      `app/(shell)/privacy/page.tsx`, "Free coverage suggestion at
 *      sign-up") — never performed before it is declared.
 *   2. SUGGESTED, NEVER APPLIED — this module only ever WRITES a dossier.
 *      Nothing here ever touches `vendor_profiles.services`; that happens
 *      only when the shop presses "Add" on a suggestion it is shown (see
 *      `app/vendor-dashboard/shop/suggested-coverage-actions.ts`).
 *   3. The shop is told ON SCREEN, not only in the notice — see the caption
 *      under the website field in `public-line-card.tsx` and the suggestion
 *      card's own "We read your website" line.
 *
 * 🔒 FAILS SILENT AND OPTIONAL, EVERYWHERE. No flag, no key, no website, a
 * network failure, an unparseable result, a database hiccup — none of it
 * throws out of this module, and none of it can ever slow or block the
 * website save that triggers it (callers invoke this from `after()`).
 */

export const SIGNUP_SUGGESTION_KIND = 'signup_suggestion' as const;

/**
 * Kick off (at most once per shop) a free, Setnayan-initiated read of the
 * shop's own website to suggest coverage. Best-effort and fire-and-forget —
 * call this from `after()`, never from the request path that must return a
 * response to the vendor.
 *
 * Never runs twice for the same shop: a `signup_suggestion` dossier already
 * existing (any status) means this shop's site was already read once. A
 * dossier purged by the 180-day retention sweep leaves nothing behind to
 * check, so a shop that re-adds a website years later is read again —
 * exactly the same honest limit every other Deep Search dossier lives under.
 *
 * 🔑 DOES NOT GATE ON `deepSearchAiConfigured()` — `runDeepSearchOrLite`
 * already decides AI vs. the free keyless Lite pass internally, exactly as
 * `runAndRecordVendorDeepSearch` (the vendor-run / admin-verify seam) does.
 * Without a key this still opens and completes a `signup_suggestion` row
 * (model = `lite`), just with an honestly empty `detected_services` — so no
 * suggestion is ever shown, with no special-casing needed anywhere else.
 *
 * `admin` is INJECTED (never constructed inside), the same shape
 * `runAndRecordVendorDeepSearch` takes — the caller passes its own
 * `createAdminClient()`, which is what lets this be unit-tested with a fake
 * client instead of a real database.
 */
export async function maybeSuggestCoverageFromWebsite(args: {
  admin: SupabaseClient;
  vendorProfileId: string;
  inputs: DeepSearchInputs;
}): Promise<void> {
  const { admin } = args;
  try {
    if (!isVendorSignupCoverageSuggestEnabled()) return;
    if (!args.inputs.website) return; // nothing to read
    if (!(await isDataPrivacyControlActiveWith(admin, 'vendor_deep_search'))) return;

    const { data: existing } = await admin
      .from('vendor_web_dossiers')
      .select('id')
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('kind', SIGNUP_SUGGESTION_KIND)
      .limit(1)
      .maybeSingle();
    if (existing) return;

    const { data: row, error: insErr } = await admin
      .from('vendor_web_dossiers')
      .insert({
        vendor_profile_id: args.vendorProfileId,
        application_id: null,
        status: 'running',
        requested_by: null, // Setnayan-initiated — nobody to name
        kind: SIGNUP_SUGGESTION_KIND,
        inputs: args.inputs,
      })
      .select('id')
      .maybeSingle();
    if (insErr || !row) return;
    const dossierId = (row as { id: number }).id;

    try {
      const { dossier, model } = await runDeepSearchOrLite(args.inputs);
      await admin
        .from('vendor_web_dossiers')
        .update({ status: 'complete', dossier, model, completed_at: new Date().toISOString() })
        .eq('id', dossierId);
    } catch (e) {
      await admin
        .from('vendor_web_dossiers')
        .update({
          status: 'failed',
          error: e instanceof Error ? e.message : 'Could not read the website.',
          completed_at: new Date().toISOString(),
        })
        .eq('id', dossierId);
    }
  } catch {
    // Fail silent and optional, by design — a shop must never see an error
    // about an assistant they did not ask for.
  }
}
