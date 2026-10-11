/**
 * a-failed-read-is-not-an-absence.test.ts — on the guest's day pages, a database
 * read that FAILED is never drawn as a thing that is not there.
 * (lib/guest-read.ts has the story.)
 *
 * ── The defect ─────────────────────────────────────────────────────────────
 * `const { data } = await admin.from(…)…` throws the error away, and a failed
 * read resolves `data: null` / `[]` — exactly the value that means "nothing
 * here". On these pages that value was then SAID to the guest:
 *
 *   the event read ........ `notFound()` → "This link can't be found."
 *   the cast read ......... "The entourage hasn't been shared yet."
 *   the guest-list read ... "No one else has said yes yet."
 *   the plus-one's row .... a silent bounce back to the page that sent them
 *   the seat QR's hop ..... the event's page, with the guest's code dropped
 *   the table sign's view . "No one has been seated here yet."
 *
 * ── The property (read from the syntax tree, not from a phrasing) ──────────
 * In each file below, EVERY database read — every `<client>.from('table')`
 * chain that is not a write — is one of:
 *
 *   THROWN ..... passed to `guestRead(…)`, which retries a blip and throws on
 *                any error (the guest boundary answers);
 *   CONSULTED .. its `error` is bound in the destructure (directly, through
 *                `withSchemaRetry`, or as one of a `Promise.all`) AND that name
 *                is used again in the file — so the failure decides something;
 *   LISTED ..... named in `SOFT` below with the reason its soft failure is
 *                deliberate. A listed read that is no longer found fails the
 *                test too, so the list cannot rot into a blanket excuse.
 *
 * A read that is none of the three — `const { data } = await …`,
 * `(await …).data`, a bare `return admin.from(…)` — fails, by file and line.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · It proves the error is BOUND AND USED, not that it is used well. A
 *     `console.error(err)` satisfies "used". The reads this piece of work
 *     changed are also pinned by name in § 2, where the use is a throw or the
 *     in-place answer.
 *   · "Used again" is counted by NAME across the file. A read that binds the
 *     bare name `error` is satisfied by any other `error` in the file; today
 *     one read does (seat/page.tsx `fetchTables`, which returns
 *     `failed: Boolean(error)`). Bind a named error (`castError`) in new code.
 *   · It sees reads written in THESE files. A read inside a helper they call
 *     (`fetchEgiftMethods`, `isRecapPublished`, `loadRoomLinks`,
 *     `eventRecognisesViewer`'s client) is that helper's business and is not
 *     walked. Known and left: `isRecapPublished` answers "not published" for a
 *     failed read ("The recap isn't ready yet") — it is a publishing gate, so
 *     failing closed is right, but the sentence is then untrue.
 *   · `.rpc(…)` calls are not walked (none of these files reads through one
 *     for a decision that is said to a guest).
 *   · Nothing here runs a page. That the guest boundary is what a throw draws,
 *     and what a phone shows for the hops' in-place answer, needs a real run.
 *
 * Sabotage (2026-10-11, each on the real file, restored by hash):
 *   hub: the event read back to `const { data: event } = await` ... § 1 · 2 red
 *   pabuya: the same ............................................. § 1 · 2 red
 *   everyone: drop `if (castError) throw` ........................ § 1 · 2 red
 *   everyone: the gated read no longer binds `error` ............. § 1 red
 *   welcome: the guest read back to `const { data: guest }` ...... § 1 red
 *   seat/claim: drop the `guestError` answer ..................... § 2 red
 *   seat/claim: the event read no longer binds `error` ........... § 1 red
 *   seat: the table view's names read no longer binds `error` .... § 1 red
 *   an entry added to SOFT that matches nothing .................. § 1 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { stripComments } from '@/lib/strip-comments';

const HERE = __dirname;
const FILES = [
  'hub/page.tsx',
  'everyone/page.tsx',
  'pabuya/page.tsx',
  'recap/page.tsx',
  'welcome/page.tsx',
  'seat/page.tsx',
  'seat/claim/route.ts',
  'redeem/route.ts',
] as const;

/**
 * Reads whose soft failure is deliberate — `file · table · what it is bound to`.
 * Each carries the reason; none of them is followed by a sentence about an
 * absence that a failed read would make untrue.
 */
const SOFT: Record<string, string> = {
  'hub/page.tsx · event_seat_assignments · assignmentRow':
    'the seat label on the hub: inside a try, documented "graceful-degrade — these tables may not exist on every install"; a failed read draws no table line, and the seat pass itself (seat/page.tsx) says when it cannot load',
  'hub/page.tsx · event_tables · tableRow': 'the same seat label, second half of the same try',
  'welcome/page.tsx · guests · primary':
    'the inviting guest\'s NAME for one line of copy; unread, the line says "the inviting guest" — a plainer word, not a claim that nobody invited them',
  'seat/page.tsx · guest_checkins · checkin':
    'the "arrived" flourish on the pass; unread, the pass draws as not-yet-arrived, which changes no fact the guest acts on',
  'everyone/page.tsx · event_members · data':
    'whether the reader is a host: an absence DENIES here (the rest of the guest list stays hidden) — failing closed is correct',
};

type Read = { file: string; table: string; line: number; bound: string; verdict: 'thrown' | 'consulted' | 'discarded' };

const WRITES = new Set(['update', 'insert', 'upsert', 'delete']);

function readsOf(file: string): Read[] {
  const text = readFileSync(join(HERE, file), 'utf8');
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  /** How many times each identifier is written in the file — a bound error used again counts ≥ 2. */
  const uses = new Map<string, number>();
  const count = (n: ts.Node) => {
    if (ts.isIdentifier(n)) uses.set(n.text, (uses.get(n.text) ?? 0) + 1);
    ts.forEachChild(n, count);
  };
  count(sf);

  const out: Read[] = [];
  const unwrap = (n: ts.Node): ts.Node => (n.parent && ts.isParenthesizedExpression(n.parent) ? unwrap(n.parent) : n);

  /** The name an object pattern binds `error` to, when that name is used again. */
  const consultedError = (pattern: ts.BindingName | undefined): string | null => {
    if (!pattern || !ts.isObjectBindingPattern(pattern)) return null;
    for (const el of pattern.elements) {
      const key = el.propertyName ?? el.name;
      if (ts.isIdentifier(key) && key.text === 'error' && ts.isIdentifier(el.name)) {
        return (uses.get(el.name.text) ?? 0) >= 2 ? el.name.text : null;
      }
    }
    return null;
  };
  const boundData = (pattern: ts.BindingName | undefined): string => {
    if (!pattern) return '?';
    if (ts.isIdentifier(pattern)) return pattern.text;
    if (ts.isObjectBindingPattern(pattern)) {
      for (const el of pattern.elements) {
        const key = el.propertyName ?? el.name;
        if (ts.isIdentifier(key) && key.text === 'data' && ts.isIdentifier(el.name)) return el.name.text;
      }
    }
    return '?';
  };

  const visit = (node: ts.Node) => {
    ts.forEachChild(node, visit);
    if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return;
    if (node.expression.name.text !== 'from') return;
    const arg = node.arguments[0];
    if (!arg || !ts.isStringLiteralLike(arg)) return;
    const table = arg.text;

    // Climb the builder chain: `.from('t').select(…).eq(…).maybeSingle()`.
    let top: ts.Node = node;
    const methods: string[] = [];
    while (top.parent && ts.isPropertyAccessExpression(top.parent) && top.parent.expression === top && ts.isCallExpression(top.parent.parent) && top.parent.parent.expression === top.parent) {
      methods.push(top.parent.name.text);
      top = top.parent.parent;
    }
    if (methods.some((m) => WRITES.has(m))) return;
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;

    // `guestRead('…', () => chain)` — thrown.  `withSchemaRetry(() => chain)` — look at what binds IT.
    let expr: ts.Node = unwrap(top);
    const arrow = expr.parent;
    if (arrow && ts.isArrowFunction(arrow) && arrow.body === expr && ts.isCallExpression(arrow.parent) && ts.isIdentifier(arrow.parent.expression)) {
      const callee = arrow.parent.expression.text;
      if (callee === 'guestRead') {
        out.push({ file, table, line, bound: 'guestRead', verdict: 'thrown' });
        return;
      }
      if (callee === 'withSchemaRetry') expr = unwrap(arrow.parent);
    }

    // One of a `Promise.all([…])`: the matching element of the array pattern.
    let pattern: ts.BindingName | undefined;
    const list = expr.parent;
    if (list && ts.isArrayLiteralExpression(list) && ts.isCallExpression(list.parent)) {
      const index = list.elements.indexOf(expr as ts.Expression);
      const awaited = unwrap(list.parent).parent;
      const decl = awaited && ts.isAwaitExpression(awaited) ? unwrap(awaited).parent : undefined;
      if (decl && ts.isVariableDeclaration(decl) && ts.isArrayBindingPattern(decl.name)) {
        const el = decl.name.elements[index];
        if (el && ts.isBindingElement(el)) pattern = el.name;
      }
    } else if (list && ts.isAwaitExpression(list)) {
      const decl = unwrap(list).parent;
      if (decl && ts.isVariableDeclaration(decl)) pattern = decl.name;
    }
    const consulted = consultedError(pattern);
    out.push({ file, table, line, bound: consulted ?? boundData(pattern), verdict: consulted ? 'consulted' : 'discarded' });
  };
  visit(sf);
  return out;
}

const ALL = FILES.flatMap(readsOf);
/* `DUMP_READS=1` prints what the walker found and how it ruled — the way to check it is not blind before trusting it. */
if (process.env.DUMP_READS) for (const r of ALL) console.log(`# ${r.verdict.padEnd(9)} ${r.file}:${r.line} ${r.table} → ${r.bound}`);

test('1 · every read on the guest\'s day pages is thrown, consulted, or listed with its reason', () => {
  // Anti-vacuity: the walker finds reads at all, and finds each kind.
  for (const file of FILES) {
    assert.ok(ALL.some((r) => r.file === file), `the walker found no database read in ${file} — it moved, or the walker is blind`);
  }
  assert.ok(ALL.filter((r) => r.verdict === 'thrown').length >= 6, 'anti-vacuity: fewer `guestRead` reads than this work made');
  assert.ok(ALL.filter((r) => r.verdict === 'consulted').length >= 8, 'anti-vacuity: fewer consulted reads than the files hold');
  assert.ok(ALL.length >= 28, `anti-vacuity: the walker sees ${ALL.length} reads; there were 28 when this was written`);

  const soft = new Set<string>();
  const offenders: string[] = [];
  for (const r of ALL) {
    if (r.verdict !== 'discarded') continue;
    const key = `${r.file} · ${r.table} · ${r.bound}`;
    if (key in SOFT) soft.add(key);
    else offenders.push(`${r.file}:${r.line} reads \`${r.table}\` (bound to \`${r.bound}\`) and throws its error away`);
  }
  assert.deepEqual(
    offenders,
    [],
    'A failed read here resolves `data: null` — the same value as "nothing there" — and the page will say so. ' +
      'Pass it to `guestRead(…)`, or bind `error` and decide on it; list it in SOFT only with a reason:\n  ' +
      offenders.join('\n  '),
  );
  const stale = Object.keys(SOFT).filter((k) => !soft.has(k));
  assert.deepEqual(stale, [], `SOFT lists reads that are no longer soft (or no longer there) — remove them:\n  ${stale.join('\n  ')}`);
});

test('2 · the reads this work changed decide something on failure — a throw, or the in-place answer', () => {
  const src = (file: string) => stripComments(readFileSync(join(HERE, file), 'utf8'));
  const everyone = src('everyone/page.tsx');
  assert.match(everyone, /if \(castError\) throw new GuestReadError\('everyone \(entourage\)', castError\);/, 'a failed entourage read is not thrown');
  assert.match(everyone, /if \(guestRowsError\) throw new GuestReadError\('everyone \(guest list\)', guestRowsError\);/, 'a failed guest-list read is not thrown');
  // …and each throw stands BEFORE the sentence it protects.
  assert.ok(everyone.indexOf('if (castError) throw') < everyone.indexOf('The entourage hasn&rsquo;t been shared yet.'));
  /* 🔁 RE-AIMED 2026-10-11 (N19): the list is now the guests who said YES, so its empty sentence reads "No one
     else has said yes yet." The claim is the same — it is said only of a list that was read. */
  assert.ok(everyone.indexOf('if (guestRowsError) throw') < everyone.indexOf('No one else has said yes yet.'));
  assert.ok(everyone.includes('The entourage hasn&rsquo;t been shared yet.') && everyone.includes('No one else has said yes yet.'), 'anti-vacuity: the two sentences moved');

  const claim = src('seat/claim/route.ts');
  for (const name of ['eventError', 'guestError']) {
    assert.match(claim, new RegExp(`if \\(${name}\\) \\{[\\s\\S]{0,240}?return didNotLoadAnswer\\(tryAgainHref\\);\\s*\\}`), `seat/claim: ${name} is not answered with "didn't load"`);
  }
  // The code read is ruled out BEFORE the forward that treats "no guest row" as a table code.
  assert.ok(claim.indexOf('if (guestError)') > -1 && claim.indexOf('if (guestError)') < claim.indexOf("passUrl.searchParams.set('t', token)"));
  // A throw in the hop is answered in place too.
  assert.match(claim, /catch \(err\) \{\s*if \(!retry\.href\) throw err;[\s\S]{0,160}?return didNotLoadAnswer\(retry\.href\);/);

  // The public table view says "No one has been seated here yet." only of a table it read.
  const seat = src('seat/page.tsx');
  for (const name of ['assignmentsErr', 'occupantsErr']) {
    assert.match(seat, new RegExp(`if \\(${name}\\) \\{[\\s\\S]{0,260}?return <SeatCouldNotLoad `), `seat: ${name} is not answered with "We couldn't load"`);
  }
  assert.ok(seat.indexOf('if (occupantsErr)') > -1 && seat.indexOf('if (occupantsErr)') < seat.indexOf('No one has been seated here yet.'), 'the "nobody seated" sentence is reached before the failed read is ruled out');

  // Where a page reaches `notFound()` for the event, the event came through `guestRead`.
  for (const file of ['hub/page.tsx', 'everyone/page.tsx', 'pabuya/page.tsx', 'recap/page.tsx', 'welcome/page.tsx']) {
    const s = src(file);
    assert.match(s, /guestRead\('\w+ \(event\)', \(\) =>\s*admin\s*\.from\('events'\)/, `${file}: the event read no longer goes through guestRead`);
    assert.ok(s.includes('notFound()'), `anti-vacuity: ${file} no longer has a notFound()`);
  }
});
