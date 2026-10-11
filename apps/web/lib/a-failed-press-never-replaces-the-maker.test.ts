/**
 * a-failed-press-never-replaces-the-maker.test.ts — 📵 A PRESS WHOSE REQUEST NEVER ANSWERED IS SAID IN PLACE. IT
 * NEVER TAKES THE SCREEN.
 *
 * Owner, 2026-10-11, verbatim: *"make sure requests does not cause a crash"*. The database is on a small plan (the
 * first call after a quiet gap can take 3 s; once a day it stalls ~40 s) and phones drop signal. Measured the same
 * day on the Maker's own bar: offline, one tap on ↺ Undo replaced the WHOLE Maker with the app's error screen
 * ("Something on our end didn't work.") — the canvas, the tools and every unsaved field with it. The cause is one
 * shape, and it was in five more presses (a scene's Style / background pick, a scene's words, the Dress code's
 * Figures, the thank-you words, the tour's last button): a server action AWAITED INSIDE A TRANSITION with nothing to
 * catch it. React rethrows a transition's rejection while rendering, and `/dashboard` has no boundary below
 * `app/error.tsx`.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. In every file under the Maker's two folders (`launch/`, `website/`) AND every file the Maker's page imports
 *      for its code (walked from `launch/page.tsx`, so a shared row mounted in the Maker is held too), each `await`
 *      — or returned promise — in a function given to a transition is caught: in a `try/catch` that does not rethrow,
 *      by a `.catch(…)` on the expression, or by a function that never rejects (`lib/transition-await-scan.ts`).
 *      What is still open is in `STILL_OPEN` below, by file, with a ceiling and the reason — it may only go down.
 *   2. Every call to a Maker save door (`makerSave` · `makerRedrawSave`) — each REJECTS when the request never
 *      answered — has its rejection taken where it is written, or sits in a function named in `CAUGHT_BY_THE_CALLER`
 *      with the place that catches it.
 *   3. The functions the scan trusts never to reject are read and proved to be one `try/catch` (`hubDraftAnswer`).
 *   4. The scan can fire — each rule is run on a few lines of source, safe and unsafe.
 * Floors prove the walk is reading the Maker.
 *
 * ── NOT CLAIMED (so a green is not over-read) ───────────────────────────────────────────────────────────────────────
 *   · A plain `<form action={serverAction}>` post: React runs it in a transition of its own and there is no `await`
 *     in our source to find. The Maker still has such forms; a post that never answers is NOT covered by this file.
 *   · That the catch SAYS something. A silent `catch {}` passes here; the words are each component's own test.
 *   · Anything outside the Maker's reach — the guest list, seating on its own page, the supplier pages.
 *   · That a request really fails this way on a phone. This reads source; the failure was measured once, by hand, on
 *     the draft bar (see `hubDraftAnswer`).
 *   · The walk follows imports by FILE and by spelling — a component reached only through a string-built
 *     `import()` is not seen.
 *
 * WHEN IT FAILS: wrap the await the way the file's neighbours do — `hubDraftAnswer('save', () => makerSave(…))` for a
 * draft save (it answers with "Something went wrong. Please try again — your draft is kept."), or a `try/catch` that
 * sets the row's own error line. Never add to `STILL_OPEN` to go green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { namedFunctions, neverRejects, parseSource, scanSaveCalls, scanTransitionAwaits } from './transition-await-scan';

const WEB = path.resolve(__dirname, '..');
const EVENT = 'app/dashboard/[eventId]';
const MAKER_PAGE = `${EVENT}/launch/page.tsx`;
const read = (rel: string) => fs.readFileSync(path.join(WEB, rel), 'utf8');

function walkDir(rel: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(WEB, rel), { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const next = `${rel}/${e.name}`;
    if (e.isDirectory()) walkDir(next, out);
    else if (/\.tsx?$/.test(e.name) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(e.name)) out.push(next);
  }
  return out;
}

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(WEB, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(path.join(WEB, from)), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) {
    if (/\.tsx?$/.test(c) && fs.existsSync(c) && fs.statSync(c).isFile()) return path.relative(WEB, c);
  }
  return null;
}

/** The files `rel` imports for their CODE (`import type` and all-`type` lists are erased), `import()` included. */
function codeImports(rel: string): string[] {
  const sf = parseSource(rel, read(rel));
  const out: string[] = [];
  const add = (spec: string) => {
    const to = resolveSpec(rel, spec);
    if (to) out.push(to);
  };
  const visit = (n: ts.Node) => {
    if (ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)) {
      const c = n.importClause;
      const named = c?.namedBindings && ts.isNamedImports(c.namedBindings) ? c.namedBindings.elements : null;
      const typesOnly = c?.isTypeOnly || (c && !c.name && named && named.length > 0 && named.every((e) => e.isTypeOnly));
      if (!typesOnly) add(n.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(n) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier) && !n.isTypeOnly) add(n.moduleSpecifier.text);
    else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) add(n.arguments[0].text);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** Everything the Maker's page imports for its code, transitively. */
function makerReach(): Set<string> {
  const seen = new Set<string>([MAKER_PAGE]);
  const stack = [MAKER_PAGE];
  while (stack.length) for (const to of codeImports(stack.pop()!)) if (!seen.has(to)) (seen.add(to), stack.push(to));
  return seen;
}

const REACH = makerReach();
const FOLDERS = [...walkDir(`${EVENT}/launch`), ...walkDir(`${EVENT}/website`)];
const SCOPE = [...new Set([...FOLDERS, ...REACH])].sort();

/** Functions in OTHER files the scan may trust never to reject — each proved below, in the file that defines it. */
const ANSWERS: Record<string, string> = { hubDraftAnswer: 'lib/hub-draft.ts' };
const answers = new Set(Object.keys(ANSWERS));

/**
 * 🧾 STILL OPEN — presses the Maker can reach whose request, unanswered, still takes the screen. Each number is a
 * CEILING (fewer passes; more fails), so a fix on another branch never turns this red.
 *
 * None of these is in the Maker's own two folders. Each is another tool's component the Maker mounts in a panel:
 */
const STILL_OPEN: Record<string, { ceiling: number; why: string }> = {
  [`${EVENT}/seating/_components/seating-editor.tsx`]: {
    ceiling: 31,
    why: 'The seating plan (its own tool, drawn in a Maker panel). Every press goes through `runGated`, which rethrows; the plan has no line to say a failed move in. Its own piece of work.',
  },
  [`${EVENT}/studio/indoor-blueprint/_components/blueprint-studio.tsx`]: { ceiling: 1, why: 'The floor plan’s Save, inside the seating tool — with it.' },
  [`${EVENT}/_components/inline-checkout-drawer.tsx`]: {
    ceiling: 2,
    why: 'The checkout drawer (voucher · place order). A payment press needs its own honest words — an order whose answer was lost may have been placed.',
  },
  [`${EVENT}/guests/_components/send-invite.tsx`]: { ceiling: 2, why: 'The guest list’s Mark as sent and invite message — being fixed on the guest-list branch (rd/c-requests-never-crash).' },
  [`${EVENT}/schedule/_components/announce-button.tsx`]: { ceiling: 1, why: 'The schedule’s Announce — it sends a notice to people; a retry must not send it twice. Its own piece.' },
  [`${EVENT}/studio/mood-board/_components/inspiration-board.tsx`]: { ceiling: 1, why: 'The Mood Board’s remove-a-photo.' },
  [`${EVENT}/studio/save-the-date/_components/launch-std-button.tsx`]: { ceiling: 3, why: 'Launch · schedule · cancel the Save the Date — guest-facing sends, each its own honest line.' },
};

const FOUND = SCOPE.map((file) => ({ file, awaits: scanTransitionAwaits(file, read(file), { answers }) })).filter((f) => f.awaits.length > 0);

test('the walk reads the Maker: its folders, the shared rows it mounts, and the presses this was written for', () => {
  assert.ok(FOLDERS.length >= 200, `only ${FOLDERS.length} files under launch/ and website/`);
  assert.ok(REACH.size >= 900, `only ${REACH.size} files reached from the Maker's page`);
  for (const f of [
    `${EVENT}/launch/_components/maker-shell.tsx`,
    `${EVENT}/website/editor/_components/use-scene-canvas.ts`,
    `${EVENT}/website/editor/_components/scene-style-row.tsx`,
    `${EVENT}/pabuya/_components/pabuya-message-editor.tsx`,
    `${EVENT}/details/_components/governed-fields.tsx`,
    `${EVENT}/_components/address-pin-field.tsx`,
  ]) {
    assert.ok(REACH.has(f), `${f} is no longer reached from the Maker's page — the walk lost it`);
  }
  const total = FOUND.reduce((n, f) => n + f.awaits.length, 0);
  assert.ok(FOUND.length >= 45 && total >= 100, `only ${total} transition awaits in ${FOUND.length} files — the scan is not seeing the transitions`);
  /* The five presses of 2026-10-11 are each SEEN (a fix the scan cannot see is not held by it). */
  const seen = (file: string, awaited: RegExp) => FOUND.find((f) => f.file === file)?.awaits.some((a) => awaited.test(a.awaited) && a.guard !== null);
  assert.ok(seen(`${EVENT}/website/editor/_components/use-scene-canvas.ts`, /^hubDraftAnswer\(/), 'useSceneCanvas.save');
  assert.ok(seen(`${EVENT}/website/editor/_components/details-bound-field.tsx`, /^hubDraftAnswer\(/), 'DetailsBoundField answer');
  assert.ok(seen(`${EVENT}/website/editor/_components/scene-style-row.tsx`, /^hubDraftAnswer\(.*saveEvents/), 'DressFiguresRow');
  assert.ok(seen(`${EVENT}/pabuya/_components/pabuya-message-editor.tsx`, /savePabuyaMessage/), 'the thank-you words');
  assert.ok(seen(`${EVENT}/launch/_components/maker-tour.tsx`, /^completeAction\(/), 'the tour’s last button');
});

test('1 · no await in a transition the Maker can reach is left to throw into it', () => {
  const open = new Map<string, string[]>();
  for (const { file, awaits } of FOUND) {
    const bad = awaits.filter((a) => a.guard === null).map((a) => `${file}:${a.line}  ${a.starter}(… await ${a.awaited})`);
    if (bad.length) open.set(file, bad);
  }
  const over: string[] = [];
  for (const [file, bad] of open) {
    const allowed = STILL_OPEN[file]?.ceiling ?? 0;
    if (bad.length > allowed) over.push(...(allowed ? [`${file}: ${bad.length} open, ceiling ${allowed}`] : []), ...bad);
  }
  assert.deepEqual(
    over,
    [],
    `A request awaited inside a transition with nothing to catch it. When it never answers (no signal, a 5xx) React rethrows it and the whole Maker is replaced by the app's error screen:\n  ${over.join('\n  ')}\nSee "WHEN IT FAILS" at the top of this file.`,
  );
  /* Nothing in the Maker's own two folders is ever on the open list. */
  for (const file of Object.keys(STILL_OPEN)) {
    assert.ok(!file.startsWith(`${EVENT}/launch/`) && !file.startsWith(`${EVENT}/website/`), `${file} is the Maker's own — fix it, do not list it`);
    assert.ok(fs.existsSync(path.join(WEB, file)), `${file} moved or was deleted — take it off STILL_OPEN`);
  }
});

/**
 * A save door called in a helper that hands its promise on. Each is caught one step out — named here so a NEW bare
 * call cannot hide behind "its caller probably catches". `file › function` → where the rejection is taken.
 */
const CAUGHT_BY_THE_CALLER: Record<string, string> = {
  [`${EVENT}/launch/_components/details-your-event.tsx › draftFactsFull`]:
    'draftFacts / draftDate — every caller awaits in a try/catch (held by claim 1: each is in a transition), and `saveDay` answers in words',
  [`${EVENT}/launch/_components/details-your-event.tsx › draftVenueChoice`]: 'VenuesEditor `choose` — `.then(…).catch(…)` puts the card back',
  [`${EVENT}/website/editor/_components/use-scene-canvas.ts › useHeldEventsSave`]: 'DressFiguresRow — `hubDraftAnswer(\'save\', () => saveEvents(…))` (held by claim 1)',
};

test('2 · every Maker save door’s rejection is taken where it is called, or by a caller that is named', () => {
  const doors = new Set(['makerSave', 'makerRedrawSave']);
  const files = [...walkDir('app'), ...walkDir('lib'), ...walkDir('components')].filter((f) => f !== 'lib/maker-refresh.ts');
  const calls = files.flatMap((file) => scanSaveCalls(file, read(file), doors, { answers }).map((c) => ({ file, ...c })));
  assert.ok(calls.length >= 55, `only ${calls.length} save-door calls found — the scan is not reading the Maker`);
  const bare = calls.filter((c) => c.guard === null);
  const unnamed = bare.filter((c) => !(`${c.file} › ${c.owner}` in CAUGHT_BY_THE_CALLER)).map((c) => `${c.file}:${c.line}  ${c.name}(…) in ${c.owner}`);
  assert.deepEqual(unnamed, [], `A Maker save whose rejection nothing takes. It rejects when the request never answered:\n  ${unnamed.join('\n  ')}`);
  const used = new Set(bare.map((c) => `${c.file} › ${c.owner}`));
  for (const key of Object.keys(CAUGHT_BY_THE_CALLER)) assert.ok(used.has(key), `${key} no longer hands its promise on — take it off CAUGHT_BY_THE_CALLER`);
});

test('3 · the functions trusted never to reject are one try/catch, in the file that defines them', () => {
  for (const [name, file] of Object.entries(ANSWERS)) {
    const fn = namedFunctions(parseSource(file, read(file))).get(name);
    assert.ok(fn, `${name} is not defined in ${file} any more`);
    assert.ok(neverRejects(fn), `${name} can reject now — every press that relies on it throws into its transition again`);
  }
});

test('4 · the scan can fire: each rule, on a few lines of source', () => {
  const scan = (body: string, pre = '') =>
    scanTransitionAwaits('x.tsx', `${pre}\nfunction C() { const [p, start] = useTransition();\n const go = () => { start(${body}); }; }`, { answers }).map((a) => a.guard);
  // The defect itself.
  assert.deepEqual(scan('async () => { const r = await save(fd); if (!r.ok) setError(r.error); }'), [null]);
  assert.deepEqual(scan('async () => { await makerSave(() => act(fd), refresh); }'), [null]);
  // …by React's own name, and by a returned promise.
  assert.deepEqual(scanTransitionAwaits('x.tsx', 'startTransition(async () => { await act(); });').map((a) => a.guard), [null]);
  assert.deepEqual(scan('() => act(fd)'), [null]);
  assert.deepEqual(scan('() => { return act(fd); }'), [null]);
  assert.deepEqual(scan('() => router.refresh()'), [], 'router.refresh() returns nothing');
  assert.deepEqual(scan('async () => { const r = await save(fd).catch(() => no); if (!r.ok) return setError(r.error); }'), ['chain'], 'a returned setter is not a promise (async returns are not judged — see the scan’s header)');
  // The three ways it is caught.
  assert.deepEqual(scan('async () => { try { await save(fd); } catch { setError("x"); } }'), ['try']);
  assert.deepEqual(scan('async () => { const r = await save(fd).catch(() => null); }'), ['chain']);
  assert.deepEqual(scan('async () => { const ok = await save(fd).then((r) => r.ok, () => false); }'), ['chain']);
  assert.deepEqual(scan("async () => { const r = await hubDraftAnswer('save', () => makerSave(() => act(fd), refresh)); }"), ['answers']);
  assert.deepEqual(scan('async () => { await took(save(fd)); }', 'async function took(p) { try { return (await p).ok; } catch { return false; } }'), ['answers']);
  // …and the ways it only LOOKS caught.
  assert.deepEqual(scan('async () => { try { await save(fd); } finally { done(); } }'), [null], 'a try with no catch');
  assert.deepEqual(scan('async () => { try { await save(fd); } catch (e) { log(e); throw e; } }'), [null], 'a catch that rethrows');
  assert.deepEqual(scan('async () => { try { await save(fd); } catch (e) { if (isRedirect(e)) throw e; setError("x"); } }'), ['try'], 'a rethrow on a condition is a catch');
  assert.deepEqual(scan('async () => { try { await a(); } catch { await b(); } }'), ['try', null], 'an await inside the catch itself');
  assert.deepEqual(scan('async () => { await gated(() => act(fd)); }', 'const gated = async (fn) => { try { return await fn(); } catch (e) { if (lost(e)) return null; throw e; } };'), [null], 'a wrapper that rethrows');
  assert.deepEqual(scan('async () => { await save(fd).then((r) => r.ok); }'), [null], 'a one-argument then');
  // A function it only DEFINES is not its await; a function it is HANDED by name is opened.
  assert.deepEqual(scan('async () => { const later = async () => { await act(); }; setLater(later); }'), []);
  assert.deepEqual(scan('send', 'const send = async () => { await act(); };'), [null]);
  assert.deepEqual(scan('props.send'), [], 'a property is not opened (documented: judged where the transition is written)');
  assert.deepEqual(scan('send'), [null], 'a name this file does not define is reported, not waved through');

  const doors = new Set(['makerSave']);
  const call = (src: string) => scanSaveCalls('x.ts', src, doors, { answers }).map((c) => c.guard);
  assert.deepEqual(call('async function f() { const r = await makerSave(send, refresh); return r; }'), [null]);
  assert.deepEqual(call('function f() { return makerSave(send, refresh); }'), [null]);
  assert.deepEqual(call('async function f() { try { return makerSave(send, refresh); } catch { return null; } }'), [null], 'returned bare from inside a try');
  assert.deepEqual(call('async function f() { try { return await makerSave(send, refresh); } catch { return null; } }'), ['try']);
  assert.deepEqual(call('function f() { void makerSave(send, refresh).then(done).catch(put); }'), ['chain']);
  assert.deepEqual(call('function f() { q = q.then(() => makerSave(send, refresh)).catch(() => no).then(say); }'), ['chain']);
  assert.deepEqual(call('function f() { q = q.then(() => makerSave(send, refresh)).then(say); }'), [null]);
  assert.deepEqual(call("async function f() { return hubDraftAnswer('save', () => makerSave(send, refresh)); }"), ['answers']);
  assert.deepEqual(call('async function f() { const r = await (a ? makerSave(x, r) : makerSave(y, r)).catch(() => no); }'), ['chain', 'chain']);
});
