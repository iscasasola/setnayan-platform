## 2026-10-26 · feat(card-checks): Integrity watch › Cards — Approve · Ask to fix · Reject, bulk approve, the words that flag

Owner 2026-10-26: *"Cards go live right away after automatic checks; only flagged cards wait for admin review."*
PR 3 of the approved PLAN's order (corpus `prototypes/service_card_checks_2026-10-26/`), stacked on the save PR.

- A fifth **Cards** tab on the shipped `/admin/integrity-watch` (no new page, no new nav/queue registry — the Work
  feed already counts every open `integrity_flags` row). Rows: cover · title + price line · shop + verification word
  and card count · filed service ("reads like …") · reason chips · age, "over 72h" past the existing SLA; an
  unverified shop is a grey context chip and sorts lower, never a hold. Status and reason are one dropdown each.
- Opening a row: the card as couples see it (`ServiceCardView`), one block per reason with its evidence (photo pair
  from Repost watch · band rail · words found vs its own · the title with the words marked), then the verdicts.
- Verdicts (`card-actions.ts`): Approve goes through `approve_service_card()` only (closes the linked Repost-watch row;
  an unfinished check is run again first) · Ask to fix (message in-app) · Reject (one-dropdown reason) · bulk approve
  for words-only rows (re-checked server-side, one audit row each) · "Not a problem — stop flagging “…” for this
  shop" · the words list (add / remove). Every verdict: one `admin_audit_log` row + an in-app `service_card_check`
  notice, no email. The older Dismiss refuses a card.
- Tab icons hide below `sm` so five tabs fit a 390 phone (as drawn).
- `/dev/card-checks-lab` (dev-only) draws the real components over the prototype's samples; `/dev/card-maker-lab`
  gains `&held=1` for the maker helper.
- Admin › Categories row word (PLAN PR 6) NOT built: that page's card list has not landed.
- Tests: `the-cards-tab-decides-through-one-door.test.ts` (6, sabotaged red → restored), the lab's never-ships (2).

SPEC IMPACT: None new — implements DECISION_LOG 2026-10-26 "APPROVED — SERVICE CARD CHECKS AS DRAWN".
