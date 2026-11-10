/**
 * taxonomy-literal-scan.ts — find a HARD-CODED COPY of the service taxonomy in
 * product code. The scanner behind `lib/no-taxonomy-literals.test.ts` and
 * `scripts/gen-taxonomy-literals-baseline.ts`.
 *
 * Owner, 26 Oct: Admin › Categories is "the foundation of all suppliers".
 * Owner, 9 Nov: "make sure the services are not hard coded and other codes that
 * should live based on the taxonomy." So a group, category, service or part an
 * admin renames, moves or adds must reach every screen with no deploy — which
 * is only true while no screen keeps its own copy of the list.
 *
 * ── WHAT COUNTS AS A COPY (three kinds) ─────────────────────────────────────
 *   list     an array, object or union type that names THREE OR MORE taxonomy
 *            slugs (as string values or as object keys) — a second taxonomy.
 *   compare  `=== 'slug'`, `!== 'slug'`, `case 'slug':`, `.includes('slug')`,
 *            `.has('slug')` — a behaviour switched on one category's name.
 *   import   a VALUE import of the seed constants (`TAXONOMY_MAP`,
 *            `TILE_PARENT`, `WEDDING_TILE_LABEL`, `WEDDING_FOLDER_*`, …) from
 *            `lib/taxonomy` — the code copy read where the live one belongs
 *            (`getTaxonomy()` in `lib/taxonomy-db.ts`). Type imports are fine.
 *
 * 🔑 It parses with the TypeScript compiler, so a comment or a docblock that
 * MENTIONS a slug can never trip it, and a string inside a template or a regex
 * is never mistaken for one.
 *
 * The vocabulary is the seed itself (`fallbackSnapshot()` — every group id,
 * category id and service key — plus the `vendor_category` enum), so a slug the
 * seed learns tomorrow is covered tomorrow without editing this file.
 */
import ts from 'typescript';
import { fallbackSnapshot } from '@/lib/taxonomy-snapshot';
import { VENDOR_CATEGORIES } from '@/lib/vendors';

export type LiteralKind = 'list' | 'compare' | 'import';

export type LiteralFinding = { kind: LiteralKind; line: number; text: string };

/**
 * Slugs that ALSO name a role, a phase, a page or a plain English word
 * (`coordinator` is a member role, `reception` a part of the day, `editorial` a
 * page phase, `design` a stage). A comparison against one of these is far more
 * often about the other meaning, so `compare` ignores them; a `list` must still
 * hold at least two slugs outside this set before it counts.
 */
export const AMBIGUOUS_SLUGS: ReadonlySet<string> = new Set([
  'coordinator',
  'reception',
  'editorial',
  'venue',
  'design',
  'look',
  'program',
  'planning',
  'experience',
  'feast',
  'documentary',
  'farewell',
  'specialty',
  'misc',
  'security',
  'transport',
  'transportation',
  'insurance',
  'dining',
  'prints',
  'stations',
  'outdoor',
  'printing',
  'booths',
  'rings',
]);

/** The seed constants a product file must not read for live data. */
export const SEED_SYMBOLS: ReadonlySet<string> = new Set([
  'TAXONOMY_MAP',
  'TILE_PARENT',
  'WEDDING_TILE_LABEL',
  'WEDDING_TILE_SLUG',
  'WEDDING_TILE_ORDER',
  'WEDDING_TILES_BY_PARENT',
  'WEDDING_FOLDER_LABEL',
  'WEDDING_FOLDER_SHORT_LABEL',
  'WEDDING_FOLDER_SLUG',
  'WEDDING_FOLDER_ORDER',
  'ADMIN_ONLY_TILES',
]);

let vocabCache: ReadonlySet<string> | null = null;

/** Every group id, category id and service key in the seed, plus the coarse enum. */
export function taxonomyVocabulary(): ReadonlySet<string> {
  if (vocabCache) return vocabCache;
  const s = fallbackSnapshot();
  vocabCache = new Set<string>([
    ...s.folderOrder,
    ...s.tileOrder,
    ...Object.keys(s.map),
    ...(VENDOR_CATEGORIES as readonly string[]),
  ]);
  return vocabCache;
}

/** `lib/taxonomy` by any spelling: `@/lib/taxonomy`, `./taxonomy`, `../../lib/taxonomy`. */
function isSeedModule(spec: string): boolean {
  return /(^|\/)taxonomy$/.test(spec);
}

function propName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name)) return name.text;
  return null;
}

function stringOf(node: ts.Node | undefined): string | null {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isAsExpression(node) || ts.isSatisfiesExpression(node) || ts.isParenthesizedExpression(node)) {
    return stringOf(node.expression);
  }
  return null;
}

/** Scan one file's source. `fileName` only picks TS vs TSX parsing. */
export function scanTaxonomyLiterals(fileName: string, src: string): LiteralFinding[] {
  const vocab = taxonomyVocabulary();
  const sf = ts.createSourceFile(
    fileName,
    src,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const out: LiteralFinding[] = [];
  const lineOf = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
  const textOf = (n: ts.Node) => n.getText(sf).replace(/\s+/g, ' ').slice(0, 80);

  const addList = (node: ts.Node, slugs: Iterable<string>) => {
    const set = new Set([...slugs].filter((x) => vocab.has(x)));
    if (set.size < 3) return;
    const firm = [...set].filter((x) => !AMBIGUOUS_SLUGS.has(x)).length;
    if (firm < 2) return;
    out.push({ kind: 'list', line: lineOf(node), text: textOf(node) });
  };
  const firmSlug = (s: string | null): s is string => s !== null && vocab.has(s) && !AMBIGUOUS_SLUGS.has(s);

  const visit = (node: ts.Node) => {
    // ── list ──
    if (ts.isArrayLiteralExpression(node)) {
      const slugs: string[] = [];
      for (const el of node.elements) {
        const s = stringOf(el);
        if (s !== null) slugs.push(s);
        else if (ts.isObjectLiteralExpression(el)) {
          // An array of records that each name one category (`{ catalogTile: 'cake', … }`)
          // is the same list again, one row at a time.
          for (const p of el.properties) {
            if (ts.isPropertyAssignment(p)) {
              const v = stringOf(p.initializer);
              if (v !== null) slugs.push(v);
            }
          }
        }
      }
      addList(node, slugs);
    } else if (ts.isObjectLiteralExpression(node)) {
      const slugs: string[] = [];
      for (const p of node.properties) {
        if (ts.isPropertyAssignment(p) || ts.isShorthandPropertyAssignment(p)) {
          const k = propName(p.name);
          if (k !== null) slugs.push(k);
          if (ts.isPropertyAssignment(p)) {
            const v = stringOf(p.initializer);
            if (v !== null) slugs.push(v);
          }
        }
      }
      addList(node, slugs);
    } else if (ts.isTypeLiteralNode(node)) {
      const slugs: string[] = [];
      for (const m of node.members) {
        if (ts.isPropertySignature(m)) {
          const k = propName(m.name);
          if (k !== null) slugs.push(k);
        }
      }
      addList(node, slugs);
    } else if (ts.isUnionTypeNode(node)) {
      const slugs: string[] = [];
      for (const t of node.types) {
        if (ts.isLiteralTypeNode(t) && ts.isStringLiteral(t.literal)) slugs.push(t.literal.text);
      }
      addList(node, slugs);
    }

    // ── compare ──
    if (ts.isBinaryExpression(node)) {
      const op = node.operatorToken.kind;
      if (
        op === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
        op === ts.SyntaxKind.EqualsEqualsToken ||
        op === ts.SyntaxKind.ExclamationEqualsToken
      ) {
        if (firmSlug(stringOf(node.left)) || firmSlug(stringOf(node.right))) {
          out.push({ kind: 'compare', line: lineOf(node), text: textOf(node) });
        }
      }
    } else if (ts.isCaseClause(node)) {
      if (firmSlug(stringOf(node.expression))) {
        out.push({ kind: 'compare', line: lineOf(node), text: `case ${textOf(node.expression)}` });
      }
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const m = node.expression.name.text;
      if ((m === 'includes' || m === 'has') && node.arguments.length === 1 && firmSlug(stringOf(node.arguments[0]))) {
        out.push({ kind: 'compare', line: lineOf(node), text: textOf(node) });
      }
    }

    // ── import ──
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && isSeedModule(node.moduleSpecifier.text)) {
      const clause = node.importClause;
      if (clause && !clause.isTypeOnly && clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const el of clause.namedBindings.elements) {
          if (el.isTypeOnly) continue;
          const name = (el.propertyName ?? el.name).text;
          if (SEED_SYMBOLS.has(name)) out.push({ kind: 'import', line: lineOf(el), text: name });
        }
      }
    } else if (
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer &&
      ts.isAwaitExpression(node.initializer) &&
      ts.isCallExpression(node.initializer.expression) &&
      node.initializer.expression.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      const spec = stringOf(node.initializer.expression.arguments[0]);
      if (spec && isSeedModule(spec)) {
        for (const el of node.name.elements) {
          const name = (el.propertyName && ts.isIdentifier(el.propertyName) ? el.propertyName : el.name);
          if (ts.isIdentifier(name) && SEED_SYMBOLS.has(name.text)) {
            out.push({ kind: 'import', line: lineOf(el), text: name.text });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/**
 * The files that OWN the seed — where the taxonomy is defined, mirrored from the
 * tables, or bridged to the coarse enum. Everything else reads from them.
 */
export const SEED_OWNERS: Readonly<Record<string, string>> = {
  'lib/taxonomy.ts': 'the seed itself — the DB is generated from it and falls back to it',
  'lib/taxonomy-snapshot.ts': 'builds the snapshot from the seed (fallback) or from the rows',
  'lib/taxonomy-db.ts': 'the live read (`getTaxonomy()`)',
  'lib/vendor-category-taxonomy.ts': 'the coarse vendor_category ↔ tile bridge the seed is keyed through',
  'lib/vendors.ts': 'defines the vendor_category enum and its one label map',
  'lib/vendor-branch-category.ts': 'the seed of service_categories.coarse_category (fallback only)',
  'lib/taxonomy-literal-scan.ts': 'this scanner',
};

/** Paths the scan never reads: tests, dev labs, fixtures, generated files. */
export function isScannedPath(rel: string): boolean {
  if (!/\.tsx?$/.test(rel)) return false;
  if (/\.test\.tsx?$/.test(rel) || /\.d\.ts$/.test(rel)) return false;
  if (/(^|\/)dev\//.test(rel)) return false;
  if (/fixture/i.test(rel)) return false;
  if (/\.generated\./.test(rel)) return false;
  if (rel in SEED_OWNERS) return false;
  return true;
}
