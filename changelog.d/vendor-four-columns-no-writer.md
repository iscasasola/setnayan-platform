# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-08-09 · feat(vendor): four settings a shop could be judged on but never set

`tagline`, `website`, `same_day_available` and `social_feature_opt_out` all had live readers and no writer a real vendor could reach. Their only writer was `saveVendorProfile`, whose form (`/vendor-dashboard/profile`) was retired **2026-07-05** and replaced by a redirect stub; the action has had no caller since. For the month that followed:

- **`same_day_available`** was FALSE on every row, so the couple's Day-of "Get help" shortlist (`lib/same-day-vendors.ts`, filtering `.eq('same_day_available', true)`) **could never match a single vendor**. The card shipped, and there was nobody to put in it.
- **`social_feature_opt_out`** was FALSE on every row, so every verified shop was eligible for a celebration post on Setnayan's Facebook/Instagram (`lib/social/flush.ts#sweepVendorFeatures`) and **no shop could decline**. The column's own comment still advertised the control — *"Self-serve on /vendor-dashboard/profile"* — pointing at the redirect stub.
- **`website`** had no writer at all, while two public v1 API routes and `lib/vendor-deep-search-run.ts` kept reading it.
- **`tagline`** kept a partial writer in `saveUnclaimedVendorProfile`, but it is gated `.is('user_id', null)` — it writes SEEDED rows only. A vendor who claimed their shop was stuck with the line an admin typed for them.

This is the **fifth** instance of the reader-with-no-writer shape the codebase tracks (see the header of `apps/web/lib/vendor-compatibility.ts` for the prior four).

**Owner decision 2026-08-09 · social consent.** The opt-out was surfaced rather than decided in code, because shipping a consent-shaped column with no control is itself the bug. Owner chose to **keep the opt-OUT default** (featured unless the vendor declines) and ship the missing checkbox, rather than inverting to opt-in — a business promotion post is not the personal-data case that made `users.public_greeting_opt_in` default FALSE in the same migration.

### What was added

- **`apps/web/lib/vendor-public-line.ts`** (new): the parse rules for the two free-text columns. `parseTagline` collapses whitespace to one line and truncates at `TAGLINE_MAX` (120) rather than rejecting. `parseWebsiteUrl` normalizes a bare `yourstudio.com` to an absolute `https://` URL and **refuses an explicit non-http(s) scheme instead of coercing it** — the retired form stored `website` with `nullIfBlank` and no parse at all, so `javascript:…` was a storable value in a column two public API routes hand to callers who will linkify it.
- **`apps/web/app/vendor-dashboard/shop/public-line-actions.ts`** (new) + **`_components/public-line-card.tsx`** (new): "Your line and your link" — writes `tagline` + `website`.
- **`apps/web/app/vendor-dashboard/shop/visibility-actions.ts`** (new) + **`_components/visibility-card.tsx`** (new): "Where else you show up" — writes `same_day_available` + `social_feature_opt_out`.
- **`apps/web/app/vendor-dashboard/shop/page.tsx`**: renders both cards in the Business Profile panel; reads the two booleans and `social_featured_at` via a **separate** soft-probe rather than adding columns to `FULL_VENDOR_PROFILE_SELECT` (a lagging column there fails the whole projection and silently drops the page to the LEGACY select).
- **`apps/web/lib/vendor-public-line.test.ts`** (new, 19 tests): the parse rules, plus source-text guards that the writers exist **and are reachable** — a writer in an action nobody calls is how these four spent a month looking writable.

### Why dedicated cards and not `INLINE_PROFILE_FIELDS`

`updateVendorProfileField` refuses every field outside `GALLERY_MEDIA_FIELDS` once a shop is verified. Both booleans **only act on a verified shop** (`findSameDayVendors` and the social sweep each filter `verification_state='verified'`), so routing them through the identity editor would have made them settable by exactly the vendors they can never apply to, and unsettable by exactly the vendors they exist for. A tagline change would likewise have become an admin correction ticket. `20270503892144_vendor_correction_requests.sql` names the split directly: *"Non-identity writes (is_published, tagline, portfolio, opt-outs, compatibility arrays) stay vendor-editable."* The precedent followed is `updateVenueMatching` / `updateServiceRadius`. Neither card is a checklist item, for the reason venue matching isn't: a new row would drop every already-published shop below 100% and re-open the verify teaser on shops that finished months ago.

### The absent-means-false hazard, handled two different ways

No full-payload action was reintroduced. The existing guard on that shape is `lib/vendor-compatibility.test.ts` → *"saveVendorProfile only writes compatibility when the form declared it asked"*; these four carry the identical hazard, and the new tests mirror its discipline — including its recorded lesson that a guard test must match the **guard statement**, not the bare marker name, or the explanatory comment above the guard satisfies the assertion all by itself.

- The **text** fields use `formData.has()` per key — sound *only* because a rendered text input always posts, so "present and empty" (clear it) and "never rendered" (leave it alone) are genuinely distinguishable.
- The **checkboxes** cannot use that test: an unticked box posts nothing, so `=== 'on'` reads identically for "the vendor unticked it" and "the form never asked". They are gated on an explicit hidden `visibility_fields_present` marker, checked before the write — same shape as `compatible_fields_present` in `saveVendorProfile`. Without it, any future caller posting an unrelated FormData would silently re-enable social posting for a vendor who had opted out, with a save that reported success.

### Measured against prod, not inferred (2026-08-09)

Both live shops in `setnayan-prod`, at the time of this change:

| | SetnaProd | Saysay Live Band & Hosting (FIXTURE) |
|---|---|---|
| `verification_state` | verified | verified |
| `tier_state` | free | solo |
| claimed (`user_id` set) | yes | yes |
| `same_day_available` | false | false |
| `social_feature_opt_out` | false | false |
| `social_featured_at` | **set — already posted** | null |
| `tagline` / `website` | null / null | null / null |

Four things this pins down that reading the code could only suggest:

1. **The consent gap is not hypothetical — it already fired.** `SetnaProd` was posted to Setnayan's public Facebook/Instagram while `social_feature_opt_out` was FALSE and no control existed to change it. The new card's `alreadyFeatured` copy path exists for exactly this row, and says plainly that ticking the box now stops future features but cannot recall the post that went out.
2. **The verified lock would have hit 100% of live vendors.** Both shops are `verified`, so had these four been added to `INLINE_PROFILE_FIELDS`, *every* shop on the platform would have been shown a control it could not use.
3. **`tagline` was unwritable for every live shop.** Both are claimed (`user_id` non-null), and the only surviving writer, `saveUnclaimedVendorProfile`, is gated `.is('user_id', null)`. Neither row was reachable by it.
4. **The Day-of shortlist goes from zero possible matches to one eligible vendor.** `findSameDayVendors` needs verified + non-free; only Saysay (solo) qualifies. SetnaProd is free-tier, so ticking the box will correctly still not surface it.

### Also corrected

`changelog.d/open-shop-onboarding-logo-email.md` claimed *"Website + social remain fully editable in the dashboard: `website` at `vendor-dashboard/profile/page.tsx` (Website field → `saveVendorProfile`)"*. That entry is dated **2026-07-05** — the same day the route was retired, so the claim was false when written. Onboarding dropped its website field on the strength of a dashboard editor that was being removed in the same breath. Struck, with a dated correction note.

### Not changed

`saveVendorProfile` itself is left in place, still orphaned. Removing it is a separate change with its own blast radius (`admin/verify/actions.ts` and two components still reference its behavior in comments), and this PR deliberately does not mix a deletion into a gap-fix.

SPEC IMPACT: The social-feature opt-out is a consent control under the hybrid-anonymity doctrine and its column comment is now wrong — it points vendors at `/vendor-dashboard/profile`, retired 2026-07-05. Record in `~/Documents/Claude/Projects/Setnayan/DECISION_LOG.md`: (1) the 2026-08-09 owner decision to keep the vendor social feature **opt-out** (not opt-in), with the reasoning that a business promotion post differs from the personal-data case governing `users.public_greeting_opt_in`; (2) the control's new home is My Shop → Business Profile → "Where else you show up", not `/vendor-dashboard/profile`. A follow-up migration should update the `COMMENT ON COLUMN public.vendor_profiles.social_feature_opt_out` text to match — not done here, because a comment-only migration in a PR that ships UI is the kind of unrelated schema churn the Ugat map tests exist to keep honest.
