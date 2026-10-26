/**
 * Types for the raw-colour ratchet, authored in plain `.mjs` so CI runs it before `pnpm install`.
 * `lib/raw-colour-guard.test.ts` imports these to execute the matcher and the ratchet.
 */
export type RawHit = { kind: 'hex' | 'fn' | 'triple' | 'legacy' | 'role-alpha'; text: string };
export type RawLine = { lineNumber: number; text: string; hits: RawHit[] };
export declare const WEB_ROOT: string;
export declare const BASELINE_PATH: string;
export declare const MIN_FILES: number;
export declare const NOT_SCANNED: RegExp[];
export declare const ROLES: Set<string>;
export declare function classifyColour(name: string, opacity: string | undefined): 'legacy' | 'role-alpha' | null;
export declare function rawOnLine(line: string): RawHit[];
export declare function rawLines(source: string, file?: string): RawLine[];
export declare function countOf(found: RawLine[]): number;
export declare function scan(webRoot?: string): {
  files: number;
  counts: Record<string, number>;
  hits: Record<string, RawLine[]>;
};
export declare function parseBaseline(text: string): Record<string, number>;
export declare function formatBaseline(counts: Record<string, number>): string;
export declare function compare(
  counts: Record<string, number>,
  baseline: Record<string, number>,
): { rel: string; count: number; allowed: number }[];
