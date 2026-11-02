## 2026-10-26 · feat(guest): "Confirm attendance" opens the RSVP page; the thank-you after a Yes starts with "You're on the list."

Owner, verbatim: *"on rsvp when they get the invite link there is a button confirm attendance. instead of jumping to
will you join us? (REPLY) make it go directly to the RSVP Page."* · *"On you're on the list part of the RSVP since the
ticket has the logo alread and Event Name, Just start with your on the list"*.

- **The cover's RSVP button opens the reply page itself** (`lib/cover-rsvp.ts` `coverRsvpOf`): every pressable state —
  Confirm attendance · You're coming ✓ · Change · You're coming ✓ · N more answers · You can't make it · Change — goes to
  the Reply card's own door (`/{slug}/invite/reply`), one tap, for a guest with a seat and for the host on their own page
  (the reply page has replied as the host's own row since 2026-10-24, or says they are not on the list). It no longer
  stops at Me's "Will you join us? · Reply" (`#me-reply`) or the card under the cover (`#site-reply`); both stay where
  they are. Unchanged: a shut window (plain words), a stranger (the stranger's door in the cover's foot), the Maker's
  canvas (its doorway, inert there). The in-page glide (`cover-rsvp-goes.tsx`) is removed — nothing produces an in-page
  mark any more. `toPart`/`partHref` are gone from `coverRsvpOf`.
- **The page after a Yes starts with its heading** (`invite/enter/page.tsx`): with the full ticket drawn, the door's top
  — the couple's mark, their names and their invitation line under the names — is not drawn (`landingTopStandsDown`,
  `lib/guest-landing.ts`; `DoorShell quietTop`); the names stay the page's `<h1>` for a screen reader. A "You're in!"
  arrival keeps its own line. **"We'll miss you." keeps its top**: there is no ticket after a No, so without it that page
  would not say whose event it is.
- The maker-lab's thank-you (`/dev/maker-lab/guest?rsvp=thanks&guest=1`) now draws through the real `DoorShell` +
  `hubDoorSkin` (`lab-thanks-door.tsx`), and the lab cover's button lands on the lab's reply page (`LAB_REPLY_DOOR`).
- Guards: `the-cover-rsvp-reaches-its-action.test.ts` (re-aimed: the button's href is the reply page, never a `#` mark,
  on the real `SiteBody` page) · its e2e (re-aimed: a tap at 375 touch and 1280 lands on the reply page) ·
  `invite/enter/the-thank-you-starts-with-its-heading.test.ts` (new). `the-cover-has-its-rsvp-button.test.ts` and
  `the-cover-counts-the-reply-pages-questions.test.ts`, `me-is-the-one-place.test.ts` (2) (two doors into the reply page
  now: Me's and the cover's), `every-guest-gets-the-new-side.test.ts` 1, `the-door-wears-the-hub.test.ts` 3 re-aimed.
  Goldens re-recorded on purpose: `site-body-fixture.golden.html` (only the cover's href) and
  `every-stage-is-todays-page.golden.json` (rsvp · guest · plain/hidden/browse, the same href). Port baseline
  regenerated (`CoverRsvpGoes` deliberately gone).

SPEC IMPACT: DECISION_LOG.md — a 2026-10-26 row recording both rulings; supersedes the 2026-10-17 "the button TAKES the
reader to the RSVP part" mechanism (the 307 that forced it is gone since 2026-10-24).
