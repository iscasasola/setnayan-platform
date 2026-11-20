/**
 * event-today-is-focus-shaped.test.ts — 🔒 THE EVENT'S TODAY RUNS LIKE ADMIN FOCUS AND THE SUPPLIER'S TODAY.
 *
 * Owner, 20 Nov 2026: *"make the Today of the event dashboard run like the Focus of Admin and Today of Suppliers
 * Dashboard"* · on the dark event card: *"keep it, the information there is vital or maybe you can make it look
 * better"* · on Do it tomorrow: *"tasks would show whoever is on. they have independent tasks. one host may choose to
 * do it tomorrow but the other host hasn't so there is a change that can be done today"* · *"Yes, build it"*. Drawing
 * `prototypes/event_today_focus_2026-11-20/` v3.
 *
 *   1 · ONE list under the card, by urgency, on the SHARED parts (`orderByUrgency`, `useTodayDrag`, `TwoWayPanes`) —
 *       never a third shape; the To do block and the Today pill lines are gone from the first screen;
 *   2 · the card is KEPT: its countdown (the Date Finder's door), the count line, and the strip with its level word;
 *   3 · a red row never offers "Do it tomorrow", and drags right only;
 *   4 · the put-off is written in scope `event`, PER PERSON — the table, the policy, the write and the read agree;
 *   5 · the day-of and after-the-day screens keep their Today lines.
 *
 * SABOTAGE (each seen red once, 2026-11-20, then reverted): `orderByUrgency(rows)` → `rows` in the lib (1) ·
 * `useTodayDrag` swapped for a bare object in the row (1) · `need={…}` dropped from the band (2) · `level={…}` dropped
 * from the strip (2) · `row.putOff && canPutOff(level)` → `row.putOff` with the lib's red rule off (3) ·
 * `scope: 'event'` → `scope: 'admin'` in the list (4) · `user_id: user.id` dropped from the upsert (4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl, fixtureDay } from '@/lib/home-control-fixture';
import { buildEventToday } from '@/lib/event-today';
import { homeToday, homeWaiting } from './_components/home-control-faces';
import { count, drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (...rel: string[]) => stripComments(readFileSync(join(WEB, ...rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;/g, '’').replace(/\s+/g, ' ').trim();
const TODAY = '2026-11-20';

/** A Home with one late task beside the late payment the strip holds. */
function lateTask() {
  const c = fixtureControl('e1');
  if (c.checklist && c.checklist !== 'unread') c.checklist.next[0] = { ...c.checklist.next[0]!, dueDate: fixtureDay(-5), daysUntilDue: -5 };
  return c;
}

test('1 · ONE list under the card, by urgency, on the shared parts — never a third shape', () => {
  const lib = src('lib', 'event-today.ts');
  assert.match(lib, /for \(const raw of orderByUrgency\(rows\)\)/, 'the list is no longer ordered by the shared orderByUrgency');
  assert.match(lib, /import \{ orderByUrgency, type TodayUrgency \} from '@\/lib\/supplier-today-v2'/, 'the urgency order is a private copy');
  const list = src('app', 'dashboard', '[eventId]', '_components', 'event-today-list.tsx');
  assert.match(list, /import \{ TwoWayPanes, useTodayDrag \} from '@\/app\/_components\/two-way-drag'/, 'the row no longer uses the shared two-way drag');
  assert.match(list, /= useTodayDrag\(\{\s*enabled: Boolean\(g\) && !open,\s*red,/, 'the row’s drag is not the shared gesture, or an open card drags');
  assert.match(list, /<TwoWayPanes tx=\{tx\} armed=\{armed\} red=\{red\} \/>/, 'the panes behind a moving row are not the shared ones');
  assert.doesNotMatch(list, /onTouchStart|onTouchMove|swipeBegin|swipeMove/, 'the list grew a gesture of its own');

  const c = lateTask();
  const html = drawHome({ control: c });
  const cover = html.indexOf('data-home-cover');
  const at = html.indexOf('data-event-today=""');
  assert.ok(at > cover && at < html.indexOf('data-home-your-event'), 'the list is not under the card, before the widgets');
  assert.equal(count(html, 'data-event-today-list=""'), 1, 'the first screen draws the list more or less than once');
  const part = slice(html, 'data-event-today=""', ['data-home-your-event']);
  // The rendered rows are the lib's rows, in the lib's order.
  const want = buildEventToday({ control: c, today: homeToday(c.next, c.guests, homeWaiting(c)), putOffs: [], todayIso: TODAY }).list.map((r) => r.key);
  const drawn = [...part.matchAll(/data-event-today-row="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(drawn, want, 'the rows drawn are not the lib’s rows in the lib’s order');
  assert.equal(drawn[0], 'task:t1', 'anti-vacuity: the late task is not first');
  // A level is a WORD plus the colour, never colour alone.
  const first = slice(part, 'data-event-today-row="task:t1"', ['data-event-today-row="']);
  assert.match(first, /data-event-today-urgency="red"/);
  assert.match(text(first), /Overdue · due /, 'a red row does not say its level in words');
  const amber = slice(part, 'data-event-today-row="pay:li-2"', ['data-event-today-row="']);
  assert.match(amber, /data-event-today-urgency="amber"/);
  assert.match(text(amber), /Soon · ₱22,275/, 'an amber row does not say its level in words');
  // The heading counts the rows; the strip's own item is not among them.
  assert.match(part, /Needs you today/);
  assert.match(part, new RegExp(`<em data-event-today-count="">${want.length}</em>`), 'the heading does not count the rows on Today');
  assert.ok(!drawn.includes('pay:li-1'), 'the list repeats the payment the card’s strip holds');
  // The old To do head and the Today pill lines are gone from the first screen.
  assert.doesNotMatch(html, /data-home-today-asks|data-home-today-item|<em>soonest first<\/em>/, 'the To do block or the Today pill lines are back on the first screen');
  const screen = src('app', 'dashboard', '[eventId]', '_components', 'home-first-screen.tsx');
  assert.match(screen, /<HomeTodayList eventId=\{eventId\} today=\{list\}/, 'the first screen does not draw the one list');
  assert.doesNotMatch(screen, /HomeTodoList|\{asks\}/, 'the first screen still draws the To do block or the asks block');
});

test('2 · the event card is KEPT: countdown, count line, and the strip with its level word', () => {
  const c = fixtureControl('e1');
  c.countdown.short = 'Sat 12 Dec';
  const html = drawHome({ control: c });
  const card = slice(html, 'data-home-cover', ['data-home-column']);
  assert.equal(count(card, 'data-home-card-countdown='), 1, 'the card lost its countdown');
  assert.match(card, /data-home-card-countdown=""[^>]*href="\/dashboard\/e1\?date=find"|href="\/dashboard\/e1\?date=find"[^>]*data-home-card-countdown=""/, 'the countdown no longer opens the Date Finder');
  assert.match(text(card), /51 days to go · Sat 12 Dec · Tagaytay/, 'the countdown is not one line with its day (and the place kept)');
  assert.match(text(slice(card, 'data-home-card-need', ['data-home-today='])), /^[^>]*> ?7 things need you/, 'the count did not join the card');
  assert.equal(count(card, 'data-home-today='), 1, 'the card lost its strip');
  const strip = slice(card, 'data-home-today=', ['</div>']);
  assert.match(strip, /data-home-now-level="red"/, 'the strip does not wear its level');
  assert.match(text(card), /Overdue ₱8,000 to Lumière Catering · 3 days late/, 'the strip does not say why it is first');
  assert.doesNotMatch(text(card), /\bNow\b/, 'the strip says "Now" beside a level word');
  // With no level, it still says Now.
  const calm = drawHome({ control: fixtureControl('e1', { budget: { paidPhp: 0, owingPhp: 0, pays: [] } }) });
  assert.match(text(slice(calm, 'data-home-today=', ['data-home-column'])), /Now /, 'a strip with no level lost its "Now"');
  const band = src('app', 'dashboard', '[eventId]', '_components', 'home-cover-band.tsx');
  assert.match(band, /data-home-card-need=""/);
  assert.match(src('app', 'dashboard', '[eventId]', '_components', 'home-first-screen.tsx'), /need=\{eventTodayNeedWords\(list\)\}/, 'the card’s count is not the list’s own');
});

test('3 · a red row never offers "Do it tomorrow", and drags right only', () => {
  const c = lateTask();
  const t = buildEventToday({ control: c, today: homeToday(c.next, c.guests, homeWaiting(c)), putOffs: [{ task_key: 'task:t1', until_day: '2999-01-01' }], todayIso: TODAY });
  const red = t.list.find((r) => r.key === 'task:t1');
  assert.ok(red, 'a red row was hidden by a put-off record');
  assert.equal(red.putOff, false, 'the lib lets a red row go to tomorrow');
  assert.equal(t.tomorrow.length, 0);
  const list = src('app', 'dashboard', '[eventId]', '_components', 'event-today-list.tsx');
  assert.match(list, /\{row\.putOff && canPutOff\(level\) \? \(\s*<button type="button" onClick=\{\(\) => g\?\.putOff\(row\.key\)\}[^>]*data-event-today-do-it-tomorrow=""/, 'the open card’s "Do it tomorrow" is not held by canPutOff');
  assert.equal(count(list, 'data-event-today-do-it-tomorrow'), 1, '"Do it tomorrow" is offered somewhere the rule does not reach');
  assert.match(list, /onTomorrow: \(\) => \(row\.putOff \? g\?\.putOff\(row\.key\) : undefined\)/, 'a drag left can put off a row that may not go');
  assert.match(list, /onRefuse: \(\) => g\?\.refuse\(\)/, 'a red row dragged left is not refused in words');
  const html = drawHome({ control: c });
  const row = slice(html, 'data-event-today-row="task:t1"', ['data-event-today-row="']);
  assert.match(row, /data-event-today-swipe="right-only"/, 'a red row does not say it drags right only');
  const normal = slice(html, 'data-event-today-row="decide:suppliers"', ['data-event-today-row="']);
  assert.match(normal, /data-event-today-swipe="both"/);
  assert.doesNotMatch(src('app', 'dashboard', '[eventId]', '_components', 'event-today-list.tsx'), /Trash|Delete|✕/, 'a row grew a delete');
});

test('4 · the put-off is written in scope event, per person', () => {
  const list = src('app', 'dashboard', '[eventId]', '_components', 'event-today-list.tsx');
  assert.match(list, /todayPutOff\(\{ op, key, scope: 'event', eventId \}\)/, 'the list no longer writes its put-off in scope event');
  assert.equal(count(list, 'todayPutOff('), 1);
  const action = src('app', '_actions', 'today-put-off-actions.ts');
  assert.deepEqual([...action.matchAll(/^export (?:async )?function (\w+)/gm)].map((m) => m[1]), ['todayPutOff'], 'the action file grew a second route');
  const branch = action.slice(action.indexOf("if (scope === 'event' && eventId)"), action.indexOf('const vendorProfileId'));
  assert.match(branch, /\.from\('event_today_put_offs'\)\s*\.upsert\(\{ event_id: eventId, user_id: user\.id, task_key: key, until_day: tomorrowOf\(manilaToday\(\)\)/, 'the put-off is not this person’s own record');
  assert.match(branch, /onConflict: 'event_id,user_id,task_key'/, 'one host’s put-off can overwrite another’s');
  assert.match(branch, /\.delete\(\)\.eq\('event_id', eventId\)\.eq\('user_id', user\.id\)\.eq\('task_key', key\)/, 'Undo can remove another host’s record');
  assert.match(branch, /revalidatePath\(`\/dashboard\/\$\{eventId\}`\)/);
  assert.match(action, /const eventId = scope === 'event' && isUuid\(input\?\.eventId\) \? input\.eventId : null;/, 'the event id is not checked for its shape');
  // The read is this person's own rows too.
  const read = src('app', 'dashboard', '[eventId]', '_components', 'event-today-asks.tsx');
  assert.match(read, /\.from\('event_today_put_offs'\)\.select\('task_key, until_day'\)\.eq\('event_id', eventId\)\.eq\('user_id', userId\)\.gt\('until_day', todayIso\)/);
  // …and the database says the same: one row per event, person and task; own rows only, on an event they belong to.
  const sql = readFileSync(join(WEB, '..', '..', 'supabase', 'migrations', '20271354816762_event_today_put_offs.sql'), 'utf8');
  assert.match(sql, /PRIMARY KEY \(event_id, user_id, task_key\)/);
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/);
  assert.equal(count(sql, 'user_id = (SELECT auth.uid()) AND event_id IN (SELECT public.current_event_ids())'), 2, 'the policy is not own-rows-on-my-events for both USING and WITH CHECK');
});

test('5 · the day-of and after-the-day screens keep their Today lines', () => {
  const page = src('app', 'dashboard', '[eventId]', 'page.tsx');
  assert.match(page, /<div data-home-day-now="" [^>]*>\s*\{todayAsks\}/, 'the day-of console lost its Today lines');
  assert.match(page, /\{afterActive \? todayAsks : null\}/, 'the after screen lost its Today lines');
  assert.match(page, /const todayRows = afterActive\s*\? \{ asks: \[\], bodies: \{\} \}/, 'after the day the list would repeat the lines above it');
  assert.match(page, /todayList=\{\{ asks: todayRows\.asks, bodies: todayRows\.bodies, putOffs: todayPutOffs, todayIso \}\}/, 'the first screen is not handed the asks as rows');
});
