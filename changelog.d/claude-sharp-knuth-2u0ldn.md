## 2026-11-14 · fix(walk): the W2 + admin findings the re-walk found still broken on c0c8ff4 (F-W2-04 · 07 · 08 · 09 · 15 · 16 · 25 · 31 · 33 · 34 · 36 · 37 · 38 · 39 · supplier search)

Money first:

- **F-W2-31** An added Papic photo said "uses a credit, the same as a camera shot". It costs the camera price ×
  `PAPIC_UPLOAD_MULTIPLIER`. The three couple screens now say `uploadPhotoCostWords()`, which reads
  `papicCaptureCost('photo', null, 'upload')`.
- **F-W2-25** A guest marked Attending with nothing sent no longer counts as "invited". The guest list says "Everyone
  invited" and the send run says "Everyone has their invite" only when every invitable guest has an
  `invitation_sent_at` stamp (`invitationWasSent`). Otherwise both say "Nobody left to invite". The select toast says
  "Nobody selected still needs an invitation". `isToInvite` itself is unchanged (owner 2026-10-29).

Couple onboarding (`wedding-cards.tsx`):

- **F-W2-04** "Required" shows only after a name box has been typed into and emptied.
- **F-W2-07** "Steps of 10." is removed from the guest-count card.
- **F-W2-08** "You can change this anytime" shows once, on the first wedding card. The engine's photo and look cards
  still carry it: `setup-card.tsx` is held by #7605.
- **F-W2-09** The closed budget pill shows the amount, e.g. "Classic · about ₱750,000".

Event pages:

- **F-W2-15** Home's To do runs the same checklist auto-complete reconcile that /schedule runs
  (`ensureChecklistSeeded`, now returning rows inserted + ticked), but only while a task it can tick is open. When the
  reconcile ticks something, Home reads To do again.
- **F-W2-16** Home's ⓘ texts are plain words. Removed: "never repeated here", "Maker: design the page" and "One list
  now, in Schedule › Planning Stage".
- **F-W2-34** /memories no longer prints "Pinch to change the columns … · remembered on this device". The Papic guest
  allotment hints read "Leave it empty …" instead of "Blank = …".
- **F-W2-33** Challenge prompts are drawn through `displayChallengePrompt` in the add sheet, on the card's switch and on
  the live wall (`lib/live-wall.ts`). No raw `{who}` / `{host}` is shown.

Admin:

- **F-W2-36** "Needs wiring" is now "Not measured yet". The "tagged LIVE / NEEDS WIRING … instrumentation" legend is
  rewritten in plain words.
- **F-W2-37** Events are found word by word, across name, address and public id (`eventWordFilters`), in both the
  search box and Accounts › Events. A refused events read is now logged. Before, "Wanda Indigo" missed the event
  "Wanda & Indigo", and a comma broke the Events list filter.
- **F-W2-38** The events table at 390 px shows Event · Date · Actions. Guests and Face tagging show from md up, and
  the event's own page keeps the face override.
- **F-W2-39** The erasure tombstone `erased+<uuid>@erased.setnayan.invalid` now reads "Erased account"
  (`lib/erasure/display-email.ts`) on the user page, account deletions, the supplier list, the supplier team page and
  concierge abuse.

Supplier:

- The search box keeps the word being typed across a remount. It holds the word for 5 s after the last keystroke
  (`holdTyping` / `typingHeld`) and takes the keyboard back, so the clients search no longer empties while the page
  re-renders.

Guards: `lib/the-w2-re-walk-holds.test.ts` and `wedding-cards.render.test.ts`. Each was run red against origin/main.

SPEC IMPACT: None — copy, counting and layout fixes inside shipped rules. Not built, because they conflict with locked
owner rulings: F-W2-26/27 (Budget and Schedule are Home's pages, BARS LOCKED 7 Nov) and F-W2-22 (the phone peek strip,
owner 2026-09-22). Both are surfaced in the PR for an owner call.
