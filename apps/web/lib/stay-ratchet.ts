/**
 * lib/stay-ratchet.ts — 📍 WHICH SERVER ACTIONS STILL RE-DRAW THE SCREEN (owner, 2026-10-26, DECISION_LOG "A SAVE
 * NEVER RESETS THE SCREEN — APP-WIDE"). The scanner behind `a-save-never-resets-the-screen.test.ts`.
 *
 * A server action that ends in `redirect(<somewhere>)` makes a plain `<form action>` NAVIGATE: the page is re-drawn
 * from the top, the open sheet shuts. This reads every `'use server'` module under `app/ lib/ components/` (TypeScript
 * AST — never a regex over prose) and lists each exported action whose body — or a same-file helper it calls — reaches
 * a `redirect(` that is not a pure sign-in / not-on-the-event guard (`/login…`, `/sign…`, bare `/dashboard`).
 *
 * Every action it lists must be ONE of:
 *   · a stay door (`lib/stay-doors.ts` → `app/_actions/save-in-place.ts`): its controls save in place;
 *   · navigation, on purpose (`STAY_NAVIGATION` in `stay-ratchet.navigation.ts`) — with the reason;
 *   · not converted YET (`a-save-never-resets-the-screen.baseline.txt`) — a list that may only SHRINK.
 *
 * Regenerate the baseline after converting (it only ever loses lines):
 *   pnpm tsx lib/stay-ratchet.ts --write
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';

export const WEB = resolve(__dirname, '..');
export const BASELINE_FILE = join(WEB, 'lib/a-save-never-resets-the-screen.baseline.txt');
const ROOTS = ['app', 'lib', 'components'];
const SKIP = /(^|\/)(node_modules|\.next)(\/|$)|\.test\.tsx?$|\.d\.ts$|^app\/dev\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const rel = relative(WEB, abs);
    if (SKIP.test(rel)) continue;
    if (statSync(abs).isDirectory()) walk(abs, out);
    else if (/\.tsx?$/.test(name)) out.push(rel);
  }
  return out;
}

export function sourceFiles(): string[] {
  return ROOTS.flatMap((r) => walk(join(WEB, r)));
}

const parse = (rel: string, text = readFileSync(join(WEB, rel), 'utf8')) =>
  ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

function isUseServer(sf: ts.SourceFile): boolean {
  const first = sf.statements[0];
  return Boolean(first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === 'use server');
}

/** A redirect whose only job is "sign in" or "you are not on this event" — not a same-screen landing. */
function guardOnly(arg: ts.Expression | undefined, sf: ts.SourceFile): boolean {
  if (!arg) return false;
  const text = arg.getText(sf).trim();
  if (/^[`'"]\/(login|sign)/.test(text)) return true;
  if (/^[`'"]\/dashboard[`'"]$/.test(text)) return true;
  /* `'/login?next=' + …` */
  if (ts.isBinaryExpression(arg) && /^[`'"]\/(login|sign)/.test(arg.left.getText(sf))) return true;
  return false;
}

/** Every exported action of a `'use server'` module that reaches a non-guard `redirect(`. */
export function redirectingActions(rel: string, text?: string): string[] {
  const sf = parse(rel, text);
  if (!isUseServer(sf)) return [];
  const bodies = new Map<string, ts.Node>();
  const exported = new Set<string>();
  for (const st of sf.statements) {
    const isExp = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (ts.isFunctionDeclaration(st) && st.name && st.body) {
      bodies.set(st.name.text, st.body);
      if (isExp(st)) exported.add(st.name.text);
    } else if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (ts.isIdentifier(d.name) && d.initializer && (ts.isArrowFunction(d.initializer) || ts.isFunctionExpression(d.initializer))) {
          bodies.set(d.name.text, d.initializer.body);
          if (isExp(st)) exported.add(d.name.text);
        }
      }
    }
  }
  /* What each function reaches directly: a landing redirect, and the same-file functions it calls. */
  const lands = new Map<string, boolean>();
  const calls = new Map<string, Set<string>>();
  for (const [name, body] of bodies) {
    let l = false;
    const c = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const callee = n.expression.text;
        if ((callee === 'redirect' || callee === 'permanentRedirect') && !guardOnly(n.arguments[0], sf)) l = true;
        else if (bodies.has(callee) && callee !== name) c.add(callee);
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    lands.set(name, l);
    calls.set(name, c);
  }
  const reaches = (name: string, seen = new Set<string>()): boolean => {
    if (lands.get(name)) return true;
    seen.add(name);
    for (const c of calls.get(name) ?? []) if (!seen.has(c) && reaches(c, seen)) return true;
    return false;
  };
  return [...exported].filter((n) => reaches(n)).sort();
}

/** `file › action` for every redirecting action in the tree. */
export function scanRedirecting(): string[] {
  return sourceFiles().flatMap((rel) => redirectingActions(rel).map((n) => `${rel} › ${n}`)).sort();
}

/** Resolve an import specifier from `fromRel` to a repo-relative source file. */
export function resolveImport(fromRel: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(WEB, dirname(fromRel), spec) : null;
  if (!base) return null;
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx']) {
    try {
      if (statSync(base + ext).isFile()) return relative(WEB, base + ext);
    } catch {
      /* next */
    }
  }
  return null;
}

/** Named imports of a file: local name → `file › exported name`. */
export function namedImports(rel: string, text?: string): Map<string, string> {
  const sf = parse(rel, text);
  const out = new Map<string, string>();
  for (const st of sf.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const bindings = st.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const file = resolveImport(rel, st.moduleSpecifier.text);
    if (!file) continue;
    for (const el of bindings.elements) out.set(el.name.text, `${file} › ${(el.propertyName ?? el.name).text}`);
  }
  return out;
}

export const DOOR_FILE = 'app/_actions/save-in-place.ts';

/** The actions the stay door runs, as `file › action`. */
export function doorActions(): Set<string> {
  const imports = namedImports(DOOR_FILE);
  return new Set([...imports.values()].filter((k) => isUseServer(parse(k.split(' › ')[0]!))));
}

export function readBaseline(): string[] {
  return readFileSync(BASELINE_FILE, 'utf8')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'));
}

export const BASELINE_HEADER = `# a-save-never-resets-the-screen.baseline.txt — server actions that still REDIRECT back to a screen (owner,
# 2026-10-26, DECISION_LOG "A SAVE NEVER RESETS THE SCREEN — APP-WIDE"). Not converted YET. This list may only SHRINK:
# convert a control to a \`StayForm\` door (lib/stay-doors.ts + app/_actions/save-in-place.ts), then regenerate with
#   pnpm tsx lib/stay-ratchet.ts --write
# Never add a line by hand — a NEW redirecting action is either a door or navigation (stay-ratchet.navigation.ts).
`;

if (require.main === module && process.argv.includes('--write')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { STAY_NAVIGATION } = require('./stay-ratchet.navigation') as typeof import('./stay-ratchet.navigation');
  const doors = doorActions();
  const rest = scanRedirecting().filter((k) => !doors.has(k) && !(k in STAY_NAVIGATION));
  const first = process.argv.includes('--init');
  const before = first ? [] : readBaseline();
  const grown = rest.filter((k) => !before.includes(k));
  if (grown.length && !first) {
    console.error(`Refusing to GROW the baseline — make each a door or navigation:\n  ${grown.join('\n  ')}`);
    process.exit(1);
  }
  writeFileSync(BASELINE_FILE, BASELINE_HEADER + rest.join('\n') + '\n');
  console.log(`baseline: ${before.length} → ${rest.length}`);
}
