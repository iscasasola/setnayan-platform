## 2026-11-17 · perf(rise): a sheet mounts once on a tap; the rise moves on its own layer; shell first

Owner, 17 Nov: *"we need a fix on how pages grow full screen. since it shows, it feels like it is lagging."*

- `lib/use-portal-host.ts` — `useSyncExternalStore` instead of `useState(null)` + `useEffect(setHost(body))`. Every
  sheet opened by a tap (the shared `Sheet`, `RiseScreen`, the picked client, and 10 other users of the hook) rendered
  twice before it could move — in place, then remounted into the portal, every child mounted a second time. Now one
  render; the server snapshot keeps hydration drawing in place exactly as before. The ⚙'s private `OnBody` uses it too.
- `lib/rise-layer.ts` (`onItsOwnLayer`) — both clip-path rises (RiseScreen, picked client) get `will-change` for the
  length of the motion, open and close, and drop it on finish or cancel. Same frames, timing and easing.
- `RiseScreen` paints its shell on the tap's frame and renders the body right after in a transition — only behind a
  tap; a deep link or server HTML has the body at once.
- 🔒 `lib/a-sheet-mounts-once-on-a-tap.test.ts` (4 tests, each sabotaged red once). The picked-client guard's open
  regex accepts the wrapper.

Nothing looks different: same rise, same 0.7 s (`RISE_MS`), same look.

SPEC IMPACT: None
