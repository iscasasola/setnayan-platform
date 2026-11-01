## 2026-10-29 · feat(home): nothing above the cover — every prompt is a Today line; the coordinator's access opens the house Sheet

Owner, verbatim, over a phone screenshot of his Home: *"The popup for the access and other popups above the header
can be presented better"*. Four prompts could stack ABOVE Home's cover band; the cover is now the top of Home and each
is a line of the Today list under it (`HomeTodayItem` / `TodaySheetItem` in `home-parts.tsx`, the Today line's own
pill, wrapping so a shop's full name is never cut), action-needed first:

- **Coordinator's access** (S4b, #7041) — "<shop> joined as your coordinator · Pick their access"; the press opens the
  shared `Sheet` (bottom on a portrait phone, right panel from the couple dashboard's `tab:` line): the shop's logo +
  name, Limited ("Can see your event; changes only what you allow") · Full access ("Same as you: Event Hub, schedule,
  guests, seats", primary), details in the ⓘ. Writes exactly as before (`setDelegateArea`, `access_level`; Full = the
  co-host seat), saves in place, toast with Undo, the line leaves. The shop name is now also sought from the shop's own
  access request and its booking on the event — the seat the "asked for access" door upserts carries no label, which is
  why the owner's line read "Your coordinator has joined".
- **Access requests** — the doorway is a Today line to the requests page.
- **Date change** — a Today line; its press opens the house Sheet holding the same body (who answered, keep waiting ·
  drop, withdraw).
- **Event day soon** — the pre-load is a Today line (T-3d..T+1d, unchanged window).

On the event-day console and the after page (no cover there) the same lines lead the page. Layout-level lines drawn
above every event page (CohostWelcome, CoordinatingLine, ViewOnlyLine, PromoFreeWindowBanner) are unchanged.

Guard: `app/dashboard/[eventId]/_components/the-cover-is-the-top-of-home.test.ts` (nothing above the cover; the four
prompts only in `todayAsks`; each is a Today line; the line names the shop). `the-hosts-pick-their-coordinators-access`
re-aimed at `levelTodayWords` with a written reason.

SPEC IMPACT: None (presentation of an owner-approved flow; no decision changed).
