/**
 * sentry-stays-out-of-the-first-load.test.ts — ⚡ THE DIET (2026-10-01).
 *
 * The browser Sentry SDK is loaded at idle, on purpose
 * (`app/_components/deferred-observability.tsx`). But `lib/supabase/error-detect.ts`
 * imported it statically, and client modules reach that file (the event layout's
 * unread badges → `lib/notifications.ts` / `lib/chat.ts`), so @sentry/core —
 * 13KB gz — sat in the first load of every event page, the Maker's included
 * (`scripts/check-maker-js-budget.mjs`).
 *
 * The fix keeps the server's synchronous capture and, in the browser, asks for
 * the same lazily-loaded SDK. This fails if either half is undone, or if a client
 * file imports Sentry statically again.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { stripComments } from './strip-comments';

const WEB = process.cwd();

test('logQueryError captures synchronously on the server and through the lazy SDK in the browser', () => {
  const src = stripComments(readFileSync(join(WEB, 'lib/supabase/error-detect.ts'), 'utf8'));
  const calls = src.match(/Sentry\.captureException\(/g) ?? [];
  assert.equal(calls.length, 1, `expected ONE static Sentry.captureException, found ${calls.length}`);
  assert.match(
    src,
    /if \(typeof window === 'undefined'\) \{\s*Sentry\.captureException\(err, hint\);\s*\} else \{\s*void import\('@sentry\/nextjs'\)\.then\(/,
    'the static capture must sit behind `typeof window === \'undefined\'` with the browser asking ' +
      'import(\'@sentry/nextjs\') — a bare static call puts @sentry/core back in every event page’s first load',
  );
});

test('no client file imports Sentry statically', () => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
    }
  };
  for (const r of ['app', 'components', 'lib']) walk(join(WEB, r));
  const clients = out.filter((f) => /^\s*['"]use client['"]/.test(readFileSync(f, 'utf8')));
  assert.ok(clients.length > 100, `found only ${clients.length} client files — the scan is blind`);
  const bad = clients
    .filter((f) => /^\s*import\s+(?!type\b)[^;]*?from\s+['"]@sentry\//m.test(readFileSync(f, 'utf8')))
    .map((f) => relative(WEB, f));
  assert.deepEqual(bad, [], 'a client file imports @sentry statically — load it with import() like deferred-observability.tsx');
});
