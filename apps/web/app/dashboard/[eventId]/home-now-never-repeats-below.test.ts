/**
 * home-now-never-repeats-below.test.ts — 🎴 THE EVENT CARD'S NOW, AND THE ONE TO DO UNDER IT (owner-approved Home
 * redraw 2026-11-02, round 3 — `prototypes/home_controller_2026-11-02/`, DECISION_LOG "HOME CONTROLLER REDRAW APPROVED
 * (round 3)": *"one To do, Now no-repeat"*).
 *
 * Properties, EXECUTED on the control row's own fixture through the real first screen:
 *   1 · Now rides the event card with ONE verb — the late payment's Pay opens THAT payment — and the Budget card leaves
 *       that payment out (the next one leads);
 *   2 · an overdue task in Now is ticked in place (Planning Stage's own write), and the To do list leaves it out;
 *   3 · the To do list is the plan's three soonest rows, each with Planning Stage's tick, closed by the plan's state —
 *       and the Countdown / To do widgets are gone from the grid (one place per thing).
 *
 * Sabotage (2026-11-02, each reverted, each red): `budgetTile` without the `holds.pay` filter (1) · `HomeTodoList`
 * without `holds` (2) · `checklistTile` back in `homeControlTiles` (3) · Now's tick posting `tick-step` for a task (2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { fixtureControl, fixturePays } from '@/lib/home-control-fixture';
import { homeControlTiles, homeNowAction, homeToday, homeWaiting, type HomeControlInput } from './_components/home-control-faces';
import { drawHome, loadHome, slice } from './home-render.harness';

test.before(loadHome);
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ');

const TASK = { id: 'late-1', title: 'Book the church', dueDate: '2026-01-10', daysUntilDue: -20, tick: { kind: 'task' as const, id: 'row-late-1' } };
/** Nothing waits but an overdue task: no late payment, no quote to answer, no access ask, no setup step. */
function taskOnly(): HomeControlInput {
  const c = fixtureControl('e1');
  const cl = c.checklist && c.checklist !== 'unread' ? c.checklist : null;
  return {
    ...c,
    next: { kind: 'plan', title: 'You are on track', body: '', action: '' },
    budget: { paidPhp: 1, owingPhp: 1, pays: fixturePays().filter((p) => p.state !== 'overdue') },
    suppliers: { booked: 2, of: 6, toDecide: [], replied: 0 },
    asks: 0,
    checklist: cl ? { ...cl, next: [TASK, ...cl.next] } : null,
  };
}

test('1 · the late payment is Now’s — Pay opens it — and the Budget card leaves it out', () => {
  const c = fixtureControl('e1');
  const html = drawHome({ control: c });
  const card = slice(html, 'data-home-cover', ['data-home-column']);
  assert.match(text(card), /Now ₱8,000 to Lumière Catering · 3 days late/, 'Now does not name the late payment');
  assert.ok(card.includes('href="/dashboard/e1/budget?pay=li-1"'), 'Now’s Pay does not open that payment');
  const budget = homeControlTiles(c).tiles.find((t) => t.key === 'budget')!;
  assert.deepEqual(
    budget.faces.filter((f) => f.id.startsWith('pay-')).map((f) => f.id),
    ['pay-li-2', 'pay-li-3', 'pay-li-4'],
    'the Budget card repeats the payment Now holds',
  );
  const grid = slice(html, 'data-home-control="compact"', ['data-home-control="detail"']);
  assert.doesNotMatch(text(grid), /₱8,000/, 'the ₱8,000 Now names is drawn again below');
});

test('2 · an overdue task is Now’s — ticked in place — and the To do list leaves it out', () => {
  const c = taskOnly();
  const t = homeToday(c.next, c.guests, homeWaiting(c));
  assert.equal(t.holds?.task, 'late-1');
  const act = homeNowAction(t, c);
  assert.equal(act?.verb, 'Done');
  assert.deepEqual(act?.tick, { kind: 'task', id: 'row-late-1', title: 'Book the church' }, 'Now does not tick the task’s own row');
  const html = drawHome({ control: c });
  const card = slice(html, 'data-home-cover', ['data-home-column']);
  assert.match(text(card), /Now Book the church · due Jan 10 · overdue/);
  const todo = slice(html, 'data-home-todo=""', ['data-home-your-event']);
  assert.doesNotMatch(text(todo), /Book the church/, 'the To do list repeats the task Now holds');
  assert.equal((todo.match(/data-home-todo-row=/g) ?? []).length, 3, 'the list does not fill back to three');
  // Now's Done is Planning Stage's own write — a task's row is ticked as a task.
  const parts = src('_components/home-parts.tsx');
  assert.match(parts, /fd\.set\('op', t\.kind === 'task' \? 'tick-task' : 'tick-step'\)/, 'Now’s Done does not write the row it names');
  assert.match(parts, /await planningRowAction\(fd\)/, 'Now’s Done is not Planning Stage’s write');
});

test('3 · ONE To do under the card — three rows, each with the plan’s tick, then the plan’s state — and no To do or Countdown widget', () => {
  const html = drawHome();
  const cover = html.indexOf('data-home-cover');
  const todoAt = html.indexOf('data-home-todo=""');
  assert.ok(todoAt > cover && todoAt < html.indexOf('data-home-your-event'), 'the To do list is not under the card, before the widgets');
  const todo = slice(html, 'data-home-todo=""', ['data-home-your-event']);
  assert.equal((todo.match(/data-home-todo-row=/g) ?? []).length, 3, 'the To do list is not three rows');
  assert.match(text(todo), /62% of the plan done · All 1 this week/, 'the closing line is not the plan’s state');
  const list = src('_components/home-todo-list.tsx');
  assert.match(list, /<PlanningTick eventId=\{eventId\} kind=\{t\.tick\.kind\} id=\{t\.tick\.id\}/, 'the rows are not ticked by Planning Stage’s own tick');
  const keys = homeControlTiles(fixtureControl('e1')).tiles.map((t) => t.key);
  assert.ok(!keys.includes('plan'), 'a To do widget is back — the plan would be in two places');
  assert.ok(!keys.includes('count'), 'a Countdown widget is back — the card already carries it');
  assert.equal((html.match(/data-home-card-countdown=/g) ?? []).length, 1, 'the card does not carry the countdown exactly once');
});
