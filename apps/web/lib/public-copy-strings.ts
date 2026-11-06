/**
 * public-copy-strings.ts — the words a PERSON READS in a source file, and only
 * those, pulled out with the TypeScript parser.
 *
 * ── WHY A PARSER AND NOT A REGEX ────────────────────────────────────────────
 * "vendor" is a code word in this repo long before it is a copy word: the
 * `/vendor-dashboard` route, `vendor_id`, `VendorGrowHero`, `vendors.slug`,
 * `import … from './vendor-grow-sections'`. A regex over the file convicts all
 * of them, and the usual cure — a growing list of `.replace()` exemptions —
 * fails silently the day a new identifier lands. The guard has to ask the
 * PROPERTY ("does a reader see this word?"), so it reads the same tree the
 * compiler reads:
 *
 *   · JSX text                                  → copy
 *   · string / template literals                → copy, UNLESS they are
 *       – a module specifier (import / export / dynamic import),
 *       – a JSX attribute that is never read (className, href, src, key, id…),
 *       – an object key, a type, or a `case`/comparison operand,
 *       – a machine token: no space and only URL/identifier characters
 *         ("/vendor-dashboard", "vendor_billing_catalog", "website").
 *
 * The last rule is the one that could hide copy, so it is narrow: a one-word
 * label ("Vendors") is NOT a machine token — it starts with a capital and holds
 * no `/ _ - . :`, so it is kept. Only lowercase single tokens and anything with
 * path / identifier punctuation are dropped.
 *
 * Pure: no React, no `server-only`, no database. Test-only consumer today
 * (`public-copy-says-the-house-words.test.ts`).
 */

import ts from 'typescript';

export type CopyString = { text: string; line: number };

/** JSX attributes whose value is never shown to a person. */
const UNREAD_ATTRS = new Set([
  'className',
  'href',
  'src',
  'srcSet',
  'key',
  'id',
  'htmlFor',
  'name',
  'type',
  'rel',
  'target',
  'role',
  'value',
  'method',
  'action',
  'as',
  'variant',
  'tone',
  'size',
  'icon',
  'slug',
  'prefetch',
  'sizes',
  'loading',
  'decoding',
  'fetchPriority',
  'style',
  'mode',
  'kind',
  'data-testid',
]);

/** A string with no space made only of path / identifier characters is code. */
function isMachineToken(s: string): boolean {
  const t = s.trim();
  if (t === '') return true;
  if (/\s/.test(t)) return false;
  // Anything carrying path / identifier / URL punctuation is code.
  if (/[/_.:#?=&@\\[\]{}()$*]/.test(t) || /^[a-z0-9-]+$/.test(t)) return true;
  return false;
}

function attrName(node: ts.Node): string | null {
  // "…" inside <X attr="…"> or <X attr={'…'}>
  let p: ts.Node | undefined = node.parent;
  if (p && ts.isJsxExpression(p)) p = p.parent;
  if (p && ts.isJsxAttribute(p)) return p.name.getText();
  return null;
}

function isSkippedPosition(node: ts.Node): boolean {
  const p = node.parent;
  if (!p) return false;
  // import x from '…' · export … from '…' · import('…') · require('…')
  if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isExternalModuleReference(p)) return true;
  if (ts.isCallExpression(p) && (p.expression.kind === ts.SyntaxKind.ImportKeyword || p.expression.getText() === 'require')) return true;
  // console.warn('[vendors] fetch failed') · new Error('…') — a log line or a
  // thrown message is read by an engineer, not by the person on the page.
  if (ts.isCallExpression(p) && /^console\.\w+$/.test(p.expression.getText())) return true;
  if (ts.isNewExpression(p) && /^(?:\w*Error)$/.test(p.expression.getText())) return true;
  // { 'key': … } — the key, not the value
  if ((ts.isPropertyAssignment(p) || ts.isPropertySignature(p) || ts.isMethodDeclaration(p)) && p.name === node) return true;
  // { '@type': 'WebSite', type: 'website' } — schema.org / Open Graph vocabulary
  if (ts.isPropertyAssignment(p) && p.initializer === node && /^['"]?(?:@type|@id|@context|type)['"]?$/.test(p.name.getText())) return true;
  // a['key']
  if (ts.isElementAccessExpression(p) && p.argumentExpression === node) return true;
  // type positions: 'a' | 'b'
  if (ts.isLiteralTypeNode(p)) return true;
  // case 'vendor': · x === 'vendor'
  if (ts.isCaseClause(p) && p.expression === node) return true;
  if (ts.isBinaryExpression(p)) {
    const k = p.operatorToken.kind;
    if (
      k === ts.SyntaxKind.EqualsEqualsEqualsToken ||
      k === ts.SyntaxKind.ExclamationEqualsEqualsToken ||
      k === ts.SyntaxKind.EqualsEqualsToken ||
      k === ts.SyntaxKind.ExclamationEqualsToken
    )
      return true;
  }
  // 'use client' · 'use server'
  if (ts.isExpressionStatement(p) && /^use (client|server)$/.test((node as ts.StringLiteral).text ?? '')) return true;
  const a = attrName(node);
  if (a && (UNREAD_ATTRS.has(a) || a.startsWith('data-') || a.startsWith('on'))) return true;
  return false;
}

/** Every string a reader can see in `source` (a .ts / .tsx file's text). */
export function copyStrings(source: string, fileName = 'x.tsx'): CopyString[] {
  const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: CopyString[] = [];
  const push = (node: ts.Node, text: string) => {
    if (isMachineToken(text)) return;
    out.push({ text, line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 });
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      // Kept RAW (newlines and all) so a caller can point at the exact line.
      const t = node.getText(sf);
      if (t.trim()) push(node, t);
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      if (!isSkippedPosition(node)) push(node, node.text);
    } else if (ts.isTemplateExpression(node)) {
      if (!isSkippedPosition(node)) {
        // The literal parts only — an interpolation is another node, visited below.
        const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)];
        // `${base}/#website` · `/vendors/${slug}` — the literal parts alone are
        // a path or an id, so the whole template is code.
        if (!isMachineToken(parts.join(''))) push(node, parts.join(' … '));
      }
    } else if (ts.isTaggedTemplateExpression(node)) {
      // css`…` / sql`…` / String.raw`…` — never copy.
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}
