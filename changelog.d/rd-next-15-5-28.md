## 2026-10-25 · fix(security): Next.js 15.5.27 → 15.5.28, shared bundle kept under the 202KB lock

Security release: GHSA-2464-fhr4-w9xw (image optimizer RCE via SVG) and GHSA-p3m5-59mp-jv5r (Server
Actions DoS). Same bump as Dependabot #6857 (`next` in `apps/web/package.json` + lockfile, next only).

The bump alone measured 207,355 B gzipped shared bundle, 507 B over the 202KB ceiling (local
`next build` with CI's env; CI read 202.5KB on #6857). All of that growth is framework code. The only
app-controlled bytes in the shared bundle are the webpack runtime's chunk filename map (3,151 of its
5,489 B gz, 184 lazy chunks). `next.config.ts` now gives client production chunks one filename shape
(`[name]-[contenthash:10].js` for both initial and lazy chunks) instead of two, so the 66 chunks that
are both get map entries instead of a long `id===e?"…":` chain, and the hash is 10 hex instead of 16.

Result: 206,519 B (201.7KB), 329 B headroom. Budget NOT raised. Webpack runtime 5,489 → 4,653 B gz.
All 184 runtime chunk URLs checked to resolve to files on disk. File contents unchanged; only chunk
names change. 10 hex still matches the service worker's content-hashed `IMMUTABLE_PATH` (≥ 8 hex).

SPEC IMPACT: None
