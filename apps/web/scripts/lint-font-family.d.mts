/**
 * Types for the named-font ratchet, authored in plain `.mjs` so CI runs it before `pnpm install`.
 * `lib/font-family-guard.test.ts` imports these to execute the matcher and the ratchet.
 */
export type FaceLine = { lineNumber: number; text: string; hits: string[] };
export declare const WEB_ROOT: string;
export declare const BASELINE_PATH: string;
export declare const MIN_FILES: number;
export declare const NOT_SCANNED: RegExp[];
export declare const NAMED_FACES: string[];
export declare function facesOnLine(line: string): string[];
export declare function faceLines(source: string, file?: string): FaceLine[];
export declare function countOf(found: FaceLine[]): number;
export declare function scan(webRoot?: string): {
  files: number;
  counts: Record<string, number>;
  hits: Record<string, FaceLine[]>;
};
export declare function parseBaseline(text: string): Record<string, number>;
export declare function formatBaseline(counts: Record<string, number>): string;
export declare function compare(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): { rel: string; count: number; allowed: number }[];
