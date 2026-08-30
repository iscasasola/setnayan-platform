## 2026-08-30 · feat(papic): the guest sees their real number, and an honest "no"

Session **S4** of the shots-per-guest program (spec § 6b,
`WHATS_NEXT_Shots_Per_Guest_2026-08-28.md`; session register
`WHATS_NEXT_Shots_Per_Guest_SESSIONS_2026-08-28.md`). S1 merged as #5002.

- `fetchGuestQuota` (the ONE place both the Event Hub inline camera and the
  standalone guest-camera page resolve their allowance) now folds in the
  couple's own per-guest ceiling (`papic_guest_spend_ceiling`, S2, migration
  20271184624871): `total`/`remaining`/`unlimited`/`capApplies` report whichever
  number actually binds — the couple's ceiling when they've set one, else the
  platform's flat 150 — never a stale, always-150 display once the couple has
  put a real number on a guest.
- **The ceiling always overrides the yield**, even for a guest under an active
  "Unlock all of Papic" pass or a shared pot — mirrored via a new
  `papicGuestCapAppliesWithCeiling` (`lib/papic-guest-cap.ts`, import-free by
  the same discipline as its sibling, so the rule stays independently
  testable): a bought pass is not permission to walk through a limit the
  couple set on one guest.
- **The low state** the guest camera never had: a "Running low — N left" pill
  once usage crosses the same soft-stop line the shared pool already warns at
  (`DEFAULT_EVENT_POOL_CONFIG.softStopPct`) — no new threshold invented.
- The exhausted congratulation ("That's all N photos, {guestName}!") keeps its
  exact existing copy, but `N` is now whichever number actually bound — honest
  for a named guest with a 14-shot allotment, not just for the flat 150.
- Documented the offline-drain caveat inline: a queued shot re-spends against
  the ceiling minutes after this counter last moved (drain classification is
  S2's, § 7d) — the counter is advisory, `papic_record_guest_capture` is the
  truth.

- Added the one honest-remedy sentence the couple's ceiling has and the flat
  150 does not: "This is the number the host set aside for you — they can open
  up more at any time," gated on `capReason === 'guest_spend_ceiling'` read
  from the server's own `reason` field (never inferred client-side), scoped so
  it neither promises the remedy happens, implies a shot was lost, nor sends
  the guest to go ask the host mid-celebration.
- Both new reads (`papic_guest_spend_ceiling` and `papic_guest_captures.
  points_cost`) now distinguish an EXPECTED pre-S2 miss (`isMissingRelationError`
  — quiet) from a genuine outage (now `logQueryError`'d), so a real read
  failure can never look like "no ceiling set" or "0 used".

Graceful-degrade, same pattern S3 (#5014) already established: this branches
off `main`, not off S2's unmerged branch. `papic_guest_spend_ceiling` doesn't
exist there yet, so every read degrades to `guestCeiling: null` and the whole
feature collapses back to byte-identical S1 behavior until S2 merges.

🔴 **`points_cost` IS A DELIBERATE LITERAL, AND T1 IS EXPECTED RED UNTIL S2
MERGES.** `lib/security/select-column-scan.test.ts`'s phantom-column guard
correctly fails on `.select('points_cost')` in `lib/papic-guest.ts` today —
that column does not exist until S2's migration (20271184624871) lands. A
named-constant indirection (mirroring S3's `ALLOTMENT_STORAGE`) was tried and
reverted: it isn't real precedent, because S3's constants are never handed to
a `.from().select()` at all (verified — that file has none), while this one
is. `scanSelectSites()` only matches STRING LITERALS, so hiding the name
behind an identifier doesn't pass the check, it makes the guard blind to the
site — silently, which is worse than red. **Do not "fix" this red with a
`KNOWN_PHANTOMS` entry or a constant — it clears on its own the moment #5017
merges and this branch is rebased onto the applied migration.**

⛔ **DRAFT ON PURPOSE, auto-merge NOT armed.** Per spec § 8 PR-3: "Must land
before anything is said publicly — a limit a guest cannot see is the defect in
§ 1 wearing a new number." This must not reach guests before S2 (#5017) is
actually live in production, even though this branch itself has nothing to
merge-conflict with S2.

SPEC IMPACT: None — implements the already-locked § 6b design; no decision
changed.
