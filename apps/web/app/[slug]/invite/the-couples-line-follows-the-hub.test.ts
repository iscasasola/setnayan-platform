/**
 * 🙈 THE COUPLE'S LINE UNDER THE NAMES FOLLOWS THE EVENT HUB — EVERYWHERE.
 *
 * Owner, 2026-10-04 ("YES TO ALL", audit decision 2): *"the couple's line under
 * the names follows the Event Hub everywhere — hidden there = hidden on the
 * invitation page too"*. #6301 put the line on the invitation landing
 * (`/invite/enter`, before the reply and on the thank-you) and showed it even
 * when the couple had hidden it on the Event Hub's hero.
 *
 * ONE RULE, NO SECOND FLAG: both surfaces ask `hubElementHidden` of the SAME
 * sanitised part (`sanitizeHubCanvas(hero config).elements.line`). This test
 * runs the same config through both pipelines — what the Event Hub's hero
 * draws with (`hubElementInlineStyle`, PahinaMasthead's `el('line')`) and what
 * the landing prints (`heroLineWord`) — and requires them to agree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const WORD = 'Invite you to celebrate our wedding';
const hero = (line: Record<string, unknown>) => ({ canvas: { design: 'marquee', elements: { line: { word: WORD, ...line } } } });

test('hidden on the Event Hub = hidden on the invitation landing; shown = shown (executed, both pipelines)', async () => {
  const { heroLineWord } = await import('./_lib/wear-the-hub');
  const { sanitizeHubCanvas } = await import('@/lib/hub-canvas');
  const { hubElementInlineStyle } = await import('@/lib/element-style');
  const cases: Array<[string, Record<string, unknown>]> = [
    ['hidden', { hidden: true }],
    ['shown', {}],
    ['a non-true hidden (sanitised away)', { hidden: 'yes' }],
    ['hidden, with a style of its own', { hidden: true, italic: true, size: 110 }],
  ];
  for (const [name, line] of cases) {
    const cfg = hero(line);
    const hubHides = hubElementInlineStyle(sanitizeHubCanvas(cfg).elements?.line)?.display === 'none';
    const landing = heroLineWord(cfg);
    console.log(`  ${name}: Event Hub ${hubHides ? 'hides' : 'shows'} · landing ${landing === null ? 'hides' : 'shows'}`);
    assert.equal(landing === null, hubHides, `${name}: the landing and the Event Hub disagree about the couple's line`);
    if (!hubHides) assert.equal(landing, WORD);
  }
});

test('one rule: both surfaces ask `hubElementHidden`, and nothing reads `.hidden` on its own', () => {
  const es = read('lib/element-style.ts');
  assert.match(es, /export function hubElementHidden\(style: HubElementStyle \| null \| undefined\): boolean \{\s*return style\?\.hidden === true;\s*\}/);
  const decl = es.slice(es.indexOf('export function hubElementDeclarations('), es.indexOf('const camel ='));
  assert.match(decl, /if \(hubElementHidden\(style\)\) out\.push/, 'the Event Hub hero no longer hides through the one rule');
  const wear = read('app/[slug]/invite/_lib/wear-the-hub.ts');
  const fn = wear.slice(wear.indexOf('export function heroLineWord('));
  assert.match(fn, /if \(hubElementHidden\(line\)\) return null;/, 'the landing stopped asking the one rule');
  assert.doesNotMatch(fn, /\.hidden\b/, 'the landing reads a hidden flag of its own — a second switch');
  // Both landing renders print the line through heroLineWord, nothing else.
  const enter = read('app/[slug]/invite/enter/page.tsx');
  assert.equal((enter.match(/heroLineWord\(/g) ?? []).length, 1);
  assert.doesNotMatch(enter, /elements\?\.line|\.line\?\.word/, 'the landing reads the hero line around heroLineWord');
});
