## 2026-08-13 · fix(build): the build stops phoning Google for type

`next/font/google` downloads every family from `fonts.gstatic.com` **at build
time**. On 2026-08-13 that fetch failed **twice in one day**, on two unrelated
PRs — Manrope on one, Hanken Grotesk on the other. Each time it presented as a
failure of the change under test, and one of them **took the e2e suite down with
it**, because the tests never got a build to run against.

🔑 **A BUILD THAT DEPENDS ON SOMEBODY ELSE'S UPTIME IS NOT REPRODUCIBLE.** The
font files never change; only our ability to reach them does.

### What changed

All **13 families** move from `next/font/google` to `next/font/local`, served
from **37 committed `.woff2` files** (1.1 MB) under `app/_fonts/`. Same faces,
same weights and styles, same `latin` subset — the exact files `next/font/google`
was fetching, downloaded once by `scripts/fetch-brand-fonts.mjs`.

⚠ **The download script's User-Agent is load-bearing:** Google serves `.ttf` to
unknown agents and `.woff2` only to agents it recognises as modern. Without it
you silently get files ~4× larger. The script refuses to write a **partial**
family for the same reason — a missing weight renders as a browser-synthesised
fake, which looks almost right and is not.

`adjustFontFallback` is now stated explicitly per family (serif faces get
`'Times New Roman'`, sans and mono get `'Arial'`), because `next/font/google`
derived those metrics automatically and local files cannot.

### Verified

- **37 src entries · 37 files on disk · 0 missing · 0 orphaned**, and every
  per-family count matches the original weight list exactly.
- Every file carries the real `wOF2` magic signature (8.7 KB–45.6 KB).

### Guard

`lint-fonts-are-local.mjs` fails when anything imports `next/font/google`, when
a declared path does not exist, when a committed face is referenced by nothing,
or when a font file is a stub.

🛡 **Mutation-tested four ways — a returning google import, a typo'd path, a
dropped face, and a truncated file — all four RED, all restored byte-identical.**
It also fails if it finds **zero** declarations, because a guard that silently
checks nothing reads exactly like a passing one.

🔌 **Wired into `ci.yml` with all THREE required edits** — the step (`id:` +
`continue-on-error:`), the **env binding**, and the `check '...'` line. Missing
any one of the three makes a guard run but never fail the job; this repo has
shipped that mistake before.

SPEC IMPACT: None.
