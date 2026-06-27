## 2026-06-28 · feat(weddings): Muslim wedding track — Nikah roles, essentials card, mahr, groom attire

Make the `ceremony_type='muslim'` wedding work end-to-end, complementing the
already-shipped Muslim content (traditions, schedule, paperwork, halal vendor
filter, dress-code subsystem) rather than duplicating it.

- **Data.** New `guest_role` enum values `wali`/`witness`/`imam`/`wakil`
  (migration `20270308910536`); new `events` columns `mahr_description`,
  `mahr_prompt_deferred`, `gender_separation` (default `none`) + partial-unique
  indexes making wali/imam/wakil one-per-event (`20270308998862`); 4 groom-side
  Muslim attire leaves seeded into `canonical_service_schemas`
  (`20270309397413`, closing 2026-06-11 audit gap G1).
- **Ceremony-aware roles.** A new `MUSLIM_ROLE_SET` (wedding base minus the
  Catholic sponsors/bearers/lector, plus the Nikah principals) routed via a new
  ceremony-aware chokepoint `resolveRoleSetKeyForEvent` — every guest picker,
  its server-action validator, the join self-claim flow and seating tiers become
  ceremony-aware atomically while `WEDDING_ROLE_SET` stays byte-identical
  (role-sets.test.ts pins both). New `muslim_principals` role group.
- **The five essentials of your Nikah** — a Muslim-only couple dashboard card
  (consent · wali · two witnesses · mahr · imam) with an inline editor for the
  mahr description + walima gender-separation posture. Free, core tool.
- **Mahr** surfaces as a distinct, NON-billable info card on the Budget page
  (never folded into committed/overspend math — it is the bride's gift, not a
  Setnayan/vendor charge).
- **Imam auto-resolve** parity: a new `muslim_mosque` officiant framing, with an
  inline PD 1083 comment documenting why a mosque never resolves to the
  `civil_registrar` bucket.
- Contested rulings (witness gender, gender separation, wali) are couple-set and
  default to common Filipino-Muslim (Shafi'i) practice; copy defers to the imam
  and never prescribes.

Verified: typecheck · 586 unit tests · lint + 7 CI guards · production build.

NOT in this PR (owner go-live actions): the `muslim` faith is still launch-gated
`coming_soon` in `wedding_type_launch_status` — flipping it `active` in
`/admin/wedding-types` is the owner's call AND should follow an NCMF-registered
imam's review of the corpus content (per `Muslim_Wedding_Spec_2026-06-28.md`).

SPEC IMPACT: Implements the Muslim track per
`02_Specifications/Muslim_Wedding_Spec_2026-06-28.md` +
`Muslim_Wedding_Build_Plan_2026-06-28.md` (phases P1–P5). Corpus build-plan
phase statuses updated to reflect shipped; App_Build_Status Muslim notes updated.
