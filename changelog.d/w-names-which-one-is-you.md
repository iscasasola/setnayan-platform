## 2026-11-08 · feat(onboarding): the wedding's names card asks "Which one is you?" first, and fills your own row

Owner, 8 Nov, verbatim (on whether the approved wedding's `w_names` card should ask which one of the couple the
signed-in person is): *"yes. they need to be one of the 2."*

- **The card.** `w_names` (`app/onboarding/wedding/_components/wedding-cards.tsx`) now opens with "Which one is
  you?" — ONE PickMenu (the card had no shipped two-choice control) with exactly the two of the couple, Bride /
  Groom, in the role screen's own words (`WEDDING_SELF_SIDES` in `lib/onboarding/wedding-cards.ts`, which the
  shell's `ROLE_OPTIONS` now reads too). No third option. The name rows open once it is answered, each headed
  "Bride" / "Groom", the person's own marked "· you".
- **Prefill.** The pick runs the shell's existing `selectRole`: the account name (first word → first name, the rest →
  last name) fills the person's OWN row, editable, with `given-name` / `family-name`; the partner's row is never
  prefilled and keeps autofill `off`. A re-pick MOVES the untouched prefill (`moveSelf`, beside the shipped
  `seatSelf` in `lib/onboarding/couple-handoff.ts`); anything typed or edited is never overwritten or cleared. A
  carried couple ("Plan an event together") still wins, unchanged.
- **Storage.** No new column. The pick is the wizard's existing `role`, which the shipped commit already writes to
  `event_moderators.role_subtype` and uses to link the creator to their own couple guest row
  (`creatorCoupleRowId`). The commit is unchanged.
- **Gate.** Continue on `w_names` now needs the pick AND both first names (`weddingNamesReady`); a helper from an old
  draft must answer it.
- **Guards.** New `lib/onboarding/w-names-asks-which-one-is-you.test.ts` (5 tests) + two executed renders in
  `wedding-cards.render.test.ts`. Sabotaged four ways (pass without a pick · partner row seated · partner row
  autofill on · rows drawn before the pick) → each RED; restored → GREEN. `for-me-locks-the-celebrant` re-anchored
  to `moveSelf`.

SPEC IMPACT: answers the autofill lane's open owner question ("Should `w_names` ask which one is you?") — yes, one of
the two, no helper on this card. DECISION_LOG row for the controller: `2026-11-08 · The approved wedding's names card
asks "Which one is you?" (Bride / Groom, no third option) before the names; the pick is the existing role; your own
row starts from your account name, the partner's never. Owner 8 Nov "they need to be one of the 2"; build
claude/w-names-which-one-is-you.`
