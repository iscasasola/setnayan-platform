## 2026-11-19 · perf(ci): typecheck heap ~11.4 GB → ~7.8 GB — a type-only fast path for supabase `.select('a, b, c')`

**Cause (measured on GitHub ubuntu-latest, `tsc --extendedDiagnostics`):** every Supabase client in
apps/web is untyped (no `Database` generic), yet `@supabase/postgrest-js` still parses each
`.select('…')` string literal character by character at the type level to build `{ col: any, … }`.
With ~5,500 select literals that parser was **20.8M of 24.9M instantiations** and ~3.5 GB of an
~11.4 GB heap, so `pnpm typecheck` (10240 MB cap) sat on the edge and OOMed (exit 134) at random.

**Fix:** `patches/@supabase__postgrest-js@2.105.4.patch` (pnpm `patchedDependencies`, TYPE-ONLY —
`dist/index.d.{mts,cts}`, no runtime file). A plain column list resolves straight to
`{ a: any; b: any; c: any }`; anything else (embeds, aliases, casts, `*`, quotes, `count`) falls
through to the original parser. Proved type-identical on every distinct select literal in the repo
plus edge cases before shipping. No `any` added, nothing excluded from checking.

**After:** heap ~7.8 GB, 8.1M instantiations, types 4.50M → 2.91M, 0 errors (same as before).

⚠ Upgrading `@supabase/postgrest-js` fails `pnpm install` until the patch is regenerated or removed.

SPEC IMPACT: None
