## 2026-11-10 · feat(empty-look): the event dashboard's greyed-out parts (Build 5 Lane H, slice 2)

Owner 2026-11-09 (DECISION_LOG 🧱👻 ×2), approved prototype `prototypes/empty_looks_user_event_2026-11-10/` (artifact WGwLL2uxVnUDEwCUBWu1WM). Stacked on slice 1 (`ExamplePreview`, `lib/empty-look-samples.ts`).

Each part keeps its shipped honest line and door; the Example is drawn UNDER it through the one slot, only when the part's read ANSWERED and is empty — a refused read keeps saying so and never draws a sample.

- **Today.** Guests · Event Hub · Suppliers · Budget · Schedule tiles carry `HomeFace.example` (set in `home-control-faces.ts` on their honestly empty faces; a new `plan-none` face), drawn by `HomeTile` under the real face. To do shows three sample rows on an empty plan; Who's here shows the sample team when presence answered and nobody else is in.
- **Guests.** The roster's own section + rows (`guests-example.tsx`) under "No guests yet." (not for a finished event).
- **Suppliers › Booked.** `BookedRowsExample` (the team rows) under "Go to Find", when nobody is booked or waiting.
- **Schedule.** Three sample chapters on the rail's own column (`ChaptersExample`) in the empty rail's panel.
- **Budget.** `BudgetExample` — the real `BudgetFigures` on sample books + the three groups' rows — when all three groups READ empty.
- **Memories.** The grid itself on eight sample photos (host, All, nothing narrowing it).
- **Hub.** A phone miniature of the page + four sample facts when the event read but there is no address yet (the stage draws no frame then).
- **Guard** extended: every event part renders its Example and is gated; Home rendered whole on `fixtureControlEmpty` (new, `lib/home-control-fixture.ts`) draws every widget's Example, on `fixtureControlUnread` and the full fixture none (sabotage-proven).
- **Labs.** `/dev/home-lab?empty=1` · `/dev/guests-lab?empty=1` · `/dev/empty-looks-lab?board=event` (Hub · Schedule · Memories); Booked and Budget use `/dev/suppliers-lab?mode=booked&booked=0` and `/dev/budget-lab?state=empty`.

Desktop (md+) Home detail cards draw no Example (phone sizes only, per Lane R). Find's group-row photos are left to open PRs #7420/#7417. Sample photos are existing images until the owner's Higgsfield files land.

SPEC IMPACT: None — builds the approved prototype; HOUSE_TEMPLATES T28 "Shipped/Guard" lines can name `ExamplePreview` + `every-empty-part-shows-an-example.test.ts` (controller to update with the Lane H merge).
