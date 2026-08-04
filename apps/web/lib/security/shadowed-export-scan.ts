/**
 * Static scanner for a LOCAL declaration that shadows a helper the same file
 * already imports the module of.
 *
 * WHY THIS EXISTS
 * ---------------
 * On 2026-07-27 the booking receipt was found claiming a couple had bought
 * add-ons they were never charged for. The cause was not a wrong filter — it
 * was a SECOND definition of the same rule:
 *
 *     import { formatCentavosPhp, VENDOR_PACKAGE_SELECT }  from '@/lib/vendor-packages';
 *     …
 *     const keptItems = pkg.items.filter((i) => !removedIds.has(i.item_id));
 *
 * `keptItems` is an EXPORT of `@/lib/vendor-packages`. The page had that module
 * open — it imported three other things from it on the line above — and wrote
 * its own `keptItems` anyway. The exported one also drops add-ons, because
 * there is no purchase path for them; the local one did not. The receipt and
 * the lock path then disagreed about what a couple had bought, silently, for
 * as long as the shadow stood. TypeScript is happy: an inner-scope binding may
 * legally shadow an outer one, and a module-scope const may legally share a
 * name with an export the file never imported.
 *
 * THE QUALIFIER IS THE WHOLE DESIGN
 * ---------------------------------
 * "Same name as some export somewhere in the repo" is noise — 4-digit noise in
 * this codebase, and a lint that cries wolf gets switched off, which is worse
 * than no lint. The signal is "…AND THIS FILE ALREADY IMPORTS FROM THE MODULE
 * THAT OWNS THE NAME." That narrows it to authors who had the real one in
 * reach and shadowed it regardless — which is exactly how `keptItems` drifted.
 * The two shapes it admits:
 *
 *   IMPORTED   the file imports the name itself, then re-declares it in an
 *              inner scope. Unambiguous: the shadow is the bug.
 *   SIBLING    the file imports OTHER names from the owning module and
 *              declares this one locally. The `keptItems` shape exactly.
 *
 * HONEST LIMITS — read these before trusting a green run
 * ------------------------------------------------------
 *  1. REGEX, NOT A TYPE CHECKER. Declarations, imports and exports are found by
 *     pattern over comment-stripped source. Destructuring (`const { a } = …`),
 *     `export * from`, `export default`, and computed re-exports are NOT seen.
 *     Under-reporting is the deliberate direction.
 *  2. SCOPE IS NOT MODELLED. A local named `x` is reported whether it sits at
 *     module scope or eight blocks deep. That is on purpose: both drifted the
 *     same way, and modelling scope needs a real parser.
 *  3. TYPE-ONLY IS EXCLUDED ON BOTH SIDES. `import type` / inline `type`
 *     specifiers do not put a value in reach, and `export type` / `interface`
 *     are not values that can be shadowed by a `const`. A type and a value may
 *     legitimately share a name (`export type Foo` + `const Foo`).
 *  4. TESTS ARE OUT OF SCOPE. A local stub named after the helper it replaces
 *     is the normal way to write a test double, and it is loud when wrong —
 *     the opposite of the production failure this guard exists for. Excluded:
 *     `*.test.ts(x)`, `*.spec.ts(x)`, and anything under a `__tests__/` or
 *     `tests/` directory.
 *  5. BARREL RE-EXPORTS ARE INVISIBLE. `export * from './x'` is not followed,
 *     so a name reached through a barrel is not attributed to it.
 *
 * Green here means "no file re-declares a name owned by a module it already
 * imports". It does not mean the repo has one definition of every rule.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './source-text';

const HERE = path.dirname(fileURLToPath(import.meta.url)); // apps/web/lib/security
/** apps/web/lib/security → apps/web is two levels up. */
export const APP_ROOT = path.resolve(HERE, '..', '..');

const SKIP_DIRS = new Set(['.next', 'node_modules', '.git', 'dist', 'coverage']);

/**
 * Directory names whose whole subtree is out of scope — see limit 4. `tests/`
 * catches apps/web/tests (db + e2e harnesses, full of deliberate local stubs).
 */
const SKIP_TREE_DIRS = new Set(['__tests__', '__mocks__', 'tests']);

/** Test files are out of scope on both sides of the comparison — limit 4. */
export function isTestFile(name: string): boolean {
  return /\.(test|spec)\.tsx?$/.test(name);
}

/** How a shadowed name was in reach at the moment it was re-declared. */
export type ShadowKind = 'imported' | 'sibling';

export type ShadowedExport = {
  /** repo-relative-to-apps/web path of the file holding the local declaration */
  file: string;
  line: number;
  /** the shadowed name */
  name: string;
  /** apps/web-relative path of the module that exports `name` */
  owner: string;
  kind: ShadowKind;
  /** what the declaration looked like — `const` / `function` / `class` / … */
  form: string;
  /** `file\tname\towner` — the stable key a baseline entry pins. */
  key: string;
};

/* ── source text ────────────────────────────────────────────────────────────*/

/**
 * Comments are blanked (via the shared `./source-text` stripper) before any
 * pattern runs, so a declaration quoted in a docblock is not mistaken for a
 * real one. Line numbers survive — the stripper preserves positions.
 */

/* ── exports ────────────────────────────────────────────────────────────────*/

const EXPORT_DECL_RE =
  /(?:^|\n)\s*export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(const\s+enum|const|let|var|function\*?|class|enum)\s+([A-Za-z_$][\w$]*)/g;
const EXPORT_BRACE_RE = /(?:^|\n)\s*export\s*\{([^}]*)\}/g;

/**
 * Every VALUE this module exports by name. Types are excluded — see limit 3.
 *
 * `export { a, b as c }` contributes `a` and `c` (the names a consumer would
 * write); a specifier prefixed with `type` contributes nothing.
 */
export function extractExportedValueNames(source: string): Set<string> {
  const src = stripComments(source);
  const names = new Set<string>();

  const declRe = new RegExp(EXPORT_DECL_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = declRe.exec(src))) {
    if (m[2]) names.add(m[2]);
  }

  const braceRe = new RegExp(EXPORT_BRACE_RE.source, 'g');
  while ((m = braceRe.exec(src))) {
    for (const raw of (m[1] ?? '').split(',')) {
      const spec = raw.trim();
      if (!spec || /^type\s/.test(spec)) continue;
      const parts = spec.split(/\s+as\s+/);
      const exported = (parts.length > 1 ? parts[1] : parts[0]) ?? '';
      const clean = exported.trim();
      if (/^[A-Za-z_$][\w$]*$/.test(clean) && clean !== 'default') names.add(clean);
    }
  }

  return names;
}

/* ── imports ────────────────────────────────────────────────────────────────*/

/** `import <clause> from '<spec>'` — the clause may span lines. */
const IMPORT_RE = /(?:^|\n)\s*import\s+([\s\S]*?)\s+from\s*['"]([^'"]+)['"]/g;

export type ImportRecord = {
  /** the raw module specifier as written */
  spec: string;
  /** value names this file pulled in from it (aliases resolved to the LOCAL name) */
  names: Set<string>;
};

/**
 * Every module this file imports VALUES from, and which values.
 * `import type { … }` contributes nothing — it does not put a value in reach.
 */
export function extractValueImports(source: string): ImportRecord[] {
  const src = stripComments(source);
  const out: ImportRecord[] = [];
  const re = new RegExp(IMPORT_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const clause = (m[1] ?? '').trim();
    const spec = m[2] ?? '';
    if (!spec) continue;
    if (/^type\b/.test(clause)) continue; // import type { … } / import type X

    const names = new Set<string>();
    const brace = /\{([\s\S]*)\}/.exec(clause);
    if (brace) {
      for (const raw of (brace[1] ?? '').split(',')) {
        const s = raw.trim();
        if (!s || /^type\s/.test(s)) continue;
        const parts = s.split(/\s+as\s+/);
        const local = (parts.length > 1 ? parts[1] : parts[0]) ?? '';
        const clean = local.trim();
        if (/^[A-Za-z_$][\w$]*$/.test(clean)) names.add(clean);
      }
    }
    // default and namespace bindings, i.e. everything before the brace
    const head = clause.split('{')[0] ?? '';
    for (const raw of head.split(',')) {
      const s = raw.trim().replace(/^\*\s+as\s+/, '');
      if (/^[A-Za-z_$][\w$]*$/.test(s)) names.add(s);
    }

    out.push({ spec, names });
  }
  return out;
}

/* ── local declarations ─────────────────────────────────────────────────────*/

const LOCAL_DECL_RE =
  /(?:^|[^.\w$])(const|let|var|function|class)\s+([A-Za-z_$][\w$]*)\s*(?=[=({:<]|$|\s)/g;

export type LocalDecl = { name: string; line: number; form: string };

/**
 * Every simple `const` / `let` / `var` / `function` / `class` binding, at ANY
 * nesting depth (limit 2). Destructuring patterns are not matched (limit 1).
 *
 * The `[^.\w$]` prefix stops `obj.const`-style member text and identifiers that
 * merely END in a keyword (`myconst x`) from registering.
 */
export function extractLocalDeclarations(source: string): LocalDecl[] {
  const src = stripComments(source);
  const out: LocalDecl[] = [];
  const re = new RegExp(LOCAL_DECL_RE.source, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const form = m[1];
    const name = m[2];
    if (!form || !name) continue;
    // `const` inside a type position (`readonly x: const`) cannot occur; a
    // `function` used as a type annotation cannot either. Nothing to filter.
    out.push({ name, form, line: src.slice(0, m.index).split('\n').length });
    // Allow the next match to start at this one's tail — the regex consumed a
    // leading delimiter, so overlapping declarations on one line still match.
    re.lastIndex = m.index + m[0].length - 1;
  }
  return out;
}

/* ── module resolution ──────────────────────────────────────────────────────*/

const EXTS = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

/**
 * Resolve an import specifier to a file inside apps/web, or null.
 * `@/x` is the repo's only path alias (apps/web/tsconfig.json → `"@/*": ["./*"]`).
 * Bare specifiers are third-party and out of scope by construction.
 */
export function resolveModule(spec: string, fromFile: string, root: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(root, spec.slice(2));
  else if (spec.startsWith('./') || spec.startsWith('../'))
    base = path.resolve(path.dirname(fromFile), spec);
  else return null;

  for (const ext of EXTS) {
    const candidate = base + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/* ── the walk ───────────────────────────────────────────────────────────────*/

/** Recursively collect in-scope .ts/.tsx files under `root` — see limit 4. */
export function collectSourceFiles(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name) || SKIP_TREE_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
      } else if (
        (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
        !isTestFile(entry.name)
      ) {
        out.push(path.join(dir, entry.name));
      }
    }
  };
  walk(root);
  return out;
}

export type ScanResult = {
  /** hits WITH the "file already imports from the owning module" qualifier */
  qualified: ShadowedExport[];
  /**
   * hits WITHOUT it — every local name that collides with ANY value exported
   * anywhere in apps/web. Reported only so the qualifier's worth can be
   * measured; never enforced.
   */
  unqualifiedCount: number;
  filesScanned: number;
};

/**
 * Scan `root` for local declarations that shadow an export of a module the same
 * file already imports from.
 */
export function scanShadowedExports(root: string = APP_ROOT): ScanResult {
  const files = collectSourceFiles(root);

  // Pass 1 — what does every in-scope module export by value?
  const exportsByFile = new Map<string, Set<string>>();
  const sources = new Map<string, string>();
  for (const file of files) {
    let src: string;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    sources.set(file, src);
    exportsByFile.set(file, extractExportedValueNames(src));
  }

  /** Every value name exported anywhere — the UNQUALIFIED comparison set. */
  const allExported = new Set<string>();
  for (const names of exportsByFile.values()) for (const n of names) allExported.add(n);

  // Pass 2 — per file, compare its locals against the modules it imports.
  const qualified: ShadowedExport[] = [];
  let unqualifiedCount = 0;

  for (const file of files) {
    const src = sources.get(file);
    if (!src) continue;
    const rel = path.relative(root, file);

    const locals = extractLocalDeclarations(src);
    if (locals.length === 0) continue;

    for (const local of locals) if (allExported.has(local.name)) unqualifiedCount++;

    const imports = extractValueImports(src);
    if (imports.length === 0) continue;

    /** name → { owner, kind }, first owner wins (a name is rarely dual-owned) */
    const inReach = new Map<string, { owner: string; kind: ShadowKind }>();
    for (const imp of imports) {
      const target = resolveModule(imp.spec, file, root);
      if (!target || target === file) continue;
      const owned = exportsByFile.get(target);
      if (!owned) continue;
      const owner = path.relative(root, target);
      for (const name of owned) {
        if (inReach.has(name)) continue;
        inReach.set(name, { owner, kind: imp.names.has(name) ? 'imported' : 'sibling' });
      }
    }

    const ownExports = exportsByFile.get(file) ?? new Set<string>();
    const seen = new Set<string>();
    for (const local of locals) {
      const hit = inReach.get(local.name);
      if (!hit) continue;
      // A file that itself exports the name is the OWNER of a second definition,
      // not a shadow of one — that is a different (and rarer) problem, and
      // flagging it here would fight legitimate re-export-and-widen modules.
      if (ownExports.has(local.name)) continue;
      const key = `${rel}\t${local.name}\t${hit.owner}`;
      if (seen.has(key)) continue; // one fact per (file, name, owner)
      seen.add(key);
      qualified.push({
        file: rel,
        line: local.line,
        name: local.name,
        owner: hit.owner,
        kind: hit.kind,
        form: local.form,
        key,
      });
    }
  }

  qualified.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return { qualified, unqualifiedCount, filesScanned: files.length };
}
