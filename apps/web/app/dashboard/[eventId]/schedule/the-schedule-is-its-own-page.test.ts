/**
 * the-schedule-is-its-own-page.test.ts — 📅 THE SCHEDULE IS ITS OWN PAGE, OPENED FROM HOME; NOTHING SENDS YOU AWAY;
 * SCHEDULE AND BUDGET ARE NEVER DRAWN INSIDE SUPPLIERS.
 *
 * Owner 2026-11-02, live (DECISION_LOG "BOOKED IS JUST THE TEAM"): *"the schedule still jumped to the booked-schedule"*
 * · *"no just schedule"* · *"and booked-team will just be booked."* — amends 2026-10-29 "Booked has budget and
 * schedule" and 2026-11-01 "Booked's menu keeps doors". Held, each as a PROPERTY:
 *
 *   1. THE PAGE NEVER SENDS YOU AWAY. Its only redirect is signed out → /login — not into Suppliers, not into the
 *      Maker's Details. Any other `redirect(` in it fails, whatever it points at.
 *   2. EVERY SCHEDULE DOOR IS THIS PAGE. Every href Home's Schedule card carries (its door, each face, To approve ·
 *      Release · Need you) resolves to `/dashboard/<id>/schedule`, with its own query (`?sheet=requests`,
 *      `?announce=1`) — and the drawn Home agrees.
 *   3. NO CODE LINKS THE OLD ADDRESS. Nothing in app/lib/components builds `?part=schedule`; the one forwarder in
 *      Suppliers sends it here with every param it carried.
 *   4. NEITHER PAGE IS DRAWN INSIDE SUPPLIERS. Nothing under `vendors/` imports the Schedule or Budget page, and the
 *      Booked part shell (`booked-part-page.tsx`) and its row (`booked-part-row.tsx`) stay deleted.
 *
 * Sabotage (2026-11-02, each reverted, each red): the marketplace redirect into `vendors?part=schedule` put back in
 * the page (1 + 3) · Home's "N to approve" pointed at `/vendors?part=schedule&sheet=requests` (2 + 3) · the
 * `?part=schedule` forward in `vendors/page.tsx` deleted (3) · `import CoupleSchedulePage` put back in the vendors page (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl, fixtureSchedule } from '@/lib/home-control-fixture';
import { schedulePageHref } from '@/lib/pillar-parts';
import { homeToday, scheduleTile } from '../_components/home-control-faces';
import { drawHome, loadHome } from '../home-render.harness';

test.before(loadHome);

const WEB = process.cwd();
const EV = join(WEB, 'app', 'dashboard', '[eventId]');
const code = (...p: string[]) => stripComments(readFileSync(join(EV, ...p), 'utf8'));
const E = 'e1';
const pathOf = (href: string) => href.replace(/&amp;/g, '&').split(/[?#]/)[0]!;

test('1 · the Schedule page never sends you to another page (only signed-out → login)', () => {
  const page = code('schedule', 'page.tsx');
  const redirects = [...page.matchAll(/\bredirect\(([^;]*?)\);/g)].map((m) => m[1]!.replace(/\s+/g, ' ').trim());
  assert.ok(redirects.length > 0, 'premise: the page still turns a signed-out visitor away');
  for (const r of redirects) {
    assert.equal(r, "'/login'", `the Schedule page redirects to ${r} — it is Home's page, it renders where it is opened`);
  }
  assert.doesNotMatch(page, /\bpermanentRedirect\(|\bNextResponse\.redirect\(|detailsIsTheDoor/, 'the Schedule page sends you away by another door');
});

test('2 · every Schedule door on Home opens this page, with its own query', () => {
  const route = schedulePageHref(E);
  assert.equal(route, `/dashboard/${E}/schedule`);
  assert.ok(existsSync(join(EV, 'schedule', 'page.tsx')), 'premise: the Schedule page exists at its route');
  for (const phase of ['before', 'week', 'day'] as const) {
    const control = fixtureControl(E, { schedule: fixtureSchedule(phase) });
    const tile = scheduleTile(control, homeToday(control.next, control.guests));
    assert.ok(tile, `premise: the ${phase} fixture draws a Schedule card`);
    const hrefs = [tile.door, ...tile.faces.map((f) => f.href), ...(tile.doors ?? []).filter((d) => d.id !== 'owe').map((d) => d.href)];
    for (const h of hrefs) assert.equal(pathOf(h), route, `a Home Schedule door opens ${h}`);
    const doors = new Map((tile.doors ?? []).map((d) => [d.id, d.href]));
    if (doors.has('approve')) assert.equal(doors.get('approve'), `${route}?sheet=requests`, '“N to approve” lost its requests sheet');
    if (doors.has('release')) assert.equal(doors.get('release'), `${route}?announce=1`, 'Release lost its announce sheet');
  }
  const html = drawHome({ control: fixtureControl(E, { schedule: fixtureSchedule('week') }) });
  const doors = [...html.matchAll(/(?:href|data-home-face-href)="([^"]*)"/g)].map((m) => m[1]!).filter((h) => /schedule/.test(h));
  assert.ok(doors.length > 0, 'premise: Home draws a door to the Schedule');
  for (const h of doors) assert.equal(pathOf(h), route, `Home draws a Schedule door to ${h}`);
});

/** Every non-test .ts/.tsx under a folder (labs excluded — `app/dev` never ships). */
function sources(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.next' || relative(WEB, p) === join('app', 'dev')) continue;
      sources(p, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$|\.harness\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('3 · no code links the old Suppliers › Booked › Schedule address — the forwarder carries every param', () => {
  const offenders = [join(WEB, 'app'), join(WEB, 'lib'), join(WEB, 'components')]
    .filter((d) => existsSync(d))
    .flatMap((d) => sources(d))
    .filter((f) => /[?&]part=schedule\b|\{ part: BOOKED_SCHEDULE_PART \}|bookedScheduleHref\(/.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => relative(WEB, f));
  assert.deepEqual(offenders, [], `these build the old ?part=schedule address: ${offenders.join(', ')}`);
  const vendors = code('vendors', 'page.tsx');
  const fwd = /if \(sp\.part === BOOKED_SCHEDULE_PART\) \{\s*redirect\(\s*schedulePageHref\(eventId, \{([^}]*)\}\),?\s*\);\s*\}/.exec(vendors);
  assert.ok(fwd, 'an old ?part=schedule link no longer reaches the Schedule page');
  for (const k of ['view', 'ros', 'note', 'host_answers', 'sheet', 'filter', 'announce']) {
    assert.match(fwd[1]!, new RegExp(`\\b${k}: sp\\.${k}\\b`), `the forward drops ?${k}=`);
  }
});

test('4 · neither the Schedule nor the Budget is drawn inside Suppliers', () => {
  const vendorsDir = join(EV, 'vendors');
  const draws = sources(vendorsDir).filter((f) =>
    /from '(?:\.\.\/)+(?:schedule|budget)\/page'|<CoupleSchedulePage\b|<BudgetPage\b|<ScheduleOneLine\b|<BudgetScreen\b/.test(
      stripComments(readFileSync(f, 'utf8')),
    ),
  );
  assert.deepEqual(draws.map((f) => relative(WEB, f)), [], 'Suppliers draws a Home page inside itself again');
  for (const gone of ['booked-part-page.tsx', 'booked-part-row.tsx']) {
    assert.ok(!existsSync(join(vendorsDir, '_components', gone)), `${gone} is back — Booked is just the team`);
  }
  assert.ok(!existsSync(join(EV, 'schedule', '_components', 'booked-schedule-frame.tsx')), 'the Booked schedule frame is back');
});
