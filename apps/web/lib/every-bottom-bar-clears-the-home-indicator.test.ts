/**
 * every-bottom-bar-clears-the-home-indicator.test.ts — A BAR FIXED ACROSS THE BOTTOM OF THE SCREEN KEEPS ITS CONTENT
 * ABOVE THE HOME INDICATOR (fits-every-phone sweep, owner 2026-10-21: "are they aligned for all mobile devices?").
 *
 * Every page runs under the system bars (`viewportFit: 'cover'`, app/layout.tsx), so on an iPhone with no home
 * button the bottom ~34px of the screen belongs to the home indicator. A web bar is never moved by the system: one
 * pinned with `fixed bottom-0` and only `py-3` puts its buttons in the indicator's swipe zone. Three did, found by
 * this check the day it was written — the "Setnayan was updated" notice (`stale-tab-notice.tsx`), the mood board's
 * PDF row and the seating drawer on a phone. A headless browser reports the inset as 0, so no walk can see it; the
 * property is read from the source instead.
 *
 * 🔑 THE PROPERTY, parsed (TypeScript's own TSX parser — never a regex window, which cannot know where an element
 * ends): every JSX element whose literal `className` makes it a FULL-WIDTH bar fixed to the BOTTOM EDGE
 * (`fixed` + `bottom-0` + `inset-x-0`, or `left-0 right-0`) names the bottom inset somewhere inside ITSELF — its
 * classes, its `style`, or a child (a home-indicator strip) — as `env(safe-area-inset-bottom…)`, or through
 * `--sn-bottomdock-h`, the dock height that already carries it.
 *
 * ⛔ Never weaken this to go green. A new bottom bar fixes itself: `pb-[max(0.75rem,env(safe-area-inset-bottom))]`
 * on the bar, or a strip child `[height:env(safe-area-inset-bottom)]`. Each exemption below says why it needs no pad of its own.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const WEB = join(__dirname, '..');

/** file → [a class the exempt bar carries, why]. Keyed on the class too, so a second bar in the same file is checked. */
const EXEMPT: Record<string, [string, string]> = {
  'app/wall/[eventId]/_components/wall-projection.tsx': ['bg-gradient-to-t',
    'the projector wall — drawn on a venue screen or a laptop fed to a projector, never a phone; it has no home indicator'],
  'app/dashboard/[eventId]/launch/_components/maker-sheet.tsx': ['sn-glass-bare',
    "the Maker's half sheet is a FRAME: its body is `children`, handed in by each tool, and the tools pad their own " +
    'scroll body by the inset (e.g. `details-workspace.tsx`, `print-paper.tsx`). Its folded slim bar, defined in the ' +
    'same file, is checked like any other bar. (The Maker is at its 507 KB first-load budget, so the frame was not ' +
    'given a second pad on top of its children\'s.)'],
};
const exempt = (b: { file: string; cls: string }) => Boolean(EXEMPT[b.file] && b.cls.includes(EXEMPT[b.file]![0]));
const SKIP_DIR = /^app\/dev\//;

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(join(WEB, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
      walk(rel, out);
    } else out.push(rel);
  }
  return out;
}
const SOURCES = [...walk('app'), ...walk('lib')].filter(
  (f) => /\.tsx$/.test(f) && !/\.test\.tsx?$/.test(f) && !SKIP_DIR.test(f),
);

/** The literal text of a `className` attribute: a string, or a template's static parts. */
function classText(attr: ts.JsxAttribute): string | null {
  const init = attr.initializer;
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression) {
    const e = init.expression;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    if (ts.isTemplateExpression(e)) return [e.head.text, ...e.templateSpans.map((s) => s.literal.text)].join(' ');
  }
  return null;
}

/** Tokens at the base breakpoint only — `sm:fixed` is not a phone bar. */
function isBottomBar(cls: string): boolean {
  const t = new Set(cls.split(/\s+/).filter(Boolean));
  const fullWidth = t.has('inset-x-0') || (t.has('left-0') && t.has('right-0'));
  return t.has('fixed') && t.has('bottom-0') && fullWidth;
}
const NAMES_INSET = /env\(\s*safe-area-inset-bottom|--sn-bottomdock-h/;

type Bar = { file: string; line: number; cls: string; clears: boolean };
function bars(file: string): Bar[] {
  const src = readFileSync(join(WEB, file), 'utf8');
  if (!/\bbottom-0\b/.test(src)) return [];
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out: Bar[] = [];
  const visit = (n: ts.Node) => {
    const opening = ts.isJsxElement(n) ? n.openingElement : ts.isJsxSelfClosingElement(n) ? n : null;
    if (opening) {
      for (const a of opening.attributes.properties) {
        if (!ts.isJsxAttribute(a) || a.name.getText(sf) !== 'className') continue;
        const cls = classText(a);
        if (cls && isBottomBar(cls)) {
          // The element's WHOLE text — its own attributes and every child — with comments dropped.
          const text = n.getText(sf).replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/[^\n]*/g, '');
          out.push({ file, line: sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1, cls: cls.slice(0, 90), clears: NAMES_INSET.test(text) });
        }
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

const ALL = SOURCES.flatMap(bars);

test('📏 the check finds the shipped bottom bars (anchor — a parser that finds nothing would pass everything)', () => {
  const files = new Set(ALL.map((b) => b.file));
  for (const f of ['app/[slug]/_components/site-menu-bar.tsx', 'app/_components/stale-tab-notice.tsx', 'app/dashboard/[eventId]/launch/_components/maker-sheet.tsx']) {
    assert.ok(files.has(f), `no bottom bar found in ${f} — the parser no longer sees the shipped bars`);
  }
  assert.ok(ALL.length >= 6, `only ${ALL.length} bottom bars found`);
});

test('🏠 every full-width bar fixed to the bottom edge names the home-indicator inset inside itself', () => {
  const bad = ALL.filter((b) => !b.clears && !exempt(b)).map((b) => `${b.file}:${b.line} — "${b.cls}"`);
  assert.deepEqual(bad, [], `bottom bars whose content sits in the home indicator's zone:\n${bad.join('\n')}`);
});

test('📝 every exemption still names a bar that exists (a stale exemption hides nothing and should go)', () => {
  for (const f of Object.keys(EXEMPT)) assert.ok(ALL.some((b) => b.file === f && exempt(b)), `${f} is exempt but holds no such bottom bar now`);
});
