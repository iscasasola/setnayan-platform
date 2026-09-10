/**
 * no-server-file-carries-public.test.ts
 *
 * 🚨 ONE LINE PUT ALL OF public/ INSIDE A SERVER FUNCTION, AND IT STOPPED
 * EVERY PRODUCTION DEPLOY.
 *
 * `lib/reception-decor-layers-server.ts` read a decor image off disk with
 * `readFile(path.resolve(path.join(process.cwd(), 'public'), <path>))`. Next's
 * file tracer (@vercel/nft) cannot know which file that will be, so it copies
 * EVERY file under the root it can see into the server function: 951 files ·
 * 117 MB of demo films, onboarding clips and Real Story photos — none of which
 * that code can ever read, all of which the CDN already serves. Nothing failed.
 * The vendor mood-board function simply sat within ~2 MB of Vercel's 250 MB
 * ceiling from 2026-09-06, and on 2026-09-10 the Next.js 15.5.24 security
 * update (+ a few KB of framework) tipped it to 252.37 MB. From that moment no
 * change of any kind could reach production — including the security fix.
 *
 * 🔑 THE DEFECT IS INVISIBLE TO EVERY OTHER CHECK. Typecheck, lint, unit tests
 * and the CI production build all pass; only Vercel measures function size,
 * and only at deploy time, and only as a number with no name attached.
 *
 * WHAT THIS GUARD DOES — the file set is DERIVED, never listed (a hand list is
 * a list of the files somebody thought of):
 *   1. find every non-test server file under lib/ and app/ whose code (comments
 *      stripped) builds a path from `process.cwd()` — the shape that makes the
 *      tracer copy a directory;
 *   2. trace each one ALONE with Next's own compiled tracer, the same
 *      `base`/`processCwd` Next passes, following only that file's own disk
 *      reads (its imports are ignored — they are traced as files of their own);
 *   3. fail when any of them carries a part of `public/` it was not given
 *      (`ALLOWED_PUBLIC`), or more than `MAX_ASSET_MB` of files at all.
 *
 * It traces the SOURCE (transpiled in memory — nothing is written to disk),
 * not webpack's output. The two agree on this shape: the 117 MB this guard
 * measures on the pre-fix source is the same 117 MB that stopped the deploy.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, promises as fsp } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { stripComments } from './strip-comments';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(WEB_DIR, '../..');
const require = createRequire(import.meta.url);

type Ts = typeof import('typescript');
type NftResult = { fileList: Set<string> };
type Nft = {
  nodeFileTrace: (
    files: string[],
    opts: {
      base: string;
      processCwd: string;
      mixedModules: boolean;
      readFile: (p: string) => Promise<string | null>;
      ignore: (p: string) => boolean;
    },
  ) => Promise<NftResult>;
};
const ts = require('typescript') as Ts;
// The tracer Next itself runs at build time — not a second copy of nft that
// could drift from it.
const nft = require('next/dist/compiled/@vercel/nft') as Nft;

/**
 * The one part of public/ a server file may carry, and why. Adding a line here
 * is deciding that a server function ships those bytes on every cold start —
 * write the size and the reason, not just the path.
 */
const ALLOWED_PUBLIC: Record<string, readonly string[]> = {
  // Decor-layer pilot: reads the seeded venue drawings off disk to retint them
  // server-side. `isCompositableDecorHref` admits only `/moodboard-seed/…`.
  // ~9.2 MB, 64 files (2026-09-10).
  'lib/reception-decor-layers-server.ts': ['apps/web/public/moodboard-seed/'],
};

/**
 * Per-file ceiling on everything a single file's own disk reads drag in. The
 * biggest legitimate one today is the decor seed (~9.2 MB); the NSFW model
 * (~4.2 MB) is the next. Vercel's whole-function ceiling is 250 MB, shared by
 * every route grouped into that function, so one file taking tens of MB is
 * already a question worth being asked.
 */
const MAX_ASSET_MB = 20;

const PROBE_SUFFIX = '.__nft_probe__.cjs';

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const abs = path.join(dir, name);
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) {
      out.push(abs);
    }
  }
  return out;
}

/** Every server file whose code — not a comment about it — builds a path from process.cwd(). */
function cwdReaders(): string[] {
  const files = [...walk(path.join(WEB_DIR, 'lib')), ...walk(path.join(WEB_DIR, 'app'))];
  return files
    .filter((abs) => /\bprocess\.cwd\(\)/.test(stripComments(readFileSync(abs, 'utf8'))))
    .map((abs) => path.relative(WEB_DIR, abs).split(path.sep).join('/'))
    .sort();
}

type Traced = { rel: string; files: string[]; bytes: number };

async function traceAlone(rel: string): Promise<Traced> {
  const src = path.join(WEB_DIR, rel);
  const probe = src + PROBE_SUFFIX;
  const js = ts.transpileModule(readFileSync(src, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
  const result = await nft.nodeFileTrace([probe], {
    base: REPO_ROOT,
    processCwd: WEB_DIR,
    mixedModules: true,
    // The probe exists only in memory; everything else is read from disk.
    readFile: async (p) => (p === probe ? js : fsp.readFile(p, 'utf8').catch(() => null)),
    // Follow THIS file's own reads only. Its imports are modules, traced as
    // entries of their own; following them here would charge one file for
    // another's bytes.
    ignore: (p) =>
      p.includes('node_modules') || (/\.(ts|tsx|js|cjs|mjs|jsx)$/.test(p) && !p.endsWith(PROBE_SUFFIX)),
  });
  const files = [...result.fileList].filter((f) => !f.endsWith(PROBE_SUFFIX)).sort();
  let bytes = 0;
  for (const f of files) {
    try {
      bytes += statSync(path.join(REPO_ROOT, f)).size;
    } catch {
      /* a directory entry or a vanished file carries no bytes */
    }
  }
  return { rel, files, bytes };
}

const mb = (n: number) => (n / 1048576).toFixed(2);

test('the file set is derived, and it is not empty', () => {
  const readers = cwdReaders();
  // Anti-vacuity: 13 such files exist today (2026-09-10). A walker that silently found none
  // would make every assertion below pass against nothing.
  assert.ok(
    readers.length >= 10,
    `found only ${readers.length} server files that build a path from process.cwd() — ` +
      'the walker or the comment stripper is broken, not the codebase',
  );
  for (const allowed of Object.keys(ALLOWED_PUBLIC)) {
    assert.ok(
      readers.includes(allowed),
      `${allowed} holds an ALLOWED_PUBLIC entry but no longer reads from process.cwd() — delete the entry`,
    );
  }
});

test('no server file carries a part of public/ it was not given, or tens of MB of anything', async () => {
  const readers = cwdReaders();
  const traced = await Promise.all(readers.map(traceAlone));

  // Anti-vacuity: the decor pilot MUST trace its seed files. If the tracer
  // silently traced nothing (a moved API, an ignore that swallows everything),
  // "carries nothing it should not" would be true of every file.
  const decor = traced.find((t) => t.rel === 'lib/reception-decor-layers-server.ts');
  assert.ok(decor, 'the decor-layer server file is no longer found by the walker');
  assert.ok(
    decor.files.some((f) => f.startsWith('apps/web/public/moodboard-seed/')),
    'the decor-layer server file traced ZERO seed files — the tracer is not running, ' +
      'or the pilot can no longer read what it composites (the flat-SVG fallback would hide it)',
  );

  const problems: string[] = [];
  for (const t of traced) {
    const allowed = ALLOWED_PUBLIC[t.rel] ?? [];
    const strayPublic = t.files.filter(
      (f) => f.startsWith('apps/web/public/') && !allowed.some((a) => f.startsWith(a)),
    );
    if (strayPublic.length > 0) {
      const strayBytes = strayPublic.reduce((n, f) => {
        try {
          return n + statSync(path.join(REPO_ROOT, f)).size;
        } catch {
          return n;
        }
      }, 0);
      const dirs = [...new Set(strayPublic.map((f) => f.split('/').slice(0, 4).join('/')))].slice(0, 6);
      problems.push(
        `${t.rel} drags ${strayPublic.length} files · ${mb(strayBytes)} MB of public/ into its server ` +
          `function (${dirs.join(', ')}${dirs.length === 6 ? ', …' : ''}). Root its read at the ` +
          'narrowest directory it can actually open, never at public/ itself.',
      );
    }
    if (t.bytes > MAX_ASSET_MB * 1048576) {
      problems.push(
        `${t.rel} traces ${t.files.length} files · ${mb(t.bytes)} MB (ceiling ${MAX_ASSET_MB} MB per file). ` +
          "Vercel's 250 MB function limit is shared by every route grouped with it.",
      );
    }
  }
  assert.deepEqual(problems, [], problems.join('\n'));
});
