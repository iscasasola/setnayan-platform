## 2026-10-23 · perf(maker): the canvas no longer waits for Studio's and Details' panels — they arrive behind it

Measured on production today (new Maker, phone, a couple's event, 3 runs): the Maker page took **5.4–6.3 s**
and the couple's page showed in the canvas at **7.5–11.6 s**. Two causes, one fix:

- **The canvas started last.** The editor that draws the canvas is rendered only after the launch page
  returns, and the page waited for every Studio and Details panel first (9 of its 15 database trips, and
  ~800 KB of the page's 1.27 MB — forms, made-once workspaces, Studio tools).
- **The panels were in front of it.** They are now built as ONE promise (`makerLateWork`, `lib/maker-late.ts`)
  that the page starts and never awaits. The shell and the canvas go out at once; the panels follow in the
  same response and the shell takes them up (`MakerLateBridge`, its own Suspense boundary — nothing on screen
  suspends). Nothing is fetched on a tap: a tool still opens with its data in hand (DECISION_LOG 2026-09-28
  "THE MAKER LOADS EVERYTHING UP FRONT", 2026-09-29 "THE MAKER MUST NEVER FEEL SLOW").
- While they are on their way, Details, the RSVP stage and Studio's home say **loading** (the app's
  `TimelineRowsLoading`), never "could not be loaded". If they cannot be built, each says so, as before.
- **The guided door** (an unfinished event opens on What's left) is decided from the panels' facts, so it now
  opens when they land — unless the couple has already pressed something, or the tab remembers its place.

Read harness (`maker-page-reads.harness.ts`, 150 ms a database trip; it now counts the canvas's lane and the
tools' lane apart and waits for both): page **15 → 7** trips, page with its editor **20 → 12**, canvas reads
done **3,050 → 1,837 ms**, everything in by 2,285 ms; same 94 reads. `the-maker-reads-start-together.test.ts`
tightened to 8 / 13 and gains test 5 (the canvas never waits for the tools) — sabotaged: making the page await
the tools again fails tests 1, 2 and 5.

Four source guards that pinned `prop={prop}` on `<MakerShell>` now check the same hand-over through `late`.

SPEC IMPACT: None — implements the 2026-09-28 / 2026-09-29 Maker speed rulings; no product decision changed.
