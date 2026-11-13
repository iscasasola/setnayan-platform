## 2026-11-13 · feat(help): Help asks first — the best answer, Browse topics, three helps, and what we could not answer is kept

Owner "help approved" on prototype `Setnayan-specs/prototypes/approved_2026-11-13/help-page-fable.html` v5
(DECISION_LOG 2026-11-13 "Help page approved", "Help coverage = active account", "Three helps", "User help includes
guest questions", "Help — no AI answers yet", "No programmer labels").

- `/help` opens on **Ask anything** — the ask box at the top (same `?q=`, a plain GET form), then **People ask** (only
  questions asked at least twice that found an answer) and **Browse topics** tiles that grow full screen
  (`RiseScreen`) into the topic page; rows open one at a time (`<details name>`).
- A question gets **one best answer** (its first 1–3 sentences, cut from the answer itself), **Take me there** (the
  exact screen, in the reader's own event or shop — no event, no button), **Read the full answer**, **Did this answer
  it?** Yes / No, then More answers, Features (the one search's rows), and Message us with the question attached.
  A miss says so plainly — "We don't have an answer for that yet." — with near answers labelled "not an answer".
- Plain matching, no AI (`lib/help-ask-core.ts`): the app's own words (vendor → supplier), Taglish (magkano, paano,
  mag-RSVP), typos (one letter from 5 letters, two from 9; never fee → free), and a floor (half the words, one in the
  title or topic) below which an answer is only "near".
- **Coverage = the active account, no picker**: a user account reads host AND guest answers (14 topics), a shop's
  sheet opens `/help?for=shop` (7), an invite `?for=guest`, signed out reads About Setnayan only. The old role tiles
  are gone; an old `?role=` address lands on the same coverage.
- **The team's help** is the same page inside Setnayan HQ, `/admin/help/guides` (Setnayan HQ's sheet → Help): team
  guides only (`lib/help-admin.ts`, still imported from `app/admin/**` alone), and in place of Message us the
  **No answer yet** list — most-asked first, across all three helps.
- New table `help_asks` (migration `20271344889246`): the words, which help, web or app, the outcome. No name, no
  email, no user id; RLS on with no policy and anon/authenticated grants revoked — service role only.
- Yes / No rides the existing `submitHelpMessage` (`intent=answered`) — no new server action (budget 1251 unchanged).
- Guards: `lib/help-ask-finds-the-answer.test.ts` (new); `help-and-features-share-one-search` now holds the top box on
  /help and the bottom row on /features; the account-sheet guards follow the shop / HQ Help addresses.

Not built here (named so nobody assumes it): the plan line under an answer (prototype § 06), **Show me** spotlight
stops (§ "Help → Show me"), and "Write this answer" on the No answer yet list.

SPEC IMPACT: None — builds the approved prototype as ruled; the corpus FEATURE_REGISTER.md gains a row for
`/admin/help/guides` (the team's Help) via the controller.
