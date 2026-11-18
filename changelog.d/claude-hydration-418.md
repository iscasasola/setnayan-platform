## 2026-11-18 · fix(public): W5 B3 — React #418 on every /u/<slug> load was a CSS comment naming "<style>"

**Cause, measured on live www.setnayan.com (`deployed-prod` 7dd8a59a), signed out:**
- `/u/icecasa` threw React error #418 (`args[]=text`) on **6 of 6** loads, phone and desktop. Every
  other public path walked (`/`, `/testw2walkcakes`, `/v/testw2walkcakes`, `/login`, `/signup`,
  `/explore`, `/features`, `/start`, `/suppliers`) threw nothing in ~90 loads.
- Every POST was aborted in the walk, so neither the view beacon nor any server action was involved.
- Instrumented `textContent`/`nodeValue` reads during hydration: the ONLY read before the throw was
  the page's `<style>{UPROF_CSS}</style>`. Its CSS comment ended "…rather than shipping a second
  `<style>` block." React's server renderer rewrites `<style`/`</style` inside `<style>` children to
  the CSS escape `<\73 tyle` (react-dom-server `styleReplacer`), so the served text no longer equals
  the client string and hydration fails on every load.

**Fix:** the comment says "style block" (`app/u/[userSlug]/page.tsx`), with a warning beside
`UPROF_CSS`. **Guard:** `lib/a-style-tag-never-names-a-style-tag.test.ts`. It pins the React
mechanism, then checks every `<style>{CONST}</style>` in app/, lib/ and components/ (same-file and
imported const templates; 23 resolve today) with a detector self-test and a population floor. It
fails on main naming `UPROF_CSS` and passes here.

**Ruled out with evidence:**
- `lib/stylesheet-recovery.ts`: its `#sn-css-failed` bar was present on 0 of 60 loads.
- The front-page POST to `/api/telemetry/client-fault` is the designed load-time log. Its body is
  `{"loads":[{"kind":"page","route":"/","outcome":"painted",…}]}` (`lib/telemetry/load-reporter.ts`).
- **The extra 404 was not reproduced** on the current build: 0 × 4xx in ~90 loads, headless and
  headed, plus every icon, apple-touch, manifest and manifest-icon href on 6 public pages answering 200.

SPEC IMPACT: None
