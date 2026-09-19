import ts from 'typescript';

/**
 * Finds a Supabase call whose `error` nobody reads (LAU-31).
 *
 * 🔑 SUPABASE DOES NOT THROW. A PostgREST call RESOLVES with `{ data, error }`
 * — a refused RLS check, a phantom column, a CHECK violation all come back as a
 * polite value. So a call whose `error` is never read fails in silence, and a
 * `try/catch` around it is dead code that LOOKS like handling. That is exactly
 * how LAU-30 shipped: `concierge/actions.ts` wrapped the abuse-flag insert in a
 * try/catch, logged "insert failed" from the catch, and the catch could never
 * run — a refused insert left no flag and no log line.
 *
 * This module is the DECISION, kept pure (no `server-only`, no fs) so its test
 * can RUN it over fixtures instead of grepping for it
 * ([[two-ways-a-guard-passes-without-proving-anything]]). The repo-wide sweep
 * and its baseline live in `a-database-error-is-never-ignored.test.ts`.
 *
 * WHAT IS FLAGGED — each is a result the code provably never looks at:
 *   - `discarded`         `await sb.from('t').insert(…)` as a bare statement
 *                         (or `void`-ed): the whole result, error included, is
 *                         thrown away.
 *   - `discarded-in-try`  the same, inside a `try` — the LAU-30 shape, named
 *                         separately because the catch reads as handling.
 *   - `never-awaited`     a builder as a bare statement with no `await`. A
 *                         PostgREST builder is a lazy thenable: this one never
 *                         even SENDS its request.
 *   - `write-error-dropped`  a WRITE (insert/update/upsert/delete) whose result
 *                         is kept but whose `error` is not destructured
 *                         (`const { data } = await sb.from('t').update(…)`).
 *   - `error-unused`      `error` is destructured and then never referenced.
 *
 * WHAT IS NOT FLAGGED, deliberately:
 *   - a READ that keeps only `data`. In an action, "no row" usually DENIES, and
 *     failing closed is correct; on a page it is the reads-are-honest disease,
 *     which has its own guards (`guests-read-is-honest.test.ts`,
 *     `vendor-dashboard/reads-are-honest.test.ts`). Flagging every read would
 *     bury the writes this exists for.
 *   - a result that ESCAPES — returned, passed as an argument, put in
 *     `Promise.all`, chained with `.then`. Whoever receives it may read the
 *     error; following it is beyond a syntactic scan. This is a known blind
 *     spot, not a clean bill.
 *   - a chain ending `.throwOnError()`, which really does throw.
 *   - Storage (`sb.storage.from(bucket)`), which is a different client.
 *
 *   - `error-dropped-silently`  (ONLY with `silentDrops: true` — the both-ends
 *                         guard, lib/ugat/both-ends.ts, S26) the error IS
 *                         read, but only as a CONDITION, and the branch that
 *                         condition selects records nothing: no call (log,
 *                         capture, message), no throw, no reference to the
 *                         reason. A return of a DISTINCT failure state
 *                         (`return unreadable`, `{ ok: false, reason }`) IS a
 *                         record — the caller can tell it from emptiness.
 *                         `if (error) return null;` — the shape that
 *                         let a booking fee skip with its reason discarded
 *                         (#5615). Off by default so this guard's own sweep
 *                         and baseline are unchanged; the both-ends sweep
 *                         carries its own baseline for it.
 *
 * ESCAPE HATCH: a comment on the line directly above the statement,
 *   // supabase-error-ignored: <why this failure is genuinely harmless>
 * with a reason of at least 12 characters. It is for a best-effort write whose
 * failure truly changes nothing — say so where the next reader will see it.
 */

export type UnreadErrorKind =
  | 'discarded'
  | 'discarded-in-try'
  | 'never-awaited'
  | 'write-error-dropped'
  | 'error-unused'
  | 'error-dropped-silently';

export type ScanOptions = {
  /** Also report `error-dropped-silently` (see the docblock). Default false. */
  silentDrops?: boolean;
};

export type UnreadErrorFinding = {
  kind: UnreadErrorKind;
  /** `from:<table>.<op>` or `rpc:<fn>` — the baseline key, never a line number. */
  target: string;
  /** 1-indexed, for the failure message only. Not part of any baseline key. */
  line: number;
};

const WRITE_OPS = new Set(['insert', 'update', 'upsert', 'delete']);
const POSTGREST_OPS = new Set(['select', ...WRITE_OPS]);
/** Receivers whose `.from(…)` is not Supabase. */
const NOT_SUPABASE = new Set(['Array', 'Buffer', 'Uint8Array', 'Object', 'Promise', 'Readable', 'Set', 'Map', 'Blob']);
export const IGNORE_MARKER = /\/\/\s*supabase-error-ignored:\s*(.*)$/;
const MIN_REASON = 12;

type Chain = { target: string; op: string | null; top: ts.Expression; throws: boolean; escapes: boolean };

function argName(arg: ts.Expression | undefined): string | null {
  if (!arg) return null;
  if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
  if (ts.isIdentifier(arg)) return `<${arg.text}>`;
  if (ts.isPropertyAccessExpression(arg)) return `<${arg.getText()}>`;
  return null;
}

/**
 * Given a `.from(…)` / `.rpc(…)` call, walk UP the method chain to its top and
 * describe it. Returns null when this is not a Supabase data call.
 */
function describeChain(call: ts.CallExpression): Chain | null {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return null;
  const method = callee.name.text;
  if (method !== 'from' && method !== 'rpc') return null;
  const recv = callee.expression;
  if (ts.isIdentifier(recv) && NOT_SUPABASE.has(recv.text)) return null;
  // Storage is a different client with a different contract.
  if (ts.isPropertyAccessExpression(recv) && recv.name.text === 'storage') return null;
  if (ts.isCallExpression(recv) && ts.isPropertyAccessExpression(recv.expression) && recv.expression.name.text === 'storage') {
    return null;
  }

  const name = argName(call.arguments[0]);
  if (name === null) return null;
  let top: ts.Expression = call;
  let op: string | null = null;
  let throws = false;
  let escapes = false;
  for (;;) {
    const p = top.parent;
    if (p && ts.isPropertyAccessExpression(p) && p.expression === top && p.parent && ts.isCallExpression(p.parent) && p.parent.expression === p) {
      const m = p.name.text;
      if (op === null && POSTGREST_OPS.has(m)) op = m;
      if (m === 'throwOnError') throws = true;
      if (m === 'then' || m === 'catch' || m === 'finally') escapes = true;
      top = p.parent;
      continue;
    }
    break;
  }
  if (method === 'from' && op === null) return null; // not a PostgREST chain
  const target = method === 'rpc' ? `rpc:${name}` : `from:${name}.${op}`;
  return { target, op: method === 'rpc' ? 'rpc' : op, top, throws, escapes };
}

function stripWrappers(node: ts.Node): ts.Node {
  let n = node;
  while (n.parent && (ts.isParenthesizedExpression(n.parent) || ts.isAsExpression(n.parent) || ts.isNonNullExpression(n.parent) || ts.isSatisfiesExpression(n.parent) || ts.isTypeAssertionExpression(n.parent))) {
    n = n.parent;
  }
  return n;
}

function insideTry(node: ts.Node): boolean {
  for (let n: ts.Node | undefined = node; n; n = n.parent) {
    if (ts.isFunctionLike(n)) return false;
    if (n.parent && ts.isTryStatement(n.parent) && n.parent.tryBlock === n) return true;
  }
  return false;
}

/** Every identifier named `name` inside `scope` that starts after `after`. */
function referencesAfter(scope: ts.Node, name: string, after: number): ts.Identifier[] {
  const out: ts.Identifier[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isIdentifier(n) && n.text === name && n.getStart() >= after) {
      // `{ error: x }` as an object-literal KEY is not a read of `error`.
      const p = n.parent;
      const isKey = (ts.isPropertyAssignment(p) && p.name === n) || (ts.isPropertyAccessExpression(p) && p.name === n);
      if (!isKey) out.push(n);
    }
    ts.forEachChild(n, visit);
  };
  visit(scope);
  return out;
}

function enclosingScope(node: ts.Node): ts.Node {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isBlock(n) || ts.isSourceFile(n) || ts.isCaseClause(n) || ts.isDefaultClause(n) || ts.isModuleBlock(n)) return n;
  }
  return node.getSourceFile();
}

function enclosingFunction(node: ts.Node): ts.Node {
  for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
    if (ts.isFunctionLike(n) || ts.isSourceFile(n)) return n;
  }
  return node.getSourceFile();
}

function statementOf(node: ts.Node): ts.Node {
  let n = node;
  while (n.parent && !ts.isBlock(n.parent) && !ts.isSourceFile(n.parent) && !ts.isCaseClause(n.parent) && !ts.isDefaultClause(n.parent)) {
    n = n.parent;
  }
  return n;
}

/**
 * Does this branch RECORD the failure — a call (log, capture, a message to the
 * user), a throw, or any further reference to the error value? A branch that
 * does none of these is where a reason goes to die.
 */
const FAILURE_SHAPED = /unreadable|unavailable|refused|denied|failed|failure|error|unknown/i;

/**
 * A returned value that is itself a DISTINCT failure state — `return unreadable`,
 * `return 'refused'`, `return { ok: false, reason }` — is a record: the caller can
 * tell it from emptiness, which is the whole point (the reads-are-honest pattern
 * this repo built deliberately). `return null` / `[]` / `{ status: 'skipped' }`
 * are not: they render identically to "nothing there".
 */
function returnsFailureShape(r: ts.ReturnStatement): boolean {
  const e = r.expression;
  if (!e) return false;
  if (ts.isIdentifier(e) || ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return FAILURE_SHAPED.test(e.text);
  if (ts.isPropertyAccessExpression(e)) return FAILURE_SHAPED.test(e.getText());
  if (ts.isObjectLiteralExpression(e)) {
    // `{ error }` / `{ reason }` carry the cause; `{ status: 'unreadable' }` names a
    // distinct failure state. `{ ok: false }` / `{ status: 'skipped' }` say neither.
    return e.properties.some((p) => {
      const name = p.name && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) ? p.name.text : '';
      if (/^(error|message|reason|cause|failure)$/i.test(name)) return true;
      const v = ts.isPropertyAssignment(p) ? p.initializer : null;
      return !!v && (ts.isStringLiteral(v) || ts.isNoSubstitutionTemplateLiteral(v) || ts.isIdentifier(v)) && FAILURE_SHAPED.test(v.text);
    });
  }
  return false;
}

function branchRecords(branch: readonly ts.Node[], errName: string): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    if (ts.isCallExpression(n) || ts.isNewExpression(n) || ts.isThrowStatement(n) || ts.isAwaitExpression(n)) { found = true; return; }
    if (ts.isIdentifier(n) && n.text === errName) { found = true; return; }
    if (ts.isReturnStatement(n) && returnsFailureShape(n)) { found = true; return; }
    ts.forEachChild(n, visit);
  };
  for (const b of branch) visit(b);
  return found;
}

/** The statements after `stmt` in its own block — where a negated `if (!error)` with no else falls through to. */
function fallThrough(stmt: ts.Statement): ts.Node[] {
  const p = stmt.parent;
  if (!p || !(ts.isBlock(p) || ts.isSourceFile(p))) return [];
  const list = p.statements;
  const ix = list.indexOf(stmt);
  return ix < 0 ? [] : list.slice(ix + 1);
}

/**
 * Is this reference of the error used ONLY to pick a branch that records
 * nothing? Climbs through `!`, parentheses and `&&`/`||`/`??` to the nearest
 * `if` or ternary; any other use (returned, passed, `.message`, assigned) is a
 * real read and answers false.
 */
function dropsSilently(ref: ts.Node, errName: string): boolean {
  let n: ts.Node = ref;
  let negated = false;
  for (;;) {
    const p: ts.Node | undefined = n.parent;
    if (!p) return false;
    if (ts.isParenthesizedExpression(p)) { n = p; continue; }
    if (ts.isPrefixUnaryExpression(p) && p.operator === ts.SyntaxKind.ExclamationToken) { negated = !negated; n = p; continue; }
    if (ts.isBinaryExpression(p)) {
      const k = p.operatorToken.kind;
      if (k === ts.SyntaxKind.AmpersandAmpersandToken || k === ts.SyntaxKind.BarBarToken || k === ts.SyntaxKind.QuestionQuestionToken) { n = p; continue; }
      return false;
    }
    if (ts.isIfStatement(p) && p.expression === n) {
      const branch: ts.Node[] = negated ? (p.elseStatement ? [p.elseStatement] : fallThrough(p)) : [p.thenStatement];
      return !branchRecords(branch, errName);
    }
    if (ts.isConditionalExpression(p) && p.condition === n) {
      return !branchRecords([negated ? p.whenFalse : p.whenTrue], errName);
    }
    return false;
  }
}

/** What happens to the awaited result — the decision proper. */
function classify(chain: Chain, opts: ScanOptions = {}): UnreadErrorKind | null {
  if (chain.throws || chain.escapes) return null;
  const isWrite = chain.op !== null && WRITE_OPS.has(chain.op);
  const outer = stripWrappers(chain.top);
  const parent = outer.parent;

  if (!parent) return null;
  if (!ts.isAwaitExpression(parent)) {
    // Un-awaited builder as a bare statement: the request is never sent.
    if (ts.isExpressionStatement(parent)) return 'never-awaited';
    return null; // returned, passed along, collected — it escapes.
  }
  const settled = stripWrappers(parent);
  const use = settled.parent;
  if (!use) return null;

  if (ts.isExpressionStatement(use) || ts.isVoidExpression(use)) {
    return insideTry(use) ? 'discarded-in-try' : 'discarded';
  }

  let binding: ts.BindingName | ts.Expression | null = null;
  if (ts.isVariableDeclaration(use) && use.initializer === settled) binding = use.name;
  else if (ts.isBinaryExpression(use) && use.operatorToken.kind === ts.SyntaxKind.EqualsToken && use.right === settled) binding = use.left;
  if (!binding) return null; // escapes: returned, argument, property, ternary …

  // A `const` lives in its block. A re-ASSIGNMENT (`({ data, error } = …)`)
  // writes a variable declared further out, whose reads may sit after the
  // enclosing `if` — so widen to the whole function.
  const scope = ts.isVariableDeclaration(use) ? enclosingScope(use) : enclosingFunction(use);
  const after = use.getEnd();

  // `const { data, error } = …` / `({ error } = …)`
  const props: { key: string; local: string | null }[] = [];
  let rest = false;
  if (ts.isObjectBindingPattern(binding)) {
    for (const el of binding.elements) {
      if (el.dotDotDotToken) { rest = true; continue; }
      const key = el.propertyName ? el.propertyName.getText() : el.name.getText();
      props.push({ key, local: ts.isIdentifier(el.name) ? el.name.text : null });
    }
  } else if (ts.isObjectLiteralExpression(binding)) {
    for (const p of binding.properties) {
      if (ts.isSpreadAssignment(p)) { rest = true; continue; }
      if (ts.isShorthandPropertyAssignment(p)) props.push({ key: p.name.text, local: p.name.text });
      else if (ts.isPropertyAssignment(p)) props.push({ key: p.name.getText(), local: ts.isIdentifier(p.initializer) ? p.initializer.text : null });
    }
  } else if (ts.isIdentifier(binding)) {
    // `const res = await …` — read if ANY use is not `.data` / `.count`.
    const uses = referencesAfter(scope, binding.text, after);
    const onlyData = uses.every((u) => ts.isPropertyAccessExpression(u.parent) && u.parent.expression === u && (u.parent.name.text === 'data' || u.parent.name.text === 'count'));
    if (!onlyData) {
      if (!opts.silentDrops) return null;
      // Every non-data use is `res.error` (plain or `?.`), and each such read only picks a silent branch.
      const errReads = uses.filter((u) => ts.isPropertyAccessExpression(u.parent) && u.parent.expression === u && u.parent.name.text === 'error');
      const other = uses.filter((u) => !errReads.includes(u) && !(ts.isPropertyAccessExpression(u.parent) && u.parent.expression === u && (u.parent.name.text === 'data' || u.parent.name.text === 'count')));
      if (errReads.length > 0 && other.length === 0 && errReads.every((u) => dropsSilently(u.parent, binding.text))) return 'error-dropped-silently';
      return null;
    }
    if (uses.length === 0) return 'discarded';
    return isWrite ? 'write-error-dropped' : null;
  } else {
    return null; // array pattern etc. — not a shape Supabase results take
  }

  if (rest) return null;
  const err = props.find((p) => p.key === 'error');
  if (!err) return isWrite ? 'write-error-dropped' : null;
  if (err.local === null) return null; // nested pattern — treat as read
  const refs = referencesAfter(scope, err.local, after);
  if (refs.length === 0) return 'error-unused';
  if (opts.silentDrops && refs.every((r) => dropsSilently(r, err.local as string))) return 'error-dropped-silently';
  return null;
}

function isExempt(sf: ts.SourceFile, node: ts.Node, lines: string[]): boolean {
  const stmt = statementOf(node);
  const line = sf.getLineAndCharacterOfPosition(stmt.getStart()).line; // 0-indexed
  for (let i = line - 1; i >= 0 && i >= line - 3; i--) {
    const m = lines[i]?.match(IGNORE_MARKER);
    if (m) return (m[1] ?? '').trim().length >= MIN_REASON;
    if (!/^\s*\/\//.test(lines[i] ?? '')) break;
  }
  return false;
}

/** Findings plus how many Supabase data calls were recognised at all — the
 *  second number is the sweep's floor, so a parser that silently stops seeing
 *  calls cannot read as "no findings". */
export function scanSourceDetailed(src: string, fileName = 'file.ts', opts: ScanOptions = {}): { calls: number; findings: UnreadErrorFinding[] } {
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, fileName.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lines = src.split('\n');
  const out: UnreadErrorFinding[] = [];
  let calls = 0;
  const visit = (n: ts.Node) => {
    if (ts.isCallExpression(n)) {
      const chain = describeChain(n);
      if (chain) {
        calls++;
        const kind = classify(chain, opts);
        if (kind && !isExempt(sf, chain.top, lines)) {
          out.push({ kind, target: chain.target, line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1 });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return { calls, findings: out };
}

export function scanSource(src: string, fileName = 'file.ts', opts: ScanOptions = {}): UnreadErrorFinding[] {
  return scanSourceDetailed(src, fileName, opts).findings;
}
