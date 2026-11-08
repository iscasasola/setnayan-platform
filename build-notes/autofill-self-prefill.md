# Autofill + "it's for me" prefill — build notes (8 Nov 2026)

Brief: corpus `plans/autofill_and_self_prefill_2026-11-08/BUILD_BRIEF.md`. Branch `claude/autofill-self-prefill`, cut
from `origin/claude/supplier-1build`.

## RULE 0 — what existed · what was missing · the delta

- **Existed.** `selfCelebrantName` + the "For · You" carry (`stashHonoree(..., { forSelf })`) on the create grid;
  the wizard's `knowsCelebrant` "This one's yours · For Ice · Change" chip (`generic-onboarding.tsx`); the grid's
  inline "For Ice — this one's yours." sentence; `selfName` on `/onboarding/[type]`. Supplier sign-up
  (`open-shop-wizard.tsx`) already filled the name read-only from the account and the email from the account;
  `signup/you` already filled phone + names; Help already filled the email.
- **Missing.** The celebrant was SAID, not shown in its field, and not locked (the wizard's Change unfolded an empty
  box in place). 49 person-data inputs carried no autofill decision. The wedding's own slot never started from the
  account. Help's "Your name" started empty.
- **Delta.** One shared lock part used by both create paths; tokens/`off` on every person field; own-slot seat on
  the wedding's legacy names screen; Help name prefill; two guards.

## Part A — counts (re-measured; the brief's table was not reused)

Scanner = the guard's own (`scan()` in `apps/web/lib/person-fields-carry-autofill.test.ts`): every `<input>` /
`<textarea>` in `app/` + `components/` (labs excluded) whose LITERAL `type` / `name` / `id` declares an email, phone,
address or person name. Before = `origin/claude/supplier-1build` @ 20a8c8bf34.

| kind | fields | token before → after | `off` before → after | nothing before → after |
|---|---|---|---|---|
| email | 25 | 9 → 11 | 0 → 14 | **16 → 0** |
| phone | 10 | 3 → 5 | 0 → 5 | **7 → 0** |
| address | 15 | 1 → 5 | 0 → 10 | **14 → 0** |
| name | 14 | 1 → 3 | 1 → 11 | **12 → 0** |
| **all** | **64** | **14 → 24** | **1 → 40** | **49 → 0** |

(The brief's 27/11/20/28 came from a looser keyword scan; a field whose name/id is an expression is not counted
here, so the guard cannot drift with wording. Several controlled own-data fields outside that scope also gained
tokens: the gift sheet's "Your name", the wedding's own slot.)

Own details → token: Help email/name · Profile name + phone (phone also gains `type="tel"`) · shop contact
email/phone/owner name/HQ address/city · branch city · city-pin city · payout account name · Papic payer name ·
song-request and gift "your name". Another person / not a person → `off`: guest rows, sponsors (add + edit), alaga,
godparent + invite emails, find-or-invite, a self-added supplier contact, the wedding BYO supplier sheet, the
supplier's client references, every admin lookup/console field, and fields merely named `name` that are not a person
(groups, packages, API keys, screens, songs, venues) — Chrome fills `name="name"` with the person's name otherwise.

## Part B — every create path

| path | For me | Someone else |
|---|---|---|
| Create grid inline form (birthday · debut · graduation · gender reveal) | locked field, account name, "This event is for you · Change who it's for" → re-opens For ▾ in place | shipped editable "For whom? — optional" field + `honoree_dependent_id` |
| Christening | not offered for self (for_whom rule) | shipped editable field |
| `/onboarding/[type]` wizard (birthday · debut · graduation · gender reveal) | locked field, "Change who it's for" → `/dashboard/create-event` (keeps `next`) | shipped field, carried name "Maria", editable |
| `/onboarding/[type]` christening | — | carried name, editable |
| Business-subject types | unchanged (a shop is never "you") | unchanged |
| Simple / Get-together | asks no celebrant — nothing to lock | — |
| Wedding (legacy names screen) | bride/groom: own first+last seated in OWN slot, editable, `given-name`/`family-name`; partner slot empty + `off`; helper: nothing | carried couple wins (unchanged) |

The lock posts nothing — a blank honoree stays the account holder's own slot, so the server receives exactly what it
did before.

## Proof

- Walk (Playwright Chromium, 375×812 @2x, DUMMY env `127.0.0.1:54321`, no sign-in; fixtures = `/dev/create-for-lab`
  "Ice Casasola" and `/dev/onboarding-lab?self=Ice%20Casasola` with the create grid's sessionStorage carry seeded):
  screenshots in `build-notes/shots/autofill/` — `grid-<type>-for-me|someone-else.png`,
  `grid-birthday-change-opens-for.png`, `wizard-<type>-for-me|someone-else.png`, `wedding-names-bride|groom.png` (own first + last in the own row, partner row
  empty). The "Someone helping" role tile was not clickable in the lab at 375 px, so that case is held by the
  `seatSelf` unit cases instead (a non-couple role seats nothing). The red "Issues" pill in the shots is the Next dev
  overlay reporting the dummy Supabase URL, not the form.
- Guards: `lib/person-fields-carry-autofill.test.ts` (3 tests) — sabotage: removed Help's `autoComplete="email"` →
  2 RED naming `app/(shell)/help/page.tsx`; restored → GREEN. `lib/for-me-locks-the-celebrant.test.ts` (3 tests) —
  sabotage: `name="honoree_label"` on the lock → RED; restored → GREEN. `create-for-whom` and
  `the-flow-stops-asking-what-it-knows` re-anchored to the lock (the old `setHonoreeRevealed(true)` anchor described
  the retired in-place box).

## For the controller

- **DECISION_LOG-ready line:** `2026-11-08 · "For · You" LOCKS the celebrant — every create path shows the
  account's own name in the celebrant field, read-only, with "This event is for you · Change who it's for" (back to
  For ▾); someone else unlocks the shipped name-or-link field. Every person-data input carries its autofill token
  (or off for another person's details), guarded by person-fields-carry-autofill.test.ts. Owner 8 Nov; build
  claude/autofill-self-prefill.`
- **Retired:** the wizard's in-place "Change" that unfolded an empty celebrant box (owner: change goes through For ▾).
- **Owner question (not guessed):** production weddings run the engine's `w_names` card, which asks both names with
  no "are you the bride or the groom" question — so there is no "your slot" to fill and it is left untouched
  (`couple-handoff.ts`: "we do not know, and must not guess, who is walking down the aisle"). The own-slot seat
  works on the legacy names screen (shown in the lab). Should `w_names` ask "which one is you?" first?
- **Not done:** Safari/Chrome offering a saved card on a real form (needs a real signed-in phone — not done from a
  dummy env); tsc left to CI per the brief.
