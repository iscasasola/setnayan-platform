## 2026-10-08 · fix(perf): the Maker warms the other stages once per open, never after a save — and fetches its canvas once, not twice

**Owner, on the first visit to another stage:** *"For as long as it doesnt take kore than 1 second"*.
Measured on production after #6448 (controller, one load, a real event): Invitation → The Day, canvas
document first byte 945 ms, complete 2,178 ms. Missed — so the warm comes back, in the one shape the
incident allows.

**1 · The other stages are warmed ONCE per Maker open** (`warmOnce`, `buffered-canvas-frame.tsx`).
After the stage on screen has said `ready`, on an idle moment, with the tab visible: one hidden frame
at a time, each stage at most once. The first write of the open ENDS it — nothing is warmed after a
save, while one is in flight, or again (`makerSavesStarted`, and `warmOver` for a Maker render since
the open). None on a save-data connection or a phone with ≤ 4 GB (`warmCanvasBudget`, unchanged).

**2 · A save's redraw goes to the page on screen only** (`canvasPosts`). `CANVAS_REFRESH_MESSAGE` is
a server render of the guest page; it was posted to every kept frame, so each such save re-rendered
up to three pages nobody was looking at. A kept stage now OWES the redraw and pays it when it is
shown (or its fresh page, loading behind, carries it).

**3 · The canvas document is fetched once per open.** The server's HTML carried `<iframe src>` inside
a streamed Suspense segment: the browser began loading it there, React moved the segment into place,
and a moved iframe loads again — the first full guest-page render was thrown away (production: the
same address fetched twice, 3 s apart, on every open). The frames are now mounted by the client only.
A desktop also stops fetching the phone's address (`&tabs=1`) first.

| Supabase requests (counting stand-in, empty fixture: one guest page = 35) | #6448 | this PR |
|---|---|---|
| Canvas documents fetched per Maker open — phone | 2 | 1 |
| Canvas documents fetched per Maker open — desktop (dev harness) | 4 | 1 |
| Other stages fetched per open | 0 | up to 3, once (0 on save-data / a ≤ 4 GB phone) |
| Other stages fetched per save | 0 | 0 |
| Guest-page renders per redraw save, with n kept stages | 1 + n | 1 |

Guard `lib/the-other-stages-are-warmed-once.test.ts` COUNTS fetches per open and per save over the
component's own pure functions, renders the component as the server does and counts the iframes in
its HTML (0), and pins the wiring. 13 sabotages, each seen red.

SPEC IMPACT: None (DECISION_LOG 2026-10-08 "THE MAKER LOADS ONLY THE STAGE ON SCREEN" already allows
the warm back "ONCE per open, never per save"; status in `PERF_FANOUT_BUILD_STATUS_2026-10-08.md`).
