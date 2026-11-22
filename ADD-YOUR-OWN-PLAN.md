# "Add your own supplier" — the plan (Step 0) · rd/suppliers-add-your-own · 2026-10-10

Base: `rd/suppliers-on-main` (a73bb03fc). Contract: `prototypes/suppliers_add_your_own_2026-10-10.html`
(walked in a headless browser at 375 × 812, every case A–E, before any code). Rulings:
`SUPPLIERS_OWNER_RULINGS_2026-10-10.md`. Nothing here is pushed, applied or run against a database.

RULE 0 result — what exists · what is missing · the delta
- EXISTS: the eight-field add sheet with a Setnayan name search (`NewManualVendorModal`,
  `searchMarketplaceVendorsByName`, `attachMarketplaceVendorToCategory`, `addManualSupplier`); the claim link
  (`createManualVendorInvite` → `ensureAutoShareInvite`, `SupplierConnectPanel`, `ConnectSupplierModal`); the claim
  page, sign-up, `/finalize` → `applyClaimAutoLink`; the seeded first card (`buildCanvasInitialFromCoupleCard`,
  `CanvasMaker`); the "joined" notice (`vendor_joined`); the supplier's Customers roster and calendar
  (`customerLaneOf`, `pendingInquiryDates`); invite pill copy with no caller (`INVITE_PILL_COPY`,
  `fetchLatestInvitesByVendorIds`).
- MISSING: the four-step walk; "Yes — Inquire"; "your record, not a booking"; any invite status on the couple's
  row; the couple and the date on the couple's own link; the claimed couple as a customer; "asking" for a
  hand-typed record; the price box waiting.
- DELTA: below. No new mechanism; one new sheet component composed of shipped parts.

## 1 · Each prototype screen → the shipped component and the delta

| Screen | Shipped component extended | Delta |
|---|---|---|
| A1 Start (thumb row ＋) | `find-thumb-row.tsx` `FindThumbRow`; bench `addYourOwn` | the typed name rides into the walk; the button reads "Add" once a name is typed |
| A2–A3 Step 1 Name · match · no match | `searchMarketplaceVendorsByName` (unchanged) | NEW sheet `add-your-own-walk.tsx` (`Sheet` + `ActionButton` + `PickMenu`); "Yes — Inquire" = `attachMarketplaceVendorToCategory` + `contactShortlistVendor` (the shipped pick-then-ask, behind one button); "Not them?" continues |
| A Step 2 What they do | `PickMenu`, the bench's `benchRows` | one dropdown of only the event's categories, pre-answered |
| A Step 3 Contact | `addManualSupplier` → `createManualVendor` | accepts who-OR-mobile for the walk only (`contact_either`; the table has allowed it since 20271259075750) |
| A4 Step 4 Their link | `SupplierConnectPanel` (`createManualVendorInvite`) | the prototype's words; Download (PNG) · Copy link; the "your record, not a booking" note |
| A (row after Done) | bench card in `shortlist-categories.tsx` | "Added by you · your record, not a booking" + the link's status line |
| A5 The record (form) | `NewManualVendorModal` edit mode (`loadSelfAddedSupplier` / `updateSelfAddedSupplier`) | the pill; the claim link block at the foot; contacts not forced on edit |
| B · C · D (owner strips) | — | not screens of the product; B and D are Step 4 (money), C is "add later" |
| E1 They open the link | `app/vendor/claim/[token]/page.tsx`, `fetchClaimLandingByToken` | a couple's own link loads the couple and the date; the couple-invite words replace "locked you in" |
| E2 They join | `/signup?as=vendor` → `/finalize` | none (shipped) |
| E3 Their first card | `canvas-maker.tsx` + `lib/service-publish-gate.ts` | the price waits for the cover and what's-included on a claim-seeded card |
| E4 Today · Customers · Dates | `finalize/page.tsx`; `app/vendor-dashboard/customers/page.tsx`; `lib/vendor-inquiry-dates.ts` | the claimed thread is ACCEPTED (customer, lane "Talking"), its date counts as "asking" |
| E5 Back on the couple's phone | bench card | the "Now on Setnayan — their own card" line (from the claimed invite) |
| E6 The booking fee | — | Step 4. Untouched. |
| E7 When it does not complete | bench card | the status line: declined · ran out · no answer yet |

## 2 · The nine rulings → file + symbol

1. Flow as drawn; price / "already booked?" out → `app/dashboard/[eventId]/_components/add-your-own-walk.tsx`
   `AddYourOwnWalk`; words in `lib/add-your-own.ts` (`ADD_OWN_STEPS`). Guard: `lib/add-your-own.test.ts`.
2. Fee rule B → STEP 4, not built. Seam marked in `AddYourOwnWalk`'s docblock. Today's stamp is unchanged
   ("Yes — Inquire" stamps exactly what pick-then-ask stamps today: `shortlist`).
3. 10 % either side → STEP 4, not built. No number is written anywhere in this branch.
4. Link shows who invited + the date → `lib/vendor-invites.ts` `fetchClaimLandingByToken` (loads the parent and
   event for `auto_share_link`), `lib/claim-invite-words.ts` `claimInviteWords`, the claim page's
   `auto_share_link` branch.
5. A hand-typed record does not hold the date; it reads "asking" → `lib/vendor-inquiry-dates.ts`
   `askingDates` + `app/vendor-dashboard/customers/page.tsx` (no calendar block is written anywhere).
6. Price box waits → `lib/price-waits.ts` `priceWaitsFor`, `canvas-maker.tsx` (`askSheet`).
7. Couple told on decline / never answered → `lib/supplier-invite-status.ts` `supplierInviteStatus`,
   `lib/supplier-invite-status.server.ts`, the bench card. (A bell needs a `notification_type` value — Step 4.)
8. Claimed couple = a customer → `lib/claimed-couple-is-a-customer.server.ts` `seatClaimedCoupleAsCustomer`,
   called from `finalize/page.tsx`.
9. No tour, no coach mark → none added.

Open with the owner — NOT built, seam left: which "plans"; whether a name match counts after "Not them?" (the
walk keeps no memory of the match); whether couples are told "the supplier skips the booking fee" (no fee words
on any screen).

## 3 · THE TECHNICAL QUESTION — how is "Setnayan showed the couple that shop first" read?

What records it today (read in this checkout; nothing in production was read):

| Signal | Scope | Time | Written by | Wrongly includes | Wrongly misses |
|---|---|---|---|---|---|
| `chat_threads.inquiry_source` in `SOURCED_INQUIRY_SOURCES` | event × shop | `created_at` | `startServiceInquiry` → `stampThreadProvenance` (stamp-once: `.is('inquiry_source', null)`) | a `?src=explore` a supplier puts on their own link; `editorial` / `influencer` | a couple who SAW the shop and never asked |
| `vendor_profile_views` | event × shop only when signed in with an event | `viewed_at` | ONLY `recordVendorProfileView` from the public shop page `app/v/[slug]/page.tsx` | the supplier's own link (`profile_direct`), the owner, bots, a view AFTER the add, the wrong event (primary / soonest) | **every view on the new Suppliers page**: Find rows, "More to compare" and the supplier sheet write nothing |
| `event_vendors` with a `marketplace_vendor_id` | event × shop | `created_at` | `saveVendorToPicks` (`source='host_manual'` — mislabelled), `attachMarketplaceVendorToCategory` (`host_marketplace_search` = the couple typed the name) | a name the couple brought; a link set later by a claim | anything Removed (a hard DELETE) |
| `vendor_follows` | user × shop, no event | `followed_at` | follow gate, inquiry, **and the claim itself** | the follow a claim writes | unfollow deletes it |
| impressions (a shop merely listed) | — | — | nothing | — | everything |

It has no reader for the fee: `booking_fee_attribution_for(vendor, event)` is `EXISTS (a thread whose
inquiry_source is sourced)`, and `booking_fee_open_lock_charge` skips a row with no `marketplace_vendor_id`.

**The narrowest truthful definition I propose** — for event E, shop S, and T = the moment the couple's own
record was created (`event_manual_vendors.created_at`, else the hand row's `event_vendors.created_at`):

> SHOWN FIRST(E, S, T) is true when, before T, EITHER
> (a) a `chat_threads` row for (E, S) exists whose `inquiry_source` is in the sourced set — the couple asked that
>     shop through Setnayan; OR
> (b) a `vendor_profile_views` row exists with `event_id = E`, `vendor_profile_id = S`, `viewed_at < T` and a
>     `source` in the same sourced set — the couple opened that shop from a Setnayan surface.
> Nothing else counts: not a follow (a claim writes one), not an `event_vendors` row (its `source` cannot tell a
> found shop from a named one), not `profile_direct` (the supplier's own link), not a view with no event.

- (a) alone is already honoured after a claim: the thread exists, so the lock attributes `sourced` today.
- (b) is the new read. **It is empty for the new page until one writer is added**: the supplier sheet opened from
  Find / More to compare must record a view (`recordVendorProfileView({ vendorProfileId, eventId, source })`,
  the shipped writer) — otherwise rule B can only ever see asks, never "showed".
- WRONGLY INCLUDES: a couple whose own long-time supplier they also happened to open on Setnayan before typing
  them in (they brought the supplier; Setnayan merely also listed them); a forged `?src=explore`; a co-host's view
  under the same event.
- WRONGLY MISSES: a shop the couple only saw as a card in a list and never opened (no impression is recorded
  anywhere); views while signed out or under another of their events; a view older than a salt rotation is NOT
  affected (the read keys on `event_id`, not `viewer_hash`).
- And it needs S: a hand record is tied to a shop only by the claim (`marketplace_vendor_id`) or by a stamped
  match — which is what `leak_match_vendor_profile_id` is for.

### The migration I propose (NOT written to `supabase/migrations/`; Step 4, on the controller's word)

```sql
-- via `pnpm migration:new` — never a hand-typed prefix.
BEGIN;

-- 1 · The shop a hand-typed record was matched to (name at add time, or the price check).
ALTER TABLE public.event_manual_vendors
  ADD COLUMN IF NOT EXISTS leak_match_vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;
COMMENT ON COLUMN public.event_manual_vendors.leak_match_vendor_profile_id IS
  'The Setnayan shop this hand-typed record matches (name or price within fee_leak_price_tolerance of a quote this event received). NULL = no match. Server-stamped only.';
CREATE INDEX IF NOT EXISTS event_manual_vendors_leak_match_idx
  ON public.event_manual_vendors (leak_match_vendor_profile_id)
  WHERE leak_match_vendor_profile_id IS NOT NULL;

-- RLS unchanged (event_manual_vendors_host_all governs every column). RLS is row-level, never
-- value-level, so the couple could otherwise clear their own flag: the stamp is held by the same
-- shape as guard_thread_provenance_columns (20270820292403).
CREATE OR REPLACE FUNCTION public.guard_manual_vendor_leak_match()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_role TEXT := auth.role();
BEGIN
  IF v_role IS NULL OR v_role = 'service_role' OR public.is_admin() THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN NEW.leak_match_vendor_profile_id := NULL;
  ELSE NEW.leak_match_vendor_profile_id := OLD.leak_match_vendor_profile_id; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS guard_manual_vendor_leak_match ON public.event_manual_vendors;
CREATE TRIGGER guard_manual_vendor_leak_match
  BEFORE INSERT OR UPDATE ON public.event_manual_vendors
  FOR EACH ROW EXECUTE FUNCTION public.guard_manual_vendor_leak_match();

-- 2 · The owner's number, 2026-10-10, verbatim: "10% allowance +-. so if 100,000 that is between 90-110k".
--     A typed column on the singleton, the shape of booking_fee_rate_pct (20271177298989).
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS fee_leak_price_tolerance NUMERIC(5, 2) NOT NULL DEFAULT 10.00
    CHECK (fee_leak_price_tolerance >= 0 AND fee_leak_price_tolerance <= 100);
COMMENT ON COLUMN public.platform_settings.fee_leak_price_tolerance IS
  'Percent either side of a quote within which a hand-typed price counts as the same booking. Owner 2026-10-10: 10.';

COMMIT;
```

Ugat: `event_manual_vendors` gains a link to `vendor_profiles` — a new joint claim on the existing node (or one
reasoned baseline line); both Ugat db-tests re-run in Step 4. Not in the two-column proposal, each needing its
own word: `vendor_invites.opened_at` (so the couple's row can say "opened"/"not opened" — today it cannot);
`ALTER TYPE notification_type ADD VALUE 'vendor_invite_declined'` (a bell + email for ruling 7); widening
`chat_threads_inquiry_source_check` with `invite_claim` (it is not a legal value today, which is why it is never
written); the rule-B branch inside `booking_fee_attribution_for` and its TS mirror.

## 4 · Order, as built

- STEP 1 (couple): `lib/add-your-own.ts` · `lib/supplier-invite-status.ts` (+ `.server.ts`) ·
  `add-your-own-walk.tsx` · `supplier-connect-panel.tsx` · `new-manual-vendor-modal.tsx` · `find-thumb-row.tsx` ·
  `shortlist-categories.tsx` · `vendors/page.tsx` (3 hunks) · `vendors/actions.ts` (`createManualVendor`, 1 hunk)
  · the lab.
- STEP 2 (link + supplier): `lib/vendor-invites.ts` · `lib/claim-invite-words.ts` · the claim page ·
  `lib/claimed-couple-is-a-customer.server.ts` · `finalize/page.tsx` · `lib/vendor-inquiry-dates.ts` ·
  `customers/page.tsx` · `lib/price-waits.ts` · `canvas-maker.tsx`.
- STEP 3: stop and report. `lib/booking-fee-gate.ts`, its SQL mirror, `collectBookingFeeAtLock` and
  `supabase/migrations/` are untouched.

## 5 · The two claim-link notices (controller, mid-task) — where each stands

**(1) The supplier declines the couple's link — STOPPED: it needs a new notification type.**
`declineVendorInviteByToken` (`lib/vendor-invite-actions.ts`) emits nothing. No existing type truly fits:
`inquiry_declined` is labelled "Inquiry declined" and the couple made no inquiry; `vendor_joined` is the opposite;
`guest_claim_rejected` is a guest's. `notification_type` is a Postgres enum, and a TS-only member "typechecks and
then the INSERT is refused in silence" (the file's own warning), so nothing was emitted. The SQL, in the shape of
`20271262858364_notification_type_schedule_change_requested.sql` (via `pnpm migration:new`):

```sql
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'vendor_invite_declined';
```

Then, in one commit with it: the union member + label ("Link declined") + tone in `lib/notifications.ts`; the type on
`EMAIL_ENABLED_TYPES` if it should reach the couple away from the app; and the emit in
`declineVendorInviteByToken` — to every `event_members` row with `member_type = 'couple'` of the invite's event
(`vendor_invites.vendor_id → event_vendors.event_id`), `eventId` passed, `relatedUrl = /dashboard/<event>/vendors`,
only when the UPDATE really changed a pending row (ask for the row back; a zero-row update must not notify).
Words — NOT in the prototype (E7 only asks "should the couple be told?"), so they are proposals, not built:
title "<Supplier> said they are not this supplier" · body "Your link is closed. Their record is still yours."
Until then the couple IS told on the row (`supplierInviteStatus` → "They said they are not this supplier · your
link is closed"), which is read every time the page opens.

**(2) The supplier claims the link but adds no service — NOT EMITTED: the prototype is not silent, it says "not yet".**
Prototype, E3: `e_draft` → "Saved as a draft — the couple is not told yet"; `e_publish` → "Published · linked to
Ana & Paolo's wedding · they are told you joined"; the bell (`e.bell`) is set only at publish; E5 before publish:
"Not yet. The supplier has not published." So what ships (`registerClaimedServiceToCouple` → `vendor_joined`,
"Your supplier joined Setnayan · A supplier you added has linked their service to your plan.") IS the drawn moment.
The type would fit an earlier notice too (`lib/notifications.ts`: "vendor_joined → couple: an invited vendor claimed
their profile"), so the options are:
  a. as drawn and as shipped — nothing at the claim; the bell at the first saved card. A supplier who joins and
     never puts a card up is then never announced (the row still reads "Joined through your link · their card is
     not up yet").
  b. `vendor_joined` at the claim with the shipped title alone ("Your supplier joined Setnayan", no body), and the
     shipped notice again at the first card — two notices for one supplier.
  c. `vendor_joined` at the claim only, with a new body — words nobody has approved.
Built: (a). No new emit.

Notices this branch emits: **none new.** It relies on one shipped emit — `vendor_joined` → every couple
member of the event, from `registerClaimedServiceToCouple` — which now passes `eventId` explicitly (it was
derived from the URL by `eventIdFromRelatedUrl`). Nothing else about it changed.
