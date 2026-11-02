## 2026-08-11 · fix(vendors): one definition of "this shop is live" — the invite QR was dead for every vendor

**A vendor's invite QR sent every couple to a 404, including the owner's own approved
shop.** There were two definitions of "this shop is live", and the one seven code paths
read was dead.

- `public_visibility = 'verified' AND verification_state = 'verified'` — what
  `/admin/verify` writes, what `/explore` filters on, and what the database's own
  `vendor_profiles_public_read` policy enforces (`20271013500000`).
- `is_published = TRUE` — a legacy column whose **only** writer in the whole app is a
  tick-box on `/admin/vendors/[id]/edit`. Approving a shop never sets it. Measured
  2026-08-11 against prod: the owner's fully-verified shop sits at `is_published = false`.

`lib/vendor-visibility.ts` has described that column as superseded since 2026-05-15. The
readers were never migrated. **Seven of them, none erroring:**

1. `app/vendor-invite/[slug]/page.tsx` — `notFound()` for every vendor alive. This is the
   whole "vendors import their customers" on-ramp.
2. the same invite's claim action — the identical refusal one step later.
3. the couple's add-a-vendor-by-name search — found nothing, ever. It also still filtered
   on `coming_soon`, **retired 2026-07-27 for exposing unapproved shops' name, contact
   email and phone to anyone holding the anon key**; that value is now gone from the query.
4. `lib/ghost-listing-detector.ts` — scanned an EMPTY set and reported `0 scanned`.
5. `lib/fraud-detection-runner.ts` — the same empty set.
6. `lib/admin/growth-stats.ts` — "vendors published" pinned at 0 on the growth dashboard.
7. `app/admin/accounts/_surfaces/vendors-surface.tsx` — Published tab permanently empty,
   Draft tab = every shop, and the "Published" badge never rendered on any row.

🔑 **NONE OF THE SEVEN THREW.** A dead gate and a genuinely empty result are the same
value. Same family as the phantom column, the phantom enum value, the phantom RPC
argument and the blocked iframe: the read is refused or matches nothing, and the only
symptom is an absence.

🔑 **It is the 2026-08-09 outage again in a different place** — there, two definitions of
"is a vendor" pointed the two dashboards at each other; here, two definitions of "this
shop is live" pointed a vendor's own customers at a not-found page.

**The fix is one predicate, mirroring the RLS rather than restating it:** `isShopLive()` +
`SHOP_LIVE_COLUMNS` in `lib/vendor-visibility.ts`. **Nothing was loosened** — an unapproved
shop still 404s on the invite, exactly as on its public shop page, because that screen
publishes a business name, logo, tagline and services to anyone holding the slug. Only
*which* definition of approved is asked has changed.

🛡 **`lib/one-definition-of-live.test.ts`, five tests, all three mutations verified applied
before trusting the red:**
- reintroducing `is_published` as a gate → **2 tests fail**
- deleting the gate outright (the cheap way to pass a scan) → **1 test fails**
- selecting only *half* the definition → **1 test fails**. That last one matters:
  `isShopLive` fails closed on an absent column, so a `.select()` that forgot one turns a
  live shop into a silent 404 — the original bug in a new hat. The required column list is
  **derived from `SHOP_LIVE_COLUMNS`**, never re-typed.
- The detector is a pure function with a known-bad/known-good battery (13 hazard
  spellings incl. quoted keys, shorthand, `?.`, and every PostgREST filter operator; 4
  safe spellings that must NOT trip it, because a guard that cries wolf gets skimmed past).
  Comment-stripping goes through `lib/strip-comments.ts` — the sibling guard shipped broken
  once by inlining a regex.

⚠ **Named debt, not an oversight:** the admin publish tick-box still writes a column
nothing reads. It is pinned in place by `vendor-publish-guard.test.ts`, so retiring it is a
separate decision. `app/admin/integrity-watch/actions.ts` still writes it as a
belt-and-braces half of a takedown — allowlisted with that reason.

SPEC IMPACT: `DECISION_LOG.md` — records the two-definitions defect, the ruling that
approval is the single definition, and that the invite gate stays closed to unapproved shops.
