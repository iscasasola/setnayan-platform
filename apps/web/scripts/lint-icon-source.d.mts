/**
 * Types for the icon-source ratchet, authored in plain `.mjs` so CI runs it before `pnpm install`.
 * `lib/icon-source-guard.test.ts` imports these to execute the matcher and the ratchet.
 */
export type IconImport = { lineNumber: number; text: string; names: number };
export declare const WEB_ROOT: string;
export declare const BASELINE_PATH: string;
export declare const MIN_FILES: number;
export declare const THE_MAP: string;
export declare const NOT_SCANNED: RegExp[];
export declare function namesIn(clause: string): number;
export declare function iconImports(source: string): IconImport[];
export declare function countOf(found: IconImport[]): number;
export declare function scan(webRoot?: string): {
  files: number;
  counts: Record<string, number>;
  hits: Record<string, IconImport[]>;
  mapImports: number;
};
export declare function parseBaseline(text: string): Record<string, number>;
export declare function formatBaseline(counts: Record<string, number>): string;
export declare function compare(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): { rel: string; count: number; allowed: number }[];
