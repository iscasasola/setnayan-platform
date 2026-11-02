# Changelog fragment — collected into CHANGELOG.md by scripts/changelog-collect.mjs

## 2026-07-16 · chore(deps): resolve 2 of 14 dependabot alerts

Triaged all 14 open Dependabot alerts (7 high · 6 moderate · 1 low). Shipped the two lockfile-only resolution bumps that fix a real vulnerable install in the **apps/web** (pnpm workspace) tree and pass every gate (install · typecheck · 1858-test unit suite · apps/web production build). Both are added as `pnpm.overrides` scoped to the vulnerable sub-range within the same major, so no parent gets a breaking bump.

- **js-yaml** (#34 · moderate · runtime) — `js-yaml@>=4.0.0 <4.2.0 → ^4.2.0` (resolved 4.1.1 → 4.3.0). Quadratic-complexity merge-key DoS. Pulled by `@eslint/eslintrc`. Minor bump within v4.
- **esbuild** (#17 · low · dev) — `esbuild@>=0.27.3 <0.28.1 → ^0.28.1` (resolved 0.28.0 → 0.28.1). Windows dev-server arbitrary file read. Pulled by `tsx` (root devDep). Patch bump.

**Flagged — NOT forced (major-version migration or code change required, or isolated non-gated tree):**

- **@opentelemetry/core** (#32 · moderate · runtime) — installed 1.30.1, pinned by `@sentry/nextjs@8.55.2`'s 1.x OTel tree. Patch floor is 2.8.0; forcing it is a **major** 1→2 jump that breaks Sentry 8.x's peer graph. Blocked on `@sentry/nextjs` 9.x/10.x migration (~medium: SDK-config + init changes). W3C-Baggage memory-DoS not on any request path Setnayan exposes. (Existing `@opentelemetry/core@>=2.0.0 <2.8.0 → ^2.8.0` override already covers the 2.x instance.)
- **uuid** (#6 · moderate · runtime; #16 · moderate · dev) — installed 9.0.1 under `@sentry/webpack-plugin` (build-time source-map upload), and 7.0.3 in the mobile toolchain. Patch floor is 11.1.1 — a **2-major** jump under a pinned parent. Vuln is a missing buffer bounds check only when a `buf` arg is passed to v3/v5/v6; Sentry never passes `buf`. Not force-bumped. (Existing `uuid@>=11.0.0 <11.1.1 → ^11.1.1` override covers the 11.x instance.)
- **tar** (#7/#8/#9/#10/#14/#15 · high; #19 · moderate — all dev) — the top-level `tar` in `apps/mobile` is already **7.5.16 (patched)**; only `@capacitor/assets`'s nested `tar@6.2.1` remains vulnerable. `apps/mobile` is the Capacitor native shell — a **separate npm project excluded from the pnpm workspace** (`!apps/mobile`), dev-only asset-generation tooling that never ships to the Vercel/Supabase/R2 runtime and is not covered by the CI gates. Fix = `tar` 6→7 **major** under `@capacitor/assets`, unverifiable by the pnpm gates. Recommend a separate mobile-lockfile refresh.
- **minimatch** (#13 · high · dev) — pnpm tree is already on 3.1.5+ (patched). The vulnerable `minimatch@3.0.5` lives under `replace` → `@capacitor/assets` in `apps/mobile` only (same isolated dev toolchain as tar). ReDoS on trusted glob patterns in a local build tool. Same follow-up.
- **glib** (#2 · moderate · runtime) — Rust crate in `Cargo.lock` (Tauri desktop shell), not the JS lockfile. `Iterator`/`DoubleEndedIterator` unsoundness in `VariantStrIter`. Fix is a 0.15→0.20 **major** across the gtk/tauri stack — separate Cargo ecosystem, separate PR.

SPEC IMPACT: None — dependency/lockfile hygiene only; no product surface, pricing, schema, or behavior change.
