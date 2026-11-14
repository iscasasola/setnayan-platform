/**
 * EVERY FILE THE HELP PROSE LIVES IN — for guards that read help as TEXT.
 *
 * Until 2026-11-14 every public answer was in lib/help.ts, and about fifteen
 * guards read that one file as text. The help split moved the answers into
 * lib/help/*.ts (one file per answer-writing session). A guard still reading
 * lib/help.ts alone would then scan a file with no answers in it and pass
 * forever — the inert-guard shape. So every such guard reads THIS list, which
 * is computed from the directory: a slot file added later is scanned the day
 * it appears, with no guard edit.
 *
 * `PUBLIC_HELP_SOURCES` — lib/help.ts + every lib/help/*.ts (repo-relative).
 * `ADMIN_HELP_SOURCES` — lib/help-admin.ts + every lib/help-admin/*.ts.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function dirSources(rel: string): string[] {
  return readdirSync(join(WEB, rel))
    .filter((f) => f.endsWith('.ts') && !/\.test(?:-helper)?\.ts$/.test(f))
    .sort()
    .map((f) => `${rel}/${f}`);
}

export const PUBLIC_HELP_SOURCES: readonly string[] = ['lib/help.ts', ...dirSources('lib/help')];
export const ADMIN_HELP_SOURCES: readonly string[] = ['lib/help-admin.ts', ...dirSources('lib/help-admin')];

/** The public help's source text, every file joined (each prefixed by a `// file:` line). */
export function publicHelpSourceText(): string {
  return PUBLIC_HELP_SOURCES.map((rel) => `// file: ${rel}\n${readFileSync(join(WEB, rel), 'utf8')}`).join('\n');
}

/** The admin help's source text, every file joined. */
export function adminHelpSourceText(): string {
  return ADMIN_HELP_SOURCES.map((rel) => `// file: ${rel}\n${readFileSync(join(WEB, rel), 'utf8')}`).join('\n');
}
