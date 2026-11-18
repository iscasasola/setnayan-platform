## 2026-11-14 · feat(template): T06 — the supplier's chatroom onto the design template

Owner-approved 2026-11-14: `Setnayan-specs/prototypes/design_template_sheet_2026-11-14_fable.html` (15 rules). Batch
T06, the chatroom first (owner: focus on the supplier's chatroom). Every fact, control and action is kept; no server
action, query or data logic changed.

- **The conversation (`/vendor-dashboard/messages/[threadId]`)** — read-only blocks lose their cards (the referral
  and creator-collab notes, the quotation notice, the closed-chat sentence); the two things that need an answer
  (a guest-count change, a new inquiry) sit on the warm surface as the one framed next step. Hand-made buttons
  (Talk to them · Decline · Apply ± · Hold price) are the button piece; the new-inquiry facts are one dark-grey line
  and the status words (Founder · Returning client · Active planner · Setnayan AI · Active · Influencer
  Recommendation · Creator collab active) are soft chips instead of 9 px typewriter capitals; money is bold body
  font; a refused booking answer wears the danger token, not a raw palette shade.
- **Inside the thread** — the ＋ tools sheet's labels, lines and shut rows use the three text strengths and the
  template's section label, its › is terracotta, and "They asked to book" is the amber button piece; the answer
  line's day words use the state colours and the quick replies are grey buttons; payments to confirm sit on the
  warm surface with the button piece, the plan progress is a hairline section with bold money; "Offer another
  service" and the outcome reason are PickMenus (no native select); "How did this inquiry end?" is a section with
  its explanation behind ⓘ; Questions for the couple says a failed read in amber and empty as one line.
- **The shared chat pieces (couple and supplier alike)** — the head, the tool panel's Close, the ⋮ menu's report
  form, the composer's file chip and refusals, the conversation list and the message stream use the three text
  strengths and tokens (no 9–11 px typewriter words, no ink at part strength, no raw palette shades); the quote
  card's buttons are the button piece and its badge the shared chip; a stream that could not load its cards says so
  in amber, and an empty one is one plain line. The conversation list is a column with a hairline, not a card.
  The supplier's customer sheet, its trigger and the saved-template quote follow (two PickMenus replace the native
  selects; Send waits until a template is chosen, as `required` did).
- **The rest of T06 (supplier pages)** — on the day (crew QR on the warm surface, "No events yet" one line with
  its ⓘ), plans (plan-change lines and the add-ons as hairline rows, not cards; button pieces), services (the
  category fold, requests, refinements, gift and last-minute groups lose their boxes; the reach note is one line;
  the coverage editor's Close/Save, crumbs and labels), the style library editor (button pieces, sections without
  cards), attributes, and the shop kit (`ShopPill` / `ShopNotice` tones on state tokens, `ShopEmpty` one plain line):
  ink at part strength → dark grey, 9–12.5 px captions → 12–13 px, no typewriter font, no gold small words, raw
  state palette → `--color-ok/warn/danger`.
- Guard `lib/the-blocker-row-and-the-plus-match-v8-3.test.ts`: the shut ＋ regex now reads the token pair
  (same intent — grey when shut); `lib/a-private-message-looks-private.test.ts` and
  `lib/the-chat-is-messenger-shaped.test.ts` read the new house-fill token the same way.

SPEC IMPACT: None — implements the approved template; no decision changed.
