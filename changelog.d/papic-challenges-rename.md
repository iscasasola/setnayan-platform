## 2026-07-23 · copy(papic): rename "Photo Challenge(s)" → "Papic Challenges" in all user-facing strings

Owner decision 2026-07-23 (corpus DECISION_LOG row of that date): challenges accept
clips as well as photos — completions attach `papic_guest_captures.capture_id`,
which is photo OR clip — so the user-facing feature name must not say photo-only.

Display strings only: guest capture panel header + aria, couple challenges manager
+ vendor-approval queue, vendor sponsor/buy/deny/order copy, challenge-photos
subpage, guest landing games copy, notification labels/titles, vendor benefits doc,
and the `vendor_billing_catalog` display title via migration
`20270916100000_papic_challenges_display_name.sql`. Internal identifiers are
deliberately unchanged (`vendor_photo_challenge` sku_code, `papic_missions`,
`papic_photo_challenge_sponsorships`, `NEXT_PUBLIC_PAPIC_GAMES_V1`, file names).

SPEC IMPACT: corpus DECISION_LOG 2026-07-23 row already records the decision; the
5-tab guest-site prototype v3.4 already carries the new name.
