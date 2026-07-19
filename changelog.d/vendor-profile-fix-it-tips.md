## 2026-07-01 · feat(vendor-dashboard): profile score → Fix-It Tips (Wave 1 · spec B)

New pure builder `lib/vendor-profile-tips.ts` (`buildProfileTips`) turns the
`vendor_activity_stats` component metrics into a **ranked, deterministic
checklist** — the top drags on the quality score, each with a concrete
current→target and an inquiry-lift reason (no ML). Replaced the old 3-condition
inline `nudges` in `vendor-stats-panel.tsx` with a "Fix-it tips" card that hides
when the score is already strong. Unit-tested (`lib/vendor-profile-tips.test.ts`).

Flipped `Profile Score & Fix-It Tips` `soon`→live in the homepage vendor-benefits
overlay (Data lens), and re-landed the stranded "Pay Only For Inquiries That Fit"
token-clear. Overlay/banner now read 40 live / 20 soon.

SPEC IMPACT: clears the `Profile Score & Fix-It Tips` SOON in
VENDOR_TIERS_AND_BENEFITS.md §6/§9 (updated in this PR). §6 stays the SSOT.
