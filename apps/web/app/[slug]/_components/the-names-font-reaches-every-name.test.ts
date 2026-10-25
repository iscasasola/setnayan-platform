/**
 * the-names-font-reaches-every-name.test.ts — 🔤 THE COUPLE'S NAMES FONT REACHES EVERY NAME THE COVER DRAWS, THE "&"
 * INCLUDED, ON THE GUEST PAGE AND ON THE MAKER'S CANVAS — AND APPLY TAKES IT TO GUESTS AT ONCE.
 *
 * Owner, 2026-10-17: he changed the Names font in the Maker and expected the Cover Scene's Event title to change; then,
 * *"how about the &?"* — his ruling: the "&" between the names follows the Names font too, keeps its gold, and is
 * italic where the chosen face has an italic. Measured in the Maker lab the same day (no database, 54321 stub): a pick
 * reached the canvas's names at once (phone Studio, desktop, the shipped Typeface row, every stage) — but the "&"
 * stayed Fraunces, and a draft that handed the font BACK ("Event Hub font") over a live one kept showing the live
 * font, because the canvas's drafted look is a second scope INSIDE the layout's and the layout's names mark still
 * reached the names.
 *
 *   (1) THE NEAREST SCOPE DECIDES — the stylesheet's names and joiner rules, evaluated (by the small matcher below, on
 *       the rule's own selector text) against every way the scopes nest: one scope; the canvas's drafted scope inside
 *       the layout's, choosing, clearing or agreeing; a scope that is not worn.
 *   (2) NOTHING INSIDE THE NAMES WEARS A FACE THE RULE CANNOT REACH — every masthead design, with and without the
 *       card, on a guest's page and on the canvas (its hidden second-name holder too): any element inside a
 *       `[data-hub-names]` that names a font family by class is a joiner (`data-hub-joiner`), and a two-person cover
 *       has one. The sample screen's "&" is a joiner too.
 *   (3) THE JOINER KEEPS ITS GOLD AND ITS ITALIC, and the browser never fakes an italic the face does not have.
 *   (4) APPLY REVALIDATES THE GUEST PAGE — the apply branch revalidates the event's slug (`revalidateGuestSite`), which
 *       is `revalidatePath('/<slug>')`.
 *
 * NOT TESTED HERE: a browser computing the face (no CSS engine in this suite) — the walk is in the PR, with shots.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { HERO_DESIGNS } from '@/lib/hero-design';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

/* ── a small selector matcher: compound = attribute tests and `*`, the descendant combinator, `:not(<complex>)` ── */

type El = Record<string, string>; // an element = its attributes
type Compound = { attrs: Array<{ name: string; word?: string }>; nots: Complex[] };
type Complex = Compound[]; // descendant-joined, root first

function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth += 1;
    if (ch === ')' || ch === ']') depth -= 1;
    if (depth === 0 && ch === sep) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map((x) => x.trim()).filter(Boolean);
}
function parseCompound(s: string): Compound {
  const c: Compound = { attrs: [], nots: [] };
  let rest = s.trim();
  while (rest) {
    if (rest.startsWith('*')) {
      rest = rest.slice(1);
    } else if (rest.startsWith('[')) {
      const end = rest.indexOf(']');
      const body = rest.slice(1, end);
      const m = /^([a-z-]+)(?:~='([^']*)')?$/.exec(body);
      assert.ok(m, `the matcher cannot read [${body}]`);
      c.attrs.push({ name: m[1]!, ...(m[2] !== undefined ? { word: m[2] } : {}) });
      rest = rest.slice(end + 1);
    } else if (rest.startsWith(':not(')) {
      let depth = 0;
      let i = 4;
      for (; i < rest.length; i += 1) {
        if (rest[i] === '(') depth += 1;
        if (rest[i] === ')') {
          depth -= 1;
          if (depth === 0) break;
        }
      }
      c.nots.push(parseComplex(rest.slice(5, i)));
      rest = rest.slice(i + 1);
    } else assert.fail(`the matcher cannot read "${rest}"`);
  }
  return c;
}
function parseComplex(s: string): Complex {
  return splitTop(s, ' ').map(parseCompound);
}
function matchesCompound(c: Compound, chain: El[], at: number): boolean {
  const el = chain[at]!;
  for (const a of c.attrs) {
    if (!(a.name in el)) return false;
    if (a.word !== undefined && !el[a.name]!.split(/\s+/).includes(a.word)) return false;
  }
  return c.nots.every((n) => !matchesComplex(n, chain, at));
}
/** Does `cx` match the element at `chain[at]`, its ancestors being `chain[0..at)`? */
function matchesComplex(cx: Complex, chain: El[], at: number): boolean {
  const last = cx.length - 1;
  if (!matchesCompound(cx[last]!, chain, at)) return false;
  const up = (k: number, from: number): boolean => {
    if (k < 0) return true;
    for (let i = from; i >= 0; i -= 1) if (matchesCompound(cx[k]!, chain, i) && up(k - 1, i - 1)) return true;
    return false;
  };
  return up(last - 1, at - 1);
}
const matches = (selectorList: string, chain: El[]) => splitTop(selectorList, ',').some((s) => matchesComplex(parseComplex(s), chain, chain.length - 1));

/* The rules, read from the stylesheet as shipped. */
const CSS = stripComments(read('app/globals.css'));
const rulesSetting = (prop: string) =>
  [...CSS.matchAll(/([^{}]*\[data-hub-names\][^{}]*)\{([^}]*)\}/g)]
    .filter((m) => new RegExp(`(^|;)\\s*${prop}\\s*:\\s*var\\(--hub-names-face\\)`).test(m[2]!))
    .map((m) => ({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]!.replace(/\s+/g, ' ').trim() }));
const NAMES_FACE = rulesSetting('font-family');
const wears = (chain: El[]) => NAMES_FACE.some((r) => matches(r.selector, chain));

/* Scopes as the pages wear them. */
const scope = (roles: string | null, worn = true): El => ({ ...(worn ? { 'data-guest-look': '' } : {}), ...(roles ? { 'data-hub-roles': roles } : {}) });
const NAMES: El = { 'data-hub-names': '' };
const JOINER: El = { 'data-hub-joiner': '', class: 'font-pahina italic text-gild' };
const OTHER: El = { class: 'font-pahina' }; // any other font-pahina text — the venue, a title

test('(1) THE NEAREST SCOPE DECIDES — the names and the "&" wear the Names font exactly where the nearest worn scope chose one', () => {
  assert.ok(NAMES_FACE.length >= 2, 'the stylesheet has no Names-font rule for the names and the joiner');
  const cases: Array<[string, El[], boolean]> = [
    ['a guest page, a Names font chosen', [scope('names body')], true],
    ['a guest page, nothing chosen', [scope(null)], false],
    ['a guest page, other fonts chosen but not Names', [scope('body eyebrow button')], false],
    ['no look scope at all', [], false],
    ['the canvas: live has one, the draft agrees', [scope('names'), scope('names body')], true],
    ['the canvas: live has none, the draft chooses one', [scope(null), scope('names')], true],
    ['the canvas: live has one, the draft hands it back ("Event Hub font")', [scope('names'), scope('body')], false],
    ['the canvas: live has one, the draft hands every font back', [scope('names'), scope(null)], false],
    ['a scope that is not worn is transparent', [scope('names'), scope(null, false)], true],
    ['a reply page inside the layout, both live', [scope('names body'), scope('names body')], true],
  ];
  for (const [where, scopes, expected] of cases) {
    assert.equal(wears([...scopes, NAMES]), expected, `the names: ${where}`);
    assert.equal(wears([...scopes, NAMES, JOINER]), expected, `the "&": ${where}`);
    assert.equal(wears([...scopes, OTHER]), false, `a font-pahina text that is not the names moved: ${where}`);
  }
});

/* ── (2) the markup: nothing inside the names names a face the rule cannot reach ───────────────────────── */

const WEIGHTS = new Set(['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']);
const familyClass = (cls: string) => cls.split(/\s+/).find((c) => /^(?:[a-z]+:)*font-[a-z0-9-]+$/.test(c) && !WEIGHTS.has(c.replace(/^(?:[a-z]+:)*font-/, '')));
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr', 'col', 'area', 'base', 'embed', 'track', 'param']);

/** Every element inside each `[data-hub-names]`, with its attributes. */
function insideNames(html: string): Array<Array<{ tag: string; attrs: string }>> {
  const out: Array<Array<{ tag: string; attrs: string }>> = [];
  const stack: Array<{ tag: string; names: number | null }> = [];
  for (const m of html.matchAll(/<(\/?)([a-z][a-z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g)) {
    const [, close, tag, attrs] = m as unknown as [string, string, string, string];
    if (close) {
      while (stack.length && stack[stack.length - 1]!.tag !== tag) stack.pop();
      stack.pop();
      continue;
    }
    const open = stack.findLast((s) => s.names !== null)?.names ?? null;
    if (open !== null) out[open]!.push({ tag, attrs });
    const isNames = /\sdata-hub-names=""/.test(attrs);
    if (isNames) out.push([]);
    if (!VOID.has(tag) && !attrs.trimEnd().endsWith('/')) stack.push({ tag, names: isNames ? out.length - 1 : null });
  }
  return out;
}

async function masthead(props: Record<string, unknown>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PahinaMasthead } = await import('./pahina-masthead');
  return renderToStaticMarkup(
    React.createElement(PahinaMasthead, {
      displayName: 'Maria & Jose',
      eventDate: '2026-12-18',
      venueName: 'Manila Cathedral',
      monogramSlot: React.createElement('span', null, 'MJ'),
      twoPeople: true,
      ...props,
    } as never),
  );
}
const CARD = { eyebrow: 'Together with their families', line: 'invite you to celebrate their wedding', timeLabel: 'Starts 2:30 PM', hubHref: '#hub', hubLabel: 'the day, the place' };

test('(2) NOTHING INSIDE THE NAMES WEARS A FACE THE RULE CANNOT REACH — every design, card or not, guest or canvas; a two-person cover has its joiner', async () => {
  let checked = 0;
  for (const design of HERO_DESIGNS) {
    for (const card of [CARD, undefined]) {
      for (const stampElements of [false, true]) {
        const where = `${design}${card ? ' + card' : ''}${stampElements ? ' · canvas' : ' · guest'}`;
        const blocks = insideNames(await masthead({ design, ...(card ? { card } : {}), stampElements }));
        assert.ok(blocks.length >= 1, `${where}: no [data-hub-names] on the cover`);
        let joiners = 0;
        for (const inner of blocks) {
          for (const { tag, attrs } of inner) {
            const cls = /\sclass="([^"]*)"/.exec(attrs)?.[1] ?? '';
            const fam = familyClass(cls);
            const isJoiner = /\sdata-hub-joiner=""/.test(attrs);
            if (isJoiner) joiners += 1;
            if (fam) assert.ok(isJoiner, `${where}: <${tag} class="${cls}"> inside the names wears ${fam}, which the Names font never reaches`);
            checked += 1;
          }
        }
        assert.ok(joiners >= 1, `${where}: the two names have no joiner the Names font can reach`);
      }
    }
  }
  assert.ok(checked > 20, `only ${checked} elements inside the names were looked at — the reader found nothing`);
  /* The sample screen draws the names as the cover does, its "&" a joiner too. */
  assert.match(stripComments(read('app/dashboard/[eventId]/launch/_components/look-sample.tsx')), /<em data-hub-joiner="" className="[^"]*italic text-gild">&amp;<\/em>/);
});

test('(3) THE "&" KEEPS ITS GOLD AND ITS ITALIC — and no italic is faked for a face that has none', () => {
  const joinerRule = NAMES_FACE.find((r) => /\[data-hub-joiner\]/.test(r.selector));
  assert.ok(joinerRule, 'no rule sets the Names font on the joiner');
  assert.match(joinerRule.body, /font-synthesis-style:\s*none/, 'a face with no italic would be slanted by the browser');
  assert.doesNotMatch(joinerRule.body, /(^|;)\s*(color|font-style)\s*:/, 'the joiner rule changes its gold or its italic');
});

test('(4) APPLY REVALIDATES THE GUEST PAGE — the slug, by the one helper', () => {
  const helper = stripComments(read('lib/revalidate-site.ts'));
  assert.match(helper, /export function revalidateGuestSite\(slug[^)]*\): void \{\s*if \(!slug\) return;\s*revalidatePath\(`\/\$\{slug\}`\);/);
  const action = stripComments(read('app/dashboard/[eventId]/website/hub-draft-actions.ts'));
  const apply = action.indexOf('planHubDraftApply(current, live, owned)');
  assert.ok(apply > 0, 'the apply branch moved — re-anchor this guard on it');
  const tail = action.slice(apply);
  assert.match(tail, /\.select\(`slug, /, 'the apply branch no longer reads the slug it revalidates');
  assert.match(tail, /revalidateGuestSite\(typeof ownRow\.slug === 'string' \? ownRow\.slug : null\);/, 'Apply no longer revalidates the guest page');
});
