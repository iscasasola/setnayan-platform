## 2026-11-28 · test(gown): the body-solve timing test holds a median, not one wall-clock sample

The unit test "a solve takes under 100 ms (one pass of the girth fit, after the first build)"
(`apps/web/lib/gown/body/rig.test.ts`) failed the lane whenever one sample stalled on a shared CI runner. That hit
main 6fd0a0e and ship batch #8473, neither of which touches gown code. It now does one warm-up solve, holds the
**median** of the samples to the same 100 ms budget, and allows the slowest single sample up to 400 ms, which still
catches a real slowdown. Test-only; no product code changes.

SPEC IMPACT: None — test robustness only.
