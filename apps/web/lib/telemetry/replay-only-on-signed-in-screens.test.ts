/**
 * replay-only-on-signed-in-screens.test.ts — 🎥 Sentry Session Replay runs only on signed-in screens (owner
 * 2026-10-23: "Drop Sentry Session Replay on PUBLIC pages only … keep error reporting everywhere and replay on
 * signed-in screens").
 *
 * Holds three things:
 *   1. THE RULE (`lib/telemetry/replay-scope.ts`): replay inside the signed-in work areas, nowhere else — the
 *      signed-out front door, public Event Hubs, legal / help / feature pages record none.
 *   2. THE WIRING: `DeferredObservability` initialises Sentry WITHOUT the recorder and adds it only through
 *      `sessionReplayAllowed` — at load and on a later move into a work area.
 *   3. THE BYTES: every `import('@sentry/nextjs')` names the exports it uses (`webpackExports`) and none names
 *      `replayIntegration`, so no chunk a public page loads carries the recorder; the recorder's only door is
 *      `lib/telemetry/sentry-replay.ts`. (MEASURED in the PR: a production build, JS on /, /login and /cale-ice.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '../strip-comments';
import { REPLAY_WORK_AREAS, sessionReplayAllowed } from './replay-scope';

const WEB = join(__dirname, '..', '..');

test('1 · the rule — replay only inside a signed-in work area', () => {
  for (const p of ['/dashboard', '/dashboard/people', '/dashboard/e1/launch', '/vendor-dashboard', '/vendor-dashboard/clients/x', '/admin', '/admin/papic-storage', '/onboarding/you', '/open-shop', '/site-editor/x']) {
    assert.equal(sessionReplayAllowed(p), true, `${p} is a signed-in screen and records no replay`);
  }
  for (const p of ['/', '/login', '/signup', '/help', '/help/what-is-setnayan', '/refunds', '/privacy', '/features', '/pricing', '/maria-and-jose', '/cale-ice', '/v/kuya-mike', '/u/ice', '/dashboardx', '/administrator', '', null, undefined]) {
    assert.equal(sessionReplayAllowed(p), false, `${String(p)} is public and records a replay`);
  }
  assert.equal(sessionReplayAllowed('/dashboard?tab=1#x'), true);
  assert.ok(REPLAY_WORK_AREAS.length >= 4);
});

test('2 · the wiring — init without the recorder; the recorder only through the rule', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/deferred-observability.tsx'), 'utf8'));
  const init = src.slice(src.indexOf('Sentry.init({'), src.indexOf('Sentry.init({') + 2000);
  assert.doesNotMatch(init, /replayIntegration|integrations:/, 'Sentry.init carries the recorder again — every public page would load it');
  assert.match(src, /if \(!Sentry \|\| replayAddedRef\.current \|\| !sessionReplayAllowed\(path\)\) return;/, 'the recorder is added without asking the rule');
  assert.match(src, /import\('@\/lib\/telemetry\/sentry-replay'\)[\s\S]{0,400}Sentry\.addIntegration\(replayIntegration\(\{ maskAllText: true, blockAllMedia: true \}\)\)/, 'the recorder lost its masking');
  assert.match(src, /addReplayIfSignedIn\(window\.location\.pathname\);/, 'the first screen is not asked');
  assert.match(src, /useEffect\(\(\) => \{\s*addReplayIfSignedIn\(pathname\);/, 'a move into a work area is not asked');
});

test('3 · the bytes — every Sentry import names its exports, and none names the recorder', () => {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) files.push(p);
    }
  };
  for (const r of ['app', 'components', 'lib']) walk(join(WEB, r));
  const sites: string[] = [];
  for (const f of files) {
    const raw = readFileSync(f, 'utf8');
    for (const m of raw.matchAll(/import\(\s*(\/\*[\s\S]*?\*\/\s*)?['"]@sentry\/nextjs['"]\s*\)/g)) {
      // A TYPE (`typeof import('@sentry/nextjs')`) loads nothing — only a runtime import() makes a chunk.
      if (/typeof\s*$/.test(raw.slice(Math.max(0, (m.index ?? 0) - 12), m.index))) continue;
      // Prose about an import (a comment line) loads nothing either.
      const lineStart = raw.lastIndexOf('\n', m.index ?? 0) + 1;
      if (/^\s*(\*|\/\/|\/\*)/.test(raw.slice(lineStart, m.index))) continue;
      const rel = relative(WEB, f);
      sites.push(rel);
      const magic = m[1] ?? '';
      assert.match(magic, /webpackExports:\s*\[/, `${rel}: import('@sentry/nextjs') names no exports — the recorder rides its chunk`);
      assert.doesNotMatch(magic, /replayIntegration/, `${rel}: an import names the recorder`);
    }
  }
  assert.ok(sites.length >= 4, `found ${sites.length} Sentry import sites — the scan is blind`);
  const door = readFileSync(join(WEB, 'lib/telemetry/sentry-replay.ts'), 'utf8');
  assert.match(door, /export \{ replayIntegration \} from '@sentry\/nextjs';/);
});
