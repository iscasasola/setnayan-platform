## 2026-09-29 · fix(rsvp): one question per screen is arranged by the recorded rules

Owner, on the live RSVP page with "Ask one question at a time" on: *"ask one question per screen is not neatly arranged. there are rules for like this, where the progress bar should be, where the logo, and questions."* He saw the couple's mark, then the whole invitation (eyebrow, names, date, guest, reply-by), then MID-CARD a row with "1 of 8" at one edge and the dots at the other, then the question.

Now, following `prototypes/rsvp_variants_2026-09-27.html` § SWITCH ON (DECISION_LOG 2026-09-27 "THE RSVP IS ONE EDITABLE SCENE + ONE SWITCH") and the house one-question rule (DECISION_LOG 2026-08-10 vendor onboarding, "the field label already IS the title"):

- **Progress is one unit, under the couple's mark, above everything the guest reads.** A filling bar with its "2 of 8" underneath it, centred; Back beside it on the left (kept, invisible, on screen 1 so nothing shifts). On the RSVP page it goes into DoorShell's new `lead` slot (crest → progress → header → form); on the Event Hub's reply sheet it is the form's first child.
- **The invitation's facts show on the first screen only.** From screen 2 the heading, whose reply it is and the reply-by line fold to one line ("Indalecio & Claire · for Antonio Loo"); on the Event Hub card the letterpress RSVP head folds away.
- **The question is the screen's heading** (serif, like "Will you be there?").
- **The primary action is last and stays in one place.** Next sits at the foot of a question area of one height, sticky above the phone's home bar when a question runs long. The answer screen has no Next: the tap is the answer ("Tap one to continue"), as drawn. A guest who comes Back to an answer they already picked still gets Next.
- Switch OFF: nothing changes; none of the new markup renders.
- **The couple's mark plays** (owner, same thread: *"can we also animate this?"*). A layered logo from the Maker's Logo page now plays its saved motion (draw on, then drift) in the RSVP crest through the ONE shipped player, `LayeredLogoPlayer` (the hero's and the Maker's ▶ Play). Same gate as the Event Hub hero: the animation is owned (`eventAnimatedMonogramActive`) and not switched to "Use Static Image" (`markAnimationSwitchedOff`). It plays once: the crest sits outside the reply form, so stepping never remounts it. Reduced motion, not layered, or not owned: the still mark, as before.

Files: `app/[slug]/_components/rsvp-one-at-a-time.tsx`, `app/[slug]/_components/rsvp-widget.tsx`, `app/[slug]/invite/reply/page.tsx`, `app/_components/door/door-shell.tsx` (optional `lead` prop, stamped `data-door-lead`, + `data-door-header`; a door without `lead` renders as before), `app/[slug]/invite/_components/hub-door-skin.tsx` (`animate`). Guard: `app/[slug]/_lib/one-question-screen-is-arranged.test.ts` (12 tests; 12 sabotages, each caught).

SPEC IMPACT: None. This implements the recorded prototype; no decision changes.
