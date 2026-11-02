## 2026-10-16 · fix(animate): build-in effects work — the 11 faults of the 2026-10-15 Animate walk

Owner, 15–16 Oct: *"build in effects must work. have you checked?"* · *"speed and stability fix"*. From the tester's
walk (`controller-2026-10-12/test-animate/WALK.md`), ranked by what a couple notices:

- **F1 · "On scroll" finishes while the guest reads.** Every Movement writes its scroll range, Calm included
  (`HUB_SCROLL_IN_END`, `entry min(P%, Nvh)`): a scene has arrived once it is fully on screen or its top is in the
  upper 60 %, at every height. The stylesheet's fallback is Calm's range (was `entry 92%`, which never finished on a
  tall scene). Guard `lib/a-scroll-arrival-finishes-in-view.test.ts`.
- **F3 · a Delay never blinks.** A part's timed Build in holds its first frame through its Delay (fill `backwards`).
- **F4 · the live names never blink.** The loading screen does not draw a hero part the cover brings in with its own
  Build in (`data-el-waits`, ≤ 2.5 s, its place kept) — the cover's arrival is the first time it is seen. Chosen over
  "skip the replay", which would mean the couple's Build in never plays for a guest who saw the loading screen.
- **F5 · F10 · a scene pick plays on the canvas, and ▶ plays the latest pick.** The Maker lays the scene's motion on
  the frame on screen at the tap (`scene-motion-lay.ts`) and plays the picked phase once; a frame that loads behind
  is told the latest pick on `ready`.
- **F6 · hold ▶ arrives as a guest.** On screen replays; below the screen is re-armed and arrives on scroll.
- **F7 · ▶ plays Rows: One by one** — parts and rows a stagger apart, as the guest page does (and the CSS replay).
- **F8 · ▶ ends at rest** — the page's restarted arrivals are finished when ▶'s animation comes off.
- **F11 · Slow lift** is offered only on a scene with a photo or clip behind it (or where it is already chosen).
- **F12 · Safari before 26 and Firefox** (no scroll timelines) now play every On-arrival Build in — scenes, parts,
  rows, hero parts, fixed blocks; scroll-driven arrivals play on arrival there; nothing leaves.
- **S3 · the lab's guest page** mounts the real page's observer, so labs stop reporting On arrival as broken.
- F2 (logo hidden until JS) was NOT touched — #6571 caps it; verified live (see the PR).

SPEC IMPACT: the loading screen's names (DECISION_LOG 2026-09-27 "THE EVENT HUB'S LOADING SCREEN BECOMES A SKELETON
OF THE REAL PAGE") — a hero part with its own Build in is now held undrawn on the loading screen for up to 2.5 s so it
arrives once. A builder's call under the brief's two offered options, recorded in the branch HANDOVER and the PR for
the owner's sign-off (not yet in the corpus DECISION_LOG — the local corpus checkout holds another session's
uncommitted edits to that file).
