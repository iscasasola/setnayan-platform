/**
 * a-portal-waits-for-hydration.test.ts — ⚡ THE FIRST CLIENT RENDER DRAWS WHAT THE SERVER DREW.
 *
 * Measured 2026-10-16 on a production build of origin/main, the owner's own events
 * (cale-ice + two more), Chromium at 375 px with 4× CPU: `/dashboard` threw React
 * error #418 on EVERY phone load. Traced by patching React's hydration-mismatch throw:
 * the fiber was the `<dialog aria-label="Remove Maria & Jose?">` of a board card —
 * `RemoveDialog` returned `null` when `typeof document === 'undefined'` (the server)
 * and a portal otherwise (the hydration pass), so React discarded the server HTML and
 * rendered the board again on the phone: one 662–676 ms long task, 709–754 ms TBT,
 * "usable" at 2.54 s — while a tap on a card did nothing (prod DEAD_TAP 2026-10-14).
 *
 * Holds:
 *   1. `useHydrated()` is FALSE in the server render (and so in the hydration pass,
 *      which uses the same server snapshot) — the property the fix rests on;
 *   2. the board's remove frame waits for `useHydrated()`, never for `typeof document`;
 *   3. no NEW client component gates a render on `typeof document === 'undefined'`. The
 *      ones listed below render only after a press opens them (never during hydration);
 *      a new one belongs on `useHydrated()` instead, or here with its reason.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { stripComments } from './strip-comments';
import { useHydrated } from './use-hydrated';

const WEB = join(__dirname, '..');

test('useHydrated is false while the server renders — so the hydration pass draws the same thing', () => {
  function Probe() {
    return createElement('span', null, useHydrated() ? 'client' : 'server');
  }
  assert.equal(renderToString(createElement(Probe)), '<span>server</span>');
});

test("the board's remove frame waits for hydration, not for `typeof document`", () => {
  const src = stripComments(
    readFileSync(join(WEB, 'app/dashboard/(launcher)/_components/event-card-menu.tsx'), 'utf8'),
  );
  const start = src.indexOf('function RemoveDialog(');
  assert.ok(start > 0, 'RemoveDialog not found — if it moved, move this guard with it');
  const end = src.indexOf('\nfunction ', start + 10);
  const body = src.slice(start, end > 0 ? end : undefined);
  assert.doesNotMatch(body, /typeof\s+(document|window)/, 'RemoveDialog branches on typeof document/window again');
  assert.match(body, /const hydrated = useHydrated\(\)/);
  const gate = body.indexOf('if (!hydrated) return null');
  assert.ok(gate > 0 && gate < body.indexOf('createPortal('), 'the portal must be drawn only after hydration');
});

/* Each of these renders only once a press has opened it (its parent mounts it on open),
   so it is never part of a hydration pass. Re-check before adding to this list. */
const OPENED_BY_A_PRESS = new Set([
  'app/dashboard/[eventId]/vendors/_components/lock-milestone.tsx',
  'app/dashboard/[eventId]/vendors/_components/accordion-build.tsx',
  'app/dashboard/[eventId]/launch/_components/studio-wish-sheet.tsx',
  'app/dashboard/[eventId]/launch/_components/add-part-sheet.tsx',
  'app/dashboard/[eventId]/launch/_components/stage-panel/play-status.tsx',
  'app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx',
  'app/dashboard/[eventId]/guests/_components/guest-popup.tsx',
  'app/_components/explain.tsx',
  'app/_components/auth/sign-in-here-panel.tsx',
  'app/_components/calendar.tsx',
]);

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.tsx')) out.push(p);
  }
  return out;
}

test('no new client component returns null for `typeof document === "undefined"` (use useHydrated)', () => {
  const files = [...walk(join(WEB, 'app'), []), ...walk(join(WEB, 'components'), []), ...walk(join(WEB, 'lib'), [])];
  assert.ok(files.length > 500, `scanned only ${files.length} files — the walk is broken`);
  const offenders = files
    .map((f) => relative(WEB, f))
    .filter((rel) => {
      const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
      return /typeof\s+document\s*===\s*['"]undefined['"]\s*\)\s*return\s+null/.test(src);
    })
    .filter((rel) => !OPENED_BY_A_PRESS.has(rel));
  assert.deepEqual(offenders, [], `render gated on typeof document — draws differently in the hydration pass:\n${offenders.join('\n')}`);
});
