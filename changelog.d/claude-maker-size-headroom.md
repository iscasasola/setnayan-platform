## 2026-11-04 · perf(maker): the Supabase browser client leaves the Maker's first load — 507.4 KB → 453.0 KB

The Maker's first-load JS sat at its 507.5 KB ceiling on `main` (0.0–0.1 KB headroom), so nine open PRs failed
`bundle size check` by 0.1 KB. The budget, the measurement and the check are unchanged; the first load got smaller.

**What was in it that did not need to be.** The whole browser client — supabase-js plus its auth client, ~43 KB
gzipped (≈58 KB across 17 modules counted standalone) — was in the first load of every signed-in page only because
three files imported `@/lib/supabase/client` statically, and none of them uses it before the page has drawn:

- `lib/desktop-oauth.ts` — read on every page by the root providers' desktop-updater listener (`isTauri`/`tauri`);
  the client is only needed inside `signInWithProviderDesktop`, which only the desktop shell's sign-in button calls.
  It now `import()`s the client there.
- `app/_components/unread-bell-badge.tsx` and `unread-messages-badge.tsx` — they already `import()` their poll after
  paint; the client now loads in parallel with it (and with the bell pop-over's rows when it opens).

Behaviour is identical: the polls start when both chunks are in, the pop-over still reads when it opens, and desktop
sign-in still creates the client before it starts the loopback.

**Measured** (local `next build`, `node scripts/check-maker-js-budget.mjs`): before 507.4 KB / 48 chunks (0.1 KB
headroom) → after 453.0 KB / 47 chunks (**54.5 KB headroom**). Shared client bundle (`check-bundle-size.mjs`) still
within its 202 KB lock (14 B to spare locally — that ceiling is tight on `main` independently of this change).

**The shared bundle paid for it in the webpack runtime (merge with `main`, 2026-11-04).** Every lazy chunk is one
more entry in the runtime's chunk-name map, which loads on every page: the client's three new lazy chunks added 42 B
gzipped, and with `main` sitting ~26 B under its 202 KB lock the shared total read 206,864 B against 206,848 B — 16 B
over (`check-bundle-size.mjs`). The fix is the lever `next.config.ts` already documents for this map: chunk hashes go
from 10 to 9 hex (36 bits; the service worker needs ≥ 8). Runtime 4,999 → 4,860 B gzipped (−139 B), so the shared
bundle sits ~123 B under the lock. The lock itself is unchanged.

SPEC IMPACT: None — no budget, price or decision changed; the Maker budget's ceiling and comment are untouched.
