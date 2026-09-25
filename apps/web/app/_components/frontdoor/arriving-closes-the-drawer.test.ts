/**
 * arriving-closes-the-drawer.test.ts — 2026-09-25.
 *
 * iOS app, the ☰ drawer: tapping "Galleries" navigated BEHIND the drawer, and
 * the drawer stayed open over the new page until the scrim was tapped. A
 * drawer row is a door; once the route has changed the drawer is done.
 *
 * The fix is one effect in `front-door-shell.tsx`, keyed on the PATH CHANGING
 * (not on a row being tapped, which would miss the back gesture, a redirect,
 * or a row added tomorrow). This reads it with comments stripped by the repo's
 * one stripper, and pins the three parts that each fail silently:
 *   · it depends on `pathname` — or it never re-runs on arrival;
 *   · it compares against the PREVIOUS path held in a ref — or opening the
 *     drawer (which re-runs the effect) would slam it shut on the same page;
 *   · it calls `closeRail()` — the animated close the scrim uses — rather than
 *     yanking `railOpen` to false mid-slide.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const SHELL = stripComments(readFileSync(join(HERE, 'front-door-shell.tsx'), 'utf8'));

/** Every `useEffect(() => { … }, [deps])` in the shell, as {body, deps}. */
function effects(): { body: string; deps: string[] }[] {
  const out: { body: string; deps: string[] }[] = [];
  const re = /useEffect\(\s*\(\)\s*=>\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(SHELL))) {
    let depth = 1;
    let i = re.lastIndex;
    while (depth > 0 && i < SHELL.length) {
      if (SHELL[i] === '{') depth++;
      else if (SHELL[i] === '}') depth--;
      i++;
    }
    const body = SHELL.slice(re.lastIndex, i - 1);
    const deps = /^\s*,\s*\[([^\]]*)\]/.exec(SHELL.slice(i))?.[1] ?? '';
    out.push({ body, deps: deps.split(',').map((d) => d.trim()).filter(Boolean) });
  }
  return out;
}

test('the premise: the shell still has effects and an animated close', () => {
  assert.ok(effects().length >= 3, 'the effect parse found almost nothing — this guard would pass on air');
  assert.match(SHELL, /const closeRail = useCallback\(/, 'closeRail is gone — the scrim has no animated close to share');
});

test('☰ arriving at a new path closes the drawer (animated), and opening it on the same path does not', () => {
  const arriving = effects().filter((e) => e.deps.includes('pathname') && /\bcloseRail\(\)/.test(e.body));
  assert.equal(
    arriving.length,
    1,
    `found ${arriving.length} effect(s) keyed on pathname that close the drawer — the drawer stays ` +
      'open over the page it just opened (the iOS report, 2026-09-25)',
  );
  const { body } = arriving[0]!;
  assert.match(
    body,
    /(\w+)\.current === pathname\)\s*return;[\s\S]*\1\.current = pathname/,
    'the effect does not compare against the PREVIOUS path held in a ref — opening the drawer re-runs ' +
      'it and would shut the drawer on the page it was opened from',
  );
});
