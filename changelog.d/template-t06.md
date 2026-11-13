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
- Guard `lib/the-blocker-row-and-the-plus-match-v8-3.test.ts`: the shut ＋ regex now reads the token pair
  (same intent — grey when shut).

SPEC IMPACT: None — implements the approved template; no decision changed.
