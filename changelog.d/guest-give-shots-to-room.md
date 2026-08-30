## 2026-08-31 · feat(papic): a guest who kept shots can give the unused ones to the room

S5 of the shots-per-guest stream (`WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md`), spec § 7b.

**RULE 0 first: the purchase-time half of § 7b already shipped**, on 2026-08-02 (PR #4054/#4057) —
`papic-buy-shell.tsx` already offers "This camera only" (keep) beside "Everyone's pool" (give) on
both live guest capture surfaces, and `NEXT_PUBLIC_PAPIC_GUEST_BUY` is ON in production
(`build-sessions/P0-b-SWITCHES.md`). Not rebuilt.

**What was missing, and is now built:** a guest who chose "keep them for me" had no way to change
her mind and give the *unspent* part back to the shared pool. One button, no amount to type — the
target is always her own spend-to-date (`resolveGuestRelease` in `lib/papic-guest-buy.ts`), so what
she has already shot stays hers and everything else moves, per the owner's own words ("both. they
can claim it all or share it to everybody"). Built entirely on the shipped `papic_dedicate_shots`
primitive (target-not-delta) — no new schema, no migration. Two-step confirm states plainly, before
she commits, that this cannot be undone and that anything already shot can never come back (spec
§ 7b's own line).

New: `releaseGuestDedicatedShots` server action (`app/papic/buy/actions.ts`), `ReleaseSection` UI
(`app/papic/_components/papic-buy-shell.tsx`), `resolveSeatDedicatedStanding` read
(`lib/papic-guest-own-camera.ts`), `dedicatedShotsStanding`/`resolveGuestRelease` pure helpers
(`lib/papic-guest-buy.ts`, 7 new unit tests, all mutation-verified).

**Known follow-up, deliberately not fixed here:** tracing S2's applied `papic_guest_spend_ceiling` /
`papic_record_guest_capture` gate found that a NAMED guest's self-funded ("kept") captures are not
exempted from the couple's ceiling on her — contradicting the owner's "her money, outside the
couple's limit" ruling for that one case. Inert today (0 named guests, ceiling off on all prod
events) but live the moment one couple names a guest who has also bought. Flagged to the S2/S3/S4
oversight thread; deliberately not touched here — it is a gate-function contract question, not a
buy-panel one.

SPEC IMPACT: None — implements an already-decided owner ruling (2026-08-28 § 7b), no new decision.
