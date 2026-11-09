# The wedding names card asks "Which one is you?" — build notes (8 Nov 2026)

Owner, 8 Nov, verbatim (answering the autofill lane's open question "Should `w_names` ask which one is you?"):
*"yes. they need to be one of the 2."* Branch `claude/w-names-which-one-is-you`, cut from
`origin/claude/supplier-1build` with `origin/claude/autofill-self-prefill` merged in (the release branch did not yet
hold `self-celebrant-lock.tsx` / `person-fields-carry-autofill.test.ts`).

## RULE 0 — what existed · what was missing · the delta

- **Existed.** The approved card `w_names` (`wedding-cards.tsx`), asking both names with no role. The wizard's
  `role` field (`OnboardingState.role`), which the shipped commit already writes to `event_moderators.role_subtype`
  and uses to link the creator to their own couple guest row (`creatorCoupleRowId` in `actions.ts`). The role
  screen's words (`ROLE_OPTIONS`: Bride "Walking down the aisle." · Groom "Waiting at the front."). The autofill
  lane's `seatSelf` (own slot only, never over typed text) and `selectRole` in the shell.
- **Missing.** On production weddings (`w_names` first) `role` was never asked, so it stayed null, nothing could be
  prefilled, and the commit could not say which couple row is the creator's.
- **Delta.** One PickMenu on top of `w_names` writing the existing `role` through the existing `selectRole`; a pure
  `moveSelf` beside `seatSelf` for the re-pick; `weddingNamesReady` as the card's Continue gate; the two role rows
  moved to `WEDDING_SELF_SIDES` so the card and the role screen share their words. No new column; commit unchanged.

## Control choice

The house rule is ONE dropdown for any set of choices unless the card already has a shipped two-choice pattern.
`w_names` had none, so it is a `PickMenu` (`data-wedding-self`). (The card file's older header note says "two
options → buttons"; the brief's house rule was followed instead — flag for the owner if he wants buttons.)

## Re-pick rule (`moveSelf`)

The account name leaves the row that is no longer yours only where that row still holds EXACTLY the account name
(the untouched prefill), and lands in your row only where it is empty. Edited or typed text is never cleared or
overwritten. Known edge: a person who typed their account name byte-for-byte by hand is indistinguishable from the
prefill, so on a re-pick it moves too — no text is lost (it lands in the new own row, or the row was typed and it
is simply cleared from what is now the partner's row).

## Sabotage (each run, then restored → GREEN)

| sabotage | result |
|---|---|
| `weddingNamesReady` without the pick | RED · "the names card cannot be passed without a pick" |
| `seatSelf` also seats the partner's first name | RED · 2 tests ("fills YOUR row; the partner's stays empty", "re-pick moves") |
| partner row `autoComplete={token}` | RED · "partner's row is empty with autofill off" (render) |
| name rows drawn before the pick | RED · "no name rows until it is answered" (render) |

## Lab

`/dev/onboarding-lab?type=wedding&flow=approved&self=Ice%20Casasola` mounts the approved card flow on fixtures
(dev-only; production 404s it). Never press the final create there.
