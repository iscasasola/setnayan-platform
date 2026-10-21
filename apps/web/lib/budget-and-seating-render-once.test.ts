/**
 * budget-and-seating-render-once.test.ts — opening Budget or the seat plan draws the page ONCE; it draws again only
 * when something really changed (2026-10-22).
 *
 * ── The defects (measured in a render-count lab, PR body) ──────────────────────────────────────────────────────────
 *   · BUDGET drew its whole screen twice on open: `BudgetScreen` held `const [mounted, setMounted] = useState(false)`
 *     and flipped it in a mount effect, only so the thumb row could be portalled to <body>. Flipping it re-rendered the
 *     summary and every supplier, order and expense row right after the first paint. Now the flag lives in a tiny
 *     `BodyPortal`, so only that host renders twice. Lab: `BudgetScreen` renders 2 → 1.
 *   · SEATING re-rendered its whole editor on every presence `sync` — its OWN join and every re-track (on open, and on
 *     each 30 s lock heartbeat) — because the handler answered each sync with a brand-new Map. `nextPeers` hands back
 *     the same Map when the others are unchanged, and the hook then calls no setState at all.
 *   · SEATING also joined the plan's live-refresh channel on EVERY open and left it one round-trip later: it listened
 *     on `!canEdit`, which is true while the lock is still `idle` / `acquiring`. It now listens only once the lock has
 *     said view-only (`lockSaysViewOnly`). Lab, couple alone and editing: `SeatingEditor` renders 7 → 4 (the rest are
 *     the lock answering and the phone layout); a co-planner landing view-only: 8 → 5 — and a simulated change on the
 *     plan still refreshes their page once, and a peer arriving still re-renders it.
 *
 * ── What is proven here ─────────────────────────────────────────────────────────────────────────────────────────────
 *   1 · `nextPeers` — the same Map for an unchanged sync; a NEW Map for a real arrival, departure, table pick or lock
 *       change, and a peer keeps the cursor last seen for them (driven, not read).
 *   2 · the presence hook builds its list through `nextPeers` and skips setState when it hands the same Map back.
 *   3 · `lockSaysViewOnly` is true only for a decided view-only, and EVERY caller of `useSeatingLiveRefresh` (found by
 *       walking the app) gates it on it — so the live refresh co-planners rely on still runs exactly where it must.
 *   4 · `BudgetScreen` sets none of its own state in a mount effect (read from the syntax tree, not a phrasing), and
 *       its portal goes through `BodyPortal`.
 *
 * Caveat: nothing here renders React. The render counts are the lab's (`shots-2026-10-21/render-once/work/harness`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { nextPeers, type PresencePeer } from '@/app/dashboard/[eventId]/seating/_components/seating-presence-peers';
import { lockSaysViewOnly, type SeatingLockStatus } from '@/app/dashboard/[eventId]/seating/_components/use-seating-lock';

const WEB = path.join(__dirname, '..');
const SEATING = path.join(WEB, 'app/dashboard/[eventId]/seating');
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');
const parse = (rel: string) => ts.createSourceFile(rel, read(rel), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

function each(node: ts.Node, visit: (n: ts.Node) => void) {
  visit(node);
  ts.forEachChild(node, (c) => each(c, visit));
}

const isCall = (n: ts.Node, name: string): n is ts.CallExpression =>
  ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === name;

// ── 1 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('1 · an unchanged presence sync hands back the SAME list; a real change makes a new one', () => {
  const ME = 'me-1';
  const empty = new Map<string, PresencePeer>();
  // My own join, and my own re-track with a new lock beat — nobody else is here.
  assert.equal(nextPeers(empty, {}, ME), empty, 'an empty sync made a new Map — the editor re-renders for nothing');
  assert.equal(
    nextPeers(empty, { [ME]: [{ name: 'Ana', table: null, lockHolderId: ME, lockHeartbeatAt: '2026-10-22T00:00:30Z' }] }, ME),
    empty,
    'my own re-track made a new Map — the editor re-renders on every lock heartbeat',
  );

  const withBen = nextPeers(empty, { ben: [{ name: 'Ben', table: null }] }, ME);
  assert.notEqual(withBen, empty, 'a peer arriving must make a new Map (it is drawn)');
  assert.equal(withBen.get('ben')?.name, 'Ben');
  // The same people, re-synced (my own track lands): the SAME Map.
  assert.equal(nextPeers(withBen, { ben: [{ name: 'Ben', table: null }], [ME]: [{ name: 'Ana', table: 't1' }] }, ME), withBen);

  // A cursor seen for Ben survives a sync, and an unchanged sync keeps the very same Map.
  const moved = new Map(withBen);
  moved.set('ben', { ...withBen.get('ben')!, cursor: { x: 10, y: 20, ts: 1 } });
  const resynced = nextPeers(moved, { ben: [{ name: 'Ben', table: null }] }, ME);
  assert.equal(resynced, moved, 'a sync with nothing new dropped the drawn list');
  assert.deepEqual(resynced.get('ben')?.cursor, { x: 10, y: 20, ts: 1 });

  // Every real change is a new Map.
  assert.notEqual(nextPeers(withBen, { ben: [{ name: 'Ben', table: 't7' }] }, ME), withBen, 'a table pick was swallowed');
  assert.notEqual(nextPeers(withBen, { ben: [{ name: 'Ben', table: null, lockHolderId: 'ben' }] }, ME), withBen, 'a lock change was swallowed');
  assert.notEqual(nextPeers(withBen, { ben: [{ name: 'Ben', table: null, lockHeartbeatAt: 'x' }] }, ME), withBen, 'a heartbeat was swallowed');
  assert.notEqual(nextPeers(withBen, {}, ME), withBen, 'a departure was swallowed');
  assert.notEqual(nextPeers(withBen, { cy: [{ name: 'Cy', table: null }] }, ME), withBen, 'a swap of who is here was swallowed');
});

// ── 2 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('2 · the presence hook builds its list through nextPeers, and an identical list calls no setState', () => {
  const rel = 'app/dashboard/[eventId]/seating/_components/use-seating-presence.ts';
  const sf = parse(rel);
  let syncHandler: ts.Node | null = null;
  let guardedSetter = false;
  each(sf, (n) => {
    // `.on('presence', { event: 'sync' }, <handler>)`
    if (
      ts.isCallExpression(n) &&
      ts.isPropertyAccessExpression(n.expression) &&
      n.expression.name.text === 'on' &&
      n.arguments.length === 3 &&
      ts.isStringLiteral(n.arguments[0]!) &&
      n.arguments[0]!.text === 'presence' &&
      n.arguments[1]!.getText(sf).includes("'sync'")
    ) {
      syncHandler = n.arguments[2]!;
    }
    // The one setter: returns early when handed the list already drawn, before it calls the state setter.
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'setPeers' && n.initializer && ts.isArrowFunction(n.initializer)) {
      const body = n.initializer.body;
      const first = ts.isBlock(body) ? body.statements[0] : undefined;
      guardedSetter =
        !!first &&
        ts.isIfStatement(first) &&
        /===\s*peersRef\.current/.test(first.expression.getText(sf)) &&
        ts.isReturnStatement(ts.isBlock(first.thenStatement) ? first.thenStatement.statements[0]! : first.thenStatement);
    }
  });
  assert.ok(syncHandler, 'the presence sync handler was not found — point this guard at its new home');
  const h = syncHandler as ts.Node;
  let callsNextPeers = false;
  let buildsAMap = false;
  let usesUpdater = false;
  each(h, (n) => {
    if (isCall(n, 'nextPeers')) callsNextPeers = true;
    if (ts.isNewExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'Map') buildsAMap = true;
    if (isCall(n, 'setPeers') && n.arguments[0] && (ts.isArrowFunction(n.arguments[0]) || ts.isFunctionExpression(n.arguments[0]))) usesUpdater = true;
  });
  assert.ok(callsNextPeers, 'the sync handler no longer goes through nextPeers — an unchanged sync re-renders the editor');
  assert.ok(!buildsAMap, 'the sync handler builds its own Map again — every sync is a new value and a full editor render');
  assert.ok(!usesUpdater, 'the sync handler hands setPeers an updater — React renders once more before bailing out');
  assert.ok(guardedSetter, 'setPeers must return early when handed the list already drawn (`if (next === peersRef.current) return;`)');
});

// ── 3 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('3 · the plan listens live only once the lock has said view-only — on every surface that listens', () => {
  const all: SeatingLockStatus[] = ['idle', 'acquiring', 'editing', 'view_only', 'stale_takeover_available'];
  assert.deepEqual(all.filter(lockSaysViewOnly), ['view_only', 'stale_takeover_available']);

  const callers: string[] = [];
  const bad: string[] = [];
  for (const abs of walk(path.join(WEB, 'app'))) {
    const src = fs.readFileSync(abs, 'utf8');
    if (!src.includes('useSeatingLiveRefresh(')) continue;
    const sf = ts.createSourceFile(abs, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    each(sf, (n) => {
      if (!isCall(n, 'useSeatingLiveRefresh')) return;
      const rel = path.relative(WEB, abs);
      callers.push(rel);
      const gate = n.arguments[1];
      if (!gate || !isCall(gate, 'lockSaysViewOnly')) bad.push(`${rel}: useSeatingLiveRefresh(…, ${gate?.getText(sf) ?? '—'})`);
    });
  }
  assert.ok(callers.length >= 2, `only ${callers.length} live-refresh callers found (the 2D editor and the 3D plan) — the walk is blind`);
  assert.ok(callers.some((c) => c.startsWith(path.relative(WEB, SEATING))), 'the seat-plan editor no longer listens live — co-planners would stop following the editor');
  assert.deepEqual(bad, [], 'a surface listens on something other than lockSaysViewOnly(lock.status) — `!canEdit` joins and leaves a channel on every open');
});

// ── 4 ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
test('4 · the Budget screen sets none of its own state on mount', () => {
  const rel = 'app/dashboard/[eventId]/budget/_components/budget-screen.tsx';
  const sf = parse(rel);
  let screen: ts.FunctionDeclaration | null = null;
  each(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'BudgetScreen') screen = n;
  });
  assert.ok(screen, 'BudgetScreen not found — point this guard at its new home');
  const body = (screen as ts.FunctionDeclaration).body!;
  // Its own state setters: `const [x, setX] = useState(…)`.
  const setters = new Set<string>();
  each(body, (n) => {
    if (ts.isVariableDeclaration(n) && ts.isArrayBindingPattern(n.name) && n.initializer && isCall(n.initializer, 'useState')) {
      const second = n.name.elements[1];
      if (second && ts.isBindingElement(second) && ts.isIdentifier(second.name)) setters.add(second.name.text);
    }
  });
  assert.ok(setters.size >= 3, `only ${setters.size} state setters found in BudgetScreen — the reader is blind`);
  const onMount: string[] = [];
  each(body, (n) => {
    if (!(isCall(n, 'useEffect') || isCall(n, 'useLayoutEffect'))) return;
    const deps = n.arguments[1];
    if (!deps || !ts.isArrayLiteralExpression(deps) || deps.elements.length > 0) return;
    each(n.arguments[0]!, (m) => {
      if (ts.isCallExpression(m) && ts.isIdentifier(m.expression) && setters.has(m.expression.text)) onMount.push(m.getText(sf));
    });
  });
  assert.deepEqual(onMount, [], 'BudgetScreen sets its own state in a mount effect — the whole screen renders twice on open; put the flag in a small child (BodyPortal)');
  assert.doesNotMatch(body.getText(sf), /\bcreatePortal\(/, 'BudgetScreen portals by itself again — it needs a mounted flag of its own; use <BodyPortal>');
  assert.match(body.getText(sf), /<BodyPortal>/, 'the thumb row no longer goes through BodyPortal');
});
