## 2026-08-16 · fix(stories): the page stops re-capping the shell's column — Home and Stories now render the same width, the same cards

Owner, on a screenshot of Home beside Stories: *"why is it on home, you fill the main body corner to corner while other pages are not?"*

**He was right, and it is the SAME complaint as 2026-08-14 ("ours look too big as compared to the proper sizing"), one page over.** That one was fixed at the source: `.fd-col` was uncapped from 1064px to 1600px so the front-door feed stopped rendering 254px cards against YouTube's ~390. **Home got the wide column. `/realstories` never did** — it still carried the `mx-auto w-full max-w-5xl px-4 … lg:px-8` it was written with back when it had no rail beside it.

**Measured before the fix, at a 1728px viewport:** the shell offered a 1440px column; this page painted a 1024px strip inside it with ~280px of dead cream on each side, and its own `lg:px-8` on top of `.fd-main`'s 24px. One rail-click from Home changed the apparent product.

**Measured after, on the running dev server — parity, not approximation:**

| | column | left gap | right gap | grid | card |
|---|---|---|---|---|---|
| `/` (Home) | 1440 | 264 | 24 | 4 across | **348px** |
| `/realstories` | 1440 | 264 | 24 | 4 across | **348px** |

Phone (375): 16px gutters both sides, `scrollWidth === innerWidth` — no horizontal overflow.

### 🔑 A page that wears a shared shell must not re-cap the shell's column

`.fd-col` already caps at 1600 and centres; `.fd-main` already pays the gutter (24px, 16px below 1024). A second `mx-auto max-w-*` on top is not "safe extra" — **it is a narrower answer to a question the shell has already answered, and it wins.** The marketplace hit this exact wall and went further still (`bleed`), on the owner's word, in PR #655. The signed-in app variant already solved it globally (`.fd[data-chrome='app'] .fd-main { padding: 0 }` + `.fd-col { max-width: none }`); the **doorway** variant has no such passthrough, so every doorway page's own cap is load-bearing.

### The reading width is not deleted — it moved down a level

The intro keeps `max-w-2xl` and the CTA keeps `max-w-xl`, because a 1552px line of prose is unreadable. **What widens is the SHELF**, which is the only thing on this page that wanted the room.

### The grids had to move with it, or the fix would have shipped half-done

Uncapping alone would have rendered `lg:grid-cols-3` at ~500px cards — the same page-looks-different complaint arriving through the grid instead of the cap. All card grids gain `xl:grid-cols-4` (Home's count), and "Most loved" goes `xl:grid-cols-3` so its picks stay visibly larger than the shelf below without becoming two 770px billboards.

🔒 **The headless continuation had to track them.** The grid after "The archive" has **no heading by design** (one-shelf decision, 2026-08-13) — its whole legibility rests on rendering in the same rhythm as the grids above. Widening three of four grids would have silently re-separated the shelf that decision merged. `stories-search.tsx`'s result grid moved too: the search view and the browse view are one shelf seen two ways.

### The guard, and what it cannot do

`app/realstories/stories-fills-the-shell.test.ts` — 4 assertions, **each mutation-proved with the occurrence count printed before → after**: restoring `max-w-5xl` on `<main>` (1→1 landed) ✗ · restoring `px-4` (landed) ✗ · dropping `xl:grid-cols-4` from the headless continuation only (4→3) ✗ · dropping it from all four (4→0) ✗✗ · diverging the search grid (1→0) ✗. Baseline green, restored green.

⚠ **These are TEXT guards and cannot see a rendered width.** A cap arriving from a wrapper, a plugin or an `@apply` would pass every assertion. The numbers in the table above came from `getBoundingClientRect` in a browser, not from the guards. Do not upgrade "the guards pass" to "the page fills the column".

🪤 **`$?` after a pipe is the pipe's, not the command's.** The first typecheck run printed `tsc exit=0` while tsc had actually died with a V8 stack dump; re-run unpiped it returned **exit 2** with three real type errors in the new test file (`noUncheckedIndexedAccess` on `m[1]` / `distinct[0]`). Fixed, then green. A green that came through `| tail` is not a green.

### Not changed, and why

`/pricing` (`max-w-5xl`), `/about` (`max-w-4xl`), `/privacy` (`max-w-3xl`) keep their narrow columns — **those are reading pages and a narrow measure is correct typography, not a defect.** `/explore` already runs `bleed`. `/help` and `/alaala` sit at `max-w-6xl` (1152) and were left alone deliberately; they are the remaining candidates if the owner wants every doorway to match.

SPEC IMPACT: None — layout only. No SKU, price, schema, copy or route change.
