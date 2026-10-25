import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import ts from 'typescript';

/**
 * THE FRONT DOOR SAYS "EVENT" — NEVER "CELEBRATION" FOR THE THING.
 *
 * Owner, 2026-10-04 (DECISION_LOG "ONE WORD: EVENT"): *"yes, use event
 * everywhere."* Quality sweep 2026-10-19, row B1: Home's hero — the first
 * sentence a stranger reads — still said "Every celebration, planned in one
 * place" over a main button reading "Start your celebration — free", and the
 * ⌘K palette's New-event row said "Start planning a new celebration".
 *
 * 🔑 KEYED ON A PROPERTY, NOT ON THOSE SENTENCES. Every string a front-door
 * file can put on screen — JSX text, string and template literals, attribute
 * values — is read through the TypeScript parser, so comments are never
 * mistaken for copy and a REWORDED sentence is caught as surely as the old
 * one. A new file in this folder is covered the day it lands.
 *
 * The verb is not the noun: "celebrate" / "celebrating" in a sentence is not
 * the name of a thing and does not match. The rendered hero is checked too,
 * so the words that actually reach the page are the ones under test.
 */

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
/** The noun, as a name for the thing — the verb forms do not match. */
const NOUN = /\bcelebrations?\b/i;

const FILES = readdirSync(HERE).filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f));

/** Every piece of text in a file that could reach the screen, with its line. */
function copyIn(file: string): { text: string; line: number }[] {
  const source = readFileSync(join(HERE, file), 'utf8');
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const out: { text: string; line: number }[] = [];
  const push = (n: ts.Node, text: string) =>
    out.push({ text, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1 });
  const walk = (n: ts.Node) => {
    if (ts.isJsxText(n)) push(n, n.getText(sf));
    else if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      // An import path is not copy.
      if (!ts.isImportDeclaration(n.parent) && !ts.isExportDeclaration(n.parent)) push(n, n.text);
    } else if (ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n)) push(n, n.text);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

test('the anchor: the folder has files and the reader finds real copy in them', () => {
  assert.ok(FILES.length >= 10, `only ${FILES.length} source files found — the folder moved?`);
  assert.ok(FILES.includes('front-door-anchor.tsx'), 'the Home hero file is gone');
  const hero = copyIn('front-door-anchor.tsx').map((c) => c.text).join(' ');
  assert.match(hero, /planned in one place/, 'the reader did not pick up the hero copy');
  // …and a comment is not copy: the hero's docblock prose must never be read as a string.
  assert.doesNotMatch(copyIn('front-door-anchor.tsx').map((c) => c.text).join(' '), /OAuth-brand rule/);
});

test('no front-door string names the thing a "celebration"', () => {
  const hits: string[] = [];
  for (const f of FILES) {
    for (const { text, line } of copyIn(f)) {
      if (NOUN.test(text)) hits.push(`${f}:${line} — ${JSON.stringify(text.trim().slice(0, 90))}`);
    }
  }
  assert.deepEqual(hits, [], 'House word: say "event", never "celebration":\n' + hits.join('\n'));
});

test('the rendered Home hero says "event" and never "celebration"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { FrontDoorAnchor } = await import('./front-door-anchor');
  const html = renderToStaticMarkup(React.createElement(FrontDoorAnchor));
  const text = html.replace(/<[^>]+>/g, ' ');
  assert.doesNotMatch(text, NOUN);
  assert.match(text, /\bevent\b/i);
});
