/**
 * every-maker-edit-shows-before-it-saves.test.ts — ⚡ THE MAKER NEVER WAITS ON
 * THE SERVER TO SHOW A TAP.
 *
 * Owner, 2026-09-29: *"we also want to make sure 100% that there is no slow
 * response on the maker"* (DECISION_LOG "THE MAKER MUST NEVER FEEL SLOW"). The
 * shipped mechanism is one path: the change is drawn first (local state the
 * control reads, or the canvas bridge), then the draft save runs behind it
 * through `makerSave` (`lib/maker-refresh.ts`), which refreshes the Maker ONCE
 * per burst of saves.
 *
 * This walks the Maker's client components with the TypeScript parser — not a
 * regex over a phrase — and holds three PROPERTIES of the wiring:
 *
 *   A · every `makerSave(…)` call is preceded, in the handler that runs it, by
 *       a write the screen reads: a React state setter that is not a status
 *       word (`setError`, `setBusy`, …), or a canvas post (`onPreview`, `lay`,
 *       `postMessage`, `broadcastToCanvas`). A handler that awaits the server
 *       before anything changes on screen fails here, however it is spelled.
 *   B · no Maker client calls a server action outside `makerSave` — a save that
 *       skips it also skips the one-refresh-per-burst and the canvas hold.
 *   C · `router.refresh()` runs only as `makerSave`'s refresh (or as the one
 *       listener for `requestMakerRefresh`): a bare refresh after a save is the
 *       second whole-Maker render this path exists to remove.
 *
 * Each exception is listed with its reason, and the test fails if a listed
 * exception no longer exists — the list cannot rot into a blanket pass.
 *
 * NOT SEEN (so a green is not over-read): a plain `<form action={…}>` post (the
 * Maker shell's submit listener handles those — `maker-shell.tsx`), a save
 * started from a file outside the three Maker folders, and whether the thing a
 * setter writes is really what the control draws (the component tests hold
 * that per control).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const WEB = path.resolve(__dirname, '..');
const DIRS = [
  'app/dashboard/[eventId]/launch/_components',
  'app/dashboard/[eventId]/website/editor/_components',
  'app/dashboard/[eventId]/website/_components',
];

/** State writes that report on a save rather than show the edit. */
const STATUS_SETTER = /^set(Error|Note|Problem|Failed|Busy|Pending|Save|Saving|Status|State|Reading|Loading)$/;
/** Canvas posts — the bridge draws the edit (`element-preview.ts`, `scene-bg-preview.ts`). */
const CANVAS_POST = new Set(['onPreview', 'lay', 'broadcastToCanvas', 'postToCanvas', 'postMessage']);

/**
 * Handlers that save without drawing first, and why that is right. Keyed
 * `file › handler` (the handler is the nearest named function around the save).
 */
const WAITS_ON_PURPOSE: Record<string, string> = {
  'website/_components/hub-draft-bar.tsx › run':
    'Undo · Restore · Reset · Apply: the result is computed by the server (the history, the live page). The bar shows the pending state, and the canvas reloads double-buffered, never blank.',
  'launch/_components/maker-logo.tsx › flush':
    'The logo autosave: the edit is already drawn by the studio’s own state; this is the debounced save behind it.',
  'website/editor/_components/details-bound-field.tsx › answer':
    'The words were drawn on the canvas as they were typed (`useSceneWordsBox`); this is the save behind them, held (`onSaving`).',
  'launch/_components/soft-post.tsx › onSubmit':
    'A plain Details form: what the couple typed IS the visible change; the post saves it without leaving the page.',
  'website/editor/_components/main-background-panel.tsx › <effect>':
    'Not a tap — the Main background reads the hero photo’s colours by itself and saves them.',
  'website/editor/_components/main-background-panel.tsx › save':
    'OPEN — scene/main backgrounds belong to Builder H; reported 2026-09-29 (the choice waits on the save). Remove this line when it is drawn first.',
  'launch/_components/maker-rsvp-ask.tsx › save':
    'Reply-by date: the date the couple typed IS the visible change (the input\'s own state); Save stores it and says "Saved."',
  'launch/_components/parent-cards.tsx › add':
    'OPEN (Details, Builder K) — adding a parent creates a guest row and its card needs the server\'s new guest id; nothing shows until it lands. Reported 2026-09-29.',
  'launch/_components/details-march.tsx › leaveBlank':
    'OPEN (Details, Builder K) — "Leave the other side blank" unpairs LIVE and the line changes only when the server answers. Reported 2026-09-29.',
  'launch/_components/details-march.tsx › run':
    'OPEN (Details, Builder K) — a walking-order move writes LIVE ("Saves immediately") and the line moves only when the server answers. Reported 2026-09-29.',
};

/** `router.refresh()` outside `makerSave`, and why. */
const BARE_REFRESH_OK: Record<string, string> = {
  'website/_components/hub-draft-bar.tsx':
    'The one listener for `requestMakerRefresh` — it IS the refresh a router-less control asks makerSave for.',
  'launch/_components/view-as-free.tsx': 'Switching how the page is viewed — no save, the render is the change.',
  'launch/_components/maker-reveal.tsx': 'Play the opening again when the page frame cannot be reached — no save.',
};

type Hit = { file: string; handler: string; line: number };

function clientFiles(): string[] {
  const out: string[] = [];
  for (const d of DIRS) {
    const abs = path.join(WEB, d);
    for (const f of fs.readdirSync(abs)) {
      if (!f.endsWith('.tsx') || f.endsWith('.test.tsx')) continue;
      const full = path.join(abs, f);
      if (/^\s*['"]use client['"]/.test(fs.readFileSync(full, 'utf8'))) out.push(full);
    }
  }
  return out;
}

const rel = (full: string) => path.relative(path.join(WEB, 'app/dashboard/[eventId]'), full);
const parse = (full: string) => ts.createSourceFile(full, fs.readFileSync(full, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

function calleeName(call: ts.CallExpression): string | null {
  const e = call.expression;
  if (ts.isIdentifier(e)) return e.text;
  if (ts.isPropertyAccessExpression(e)) return e.name.text;
  return null;
}

function walk(node: ts.Node, fn: (n: ts.Node) => void) {
  fn(node);
  ts.forEachChild(node, (c) => walk(c, fn));
}

/** The nearest NAMED function around `node` — the handler a tap runs. */
function handlerOf(node: ts.Node): { fn: ts.Node; name: string } | null {
  for (let p: ts.Node | undefined = node.parent; p; p = p.parent) {
    if (!(ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p))) continue;
    const parent = p.parent;
    if (ts.isFunctionDeclaration(p) && p.name) return { fn: p, name: p.name.text };
    if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return { fn: p, name: parent.name.text };
    if (parent && ts.isJsxExpression(parent)) return { fn: p, name: '<jsx handler>' };
    if (parent && ts.isCallExpression(parent)) {
      const callee = calleeName(parent);
      if (callee === 'useEffect' || callee === 'useLayoutEffect') return { fn: p, name: '<effect>' };
      if (callee === 'useCallback' && parent.parent && ts.isVariableDeclaration(parent.parent) && ts.isIdentifier(parent.parent.name)) {
        return { fn: p, name: parent.parent.name.text };
      }
    }
  }
  return null;
}

/** Does anything run before `call`, inside `handler`, write what the screen reads? */
function drawsFirst(call: ts.Node, handler: ts.Node): boolean {
  let drew = false;
  const looks = (n: ts.Node) =>
    walk(n, (x) => {
      if (!ts.isCallExpression(x)) return;
      const name = calleeName(x);
      if (!name) return;
      if (/^set[A-Z]/.test(name) && !STATUS_SETTER.test(name)) drew = true;
      if (CANVAS_POST.has(name)) drew = true;
    });
  for (let child: ts.Node = call, p = call.parent; p && child !== handler; child = p, p = p.parent) {
    if (ts.isBlock(p) || ts.isSourceFile(p)) {
      for (const st of p.statements) {
        if (st === child) break;
        looks(st);
      }
    }
  }
  return drew;
}

function isMakerSave(n: ts.Node): n is ts.CallExpression {
  return ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 'makerSave';
}
const within = (node: ts.Node, outer: ts.Node) => {
  for (let p: ts.Node | undefined = node; p; p = p.parent) if (p === outer) return true;
  return false;
};

/** Every identifier this file imports from a `'use server'` module. */
function serverActionImports(sf: ts.SourceFile, full: string): Set<string> {
  const names = new Set<string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier) || st.importClause?.isTypeOnly) continue;
    const spec = st.moduleSpecifier.text;
    const base = spec.startsWith('@/') ? path.join(WEB, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(full), spec) : null;
    if (!base) continue;
    const file = ['.ts', '.tsx'].map((x) => base + x).find((f) => fs.existsSync(f));
    if (!file || !/^\s*['"]use server['"]/.test(fs.readFileSync(file, 'utf8'))) continue;
    const bindings = st.importClause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) for (const el of bindings.elements) if (!el.isTypeOnly) names.add(el.name.text);
  }
  return names;
}

const FILES = clientFiles();

test('the scan reads the Maker — its three folders, and the saves inside them', () => {
  assert.ok(FILES.length >= 30, `only ${FILES.length} client files found — the folders moved?`);
  let saves = 0;
  for (const f of FILES) walk(parse(f), (n) => void (isMakerSave(n) && saves++));
  assert.ok(saves >= 15, `only ${saves} makerSave calls found — the scan is not reading the Maker`);
});

test('A · every Maker save is drawn on screen before the server is asked', () => {
  const late: Hit[] = [];
  const used = new Set<string>();
  for (const full of FILES) {
    const sf = parse(full);
    walk(sf, (n) => {
      if (!isMakerSave(n)) return;
      const h = handlerOf(n);
      const handler = h?.name ?? '<top>';
      const key = `${rel(full)} › ${handler}`;
      if (key in WAITS_ON_PURPOSE) {
        used.add(key);
        return;
      }
      if (!h || !drawsFirst(n, h.fn)) {
        late.push({ file: rel(full), handler, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
      }
    });
  }
  assert.deepEqual(
    late,
    [],
    `These Maker saves make the couple wait for the server before anything changes on screen. Draw the change first ` +
      `(set the state the control reads, or post it to the canvas), then save behind it:\n` +
      late.map((l) => `  ${l.file}:${l.line} (${l.handler})`).join('\n'),
  );
  const stale = Object.keys(WAITS_ON_PURPOSE).filter((k) => !used.has(k));
  assert.deepEqual(stale, [], `WAITS_ON_PURPOSE lists handlers that no longer save — remove them:\n  ${stale.join('\n  ')}`);
});

test('B · no Maker control calls a server action outside makerSave', () => {
  const bare: Hit[] = [];
  for (const full of FILES) {
    const sf = parse(full);
    const actions = serverActionImports(sf, full);
    if (actions.size === 0) continue;
    const saves: ts.CallExpression[] = [];
    walk(sf, (n) => void (isMakerSave(n) && saves.push(n)));
    /* A same-file wrapper that FORWARDS its parameter to makerSave (`run(send)` →
       `makerSave(send, …)`) counts: the action runs inside makerSave. */
    const forwarders = new Set<string>();
    for (const s of saves) {
      const a = s.arguments[0];
      if (!a || !ts.isIdentifier(a)) continue;
      for (let p: ts.Node | undefined = s.parent; p; p = p.parent) {
        if (!(ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p))) continue;
        if (p.parameters.some((prm) => ts.isIdentifier(prm.name) && prm.name.text === a.text)) {
          const holder = ts.isFunctionDeclaration(p) ? p.name?.text : ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name) ? p.parent.name.text : undefined;
          if (holder) forwarders.add(holder);
          break;
        }
      }
    }
    const viaForwarder = (n: ts.Node): boolean => {
      for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isCallExpression(p.parent) && p.parent.arguments.includes(p as ts.Expression)) {
          const callee = calleeName(p.parent);
          if (callee && forwarders.has(callee)) return true;
        }
      }
      return false;
    };
    const inSave = (n: ts.Node) => saves.some((s) => s.arguments[0] && within(n, s.arguments[0])) || viaForwarder(n);
    /** A same-file helper that wraps the action (`saveMain`) counts when it is only ever called inside makerSave. */
    const wrapperOnlySaved = (n: ts.Node): boolean => {
      let fn: ts.Node | undefined = n.parent;
      while (fn && !ts.isFunctionDeclaration(fn)) fn = fn.parent;
      const name = fn && ts.isFunctionDeclaration(fn) ? fn.name?.text : undefined;
      if (!name) return false;
      const calls: ts.Node[] = [];
      walk(sf, (x) => void (ts.isCallExpression(x) && ts.isIdentifier(x.expression) && x.expression.text === name && calls.push(x)));
      return calls.length > 0 && calls.every(inSave);
    };
    walk(sf, (n) => {
      if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || !actions.has(n.expression.text)) return;
      const inside = inSave(n) || wrapperOnlySaved(n);
      if (!inside) bare.push({ file: rel(full), handler: n.expression.text, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    });
  }
  assert.deepEqual(
    bare,
    [],
    `Server actions called outside makerSave (no one-refresh-per-burst, no canvas hold):\n` +
      bare.map((b) => `  ${b.file}:${b.line} ${b.handler}()`).join('\n'),
  );
});

test('C · router.refresh() runs only as makerSave’s one refresh', () => {
  const bare: Hit[] = [];
  const used = new Set<string>();
  for (const full of FILES) {
    const sf = parse(full);
    const saves: ts.CallExpression[] = [];
    walk(sf, (n) => void (isMakerSave(n) && saves.push(n)));
    walk(sf, (n) => {
      if (!ts.isCallExpression(n) || !ts.isPropertyAccessExpression(n.expression) || n.expression.name.text !== 'refresh') return;
      if (!ts.isIdentifier(n.expression.expression) || n.expression.expression.text !== 'router') return;
      if (saves.some((s) => s.arguments[1] && within(n, s.arguments[1]))) return;
      const file = rel(full);
      if (file in BARE_REFRESH_OK) {
        used.add(file);
        return;
      }
      bare.push({ file, handler: handlerOf(n)?.name ?? '<top>', line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
    });
  }
  assert.deepEqual(
    bare,
    [],
    `A bare router.refresh() re-renders the whole Maker outside makerSave's one refresh per burst:\n` +
      bare.map((b) => `  ${b.file}:${b.line} (${b.handler})`).join('\n'),
  );
  const stale = Object.keys(BARE_REFRESH_OK).filter((k) => !used.has(k));
  assert.deepEqual(stale, [], `BARE_REFRESH_OK lists files with no bare refresh any more — remove them:\n  ${stale.join('\n  ')}`);
});

test('a made-once page frame is double-buffered, never an iframe keyed on the render', () => {
  const full = path.join(WEB, 'app/dashboard/[eventId]/launch/_components/maker-page.tsx');
  const sf = parse(full);
  let fn: ts.Node | null = null;
  walk(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === 'MakerPageFrame') fn = n;
  });
  assert.ok(fn, 'MakerPageFrame is gone — find where the made-once pages draw their frame');
  const tags: string[] = [];
  walk(fn!, (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) tags.push(n.tagName.getText(sf));
  });
  assert.ok(tags.includes('BufferedCanvasFrame'), 'the page frame must load a new render BEHIND the one shown');
  assert.ok(!tags.includes('iframe'), 'a bare <iframe> here is remounted blank by every Maker render');
});
