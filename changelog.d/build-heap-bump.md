## 2026-07-05 · fix(build): raise Next build heap 4096 → 7168 MB (prod deploys OOM-failing)

Production Vercel builds were failing with `FATAL ERROR: … JavaScript heap out of
memory` — the last successful prod deploy was #2819; #2820 (/for-vendors → /vendors
rename) and #2821 (phase-2 schema) both OOM'd at the 4 GB `--max-old-space-size` cap,
freezing prod on the pre-rename deploy (so `/vendors` and everything after it never
went live). The build had already grown past 4 GB despite `webpackMemoryOptimizations`
+ `cpus: 1` (the recurring #1258 OOM). Raised `--max-old-space-size` to 7168 MB (fits
the 8 GB Vercel builder with overhead) to clear it and give headroom.

SPEC IMPACT: None (build config only). Follow-up worth considering: a deeper build
memory-profile if the high-water mark keeps climbing.
