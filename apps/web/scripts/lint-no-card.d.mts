/**
 * Types for the no-card ratchet, authored in plain `.mjs` so CI runs it before
 * `pnpm install`. `lib/no-card-guard.test.ts` imports these to execute the
 * matcher and the ratchet, not just read them.
 */
export declare const WEB_ROOT: string;
export declare const BASELINE_PATH: string;
export declare const MIN_FILES: number;
export declare function holdsCard(line: string): boolean;
export declare function elementOf(lines: string[], i: number): string | null;
export declare function cardLines(source: string): { lineNumber: number; text: string }[];
export declare function scan(webRoot?: string): {
  files: number;
  counts: Record<string, number>;
  hits: Record<string, { lineNumber: number; text: string }[]>;
};
export declare function parseBaseline(text: string): Record<string, number>;
export declare function formatBaseline(counts: Record<string, number>): string;
export declare function compare(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): { rel: string; count: number; allowed: number }[];
