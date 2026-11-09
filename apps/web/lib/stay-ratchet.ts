/**
 * lib/stay-ratchet.ts — 📍 WHICH SERVER ACTIONS STILL RE-DRAW THE SCREEN (owner, 2026-10-26, DECISION_LOG "A SAVE
 * NEVER RESETS THE SCREEN — APP-WIDE"). The scanner behind `a-save-never-resets-the-screen.test.ts` and the audit
 * `build-notes/save-in-place-audit.md`.
 *
 * A server action that ends in `redirect(<somewhere>)` makes a plain `<form action>` NAVIGATE: the page is re-drawn
 * from the top, the open sheet shuts, the scroll is lost. This reads every `'use server'` module under `app/ lib/
 * components/` (TypeScript AST — never a regex over prose) and lists each exported action whose body — or a same-file
 * helper it calls — reaches a `redirect(` that is not a pure sign-in / not-on-the-event guard (`/login…`, `/sign…`,
 * bare `/dashboard`).
 *
 * Every action it lists must be ONE of:
 *   · a stay door (`lib/stay-doors.ts` → `app/_actions/save-in-place.ts`): its controls save in place;
 *   · navigation, on purpose (`STAY_NAVIGATION` in `stay-ratchet.navigation.ts`) — with the reason;
 *   · not converted YET (`a-save-never-resets-the-screen.baseline.txt`) — a list that may only SHRINK.
 *
 * Regenerate the baseline after converting (it only ever loses lines):
 *   pnpm tsx lib/stay-ratchet.ts --write
 * Rewrite the audit (`build-notes/save-in-place-audit.md`):
 *   pnpm tsx lib/stay-ratchet.ts --audit
 */
import { readFileSync, readdirSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';

export const WEB = resolve(__dirname, '..');
export const BASELINE_FILE = join(WEB, 'lib/a-save-never-resets-the-screen.baseline.txt');
const ROOTS = ['app', 'lib', 'components'];
/* `app/admin/` is OUT of this rule for now — the owner's order puts admin screens last (2026-10-26 brief: "Admin screens
   are excluded (handled last)"). Ratcheting it here would fail every admin PR on a new redirect before that pass. */
const SKIP = /(^|\/)(node_modules|\.next)(\/|$)|\.test\.tsx?$|\.d\.ts$|^app\/dev\/|^app\/admin\//;

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

let filesCache: string[] | null = null;
export function sourceFiles(): string[] {
  return (filesCache ??= ROOTS.flatMap((r) => walk(join(WEB, r))));
}

const parsed = new Map<string, ts.SourceFile>();
const parse = (rel: string, text?: string): ts.SourceFile => {
  if (text === undefined && parsed.has(rel)) return parsed.get(rel)!;
  const sf = ts.createSourceFile(rel, text ?? readFileSync(join(WEB, rel), 'utf8'), ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  if (text === undefined) parsed.set(rel, sf);
  return sf;
};

export function isUseServer(sf: ts.SourceFile): boolean {
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

/** A redirect target as a route pattern: `${…}` → `[x]`, the query and hash dropped. `null` when it is not a literal. */
function targetPattern(arg: ts.Expression, sf: ts.SourceFile): string | null {
  const text = arg.getText(sf).trim();
  const m = /^[`'"]([^`'"]*)/.exec(text);
  if (!m) return null;
  const raw = m[1]!.replace(/\$\{[^}]*\}/g, '[x]');
  const path = raw.split(/[?#]/)[0] ?? '';
  return path.startsWith('/') ? path.replace(/\/$/, '') || '/' : null;
}

export type RedirectingAction = { name: string; targets: string[] };

/** Every exported action of a `'use server'` module that reaches a non-guard `redirect(`, with the literal targets. */
export function redirectingActionsDetailed(rel: string, text?: string): RedirectingAction[] {
  const sf = parse(rel, text);
  if (!isUseServer(sf)) return [];
  const bodies = new Map<string, ts.Node>();
  const exported = new Set<string>();
  const isExp = (n: ts.Node) => ts.canHaveModifiers(n) && (ts.getModifiers(n) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  for (const st of sf.statements) {
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
  const lands = new Map<string, string[] | null>();
  const calls = new Map<string, Set<string>>();
  for (const [name, body] of bodies) {
    let l: string[] | null = null;
    const c = new Set<string>();
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression)) {
        const callee = n.expression.text;
        if ((callee === 'redirect' || callee === 'permanentRedirect') && !guardOnly(n.arguments[0], sf)) {
          l ??= [];
          const t = n.arguments[0] ? targetPattern(n.arguments[0], sf) : null;
          l.push(t ?? '(computed)');
        } else if (bodies.has(callee) && callee !== name) c.add(callee);
      }
      ts.forEachChild(n, visit);
    };
    visit(body);
    lands.set(name, l);
    calls.set(name, c);
  }
  const reach = (name: string, seen = new Set<string>()): string[] | null => {
    seen.add(name);
    let out: string[] | null = lands.get(name) ? [...lands.get(name)!] : null;
    for (const c of calls.get(name) ?? []) {
      if (seen.has(c)) continue;
      const r = reach(c, seen);
      if (r) out = [...(out ?? []), ...r];
    }
    return out;
  };
  return [...exported]
    .map((n) => ({ name: n, targets: reach(n) }))
    .filter((r): r is RedirectingAction => r.targets !== null)
    .map((r) => ({ name: r.name, targets: [...new Set(r.targets)].sort() }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function redirectingActions(rel: string, text?: string): string[] {
  return redirectingActionsDetailed(rel, text).map((r) => r.name);
}

/** `file › action` for every redirecting action in the tree. */
export function scanRedirecting(): string[] {
  return sourceFiles()
    .flatMap((rel) => redirectingActions(rel).map((n) => `${rel} › ${n}`))
    .sort();
}

/** Resolve an import specifier from `fromRel` to a repo-relative source file. */
export function resolveImport(fromRel: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? join(WEB, spec.slice(2)) : spec.startsWith('.') ? resolve(WEB, dirname(fromRel), spec) : null;
  if (!base) return null;
  for (const ext of ['', '.ts', '.tsx', '/index.ts', '/index.tsx']) {
    const p = base + ext;
    if (existsSync(p) && statSync(p).isFile() && /\.tsx?$/.test(p)) return relative(WEB, p);
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
export const REGISTRY_DIR = 'app/_actions/stay-registry';

/** The registry's area files (`papic.ts`, `sponsors.ts`, …) — not its index or its `_door.ts` helpers. */
export function registryFiles(): string[] {
  return readdirSync(join(WEB, REGISTRY_DIR))
    .filter((f) => f.endsWith('.ts') && f !== 'index.ts' && !f.startsWith('_'))
    .map((f) => `${REGISTRY_DIR}/${f}`)
    .sort();
}

/** The actions the stay door runs, as `file › action` (every 'use server' import of a registry area file). */
export function doorActions(): Set<string> {
  const out = new Set<string>();
  for (const rel of registryFiles()) {
    for (const k of namedImports(rel).values()) if (isUseServer(parse(k.split(' › ')[0]!))) out.add(k);
  }
  return out;
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

/* ─────────────────────────────── the audit: which screen a press is on, and where it lands ─────────────────────── */

/** The route a source file draws on: the nearest ancestor folder holding a `page.tsx`, as a pattern (`[x]` params,
 *  route groups dropped). `null` for a file outside `app/` or with no page above it (a shared component). */
export function routeOf(rel: string): string | null {
  if (!rel.startsWith('app/')) return null;
  let dir = dirname(rel);
  while (dir.startsWith('app')) {
    if (existsSync(join(WEB, dir, 'page.tsx'))) {
      const segs = dir
        .split('/')
        .slice(1)
        .filter((s) => !/^\(.*\)$/.test(s) && !s.startsWith('_') && !s.startsWith('@'))
        .map((s) => (/^\[.*\]$/.test(s) ? '[x]' : s));
      return '/' + segs.join('/');
    }
    if (dir === 'app') break;
    dir = dirname(dir);
  }
  return null;
}

/** Who imports each action: `file › action` → the importing .tsx files. */
export function importersOf(): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const rel of sourceFiles()) {
    if (!rel.endsWith('.tsx')) continue;
    const text = readFileSync(join(WEB, rel), 'utf8');
    if (!text.includes('import')) continue;
    for (const k of namedImports(rel, text).values()) {
      const list = out.get(k) ?? [];
      list.push(rel);
      out.set(k, list);
    }
  }
  return out;
}

/** The area an action belongs to, for the audit's grouping. */
export function areaOf(rel: string): string {
  if (rel.startsWith('app/admin')) return 'admin';
  if (rel.startsWith('app/vendor-dashboard')) return 'supplier: ' + (rel.split('/')[2] ?? '').replace(/\.tsx?$/, '');
  const ev = /^app\/dashboard\/\[eventId\]\/(.+)$/.exec(rel);
  if (ev) {
    const parts = ev[1]!.split('/');
    if (parts[0] === 'studio' && parts[1]) return `event: studio/${parts[1].replace(/\.tsx?$/, '')}`;
    return parts.length > 1 ? `event: ${parts[0]}` : 'event: (event root)';
  }
  if (rel.startsWith('app/dashboard/')) return 'account: ' + (rel.split('/')[2] ?? '').replace(/^\(|\)$/g, '');
  if (rel.startsWith('app/[slug]')) return 'guest: [slug]';
  if (rel.startsWith('app/')) return 'app: ' + (rel.split('/')[1] ?? '').replace(/\.tsx?$/, '');
  return rel.split('/')[0] ?? rel;
}

const sameRoute = (target: string, route: string) => target === route || (target === '[x]' && route.startsWith('/'));

export type AuditRow = { key: string; area: string; targets: string[]; screens: string[]; same: boolean };

export function auditRows(): AuditRow[] {
  const importers = importersOf();
  const rows: AuditRow[] = [];
  for (const rel of sourceFiles()) {
    for (const a of redirectingActionsDetailed(rel)) {
      const key = `${rel} › ${a.name}`;
      const screens = [...new Set((importers.get(key) ?? []).map(routeOf).filter((r): r is string => Boolean(r)))].sort();
      const own = routeOf(rel);
      const lands = screens.length ? screens : own ? [own] : [];
      const same = a.targets.some((t) => lands.some((s) => sameRoute(t, s)));
      rows.push({ key, area: areaOf(rel), targets: a.targets, screens: lands, same });
    }
  }
  return rows.sort((x, y) => x.key.localeCompare(y.key));
}

if (require.main === module) void main();

async function main() {
  const { STAY_NAVIGATION } = await import('./stay-ratchet.navigation');
  const doors = doorActions();
  if (process.argv.includes('--write')) {
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
  if (process.argv.includes('--json')) {
    const rows = auditRows().map((r) => ({ ...r, door: doors.has(r.key), nav: STAY_NAVIGATION[r.key] ?? null }));
    console.log(JSON.stringify(rows, null, 1));
  }
}
