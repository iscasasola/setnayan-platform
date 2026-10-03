/**
 * ⚖ Owner tracker d17 (2026-10-02): plain names first, the Setnayan name small
 * underneath — "Guest photos · Papic", "Video booth · Patiktok", "Music · Music
 * Maker", "Live stream · Live Watch", "Planner · Setnayan AI".
 *
 * 🔑 THE PROPERTY: ONE list of names (`lib/service-names.ts`). Every surface that
 * names a service reads it — a second table is how two screens call one thing
 * two things.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { SERVICE_NAMES, serviceNameLine } from './service-names';

const read = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');
const strip = (s: string) => stripComments(s);

test('the owner’s five pairs, plain first', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(SERVICE_NAMES).map(([k, v]) => [k, `${v.plain} · ${v.brand}`])),
    {
      'setnayan-ai': 'Planner · Setnayan AI',
      papic: 'Guest photos · Papic',
      'live-studio': 'Live stream · Live Watch',
      'music-maker': 'Music · Music Maker',
      patiktok: 'Video booth · Patiktok',
    },
  );
  assert.equal(serviceNameLine('papic'), 'Guest photos · Papic');
});

test('the service cards and the Home read the one list — no second table of names', () => {
  const our = strip(read('lib/our-services.ts'));
  const table = our.slice(our.indexOf('const SERVICES'), our.indexOf('];', our.indexOf('const SERVICES')));
  assert.ok(table.length > 100, 'the SERVICES table moved — re-anchor this guard');
  assert.doesNotMatch(table, /^ {4}(name|plain|brand):\s*'/m, 'a service card types its own name again');
  assert.equal((table.match(/\.\.\.SERVICE_NAMES/g) ?? []).length, 5, 'every card takes its names from SERVICE_NAMES');
  assert.match(our, /label: c\.name, sub: c\.brand/, 'the More menu rows lost the small Setnayan name');

  const home = strip(read('lib/home-first-screen.ts'));
  const fn = home.slice(home.indexOf('export function homeServices'));
  assert.doesNotMatch(fn.slice(0, fn.indexOf('\n}\n')), /name: '/, 'Home’s "Your services" types its own names');
});

test('every surface draws the Setnayan name UNDER the plain one', () => {
  const sheet = strip(read('app/dashboard/[eventId]/_components/more-services-sheet.tsx'));
  assert.match(sheet, /\{s\.sub\}/, 'the More sheet drops the small line');
  const rail = strip(read('app/dashboard/[eventId]/_components/event-rail-context.tsx'));
  assert.match(rail, /rowInner\(c\.icon, c\.label, c\.description\)/, 'the rail drops the small line');
  const nav = strip(read('app/dashboard/[eventId]/_components/customer-nav-config.ts'));
  assert.match(nav, /c\.sub \? \{ description: c\.sub \}/, 'the rail rows lose the Setnayan name on the way');
  const homeCard = strip(read('app/dashboard/[eventId]/_components/home-first-screen.tsx'));
  assert.match(homeCard, /\{svc\.brand\}/, 'Home’s "Your services" drops the small line');
  const step = strip(read('app/onboarding/_shared/services-step.tsx'));
  assert.match(step, /title: SERVICE_NAMES\.papic\.plain/, 'the onboarding Papic card types its own name');
});
