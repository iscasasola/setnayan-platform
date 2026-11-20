## 2026-11-20 · fix(guest-seat): a failed seat read says "Couldn't load your seat", never "Find your seat"

On the event page, `loadGuestContext` (`app/[slug]/_lib/loaders.ts`) read the guest's table from `event_seat_assignments` and `event_tables` with the error thrown away. A refused read resolved `data: null` — the same value as "not seated yet" — so the seat line on Details and on Me said **"Find your seat →"** to a guest who has a table: byte-identical to a guest the couple has not seated. The `/hub` seat tile used to carry the honest state ("Couldn't load your seat" + Reload, 2026-11-02 audit #34); with `/hub` folding into the event page's tabs, that state moves here.

- The loader binds both errors (and treats a throw the same), logs them with `logQueryError`, and carries `guestHubData.seatUnreadable`. Only read — so only ever reported — where guests may see seats (`guestsMaySeeSeatsFor`).
- `SeatDoorLine` answers the flag first: **"Couldn't load your seat — Reload"**. Reload is a small client button (`seat-reload-button.tsx`) that calls `router.refresh()`, so the guest re-reads without losing their tab.
- Hiding the seat part clears the flag with the label, so a hidden seat says nothing.
- Guard: `app/[slug]/an-unread-seat-is-not-an-empty-one.test.ts` — every seat read binds and acts on its error, the flag reaches `guestHubData`, every `<SeatDoorLine` mount passes it, and the line answers it before it can say "Find your seat". Seven sabotages on the real files, each red.
- Render test, written failing-first: `app/[slug]/_components/a-failed-seat-read-renders-as-failed.test.ts` renders the real `SeatDoorLine` three ways (not seated · seated · read FAILED). Against `origin/main`'s line the failed case drew "Find your seat →" and 3 of 5 went red; with this line all 5 pass.
- `/dev/me-lab?stage=1&seat=none|unreadable|Table 3` draws Me's seat line in the three states, no database (`me-stage-lab.tsx`). Shots: `build-sessions/shots-8076/`.

Not covered: the story's "were you there" table (`_lib/your-own-day.server.ts`) reads the table on its own.

SPEC IMPACT: None
