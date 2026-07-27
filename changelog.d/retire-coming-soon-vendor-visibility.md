## 2026-07-27 · fix(vendors): retire `coming_soon` — and close the anon-readable hole it left in `vendor_profiles`

Owner ruling, verbatim: *"no. we only show shops that are ready."* then *"demote. remove coming soon entirely."* This supersedes iteration 0006 **Decision 6 (2026-05-15)**, which introduced `coming_soon` precisely so a named-but-unverified shop **would** appear in the marketplace ("listed but not bookable"). That intent is now rejected.

**THIS IS A PRIVACY FIX, NOT A TIDY-UP.** `/explore` has always *also* filtered `verification_state = 'verified'` in the application query, so an unapproved shop never rendered in the UI. But `vendor_profiles_public_read` — the RLS policy, i.e. the **actual** security boundary — admitted both `coming_soon` and `verified` and never looked at `verification_state` at all. The app filter was cosmetic; the row was not protected. Verified against production with nothing but the publishable anon key:

```
GET /rest/v1/vendor_profiles?select=business_name,contact_email,contact_phone
→ [{"business_name":"SetnaProd","contact_email":"…","contact_phone":"+639…",
    "public_visibility":"coming_soon","verification_state":"unverified"}]
```

An unapproved vendor's **business name, contact email and phone number** were readable by anyone holding a key that ships in the browser bundle. The UI looking correct is exactly why this went unnoticed.

**Migration `20271013500000`** — (1) `vendor_profiles_public_read` narrowed to `public_visibility = 'verified' AND verification_state = 'verified'`, so the RLS boundary *agrees with* the /explore query instead of trailing it and no single mis-set column can expose a shop; (2) column **DEFAULT `coming_soon` → `hidden`** — this mattered, because a bare `INSERT INTO vendor_profiles (user_id)` is exactly what the signup trigger and `/open-shop` both do, so every new shop was born publicly-readable before the vendor typed anything; (3) existing `coming_soon` rows migrated to `hidden`.

**Every writer now lands on `hidden`:** reject (`admin/verify/actions.ts` — both `reject_to` branches collapse; the non-hidden branch used to demote to a *public* state), fraud un-freeze and dismiss-with-un-suspend (`admin/fraud/actions.ts` ×2 — clearing a suspension must never silently relist), and admin-staged unclaimed vendors (`admin/vendors/actions.ts` — a vendor who had not even claimed their account had their name and email exposed).

**Every reader now admits `verified` only:** `PUBLIC_SURFACE_VISIBILITIES` is `['verified']`, `/explore`, `/explore/compare` (anonymously reachable — it must not be looser than /explore), and all three `vendor-counts.ts` queries. `parseVisibility` **fails closed** to `hidden`; its old fallback was `coming_soon`, so a null, legacy or garbled column silently produced a *public* vendor.

**UI:** the "Coming soon" pill and dashed-card treatment are gone from the vendor card and folder list; tile counts and CTA copy drop the now-always-zero coming-soon branch (it would have rendered "Preview 0 coming-soon vendors"); the admin queue's default tab is now **Not listed** and `coming_soon` survives only inside **All**, so historical rows stay findable. ⚠ Untouched on purpose: `coming_soon` is *also* an unrelated value on the SKU catalog `status`, the faith launch-gate, and the event wall mode — none of which are vendor visibility.

**New guard `lib/vendor-visibility.test.ts` (7 cases)** pins the boundary rather than trusting review: only `verified` may be public, `coming_soon` is not public/bookable/assignable, listed and bookable are now co-extensive (the gap existed only to serve `coming_soon`), and `parseVisibility` never resolves junk to an exposed state.

**Not done, deliberately:** `coming_soon` is **not** dropped from the `vendor_public_visibility` ENUM. PostgreSQL cannot remove an enum value in place — it needs a replacement type and re-pointing every dependent object, here the `vendor_market_stats` VIEW (the marketplace's primary read path), the policy, and the visibility index. That is a risky sequence whose only remaining benefit, once nothing can write the value and no reader treats it as public, is cosmetic. Left as an inert historical label; say the word and it can be done as its own migration.

Verified: full unit suite **4,417** green · typecheck clean · lint clean on all 13 touched files. ⚠ Production build not run locally — it is SIGTERM-killed on this machine (7 GB requested heap vs ~2.5 GB free; a control build of unmodified `main` fails identically), so that check rests on CI.

SPEC IMPACT: Supersedes iteration 0006 Decision 6 (`coming_soon` = listed-but-not-bookable). Logged in corpus `DECISION_LOG.md` 2026-07-27.
