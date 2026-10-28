# HANDOVER — supplier sign-up rebuilt inside the app (STOPPED 2026-10-29, WIP)

Controller stopped this build: for now the owner will create suppliers' shops by hand. Branch
`claude/supplier-signup-in-app` (from origin/main `cd137db2ee`). **No PR was opened. Nothing was merged or deployed.**

## Rule 0 — what exists

- **The sign-up flow is `/open-shop`.** Before this branch, `app/open-shop/page.tsx` drew `OpenShopWizard`
  (`app/open-shop/_components/open-shop-wizard.tsx`, about 950 lines) as a bordered card centred on a blank page. It sat
  outside `(shell)` and outside `NAV_ROUTES`. That card is the "old website" the owner pointed at.
  - It has 4 steps on ONE always-mounted form: **1** logo (optional) · shop name · permanent web address (`AddressPreview`) ·
    **2** "Primary service*" (single `ServicePicker`, a parent → branch → leaf drill) · events you serve (multi) · in
    business since (PickMenu, optional) · **3** your name (from the account) · position · phone (PH) · company email ·
    password (signed-out only, the account is created here) · Google/Apple · **4** map pin (`CityPin`, required and
    confirmed) · Terms checkbox (signed-out only) · booking-fee disclosure.
  - The server action is `becomeVendor` in `app/open-shop/actions.ts`. It writes `vendor_profiles` with:
    - `services = [coarse, leaf, …existing]` (index 0 is read as "primary")
    - `event_types`, `business_name`, `business_slug`, `business_owner_name`/`_position`, `contact_phone`/`_email`,
      `logo_url`, `location_city`, `hq_*`, `in_business_since_year`
    - a `vendor_team_members` admin seat, `users.account_type='vendor'` and `display_name`, and `ensureBusinessAlaga`
    - It then redirects to `/vendor-dashboard` (Today).
  - A draft is kept in sessionStorage for 1 hour (`lib/open-shop-draft.ts`). It is written for the OAuth round trip and
    at submit, and it never holds the password.
- **Every entry CTA goes to `/open-shop`.** That includes `/for-suppliers`, the front door, the account switcher's
  "Create your shop" and explore. `/signup?as=vendor` lands on it too. `/for-suppliers` is a marketing page on the glass
  nav; it is the other half of the "old website" in the 28 Oct ruling.
- **The shipped table for a shop's services is `vendor_coverages`.** It holds one row per taxonomy leaf with
  `event_types` and `faiths`, under UNIQUE (vendor_profile_id, canonical_service).
  - The only writer is `insertCoverage` in `lib/vendor-coverage-write.ts`. It is followed by `syncProfileFromCoverages`,
    which sets `vendor_profiles.services = preserved coarse + covered leaves` and sets `event_types` to the union.
  - **`/open-shop` never writes `vendor_coverages` today.** The multi-pick editor already exists at
    `/vendor-dashboard/services` (`coverage-panel.tsx`, `createCoverage`).
- **Taxonomy (one source).** `getOpenShopServiceTree()` in `lib/open-shop-service-tree.ts` is built on
  `getCoverageTaxonomy()` (Admin › Categories). It strips `setnayan_*` first-party leaves, which would make a shop
  invisible on /explore. `resolvePickedLeaf` re-resolves posted keys on the server.
- **Plan cap.** Free and Verified allow `parentCategories: 1` (`lib/vendor-tier-caps.ts`). The maker's
  `addCoverageForCard` enforces it; the Services page's `createCoverage` does NOT. **Open owner question:** should the
  sign-up checklist be capped to one group on Free? The owner said "they check all the list of services they provide".
- **The landing already exists.** Today's "Get your shop live" has six folds (PR #7026, merged):
  `app/vendor-dashboard/_components/supplier-setup-{screen,folds}.tsx` and `lib/supplier-setup.ts`.
  - Name · Your details (services, venue size, map pin, phone/email) · logo · What you offer (Good·Better·Best,
    3 cards per service) · documents · QR + days off.
  - ⚠ **Pre-existing bug:** `offerProgress(profile.services, cards)` counts the COARSE keys in `services` as separate
    services that need 3 cards each. Every `/open-shop` shop already has `[coarse, leaf]`. Fix: drop coarse keys when
    a leaf is present. Multi-pick would make it worse.
- **Prototype.** claude.ai/artifact/5p6LmsozB7acH91b3oZJWb ("New shop" = the six Today steps). There is no separate
  sign-up screen in it.
- **Decisions in `DECISION_LOG.md` (corpus origin/main):**
  - 2026-10-28 "NO PRIMARY SERVICE … MULTIPLE PICK; THE OLD SUPPLIER ENTRY IS AN OLD-WEBSITE SHELL". The controller's
    recommendation, still marked *owner to confirm*: retire /for-suppliers, and ask only shop name + services checklist
    before sign-up, then let Today ask the rest. Derive any single "primary" from the first ticked service.
  - 2026-10-29 "FIVE OPEN CALLS ANSWERED" (1): "inside the app".
  - The close/open and delete-shop rows of 2026-10-29 are not touched by sign-up.

## What this branch built (slice S1 only, not finished)

- `app/open-shop/page.tsx` moved to **`app/(shell)/open-shop/page.tsx`**, so it now wears the shared `AppRailShell`
  (the same shell as `/start`). `actions.ts` and `_components` stay in `app/open-shop/`.
- **The wizard frame is redrawn:**
  - no bordered card and no `FirstRunBrand` (the shell's top bar already shows the wordmark)
  - the step name is the `<h1>`
  - on a laptop, a 4-step list on the left (passed steps can be pressed)
  - Back/Continue sit in a frosted bar pinned to the bottom (thumb zone)
  - the fee notice moved above the button and lost its frame
- **Resume where you left off:** every step change parks the draft (`saveDraft({ step })`), and a step draft is no
  longer deleted when it is restored.
- New guard `app/open-shop/lives-in-the-app-shell.test.ts` covers 4 properties. Each was sabotaged once and went RED,
  then was restored.
- Guards updated for the path move:
  - `lib/first-run-screens-carry-the-brand.test.ts`: open-shop must now NOT draw a second wordmark
  - `four-steps`, `a-new-shop-lands-on-today`, `vendor-servable-event-types`, `the-active-shop-is-resolved-once`
  - `scripts/lint-stored-asset-refs.mjs`
- `port-control-baseline.json` and `lib/ugat/screens.generated.json` were regenerated, not hand-edited.
- What was run: `app/open-shop/*.test.ts` plus the brand guard, 44 pass. Not run: `pnpm lint`, the other
  `lint-*.mjs` scripts, tsc. Not walked in a browser.

## Not done (if resumed)

- **S2:**
  - Replace `ServicePicker` with a multi-pick checklist from `serviceTree`, grouped by Group (Fold) › Category, with
    search, posting `name="services"` many times.
  - In `becomeVendor`, read `getAll('services')`, resolve against ONE tree fetch, and set
    `patch.services = coarse in tick order`. Then insert `vendor_coverages` rows (upsert, ignoreDuplicates) with event
    types narrowed by `leaf.allowedEventTypes`, then call `syncProfileFromCoverages` once.
  - Change `OPEN_SHOP_ERRORS.service` to "Tick at least one service", and move the draft from `service` to `services[]`.
  - Do not use the hard-coded `SERVICE_GROUPS` fallback: show "couldn't load" and a retry instead.
- **S3/S4:**
  - Fix `offerProgress` (coarse keys, see above).
  - Changelog fragment and a DECISION_LOG "as built" row.
  - Walk at 390 WebKit and 1280 Chromium, light and dark.
  - Owner calls still open: confirm "name + services only, then Today" versus keeping all 4 steps; retiring
    /for-suppliers; the Free one-group cap.
