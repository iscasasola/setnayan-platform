#!/usr/bin/env node
/**
 * lint-server-action-budget — every exported `"use server"` function is ONE
 * Vercel route, and Vercel refuses a deployment above 2,048 routes.
 *
 * ── WHY THIS EXISTS (2026-09-26) ────────────────────────────────────────────
 * Production stopped updating for ~7 hours: four deploys in a row were refused
 * with `too_many_routes — Max is 2048, received 2049` at
 * `process-and-upload-routes`, while GitHub's deploy-prod run still said
 * "success" (it only fires the hook). Nothing in the repo could see the number;
 * it grew one save button at a time. Fixed by #6003 (31 unused actions
 * un-exported). The same limit had already stopped production for a day on
 * 2026-09-23. This guard makes the budget visible on every PR, BEFORE Vercel.
 *
 * ⚠ 2026-10-02: THIS BUDGETS ONE TERM, NOT THE LIMIT. The 2026-10-01 night
 * train sat exactly at this CEILING (the check is `>`) while three net new
 * dynamic routes took production to 2057 — green here, refused there. The sum Vercel counts is checked from the production build by
 * check-vercel-route-count.mjs (production build job). This one stays as the
 * early, source-only warning for the biggest term.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Count exported functions/consts in files whose first statement is
 * "use server" under apps/web/app and apps/web/lib. Fail above CEILING.
 * CEILING leaves headroom for the pages/.rsc routes that also count: at 1,209
 * exports production measured ~2,019 routes (Vercel's own count).
 *
 * Over the ceiling? In order of preference:
 *   1. reuse an existing action instead of exporting a new one;
 *   2. un-export actions nothing imports (see #6003 for the sweep);
 *   3. only with a fresh `vercel build` route count in hand
 *      (CONTROLLER.md §9), raise CEILING in the same PR and say why.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// 1225 → 1226 (2026-10-30, the couple-photo share, PR "customer-photo-to-supplier"): ONE dispatcher
// (`app/_actions/couple-photo-share-actions.ts`, four ops) instead of the four exports it would have been; no
// export nothing imports was left to drop (the two unreferenced ones in studio/recommend-actions.ts are kept on
// purpose — de0b53d1f9). No fresh `vercel build` count was taken for this +1: the SUM is gated by
// check-vercel-route-count.mjs on this PR's production build — read that job before merging.
// 1226 → 1227 (2026-11-01, Seats S1d "How guests see their seat"): ONE dispatcher (`guests/seat-view-actions.ts`,
// `guestSeatView` — the Seats ⚙ write and the guest card's preview read) instead of the two exports it would have been;
// the only unimported exports left are the two kept on purpose above. No fresh `vercel build` count for this +1 — the
// SUM is gated by check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1227 → 1228 (2026-11-05, booking-fee disputes, owner "build dispute"): ONE dispatcher
// (`app/_actions/booking-fee-dispute-actions.ts`, `bookingFeeDispute`, op=open|decide — the supplier's dispute and the
// admin's decision) instead of the two exports it would have been; no unimported export was left to drop (the two kept
// on purpose above). No fresh `vercel build` count for this +1 — the SUM is gated by check-vercel-route-count.mjs on
// this PR's production build; read that job before merging.
// 1227 → 1228 (2026-11-05, admin service-card moderation for the 7 Nov supplier registration): ONE dispatcher
// (`admin/vendors/[vendorProfileId]/card-actions.ts`, `moderateServiceCard` — take down · put back · remove photo)
// instead of the three exports it would have been; the only unimported exports left are the two kept on purpose above.
// No fresh `vercel build` count for this +1 — the SUM is gated by check-vercel-route-count.mjs on this PR's production
// build; read that job before merging.
// MERGED (2026-11-06): both +1s above landed on one tree; the real merged count measured 1228, so the ceiling stays
// 1228 — the limit is the measured count, never the sum of the two arrows.
// 1228 → 1229 (2026-11-06, "Questions for the couple — every supplier", #7248; owner OK 5 Nov): two new in-place
// actions, one per side (`messages/[threadId]/questions-actions.ts` · `sendQuestionsToEvent` for the supplier, and
// `workspace/question-answers-actions.ts` · `saveSupplierAnswers` for the couple), less one dead export removed
// (`studio/papic/actions.ts` · `reissuePapicSeat`). Measured on the tree merged with main after #7287: 1229. The route
// SUM stays gated by check-vercel-route-count.mjs — read that job before merging.
// 1229 → 1230 (2026-11-06, Ultra add-ons, owner "ULTRA ADD-ON PRICES"): ONE dispatcher
// (`vendor-dashboard/subscription/ultra-addon-actions.ts` · `buyUltraAddOn`, addon=category|service_card|waitlist|
// booking_per_date) instead of the four exports it would have been; no existing action buys an add-on by kind (the
// seat's `buyExtraSeat` is seat-only and keeps its team-page contract), and the only unimported exports left are the
// two kept on purpose above. No fresh `vercel build` count for this +1 — the SUM is gated by
// check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1230 → 1232 (2026-11-07, supplier sign-up #7351, merged after the Ultra add-on +1): the claim door's finish (`finishClaimDoor`, one action for
// the couple / auto-share / admin claim) is the one real new action. The second +1 is this script counting
// `export const dynamic` in app/dev/open-shop-lab/page.tsx, because that lab holds an inline 'use server' stand-in.
// No unimported action was found to un-export. The production build measured 1835 routes on 2026-11-07,
// 165 under check-vercel-route-count's ceiling of 2000, so there is room for these two.
// 1228 → 1228 (2026-11-05, Live Watch venue connection check, merged after the card-moderation +1; the measured total
// after both is 1228, so the ceiling stays tight): ONE dispatcher (`studio/panood/setup/venue-check/actions.ts`,
// `venueCheck` — start · finish · discard) instead of the three exports it would have been; no unimported export was
// left to drop (the two kept on purpose above). No fresh `vercel build` count for this +1 — the SUM is gated by
// check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// TRAIN 2B (2026-11-08): the venue check's +1 landed on a tree at 1230 (main); CEILING = the count measured on the merged
// train tree (never the sum of the arrows).
// TRAIN 1 (2026-11-08, #7394 merging main after 2B): train 1's two (+2 on 1230) and 2B's venue check (+1) meet;
// CEILING = the count measured on the merged tree (never the sum of the arrows).
// 1232 → 1233 (2026-11-08, THE ONE BUILD lane C2, owner v112 "Gift limit · % of the booking fee" in Admin › Gifts):
// `admin/gifts/gift-limit-actions.ts` · `saveGiftLimitPct`, the setting's ONE audited writer (spec B2 §4 sanctions
// "raise once with the reasoned line"). No unimported export was found in the lane's files to retire; message hearts
// write through the browser client under their own RLS, so they spend no route. ⚠ Other lanes raise this too — the
// controller reconciles the ONE number on the merged tree (sum of the lanes' +n), checked by check-vercel-route-count.
// 1233 → 1237 (INTEGRATION, 2026-11-08, claude/supplier-1build — THE ONE BUILD): measured on the merged tree against
// origin/main's 1233 (both counted by this script). The four new exports, each imported by its one caller:
// C2 `admin/gifts/gift-limit-actions.ts` · `saveGiftLimitPct` (the gift limit's one audited writer, above);
// C3 `vendor-dashboard/forms/actions.ts` · `formsAction` (ONE dispatcher for the Form Maker — save · use · send · retire),
// C3 `vendor-dashboard/clients/[eventId]/report-actions.ts` · `submitSupplierReport` (the picked client's Report page),
// C3 `admin/categories/form-suggestion-actions.ts` · `formSuggestionsAction` (ONE dispatcher for Admin › Categories' new template ·
// suggest · unsuggest). No unimported export was found to retire. No fresh `vercel build` count — 2026-11-07 measured
// 1835 routes, 165 under check-vercel-route-count's 2000, so +4 fits; the SUM stays gated by that job on the PR build.
// 1237 → 1238 (2026-11-08, Supplier Build 2 lane E, owner OK 8 Nov "raise to the measured count"): `recordClientRefund`
// in `vendor-dashboard/messages/[threadId]/pay-confirm-actions.ts` — the Payment page's "Record a refund" AND its
// swipe-left remove share this ONE export (a `remove_refund_id` field picks the mode), so the feature costs +1, not +2.
// CEILING = the count measured on the lane tree; the integration re-measures on the merged tree.
// 1238 → 1239 (2026-11-08, re-port lane R2 — #7246 Seal and plate, owner 8 Nov "Ok to raise it"): `photoMark` in
// `app/_components/photo-mark-actions.ts` — ONE dispatcher for the marked upload's server halves ('mark' what to stamp ·
// 'pair' the private clean copy · and, with #7247, 'original' to re-open a photo in the Frame step), so the whole photo
// mark + frame costs +1, not +3. No unimported export was found to retire. CEILING = the count measured on the lane
// tree; the integration re-measures on the merged tree, and check-vercel-route-count gates the sum on the PR build.
// 1239 → 1241 (2026-11-08, card checks "fix before Create", on claude/supplier-1build): TWO dispatchers instead of the six
// exports the feature would have been — `cardPhotoAction` (vendor-dashboard/services/card-check-actions.ts: the maker's
// photo check + "It's mine — report it") and `saveCardClaimWords` (admin/repost-watch/actions.ts: add · remove · allow ·
// unallow). A scan of every "use server" export found none that nothing references, so nothing could be un-exported in
// trade. No fresh `vercel build` count for this +2 — the SUM is gated by check-vercel-route-count.mjs on this PR's
// production build; read that job before merging.
// 1241 → 1242 (2026-11-11, Build 5 Lane C service card row, owner 11 Nov "swipe left to delete"): ONE new export,
// `removeVendorServiceFromList` in `vendor-dashboard/services/actions.ts` — the swipe's delete answered as a VALUE so the
// open-bookings refusal shows in place (the maker's `deleteVendorService` redirects; both run the one gate
// `deleteOrRetireOwnService`). Unimported exports found: `setGuestPlusOneCount` (held by extra-seats-are-chairs, another
// area) and three Papic purchase actions (money) — left alone. CEILING = the count measured on the tree merged with main.
// The route SUM stays gated by check-vercel-route-count.mjs on this PR's production build.
// 1242 → 1243 (2026-11-12, Build 6 Lane D — the Offer Maker): ONE dispatcher (`offerMaker` in
// app/vendor-dashboard/offers/actions.ts: load · save · switch · remove) instead of the four exports it would have been.
// Main reached 1242 on its own the same day (the line above); no unimported export was found to retire. No fresh `vercel build` count for
// this +1 — the SUM is gated by check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1243 → 1244 (2026-11-12, Piece 3b — a supplier's files for one event): ONE dispatcher (`eventFilesAction` in
// `app/_actions/event-files-actions.ts`, five ops for BOTH sides — known · file · map · remove · the couple's decide)
// instead of the five exports it would have been. No fresh `vercel build` count for this +1 — the SUM is gated by
// check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1244 → 1245 (2026-11-12, merged with Piece 3b's +1 above — event group chats, owner "group chats approved"): ONE dispatcher (`groupChat` in
// `app/samahan/chat/actions.ts` — send · add · leave · rejoin · create) instead of the five exports it would have been.
// No unimported export was found to retire. No fresh `vercel build` count for this +1 — the SUM is gated by
// check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1245 → 1246 (2026-11-12, Admin › Colours wave 1, owner 12 Nov "Yes, start wave 1"; merged after the two +1s above):
// ONE export, `saveAppColours` in app/admin/colours/actions.ts — Save AND "Reset to current" share it (an `op` field
// picks the mode), so the page costs +1, not +2. Unimported exports re-scanned: the same four as 11 Nov
// (`setGuestPlusOneCount`, held by extra-seats-are-chairs, and three Papic purchase actions — money) — left alone. No
// fresh `vercel build` count; the SUM is gated by check-vercel-route-count.mjs on this PR's production build.
// 1246 → 1247 (2026-11-13, merged with Piece 3b + group chats + Admin › Colours above — Quote + negotiation PR-4 — the offer card): ONE export, `applyDroppedOffer` in
// app/_actions/offer-card-actions.ts. It cannot be a browser card call like the other chat cards: the couple may not
// write a quote, and the offer's price must be computed on the server (offersForQuote) and handed to the service-role
// writer `apply_dropped_offer` — a browser-callable writer would let a session name its own discount. The drop itself
// is the supplier's own insert (no action). No unimported export was found to retire. No fresh `vercel build` count for
// this +1 — the SUM is gated by check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// 1247 → 1249 (2026-11-13, merged on top of the offer card's +1 above and Admin › Colours' +1, service requests — owner rulings 13 Nov): TWO new exports, one per side, which cannot be one
// dispatcher without moving the leaf mint out of admin/categories/actions.ts (category-proposal-mints-nothing.test.ts pins
// it there): `decideServiceRequest` (admin, admin/categories/actions.ts — the ONE Decision that moves every shop's cards)
// and `putCardUnderRequest` (supplier, vendor-dashboard/services/requests/actions.ts — a card joins its waiting request).
// The four exports nothing but tests import (papic purchasePapicCameras / activatePapicLimited / purchasePapicExtras,
// guests setGuestPlusOneCount) are pinned by their tests, so none was retired. No fresh `vercel build` count for this +2 —
// the SUM is gated by check-vercel-route-count.mjs on this PR's production build; read that job before merging.
// Admin team slice 2 (2026-11-13) holds the line at 1249: its ONE dispatcher (`adminTeamAct` in
// app/admin/approvals/actions.ts, op=add|save|clear|confirm_own|withdraw|reject|escalate|resolve|run_due) absorbed the
// page's own `rejectRequest`, so the eight ops it adds cost no route at all.
export const CEILING = 1249;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib'].map((r) => join(WEB, r));
const USE_SERVER = /^\s*['"]use server['"]/m;
const EXPORT = /^export\s+(?:async\s+)?(?:function|const)\s+\w+/gm;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

export function countServerActions(roots = ROOTS) {
  let total = 0;
  let files = 0;
  for (const f of roots.flatMap((r) => walk(r))) {
    const src = readFileSync(f, 'utf8');
    if (!USE_SERVER.test(src)) continue;
    files += 1;
    total += (src.match(EXPORT) || []).length;
  }
  return { total, files };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const ceiling = Number(process.env.SERVER_ACTION_CEILING || CEILING);
  const { total, files } = countServerActions();
  if (files === 0 || total === 0) {
    console.error('❌ lint-server-action-budget: found no "use server" exports — the walk is broken, not the budget.');
    process.exit(1);
  }
  if (total > ceiling) {
    console.error(
      `❌ ${total} exported server actions in ${files} "use server" files — over the ceiling of ${ceiling}.\n` +
        '   Each one is a Vercel route; production is refused above 2,048 routes (2026-09-23, 2026-09-26).\n' +
        '   Reuse an existing action, un-export ones nothing imports, or — with a fresh `vercel build`\n' +
        '   route count — raise CEILING in apps/web/scripts/lint-server-action-budget.mjs and say why.',
    );
    process.exit(1);
  }
  console.log(`✅ ${total} exported server actions in ${files} files — ${ceiling - total} under the ceiling of ${ceiling}.`);
}
