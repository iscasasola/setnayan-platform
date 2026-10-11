/**
 * transition-await-scan.ts — find every `await` that can THROW INTO A REACT TRANSITION.
 *
 * WHY THIS SHAPE. `startTransition(async () => { await serverAction() })` hands React the promise. When the request
 * never answers (no signal, a 5xx, the daily database stall) that promise REJECTS, React rethrows it while rendering,
 * and the nearest error boundary takes the screen — under `/dashboard` that is `app/error.tsx`, the whole page. The
 * Maker, the canvas and everything typed go with it. A rejection in a plain event handler does not do this; a
 * transition does. So the unit of the scan is: an `await` (or a returned promise) in a function GIVEN TO A TRANSITION.
 *
 * WHAT COUNTS AS A TRANSITION BODY (found, not listed):
 *   · the first argument of `startTransition(…)`, or of any name destructured as the second element of
 *     `useTransition()` in the same file (`const [pending, start] = useTransition()` → `start`);
 *   · an inline function, or a name bound to a function in the same file (`start(save)`).
 *
 * WHAT MAKES AN AWAIT SAFE (`guard`):
 *   · `try`      — it sits in the `try` block of a `try/catch` inside that same function, and the catch does not END
 *                  in a `throw` (a catch that always rethrows is a catch in spelling only). A catch that rethrows on
 *                  a CONDITION — `if (isRedirect(e)) throw e;` — counts as caught: the condition is not judged;
 *   · `chain`    — the awaited expression ends in `.catch(…)` or a two-argument `.then(a, b)`;
 *   · `answers`  — it awaits a call to a function that NEVER REJECTS: one whose whole body is a single non-rethrowing
 *                  `try/catch` — found in the same file, or named in `answers` (the caller verifies each of those in
 *                  its own file with `neverRejects`).
 *   Anything else is `null`: it can take the screen.
 *
 * ⚠ WHAT THIS CANNOT SEE — read before trusting a green:
 *   · a `<form action={serverAction}>` / `formAction` / `useActionState` — React runs those in a transition of its
 *     own, with no `await` in our source to find. Counted separately by the test, not judged here;
 *   · a transition started in ANOTHER file's helper that this file only calls (`run(fn)` from a hook): the await is
 *     judged where the `startTransition` is written, so the helper's file must be in the scanned set;
 *   · whether the catch SAYS anything — a silent `catch {}` passes. That a failure is said, in words, is each
 *     component's own test;
 *   · a promise an ASYNC body RETURNS un-awaited (`return act()`): without types `return setError(x)` looks the same,
 *     so only a SYNC body's returned call is judged (`start(() => act(fd))`), and `router.…()` there is known void;
 *   · a `throw` reached without an await (a synchronous throw inside the transition body).
 * Pure: source text in, findings out. The TypeScript parser only — no type checker, so a name is matched by spelling
 * within one file.
 */
import ts from 'typescript';

export type AwaitGuard = 'try' | 'chain' | 'answers';
export type TransitionAwait = {
  line: number;
  /** The name the transition was started with (`start`, `startTransition`, …). */
  starter: string;
  /** The awaited (or returned) expression, one line, cut short. */
  awaited: string;
  guard: AwaitGuard | null;
};

type Fn = ts.ArrowFunction | ts.FunctionExpression | ts.FunctionDeclaration | ts.MethodDeclaration;
const isFn = (n: ts.Node): n is Fn => ts.isArrowFunction(n) || ts.isFunctionExpression(n) || ts.isFunctionDeclaration(n) || ts.isMethodDeclaration(n);
const walk = (n: ts.Node, fn: (x: ts.Node) => void) => {
  fn(n);
  ts.forEachChild(n, (c) => walk(c, fn));
};
export const parseSource = (file: string, src: string) =>
  ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, /\.tsx$/.test(file) ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

/** A catch that ALWAYS rethrows: its last statement is a `throw`. (A `throw` under an `if` is a condition — not judged.) */
const alwaysRethrows = (block: ts.Block) => {
  const last = block.statements[block.statements.length - 1];
  return Boolean(last) && ts.isThrowStatement(last!);
};
const catches = (t: ts.TryStatement) => Boolean(t.catchClause) && !alwaysRethrows(t.catchClause!.block);

/** A function that never rejects: its whole body is ONE non-rethrowing `try/catch`. */
export function neverRejects(fn: ts.Node | undefined): boolean {
  if (!fn || !isFn(fn) || !fn.body || !ts.isBlock(fn.body)) return false;
  const [only, ...rest] = fn.body.statements;
  return rest.length === 0 && Boolean(only) && ts.isTryStatement(only!) && catches(only);
}

/** Every function a file binds to a name at any level: `function f(){}` · `const f = () => {}`. */
export function namedFunctions(sf: ts.SourceFile): Map<string, Fn> {
  const out = new Map<string, Fn>();
  walk(sf, (n) => {
    if (ts.isFunctionDeclaration(n) && n.name) out.set(n.name.text, n);
    else if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isArrowFunction(n.initializer) || ts.isFunctionExpression(n.initializer))) {
      out.set(n.name.text, n.initializer);
    }
  });
  return out;
}

const unwrap = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e) ? unwrap(e.expression) : e);

/** `x.catch(…)` · `x.then(a, b)` — the rejection is taken by the expression itself. */
function chainCatches(e: ts.Expression): boolean {
  const c = unwrap(e);
  if (!ts.isCallExpression(c) || !ts.isPropertyAccessExpression(c.expression)) return false;
  const name = c.expression.name.text;
  return (name === 'catch' && c.arguments.length >= 1) || (name === 'then' && c.arguments.length >= 2);
}

export function scanTransitionAwaits(file: string, src: string, opts: { answers?: ReadonlySet<string> } = {}): TransitionAwait[] {
  if (!/useTransition|startTransition/.test(src)) return [];
  const sf = parseSource(file, src);
  const fns = namedFunctions(sf);
  const answers = new Set<string>(opts.answers ?? []);
  for (const [name, fn] of fns) if (neverRejects(fn)) answers.add(name);

  const starters = new Set<string>(['startTransition']);
  walk(sf, (n) => {
    if (!ts.isVariableDeclaration(n) || !ts.isArrayBindingPattern(n.name) || !n.initializer) return;
    const init = unwrap(n.initializer);
    if (!ts.isCallExpression(init)) return;
    const callee = ts.isIdentifier(init.expression) ? init.expression.text : ts.isPropertyAccessExpression(init.expression) ? init.expression.name.text : '';
    if (callee !== 'useTransition') return;
    const second = n.name.elements[1];
    if (second && ts.isBindingElement(second) && ts.isIdentifier(second.name)) starters.add(second.name.text);
  });

  const out: TransitionAwait[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const text = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 90);
  const guardOf = (e: ts.Expression, inTry: boolean): AwaitGuard | null => {
    if (inTry) return 'try';
    if (chainCatches(e)) return 'chain';
    const c = unwrap(e);
    if (ts.isCallExpression(c) && ts.isIdentifier(c.expression) && answers.has(c.expression.text)) return 'answers';
    return null;
  };

  const scanBody = (fn: Fn, starter: string) => {
    const isAsync = Boolean(fn.modifiers?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword));
    /* `router.refresh()` · `router.push(…)` return nothing — the one call a sync body returns that is known void. */
    const knownVoid = (c: ts.CallExpression) => ts.isPropertyAccessExpression(c.expression) && ts.isIdentifier(c.expression.expression) && c.expression.expression.text === 'router';
    /* `() => call()` hands React the call's promise exactly as an `await` would. */
    if (ts.isArrowFunction(fn) && !ts.isBlock(fn.body)) {
      const body = unwrap(fn.body);
      if (ts.isAwaitExpression(body)) out.push({ line: lineOf(body), starter, awaited: text(body.expression), guard: guardOf(body.expression, false) });
      else if (ts.isCallExpression(body) && !knownVoid(body)) out.push({ line: lineOf(body), starter, awaited: text(body), guard: guardOf(body, false) });
      return;
    }
    const visit = (n: ts.Node, inTry: boolean) => {
      if (n !== fn && isFn(n)) return;
      if (ts.isTryStatement(n)) {
        visit(n.tryBlock, inTry || catches(n));
        if (n.catchClause) visit(n.catchClause, inTry);
        if (n.finallyBlock) visit(n.finallyBlock, inTry);
        return;
      }
      if (ts.isAwaitExpression(n)) out.push({ line: lineOf(n), starter, awaited: text(n.expression), guard: guardOf(n.expression, inTry) });
      /* A SYNC body that returns a call hands React that call's promise (see the header for why async is not judged). */
      else if (!isAsync && ts.isReturnStatement(n) && n.expression && ts.isCallExpression(unwrap(n.expression))) {
        const e = unwrap(n.expression) as ts.CallExpression;
        if (!knownVoid(e)) out.push({ line: lineOf(n), starter, awaited: text(e), guard: guardOf(e, false) });
      }
      ts.forEachChild(n, (c) => visit(c, inTry));
    };
    if (fn.body) visit(fn.body, false);
  };

  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || !starters.has(n.expression.text)) return;
    const arg = n.arguments[0];
    if (!arg) return;
    const a = unwrap(arg);
    if (ts.isArrowFunction(a) || ts.isFunctionExpression(a)) scanBody(a, n.expression.text);
    else if (ts.isIdentifier(a)) {
      const fn = fns.get(a.text);
      /* A name we cannot open (a prop, an import) is reported as it stands — unguarded. */
      if (fn) scanBody(fn, n.expression.text);
      else out.push({ line: lineOf(n), starter: n.expression.text, awaited: `${a.text} (a function this file does not define)`, guard: null });
    }
  });
  return out;
}

export type SaveCall = {
  line: number;
  name: string;
  /** The function the call is written in, by name (or `(inline)`). */
  owner: string;
  /** `try` · `chain` · `answers` — or null: the promise leaves this function un-caught, so its CALLER must catch. */
  guard: AwaitGuard | null;
};

/**
 * Every call to one of `names` (the Maker's save doors — they reject when the request never answers), and whether
 * the rejection is taken where the call is written. A call inside a function passed to `.then(…)` is judged by the
 * chain it feeds (`queue.then(() => makerSave(…)).catch(…)`).
 */
export function scanSaveCalls(file: string, src: string, names: ReadonlySet<string>, opts: { answers?: ReadonlySet<string> } = {}): SaveCall[] {
  if (![...names].some((n) => src.includes(`${n}(`))) return [];
  const sf = parseSource(file, src);
  const fns = namedFunctions(sf);
  const answers = new Set<string>(opts.answers ?? []);
  for (const [name, fn] of fns) if (neverRejects(fn)) answers.add(name);
  const out: SaveCall[] = [];

  /** Follow the promise `start` produces, outwards, until something takes its rejection or it leaves the function. */
  const judge = (start: ts.Node): AwaitGuard | null => {
    let node: ts.Node = start;
    let awaited = false;
    for (;;) {
      const p = node.parent;
      if (!p) return null;
      if (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p) || ts.isAwaitExpression(p) || (ts.isConditionalExpression(p) && p.condition !== node)) {
        if (ts.isAwaitExpression(p)) awaited = true;
        node = p;
        continue;
      }
      /* `.catch(…)` · `.then(a, b)` take it; `.then(a)` · `.finally(…)` pass it on to the call they make. */
      if (ts.isPropertyAccessExpression(p) && p.expression === node && ts.isCallExpression(p.parent) && p.parent.expression === p) {
        const m = p.name.text;
        if ((m === 'catch' && p.parent.arguments.length >= 1) || (m === 'then' && p.parent.arguments.length >= 2)) return 'chain';
        node = p.parent;
        awaited = false;
        continue;
      }
      /* Handed to a function that never rejects (`hubDraftAnswer`, a local try/catch helper). */
      if (ts.isCallExpression(p) && p.expression !== node && ts.isIdentifier(p.expression) && answers.has(p.expression.text)) return 'answers';
      /* Inside a try whose catch does not rethrow — but only if it is AWAITED there (a bare `return p` escapes it). */
      for (let up: ts.Node | undefined = node, child: ts.Node = node; up; child = up, up = up.parent) {
        if (isFn(up)) break;
        if (ts.isTryStatement(up) && up.tryBlock === child && catches(up) && awaited) return 'try';
      }
      /* It leaves the function it is written in. If that function is itself an argument — to `.then(…)`, to an
         answering wrapper, to another save door — the promise becomes that call's, and the walk goes on from it. */
      let fn: ts.Node | undefined = node.parent;
      while (fn && !isFn(fn)) fn = fn.parent;
      if (!fn) return null;
      const host = fn.parent;
      if (host && ts.isCallExpression(host) && host.arguments.includes(fn as ts.Expression)) {
        const callee = host.expression;
        if (ts.isIdentifier(callee) && answers.has(callee.text)) return 'answers';
        const passes = (ts.isPropertyAccessExpression(callee) && (callee.name.text === 'then' || callee.name.text === 'finally')) || (ts.isIdentifier(callee) && names.has(callee.text));
        if (passes) {
          node = host;
          awaited = false;
          continue;
        }
      }
      return null;
    }
  };

  const ownerOf = (n: ts.Node): string => {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
      if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
      if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent) && ts.isIdentifier(p.parent.name)) return p.parent.name.text;
    }
    return '(inline)';
  };

  walk(sf, (n) => {
    if (!ts.isCallExpression(n) || !ts.isIdentifier(n.expression) || !names.has(n.expression.text)) return;
    /* The declaration's own recursion aside, a save door called INSIDE another's `send` is judged with the outer one. */
    let inner = false;
    for (let p: ts.Node | undefined = n.parent; p && !inner; p = p.parent) {
      if (ts.isCallExpression(p) && ts.isIdentifier(p.expression) && names.has(p.expression.text) && p !== n) inner = true;
    }
    if (inner) return;
    out.push({ line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, name: n.expression.text, owner: ownerOf(n), guard: judge(n) });
  });
  return out;
}
