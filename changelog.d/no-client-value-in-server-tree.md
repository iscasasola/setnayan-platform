## 2026-09-12 · fix(hydration): a server file never takes a plain value from a 'use client' module

Root cause of React hydration error **#418 on ~1 load in 6 of a published story**, found by the Story's step-8 live drive (2026-09-11) and caught by patching production's `react-dom` in the test browser. `app/layout.tsx` put `<script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />` **first in `<head>`**, and `themeBootstrapScript` — a plain string — was exported from `theme-provider.tsx`, a `'use client'` module. A server component that imports a *value* from a client module gets a **client reference**, not the value: the payload carried a pointer to that file. When its JavaScript had not arrived by hydration time, the head's first child was a blocked lazy element; React paused, **replayed the head**, and its head bookkeeping ran twice — the saved body position was overwritten with the head's own first tag, and the body was then read against `<meta charset>`. React's own bug (entering a scoped singleton is not replay-safe), but only a pause *inside `<head>`* can trigger it — and the pause was ours. A person saw the story flash and redraw.

- **Four values move into plain modules**, each with the reason written at the top of the file: `themeBootstrapScript` → `app/_components/theme-bootstrap-script.ts` (the one that actually fired), `SUPPLIER_DESK_ANCHOR` → `app/[slug]/_components/supplier-desk-anchor.ts`, `APX_CSS` → `app/admin/app-performance/_components/fx-css.ts`, `BUDGET_TOP_SUMMARY_HEADER_ID` → `app/dashboard/[eventId]/budget/_components/budget-summary-ids.ts`. **No behaviour changes** — each value is byte-for-byte what it was, and still ONE constant with every file importing it from the new home.
- **Guard `lib/a-server-file-never-takes-a-value-from-a-client-module.test.ts`**: no file without `'use client'` in `app/`, `lib/` or `components/` imports, from a `'use client'` module, a name that module declares as a plain VALUE (`export const X = <string | template | number | boolean | object | array>`, or `export let/var`). Components and hooks are functions and stay fine to import — that is what client references are for. Source read through the repo's one comment stripper (`lib/strip-comments.ts`); a detector self-test; and a **population floor** — a zero population is a broken guard, not a clean repo.
- **Two reasoned exemptions, listed not hidden**, both 3D-kit internals read only inside functions a client canvas calls, both marked TO REVIEW: `plan3d/kit/booth-templates.ts ← CHASSIS_SPECS`, `plan3d/kit/outfits.ts ← fabricBumpMap`.
- `app/[slug]/_lib/a-supplier-never-sits-through-a-film.test.ts` follows the anchor to its new module and now also pins that all three files import it from there — so the constant cannot silently become two.

**Verification actually run, against this branch MERGED INTO `origin/main` (not the stale base):**

| run | resolved server→client imports | plain values among them | result |
|---|---|---|---|
| green | 895 | 0 | `# tests 2` · pass 2 · fail 0 |
| sabotage 1 — `themeBootstrapScript` back into `theme-provider.tsx`, `layout.tsx` importing it from there (the original bug, reproduced) | 896 | **1** | **fail 1**, naming `app/layout.tsx ← themeBootstrapScript` |
| sabotage 2 — `SUPPLIER_DESK_ANCHOR` back into the `'use client'` ribbon | 897 | **2** | **fail 1**, naming both importers; the ribbon guard also went 5 pass → 4 pass / 1 fail |
| restored | 895 | 0 | pass 2 · fail 0 |

Both sabotages were derived from the assertion, applied to a committed tree, and restored — the population returning to 895 is what proves the restore was complete. The ribbon guard was run as `app/?slug?/_lib/...` and reported `# tests 5`; a `[slug]` path runs zero tests and exits 0, which reads exactly like a pass.

Guards run beyond the unit suite, each green: `lint-one-comment-stripper` (291 known, unchanged) · `lint-dup-rule-baseline` · `lint-port-no-lost-controls` (427 routes / 1550 controls) · `lint-server-only-boundary` (735 client files, 289 server-only modules, no value import crosses the boundary) · `lint-changelog-dir`.

SPEC IMPACT: `Design_Editorial_By_The_Minute_2026-09-07/step8_end_to_end_drive/10a-evidence.md` — the `[chaos/chaos-02]` row calls #418 "unexplained, not fixed" and records it on the public story page in 6 of 32 loads. Amended to record the root cause and this PR. The Story Maker's own one-off error pair stays listed as still to be re-checked after this ships — it is suspected to be the same cause, and suspicion is not a measurement.
