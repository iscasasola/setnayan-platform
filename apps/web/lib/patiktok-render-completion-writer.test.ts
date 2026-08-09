/**
 * Item 113 · the dead Patiktok render worker must not come back.
 *
 * `app/api/internal/patiktok/process-job/route.ts` was a STUB queue-drainer:
 * it claimed the oldest queued `patiktok_render_jobs` row, slept 100ms, then
 * wrote status='completed' with a hardcoded placeholder `output_url`. Nothing
 * called it (no cron — `vercel.json` ships `"crons": []`, no pg_cron schedule,
 * no fetch anywhere in the tree) but the route was deployed and secret-gated,
 * so anything that ever reached it would have marked a REAL couple's reel
 * finished while pointing at a file that does not exist. It was deleted.
 *
 * The real render happens in the guest's browser (WebCodecs / MediaRecorder),
 * uploads to R2, and is closed out by `finalizePatiktokRenderJob` — which
 * derives the object key server-side from the job row. That server action is
 * the ONLY thing allowed to write status='completed' on a Patiktok render job.
 *
 * ── WHY THIS IS A SOURCE SCAN ───────────────────────────────────────────────
 * The thing being prevented is a FILE reappearing, not a value being wrong at
 * runtime. So the scan walks the shipped tree and asserts the completion-write
 * set is exactly one file.
 *
 * ⚠ Comments are stripped before matching, deliberately. A whole-file grep
 * would match the paragraph you are reading right now — including the deleted
 * route's own path — and pass forever on its own justification.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

const WEB_ROOT = dirname(dirname(fileURLToPath(import.meta.url))); // apps/web

/** The one file permitted to close out a Patiktok render job. */
const ALLOWED_COMPLETION_WRITER = join(
  'app',
  'dashboard',
  '[eventId]',
  'studio',
  'patiktok',
  'actions.ts',
);

const SCAN_ROOTS = ['app', 'lib', 'components'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'build', '__snapshots__']);

/**
 * Remove line + block comments so an assertion can only ever match code that
 * actually ships. Tracks string / template-literal state so a `//` inside a URL
 * or a `/* ` inside a string is not treated as a comment opener.
 */
function stripComments(src: string): string {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const ch = src[i] as string;
    const next = src[i + 1];
    if (quote) {
      if (ch === '\\') {
        out += '  ';
        i += 2;
        continue;
      }
      if (ch === quote) quote = null;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      out += ch;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i += 1;
      i += 2;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

function walk(dir: string, acc: string[]): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, acc);
    } else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full);
    }
  }
  return acc;
}

const SOURCE_FILES = SCAN_ROOTS.flatMap((r) => walk(join(WEB_ROOT, r), []));

/** Sanity: the scan must actually see the tree. A silent zero proves nothing. */
test('the source scan reaches the shipped tree', () => {
  assert.ok(
    SOURCE_FILES.length > 500,
    `expected to scan the app/lib/components tree, saw ${SOURCE_FILES.length} files`,
  );
});

test('no server-side Patiktok queue-drainer route exists', () => {
  const dead = join(WEB_ROOT, 'app', 'api', 'internal', 'patiktok');
  assert.ok(
    !existsSync(dead),
    `${relative(WEB_ROOT, dead)} is back. The stub worker there marked real render jobs ` +
      'completed with a placeholder output_url. If a real ffmpeg worker is being built, it ' +
      'must write a verified object key and this guard must be updated deliberately.',
  );
});

test('the route registry no longer advertises the dead worker', () => {
  const code = stripComments(readFileSync(join(WEB_ROOT, 'lib', 'routes.ts'), 'utf8'));
  assert.ok(
    !code.includes('internal/patiktok'),
    'lib/routes.ts still exports a path to the deleted Patiktok worker',
  );
});

test('finalizePatiktokRenderJob is the only writer of a completed Patiktok render job', () => {
  const writers: string[] = [];
  for (const file of SOURCE_FILES) {
    const code = stripComments(readFileSync(file, 'utf8'));
    // `.from('patiktok_render_jobs')` … `status: 'completed'` within the same
    // query chain. 600 chars comfortably covers the widest real update object
    // (the finalize writer's is ~500) without spanning into an unrelated call.
    const re = /from\(\s*['"`]patiktok_render_jobs['"`]\s*\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) {
      const chain = code.slice(m.index, m.index + 600);
      if (/status:\s*['"`]completed['"`]/.test(chain)) {
        writers.push(relative(WEB_ROOT, file).split(sep).join(sep));
        break;
      }
    }
  }
  assert.deepEqual(
    writers.sort(),
    [ALLOWED_COMPLETION_WRITER],
    'Exactly one file may mark a Patiktok render job completed. Found: ' +
      JSON.stringify(writers.sort()),
  );
});

test('the allowed writer still derives its output key server-side', () => {
  const code = stripComments(
    readFileSync(join(WEB_ROOT, ALLOWED_COMPLETION_WRITER), 'utf8'),
  );
  // Anchored on the opening paren, NOT a bare `includes`: a bare prefix match
  // still passes against `finalizePatiktokRenderJobRENAMED`, which is exactly
  // how the first cut of this assertion survived its own mutation run.
  assert.ok(
    /export async function finalizePatiktokRenderJob\s*\(/.test(code),
    'finalizePatiktokRenderJob is gone — the completion-writer allowlist above is now vacuous',
  );
  assert.ok(
    /output_object_key:\s*objectKey/.test(code),
    'the completion write no longer persists the server-derived object key',
  );
});

test('no shipped code writes a placeholder Patiktok render output', () => {
  const offenders: string[] = [];
  for (const file of SOURCE_FILES) {
    const code = stripComments(readFileSync(file, 'utf8'));
    if (/r2:\/\/patiktok-renders|please-replace-with-real-output/.test(code)) {
      offenders.push(relative(WEB_ROOT, file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'placeholder render output re-introduced in: ' + JSON.stringify(offenders),
  );
});
