## 2026-06-30 · fix(home/vendors): clear stale "Soon" tags on the For-vendors overlay after a shipped-state audit

The "For vendors" overlay (homepage ELN reskin) marked nearly every benefit
"Soon" by a 2026-06-29 keep-it-safe default. A 4-pass code audit of
`app/vendor-dashboard/*`, `app/v/[slug]`, `app/explore`, and `lib/*` confirmed
many are now genuinely live end-to-end, so their tags were cleared in
`app/_components/home/vendor-benefits.ts`. A tag clears only when the feature has
a real couple-visible/vendor-usable surface wired to actions + DB — not when only
infrastructure exists.

Cleared "Soon" (now live): Faith & region matchmaking (faith filter live),
Lead capture + matchmaking, Shortlist radar, First-look window, Booked-out
waitlist, Ultimate team calendar, Double-booking guard, Set your price once,
GCash/bank payouts, PH-style milestone tracking, Payday calendar, Receipt-backed
reviews, Right-of-reply on reviews, Search-ready microsite, Off-season promos,
Category benchmarks, Price-position meter, Demand radar, Quote-to-booking funnel,
Team sub-accounts.

Kept "Soon" with documented reasons (partial / manual-only / pilot-inert / empty
pre-launch / not built): token-burn "leads that fit" + peso-per-lead (burn is
economically inert in pilot), RA 8792 e-contracts (upload-only, no e-sign),
automated-bookings pipeline, headcount auto-requote, date-open ranking, style-twin
/ real-stories / journal spotlights / spotlight awards (empty pre-launch or generic
backlinks), social auto-share (FB/IG couple-only, no TikTok), one-profile-every-
event (reviews not pooled), no-show protection, change-order trail, day-of run-of-
show, reverse-image watch, profile score, won/lost reasons, resell Productions
(recommend-only), white-label, crew-rate (Manpower half only), certified-partner
(not couple-facing), no-pay-to-rank + dispute mediation (manual flag→HQ only).

Flagged for owner: a vendor "direct invite QR" does NOT exist, and customer
import is token-gated (1 token, thin calendar block) — NOT a free CRM import; both
were intentionally NOT added to the overlay rather than ship an unbacked claim.

SPEC IMPACT: None (marketing copy honesty fix; underlying SKUs/specs unchanged).
The shipped-state audit may inform a refresh of `App_Build_Status.md` vendor rows
separately.
