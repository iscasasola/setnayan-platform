## 2026-10-01 · perf(maker): the diet: room in the Maker first load (−30.6 KB) and the shared bundle (−0.9 KB), no feature removed

C16. Both ceilings were full: Maker first load 515,448 / 517,120 B, shared client bundle 206,836 / 206,848 B
(production build of main b02235da). Neither ceiling was raised. Each cut was measured on its own production build:

- **No Sentry debug IDs while no map is uploaded** (`next.config.ts`). `sourcemaps.disable` only emptied the upload
  list. The plugin still put a UUID snippet in front of every browser chunk, and that ID matches nothing until a map
  is uploaded. The plugin's own `sourcemaps.disable` is now passed while `sentrySourcemapsCanUpload()` is false, so
  injection comes back by itself the day uploads open. Maker −7,488 B · shared −887 B.
- **Tours stay on the server** (`app/_components/guided-tour.tsx` → server wrapper + `guided-tour-card.tsx`;
  `tour-slide-view.tsx`; `maker-tour-slides.tsx`; the guest page’s `guest-guided-tour.tsx`, mounted by `site-body.tsx` and the two Papic guest pages). Every tour's words
  (`lib/tours.ts`, ~10.5 KB gz) shipped to every page that can show one tour. The server now draws the one tour's
  slides (icons as elements) and the carousels receive only those slides. Callers and markup are unchanged.
  Maker −10.2 KB (with the cut above: −17,683 B).
- **@sentry/core leaves every event page's first load** (`lib/supabase/error-detect.ts`). The event layout's unread
  badges reach `logQueryError`, whose static Sentry import carried 13 KB gz. On the server the synchronous capture is
  unchanged. In the browser it now asks for the same lazily-loaded SDK that `deferred-observability.tsx` already
  starts at idle. Maker −12,878 B.

Totals: Maker 515,448 → 484,887 B (−30,561 B, 32,233 B spare). Shared 206,836 → 205,964 B (−872 B, 884 B spare).
⚠ The shared target (≥3 KB) was not met, and it cannot be with app code alone. 201 KB of the 205.9 KB is
Next/React framework (react-dom ×2, the app router, and the pages-router `framework` + `main` that the script counts
from `/_app` + `/_error`). The rest is the webpack runtime, whose async-chunk map is 1,827 B across 111 chunks.
Deleting the whole map would still leave the saving under 3 KB.

Guards: `lib/tours-stay-on-the-server.test.ts`, `lib/sentry-stays-out-of-the-first-load.test.ts`, and a new case in
`lib/the-build-has-headroom-ci-cannot-prove.test.ts`. Each was sabotage-checked (fix reverted → RED → restored).
`lib/tour-titles-are-text.test.ts` now reads the carousel's new file, and the render it checks is unchanged.

SPEC IMPACT: None. No behaviour, look or feature changes, and both ceilings are untouched.
