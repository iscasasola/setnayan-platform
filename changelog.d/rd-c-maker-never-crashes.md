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

## 2026-10-11 · fix(maker): round 2 — the rest of the crash protection (seating · floor plan · checkout · Announce · Mood Board · Save the Date · every form post)

Owner asked for the rest now. Everything round 1's guard listed as "still open" is closed (one entry is left there:
the guest list's `send-invite.tsx`, another branch's file). Built, not live.

**1 · Seating plan.** `seating-editor.tsx` `runGated` rethrew anything that was not a lost lock, and 25 presses await
it inside a transition (6 more awaited their action bare). It now ANSWERS: `null`, with the reason in the plan's own
notice strip — "Couldn’t save that — please try again." (new, in the strip's own shape). The presses that had drawn a
change in plain state put it back (priority order, role seating, keep-apart rules, a single table's turn, the photo
setting); the layout Save keeps its unsaved marks; Add table keeps its form open. And the fault found in round 1:
Auto arrange · Build my seating · Lock & fill · Auto-seat · "seat this role here" read the guest list, groups,
keep-apart rules and floor plan through readers that turn a REFUSED read into "none", then wrote seats from it.
`lib/seating-inputs.ts` (`guestsOrStop` · `membershipsOrStop` · `keepApartOrStop` · `floorPlanOrStop`) throws
`SeatingInputsUnreadError` inside the action's own read fan-out, before its first write — nothing is cleared, moved
or seated. `lib/seating-reconcile.ts` (the background re-seat) reads through them too and skips. New:
`fetchSeatingConstraintsMeasured` (`lib/seating.ts`). Guard: `lib/a-seat-plan-is-never-arranged-from-an-unread-list.test.ts`.

**2 · Floor plan Save** (`blueprint-studio.tsx`): caught; "Unsaved" stays and "That did not save. Please try again."
shows beside Save.

**3 · Checkout drawer** (`inline-checkout-drawer.tsx`). The double-submit guard was read first and it EXISTS: the
drawer mints ONE reference when it opens and sends it with every submit; `orders.reference_code` is `UNIQUE`
(migration `20260513150000`), so a second order with it cannot be created. The action (`checkout/actions.ts`) was not
changed. An unanswered Submit is now a refusal in the form's own alert, every field and the screenshot still there:
"We couldn’t confirm that your order reached us, and nothing was charged here. Please send it again — sending it
twice cannot create a second order." (new). It does NOT say "not ordered": an unanswered request may have reached us.
An unanswered voucher check is the action's own "We couldn’t check that code. Please try again."
⚠ Not fixed: when the first submit DID land and only its answer was lost, the retry is refused by the unique
reference and the person reads the action's own refusal — a database sentence today. No second order; not a kind line.

**4 · Announce** (`announce-button.tsx`): an unanswered send is neither "sent" nor "failed" — it may have gone out.
The words stay, the list is re-read, and it says "We couldn’t confirm that went out. Check your recent announcements
below before sending it again." (new). **Mood Board remove** (`inspiration-board.tsx`): the photo is put back —
"Could not remove — please try again." (new, the shape of its "Could not reorder —").

**5 · Save the Date** (`launch-std-button.tsx`): launch · schedule · cancel go through `answered` (never rejects) and
say their own existing "Could not … — please try again."; the screen moves only on `ok`, so a launch never looks
launched and a cancel never looks cancelled. Guard for 2–5: `lib/an-unconfirmed-press-claims-nothing.test.ts`.

**6 · Form posts.** `<form action={serverAction}>` has no `await` in our source, so round 1's scan could not see it:
64 such forms under `launch/` and `website/` were bare — a post that never answered replaced the Maker, form and all.
They are `SafeForm` now (`app/dashboard/[eventId]/_components/safe-form.tsx` + `lib/safe-form.ts`): the same `<form>`,
dispatched by React as before (pending states, the Maker's submit capture, redirects and the reset on success are
unchanged), with the action wrapped — a real failure is said in the form ("That did not save. Please try again.",
`role="alert"`) and on the Maker's status line, and the fields are KEPT by cancelling the one `reset` React fires
after an action returns. Six guards that read `<form` in source, the Ugat field scanner and
`scripts/lint-nested-forms.mjs` now read `SafeForm` as the form it is. Guard:
`lib/a-bare-form-post-never-replaces-the-maker.test.ts` — a NEW bare `<form action={fn}>` under the two folders fails.
Left: `print-menu-editor.tsx` posts natively to an API route that only answers with a redirect (the route must learn
JSON first, as the words form's did); the four `formAction` buttons in `editor-shell.tsx` (another builder's file).

Not verified: a browser (no form was posted against a dead network — the reset-cancel is read from react-dom's
source and run on an EventTarget, not driven in a page); a real phone; the Maker's first-load JS budget (no build:
`SafeForm` is a small client component now on every Maker form).

SPEC IMPACT: None.
