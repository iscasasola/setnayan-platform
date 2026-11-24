// Types for read-only-db.mjs — the one read-only door to the live catalogue (so TypeScript callers such as
// scripts/staging/copy-catalog.ts get the same signatures the .mjs callers use).
export declare const DB_URL_VARS: readonly string[];
export declare function dbUrlVar(env?: NodeJS.ProcessEnv): string | null;
export declare function assertSelectOnly(sql: string): string;
export declare function scrub(text: unknown, env?: NodeJS.ProcessEnv): string;
export declare function readRows(
  sql: string,
  opts?: { env?: NodeJS.ProcessEnv; spawn?: unknown },
): { ok: true; rows: Array<Record<string, unknown>>; via: string } | { ok: false; reason: string };
