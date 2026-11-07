/**
 * Types for the Field-template ratchet, authored in plain `.mjs` so CI runs it before `pnpm install`.
 * `lib/field-template-guard.test.ts` imports these to execute the matcher and the ratchet, not just read them.
 */
export type RawBox = { lineNumber: number; text: string };
export type Drift = { rel: string; count: number; allowed: number };
export declare const WEB_ROOT: string;
export declare const BASELINE_PATH: string;
export declare const MIN_FILES: number;
export declare const TEMPLATE_FILES: Set<string>;
export declare function openingTag(src: string, start: number): string | null;
export declare function attrOf(tag: string, attr: string): string | null | undefined;
export declare function isRawTypedBox(tag: string): boolean;
export declare function rawBoxes(source: string): RawBox[];
export declare function scan(webRoot?: string): {
  files: number;
  counts: Record<string, number>;
  hits: Record<string, RawBox[]>;
};
export declare function parseBaseline(text: string): Record<string, number>;
export declare function formatBaseline(counts: Record<string, number>): string;
export declare function compare(counts: Record<string, number>, baseline: Record<string, number>): { rose: Drift[]; fell: Drift[] };
