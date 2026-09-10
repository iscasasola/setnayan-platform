## 2026-09-11 · feat(papic): sponsors default to a bigger share of the per-guest ceiling

Owner addition 2026-08-29, the one open piece of Papic item 3. On a celebration
where the couple has turned on "how many credits each guest gets", a principal
sponsor who is not named now takes **three** equal shares and a cord, veil,
coin or candle sponsor **two** — without the couple naming them. A named
guest's own number still wins, and the release (button + late automatic) still
opens every un-named guest, sponsors included.

- **Migration `20271220526938`** — `papic_share_weight(role, extra_roles)`
  (pure), `papic_guest_share_weight(guest_id)` (NULL when named; the counter
  reads it), and `papic_guest_spend_ceiling` re-created **from production's
  live `pg_get_functiondef`** with three marked additions. Sponsors are counted
  as EXTRA HEADS in the division (`share = (pot − named) ÷ (heads + Σ(weight −
  1))`, sponsor = share × weight), so the shares still add up to the pot — the
  "capping everyone is the guarantee" rule survives. A migration assertion
  refuses to apply if the named tier, either release, the headcount or the
  floor of one is missing from the new body. Service-role only; inert on merge
  (no celebration has the ceiling switched on — dry-run in prod: 0 guests with
  a ceiling before or after, 8 sponsors recognised).
- **Who is a sponsor = the guest list** (`guests.role` + `extra_roles`), not
  `event_sponsors.linked_guest_id`. Measured in prod: 8 guests carry a sponsor
  role, 0 `event_sponsors` rows exist, so the couple's sheet recognised none
  of them. `allotmentRoleOf` is the TypeScript twin.
- **The couple's sheet** (`guest-allotments-choice.tsx`): `splitTheRest` takes
  `sponsors` and divides by the same weighted heads; the live line gains
  "3 sponsors get 39 or 26"; the grey number in each row is now what that
  guest actually gets. `spare` is floored at 0 (it could read "−150 spare").
- **The guest's counter**: `GuestQuota.sponsorShare` → the pill reads
  "33 left · a sponsor's share" on both mounts (the prop is required, so a
  mount cannot forget it).

Guards (`tests/db/papic-sponsors-get-a-bigger-share.db.test.ts`, 12 tests; the
headline shoots on a real pool event until a plain guest is refused and the
sponsor keeps going to her 15). Every sabotage measured before → after:
remove the sponsor multiplication (2 → 0) → 6 red · multiply on top instead of
weighting (1 → 0) → 6 red · TS `principal: 3` → 4 (1 → 0) → 2 red · SQL
`THEN 3` → 4 (1 → 0) → 9 red · a named sponsor still adds extra heads (1 → 0)
→ 1 red · delete the release arm (the time machine, 2 → 1) → migration refuses
to apply, 12 red · TS weighted shares (1 → 0) → 2 red · spare floor (1 → 0) → 1
red. The TS↔SQL weight parity walks every value of the live `guest_role` enum.

SPEC IMPACT: `WHATS_NEXT_Papic_Items_3_7_HANDOFF_2026-08-29.md` § 3 and
`WHATS_NEXT_Papic_Build_Order_2026-08-29.md` item 3 — the sponsor default is
built; `DECISION_LOG.md` row for the weights (3 · 2 · 1) and the weighted
division; `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 1.
