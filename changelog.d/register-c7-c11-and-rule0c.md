## 2026-08-30 · docs(register): re-apply forward what the PR race stranded

Two PRs edited this register from divergent bases; both were armed, so CI order
decided it and the one carrying the superseded content won. This re-applies the
substance FORWARD onto main rather than resolving an eleven-file conflict
backward.

- `C7.md` no longer forbids per-guest photo limits. They ship, PR #5024 landed
  the promotion-page claim, and P0-b measured `NEXT_PUBLIC_PAPIC_GUEST_BUY=true`
  in Vercel Production — so the prompt was telling an unrun session that a live,
  sold feature did not exist.
- `C11.md` prices the Setnayan AI comeback offer as the exact midpoint of retail
  and sign-up rather than a percentage. Charm endings make the implied discounts
  40.02–40.20, so half is 20.01–20.10 and a hard-coded 20 is wrong per tier
  before any reprice. Half the saving is a whole peso in every tier, so the
  midpoint needs no rounding at all: ₱1,999 · ₱1,199 · ₱719 · ₱159.
- Rule 0c gains an elapsed-time detector: `DB_EXIT=127 elapsed=0s` meant
  `timeout` is absent on macOS and the command never ran. Duration beside exit
  status separates "did not run" from "ran and failed"; no exit code can.
- New sections on identifying the session that owns a worktree, and on why two
  armed PRs on one file resolve in CI order rather than an order anybody chose.

SPEC IMPACT: None. Documents only.
