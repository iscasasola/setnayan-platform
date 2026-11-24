// ts-alias-hooks — resolve hooks so a READ-ONLY audit script can import a pure
// apps/web/lib/*.ts module with `node --experimental-strip-types`, without
// installing anything: `@/x` → apps/web/x, and extensionless relative imports
// → the .ts / .tsx / index.ts file that exists. Used by dead-paths.mjs to ask
// lib/legacy-redirects.ts (the middleware's own retired-page table) directly,
// instead of keeping a second copy of that table here.

import { existsSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'apps', 'web');

function withExt(base) {
  for (const cand of [base, `${base}.ts`, `${base}.tsx`, join(base, 'index.ts')]) {
    if (existsSync(cand) && statSync(cand).isFile()) return cand;
  }
  return null;
}

export async function resolve(specifier, context, next) {
  if (specifier.startsWith('@/')) {
    const hit = withExt(join(WEB, specifier.slice(2)));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
    const hit = withExt(join(dirname(fileURLToPath(context.parentURL)), specifier));
    if (hit) return next(pathToFileURL(hit).href, context);
  }
  return next(specifier, context);
}
