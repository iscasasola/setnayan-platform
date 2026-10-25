## 2026-10-17 · fix(event-hub): the cover's "Confirm attendance" takes the reader to the RSVP part

Live on `/cale-ice` (owner, as its host: *"confirm attendance is not doing anything?"* · *"it is not going to the RSVP
part?"*). Measured cause: the tap was not swallowed — in the lab with the veil and the kept drape (Chromium 375/1280,
WebKit 375) the click reached the link with `defaultPrevented` false and the browser navigated. It went to
`/{slug}/invite/reply`, which keeps only a reader holding a guest pass (`replyEntry`): the host holds none, so live
`GET /cale-ice/invite/reply` → 307 → `/cale-ice` — the tap reloaded the cover it was pressed on.

- The cover's button now TAKES the reader to the page's RSVP part — the Reply card under the cover
  (`COVER_RSVP_PART`, `site-reply`) — with a glide (`cover-rsvp-goes.tsx`; a plain jump without script; at once under
  reduced motion). The card's own button opens the Reply.
- Guest with a key: the Welcome's Reply card is drawn under the cover again (it was hidden while the cover held the
  button) and is the RSVP part; its button opens the reply page.
- Host on their own page: the same Reply card stands under the cover; its button opens the Reply as the host's own
  preview (`?preview=draft`, the verified-host door — a sample guest, never a real reply). A booked supplier gets no
  button (nothing to reply). The stranger's "Confirm your Booking" door is unchanged.
- Lab (`/dev/maker-lab/guest`) mirrors it. Guards: `the-cover-rsvp-reaches-its-action.test.ts` (rendered, guest + host)
  and `tests/e2e/the-cover-rsvp-reaches-its-action.spec.ts` (a real tap at 375 touch and 1280).

SPEC IMPACT: DECISION_LOG — the 2026-10-16 cover row says the button "opens the shipped Reply"; the owner's 2026-10-17
words refine it to "goes to the RSVP part" (controller records it). Corpus not edited from this session.
