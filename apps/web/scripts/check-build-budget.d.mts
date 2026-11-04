/**
 * Types for check-build-budget.mjs, so `lib/the-build-stays-fast.test.ts` can
 * run the checks themselves, not only read them.
 */
export declare const STATIC_PAGE_CEILING: number;
export declare const BASELINE_SECONDS: number;
export declare const SLOWER_WARN_RATIO: number;
export declare function checkBuildBudget(opts?: { nextDir?: string; buildSeconds?: number }): {
  errors: string[];
  warnings: string[];
  staticPages: number | null;
};
