## 2026-10-02 · perf(maker): the Maker preloads all its tools once it opens, and a host's app code loads in the background

Owner, 2026-10-02 (DECISION_LOG "THE MAKER DOWNLOADS ALL ITS TOOLS RIGHT AFTER IT OPENS — EVERY TAP IS INSTANT",
"THE MAKER'S TOOL PRELOAD SHOWS AS A THIN LINE UNDER THE TOP BAR", "A HOST'S WHOLE APP LOADS ONCE, IN THE
BACKGROUND…" and "THE PRELOAD FOLLOWS WHAT THE ACCOUNT HAS").

- **One preload queue** (`lib/app-preload.ts`). It starts after the page has loaded and runs one job per idle
  moment, in order. Nothing is queued when Save-Data is on. A key that has loaded is never fetched again, and a
  key that failed is asked again later. Both callers below share it, and the Maker's jobs go first.
- **One registry of Maker tools** (`launch/_components/maker-tools.tsx`). It lists Details' pieces, the scene
  style rows and Post Event presets, Love Story, Schedule, Mood Board, Seat plan, the march, and the Logo's
  outline maker. The Maker hands all of it to the queue once it is idle.
- **Warming, not just fetching** (`lib/warm-dynamic.ts`). Measured on a phone profile: the old idle prefetch
  had already fetched these chunks, and taps still took 300–800 ms behind a skeleton. `next/dynamic` draws
  through `React.lazy`, which suspends on its first render even when the code has already arrived, and React
  then holds the real piece back 300 ms behind its placeholder. Warming starts each stand-in's own loader, so
  the first tap draws the real panel with no placeholder. A failed warm is reset, so a later tap still loads
  the panel.
- **The thin line** (`maker-preload-line.tsx`). A hairline under the top bar fills as tools arrive and fades out
  at 100%. It reaches 100% only when every tool has loaded. It is hidden under Save-Data and when the tools were
  already loaded, and with reduced motion it does not animate.
- **The account's app code** (`app/_components/app-preload.tsx` + `lib/app-preload-sets.ts`). A signed-in
  landing (account home, an event's pages, the shop) preloads by what the account has:
  - hosts get every page of their event's menu, including the Maker;
  - a shop gets Today · Customers · Shop · More and More's rows;
  - a guest-only account gets nothing;
  - admin and public pages are never preloaded.

  Each page's code is fetched into the browser cache. `router.prefetch` was measured not to bring the
  JavaScript. Loading by `import()` from these layouts grew the shared runtime by 139–176 B, so plain fetches
  are used instead, which leave it unchanged. Data stays fresh on the tap. The plan comes from data the layouts
  already read, so it adds no query.
- Removed: the old per-stand-in `prefetch*()` helpers and the navigator's hover prefetch. They were replaced by
  the queue above, so there is one mechanism.

Guards: `maker-tools-are-all-preloaded.test.ts` (every `import()` the Maker can run is in the registry or is
listed as not-a-tool with a reason; the whole registry is queued; the line fills only when every tool has
loaded), `lib/app-preload.test.ts`, `lib/app-preload-sets.test.ts`, `lib/warm-dynamic.test.ts` (run against the
installed React + Next). Each was sabotage-checked.

SPEC IMPACT: None. The decision rows are already in DECISION_LOG (2026-10-02); this implements them.
