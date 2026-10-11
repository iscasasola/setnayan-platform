## 2026-10-11 · fix(maker): a failed request never replaces the Maker with an error screen — the couple's side

Owner, verbatim: *"make sure requests does not cause a crash"*. The database is on a small plan (a first call after
a quiet gap can take 3 s; once a day it stalls ~40 s) and phones drop signal. Three faults of one class — a failure
that takes the screen, says "this page doesn't exist", or renders as emptiness. Built, not live.

**1 · A press whose request never answered is said in place.** A server action awaited inside a transition with
nothing to catch it: when it rejects (offline, a 5xx) React rethrows it and `app/error.tsx` replaces the whole Maker —
canvas, tools and every unsaved field. Caught, each the way the draft bar already is (`hubDraftAnswer`), with the
words each control already had:

- `website/editor/_components/use-scene-canvas.ts` `useSceneCanvas.save` (a scene's Style · palette look · Venue map
  switch), `details-bound-field.tsx` `answer` (a scene's words — the paragraph stays in the box, the question stays
  open), `scene-style-row.tsx` `DressFiguresRow` → "Something went wrong. Please try again — your draft is kept."
- `pabuya/_components/pabuya-message-editor.tsx` `ShippedEditor.save` → "Could not save your message."
- `launch/_components/maker-tour.tsx` `finish` and `app/_components/guided-tour-card.tsx` `dismiss` (every panel's
  first-visit card) — nothing to say; the tour is offered again next time.
- Found by the scan, same fault, mounted in the Maker: `website/photo-moments/…/photo-moments-editor.tsx`;
  `details/_components/governed-fields.tsx` (`applyField` never throws; the ceremony switch; both conflict checks);
  `launch/_components/details-your-event.tsx` `saveDay`; `_components/address-pin-field.tsx` (Find);
  `pabuya/_components/pabuya-manager.tsx` `run`; `invitation/_components/slug-field.tsx` (the address — a redirect is
  still how that action answers and is let through); `app/_components/run-of-show-header.tsx` `onAdvance` (the list is
  re-read either way, so the rows show what is true before anyone presses again);
  `launch/_components/maker-theme-picker.tsx` (its wait on the save queue).

Strings added (each already used elsewhere in the app): "That did not save. Please try again." (governed rows, e-gift
methods, the address); "We could not check your booked suppliers just now. Please try again." (governed rows, new).

Guard: `apps/web/lib/a-failed-press-never-replaces-the-maker.test.ts` + `lib/transition-await-scan.ts` (TypeScript
parser). Every `await` in a function given to a transition — in `launch/`, `website/`, and every file the Maker's page
imports for its code — is in a non-rethrowing `try/catch`, ends in `.catch`, or awaits a function proved never to
reject; every `makerSave` / `makerRedrawSave` call's rejection is taken where it is written or by a named caller.
**Still open, listed in the test with ceilings** (other tools the Maker mounts): the seating plan (31 presses through
`runGated`, which rethrows), the floor plan's Save, the checkout drawer, the guest list's two invite presses (fixed on
`rd/c-requests-never-crash`), the schedule's Announce, the Mood Board's remove-a-photo, the Save the Date's launch ·
schedule · cancel. **Not covered at all:** plain `<form action={serverAction}>` posts — React runs those in a
transition of its own and there is no `await` in our source to find.

**2 · A read that could not be made never says the page does not exist.** supabase-js resolves a dropped connection
as `status: 0`; `isTransientReadError` did not count it, so `dashboard/[eventId]/layout.tsx` answered `notFound()`
("This page doesn't exist on Setnayan.") and `launch/page.tsx` redirected silently to the event's home.
`lib/read-retry.ts`: `isNetworkReadFailure` (status 0, or — where a caller has no status — the fetch error's own
words), counted transient, so every gate that already threw `schemaBlipError` now throws it for this too →
"Reconnecting…" → the honest error. It is **not** run again by `withSchemaRetry`: postgrest-js has already retried
that GET three times over seven seconds, and five rounds of that is half a minute of blank page. EventLayout's event
read, when it THREW, came back as `{ data: null, error: null }` (→ `notFound()`); it is handed on as `status: 0`.
"No such row", an RLS refusal, a 4xx and a statement timeout keep their caller's path exactly as before. Behaviour
that changes with it, on purpose: Home (`fetchUserEventsOrReconnect`) shows "Reconnecting…" on a dropped connection
instead of an empty board. Guard: the table in `lib/read-retry.test.ts` (0 · 500 · 502 · 503 · 504 · PGRST000–003 ·
57014 · 42501 · 42703 · PGRST205 · PGRST116 · a real "no row" — transient? network? read how many times?).

**3 · The guest list's groups and seats say when they could not be read.** On `guests/page.tsx` a failed groups,
memberships, assignments, tables or floor-plan read fell back to empty: every guest with no group, nobody at a table,
no word. Each is now measured — `fetchGuestGroupsByEventMeasured`, `fetchGroupMembershipsByEventMeasured`
(`lib/guests.ts`), `fetchFloorPlanMeasured` (`lib/seating.ts`), and `measuredOr` (`lib/measured-read.ts`) for the two
that throw (which are now also logged — the plain catch left no trail). The page says it in the counts strip, in the
list's own words and with the list's own Try again: "We couldn’t load your groups / tables / groups and tables this
time. Nothing has been lost." (`lib/guest-list-unread.ts`; new strings). No table is suggested from seat reads that
did not all happen. Guard: `lib/guest-list-side-reads-are-honest.test.ts` (the reads against a stubbed client, the
sentence, the page's fan-out, and the line drawn by the real screen).

Not verified: a real phone, a real network drop, a real event; the Maker's first-load JS budget (no build was run —
the browser code added is `hubDraftAnswer`, already in the first load, and a few `try/catch`).

SPEC IMPACT: None.
