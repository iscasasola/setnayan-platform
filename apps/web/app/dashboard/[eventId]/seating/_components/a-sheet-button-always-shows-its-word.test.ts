/**
 * a-sheet-button-always-shows-its-word.test.ts — NO BUTTON ON THE SEAT PLAN DRAWS BLANK (owner, live, 2026-10-09, on the table's sheet: *"toolbar is not fixed as well"* — a SOLID
 * BLACK OVAL with no word and no icon beside "Delete this table").
 *
 * THE CAUSE: the table sheet's "Done" was `` `${phoneBtn} ml-auto bg-ink text-cream hover:bg-ink` `` and `phoneBtn` already says `text-ink/80`. Two text colours on one element: the
 * stylesheet's own order decides, and `text-ink/80` won (measured in Chromium on the compiled sheet: color rgba(44,42,41,.8) on background rgb(44,42,41)) — ink words on an ink
 * fill. The word was in the page the whole time; nobody could read it. Written 2026-10-02 (f4a147c01), never a regression of a later change.
 *
 * TWO PROPERTIES, over every seat-plan component (so the next sheet is caught too):
 *   (1) NO ELEMENT CARRIES TWO TEXT COLOURS — a class string (a literal, or a template whose `${const}` pieces are resolved from the same file) never holds two different
 *       `text-<colour>` utilities. Which of the two shows is the stylesheet's order, never the author's.
 *   (2) EVERY `<button>` HAS A NAME AND SOMETHING TO SEE — an `aria-label` / `title` / words as its name, and words or an icon drawn in it (an empty button is a blank pill).
 * (The one ActionButton always draws its word and its icon; `components/action-button.tsx`.)
 *
 * SABOTAGE (each seen RED, then restored): the old `bg-ink text-cream` appended to `phoneBtn` again · a button with an icon and no name · a button with a name and nothing drawn.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const HERE = dirname(fileURLToPath(import.meta.url));
const COLOUR = /^text-(?:ink|cream|white|black|mulberry|terracotta|danger|success|warn|gild|link|sn-accent|sn-on-accent)(?:-[\w]+)?(?:\/\d+)?$/;

const files = () => readdirSync(HERE).filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f));
const parse = (f: string) => ts.createSourceFile(f, readFileSync(join(HERE, f), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

/** Two different text colours in one class string (variants such as `hover:` are other states, not this). */
export function twoTextColours(classes: string): string[] {
  const toks = classes.split(/\s+/).filter((t) => COLOUR.test(t));
  return new Set(toks).size > 1 ? [...new Set(toks)] : [];
}

function classClashes(sf: ts.SourceFile): string[] {
  const consts = new Map<string, string>();
  const collect = (n: ts.Node) => {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer && (ts.isStringLiteral(n.initializer) || ts.isNoSubstitutionTemplateLiteral(n.initializer))) consts.set(n.name.text, n.initializer.text);
    ts.forEachChild(n, collect);
  };
  collect(sf);
  const out: string[] = [];
  const at = (n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const visit = (n: ts.Node) => {
    let text: string | null = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateExpression(n)) {
      text = n.head.text;
      for (const sp of n.templateSpans) text += (ts.isIdentifier(sp.expression) ? (consts.get(sp.expression.text) ?? ' ') : ' ') + sp.literal.text;
    }
    if (text && /\btext-/.test(text)) {
      const clash = twoTextColours(text);
      if (clash.length) out.push(`${sf.fileName}:${at(n)} — ${clash.join(' + ')}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

/** A `<button>` with no name, or nothing drawn in it. */
export function unlabelledButtons(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  const visit = (n: ts.Node) => {
    if (ts.isJsxElement(n) && ts.isIdentifier(n.openingElement.tagName) && n.openingElement.tagName.text === 'button') {
      const attrs = new Set(n.openingElement.attributes.properties.filter(ts.isJsxAttribute).map((a) => (a.name as ts.Identifier).text));
      /* Words anywhere inside it (a nested <span>'s text names it too). */
      const hasWords = (x: ts.Node): boolean => (ts.isJsxText(x) && x.text.trim() !== '') || (ts.isJsxExpression(x) && x.expression !== undefined) || x.getChildren().some(hasWords);
      const words = n.children.some(hasWords);
      const drawn = words || n.children.some((c) => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
      const named = attrs.has('aria-label') || attrs.has('title') || words;
      const spread = n.openingElement.attributes.properties.some(ts.isJsxSpreadAttribute);
      if ((!named || !drawn) && !spread) out.push(`${sf.fileName}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

test('(1) no element on the seat plan carries two text colours — the stylesheet’s order would pick one, and a word can vanish into its own fill', () => {
  const all = files().flatMap((f) => classClashes(parse(f)));
  assert.deepEqual(all, [], `two text colours on one element:\n${all.join('\n')}`);
  assert.ok(files().length >= 8, 'anti-vacuity: the seat plan’s components were not read');
  assert.deepEqual(twoTextColours('sn-press text-ink/80 text-cream bg-ink hover:bg-ink'), ['text-ink/80', 'text-cream'], 'the check cannot see the bug it was written for');
  assert.deepEqual(twoTextColours('text-ink/80 hover:text-ink'), [], 'a hover state is another state, not a second colour');
});

test('(2) every <button> on the seat plan has a name and something drawn in it', () => {
  const all = files().flatMap((f) => unlabelledButtons(parse(f)));
  assert.deepEqual(all, [], `a button with no name, or nothing to see:\n${all.join('\n')}`);
  const sf = ts.createSourceFile('x.tsx', '<div><button type="button" className="a"></button><button aria-label="x"></button><button><svg /></button><button>Go</button></div>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  assert.equal(unlabelledButtons(sf).length, 3, 'the check cannot see an empty button, an unnamed icon, or a named nothing');
});
