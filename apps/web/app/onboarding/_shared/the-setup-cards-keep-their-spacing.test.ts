/**
 * the-setup-cards-keep-their-spacing.test.ts — NO RULE OF THE OLD ONBOARDING SHEETS SETS A MARGIN OR A PADDING ON A
 * SETUP CARD.
 *
 * MEASURED 2026-10-11 (owner's walk of the live wedding flow, then `/dev/onboarding-lab` at 375 and 1280): on all nine
 * approved cards every field had padding 0 (the placeholder sat on the left edge, a field was 30 px tall), the quick
 * pills had padding 0, and counter → title → line → control → pills → footer were stacked with 0 px between them.
 * The cards (`SetupFrame`, the wedding's own cards) are spaced ONLY with Tailwind classes (`mt-2`, `mt-6`, `px-4 py-3`),
 * and they are drawn inside `<div class="onbw">`, whose sheet opened with `.onbw *{margin:0;padding:0}`. That rule is
 * exactly as strong as one Tailwind class and its sheet loads later, so it won — on every card, every element.
 * `gap-*` survived, which is why the names still had space between the fields.
 *
 * ── WHAT IT CLAIMS ──────────────────────────────────────────────────────────────────────────────────────────────────
 *   1. Every stylesheet that scopes itself under `.onbw` is read. For every rule in them that declares ANY margin or
 *      padding, its selector is matched against EVERY ELEMENT of every setup card — the cards as they really render
 *      (server render, not source), standing in the shell's real wrappers (.onbw › .phone › .body › section.screen).
 *      No such rule matches any of them. The property is guarded, not a spelling: a universal rule, a tag rule
 *      (`.onbw input{…}`), or an old class that happens to share a Tailwind name (`.onbw .flex{…}`) all fail alike.
 *   2. The old reset is still in force everywhere else: it matches the shell's own wrappers (the old screens were
 *      written against it and still rely on it).
 *   3. The detector can fire: given the sheet as it was (`.onbw *{…}`), it names every element of every card; given a
 *      tag rule or a colliding class, it names those.
 * Floors prove none of the walks is empty.
 *
 * NOT CLAIMED (so a green is not over-read): this matches selectors, it does not lay anything out — the pixels were
 * measured in a browser (`controller-2026-10-08/batch-c/onboarding/REPORT.md`). It reads the cards' FIRST render (and
 * the area card with "We already have our venue" open); the old "Where" screen that opens under "More places"
 * (`LocationStep`) is old markup that carries its own `.onbw` classes on purpose and is not walked. It knows nothing
 * of sheets that do not mention `.onbw`. State pseudo-classes (`:hover`, `:focus`, `:nth-child`…) are assumed able to
 * match, and `:has()` too — so it can over-report, never under-report.
 *
 * WHEN IT FAILS: an `.onbw` rule reaches into a setup card. Scope it to its own screen (`#screen-…`, an old class the
 * cards do not wear), or — for a reset — end it with `:not(:where([data-setup-card],[data-setup-card] *))` as the
 * first rule of `onboarding.css` does. Do not restyle the cards from these sheets: their spacing is theirs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import postcss from 'postcss';

import { BUDGET_BANDS_FALLBACK } from '@/lib/budget-bands-shared';
import { WEDDING_PROFILE, profileSetup } from '@/lib/event-type-profile';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { CREATION_ASKS, resolveSetupSteps, setupViewFor } from '@/lib/onboarding/flow-config';
import { setupDefaults } from '@/lib/onboarding/setup-answers';
import { EMPTY_VENUES } from '@/lib/onboarding/venue-picks';
import { WEDDING_CARD_IDS, WEDDING_ENGINE_CARDS } from '@/lib/onboarding/wedding-cards';
import { stripComments } from '@/lib/strip-comments';
import { EMPTY_ONBOARDING_STATE } from '../wedding/types';

// tsx compiles the components with the classic JSX runtime, which reads a global `React`.
(globalThis as unknown as { React: typeof React }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');

// ── a small DOM: just enough to ask "does this selector match this element?" ─────────────────────────────────────────

type El = { tag: string; id: string; classes: Set<string>; attrs: Map<string, string>; parent: El | null; children: El[] };
/** HTML's void elements — React's server render writes these (and only these) with no closing tag. */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function parseHtml(html: string): El {
  const root: El = { tag: '#root', id: '', classes: new Set(), attrs: new Map(), parent: null, children: [] };
  let cur = root;
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z0-9-]+)\s*>|<([a-zA-Z0-9-]+)((?:\s+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'<>]+))?)*)\s*(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    if (m[1]) {
      let up: El | null = cur;
      while (up && up.tag !== m[1].toLowerCase()) up = up.parent;
      assert.ok(up && up.parent, `the markup closes <${m[1]}> that was never opened`);
      cur = up.parent;
    } else if (m[2]) {
      const attrs = new Map<string, string>();
      for (const a of (m[3] ?? '').matchAll(/([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'<>]+)))?/g)) attrs.set(a[1]!.toLowerCase(), a[2] ?? a[3] ?? a[4] ?? '');
      const el: El = { tag: m[2].toLowerCase(), id: attrs.get('id') ?? '', classes: new Set((attrs.get('class') ?? '').split(/\s+/).filter(Boolean)), attrs, parent: cur, children: [] };
      cur.children.push(el);
      if (!m[4] && !VOID.has(el.tag)) cur = el;
    }
  }
  assert.equal(cur, root, 'the markup left a tag open — the little parser lost its place');
  return root;
}
const all = (el: El): El[] => [el, ...el.children.flatMap(all)];

// ── selectors ───────────────────────────────────────────────────────────────────────────────────────────────────────

/** Split on a separator at depth 0 (outside `()` and `[]`). */
function splitTop(s: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let buf = '';
  for (const ch of s) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) {
      out.push(buf);
      buf = '';
    } else buf += ch;
  }
  out.push(buf);
  return out.map((x) => x.trim()).filter(Boolean);
}

type Simple =
  | { k: 'tag'; v: string }
  | { k: 'class'; v: string }
  | { k: 'id'; v: string }
  | { k: 'attr'; name: string; op: string; v: string }
  | { k: 'pseudo'; name: string; arg: string | null }
  | { k: 'element' };
type Step = { comb: ' ' | '>' | '+' | '~' | null; simples: Simple[] };

/** The pseudo-classes that depend on state or position: assumed ABLE to match (over-report, never under-report). */
const COULD_MATCH = new Set(['hover', 'active', 'focus', 'focus-visible', 'focus-within', 'disabled', 'enabled', 'checked', 'placeholder-shown', 'empty', 'first-child', 'last-child', 'only-child', 'first-of-type', 'last-of-type', 'nth-child', 'nth-last-child', 'nth-of-type', 'has', 'visited', 'link', 'target', 'root']);
/** Old one-colon spellings of pseudo-ELEMENTS. */
const OLD_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter']);

function parseCompound(src: string): Simple[] {
  const out: Simple[] = [];
  let i = 0;
  const ident = () => {
    const m = /^(?:\\.|[a-zA-Z0-9_-]|[^\x00-\x7f])+/.exec(src.slice(i));
    assert.ok(m, `selector syntax this guard does not read: “${src}” at ${i} — teach parseCompound`);
    i += m[0].length;
    return m[0].replace(/\\(.)/g, '$1');
  };
  while (i < src.length) {
    const ch = src[i]!;
    if (ch === '*') {
      i++;
      out.push({ k: 'tag', v: '*' });
    } else if (ch === '.') {
      i++;
      out.push({ k: 'class', v: ident() });
    } else if (ch === '#') {
      i++;
      out.push({ k: 'id', v: ident() });
    } else if (ch === '[') {
      const end = src.indexOf(']', i);
      const m = /^\s*([a-zA-Z0-9_-]+)\s*(?:([~|^$*]?=)\s*(?:"([^"]*)"|'([^']*)'|([^\s\]]+)))?\s*(?:[is])?\s*$/.exec(src.slice(i + 1, end));
      assert.ok(m, `attribute selector this guard does not read: “${src}”`);
      out.push({ k: 'attr', name: m[1]!.toLowerCase(), op: m[2] ?? '', v: m[3] ?? m[4] ?? m[5] ?? '' });
      i = end + 1;
    } else if (ch === ':') {
      if (src[i + 1] === ':') {
        out.push({ k: 'element' });
        return out; // a pseudo-element ends the compound
      }
      i++;
      const name = ident().toLowerCase();
      let arg: string | null = null;
      if (src[i] === '(') {
        let depth = 0;
        let j = i;
        for (; j < src.length; j++) {
          if (src[j] === '(') depth++;
          if (src[j] === ')' && --depth === 0) break;
        }
        arg = src.slice(i + 1, j);
        i = j + 1;
      }
      out.push(OLD_ELEMENTS.has(name) ? { k: 'element' } : { k: 'pseudo', name, arg });
    } else {
      out.push({ k: 'tag', v: ident().toLowerCase() });
    }
  }
  return out;
}

function parseComplex(sel: string): Step[] {
  const tokens: string[] = [];
  let depth = 0;
  let buf = '';
  const flush = () => {
    if (buf) tokens.push(buf);
    buf = '';
  };
  for (const ch of sel.trim()) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (depth === 0 && /\s/.test(ch)) {
      flush();
      if (tokens[tokens.length - 1] !== ' ') tokens.push(' ');
    } else if (depth === 0 && (ch === '>' || ch === '+' || ch === '~')) {
      flush();
      if (tokens[tokens.length - 1] === ' ') tokens.pop();
      tokens.push(ch);
    } else buf += ch;
  }
  flush();
  const steps: Step[] = [];
  let comb: Step['comb'] = null;
  for (const t of tokens) {
    if (t === ' ' || t === '>' || t === '+' || t === '~') {
      if (t !== ' ' || comb === null) comb = t; // "a > b" tokenises as ' ' '>' ' ': the explicit one wins
      continue;
    }
    steps.push({ comb: steps.length === 0 ? null : (comb ?? ' '), simples: parseCompound(t) });
    comb = null;
  }
  return steps;
}

const targetsAPseudoElement = (steps: Step[]) => steps.some((s) => s.simples.some((x) => x.k === 'element'));

function matchesSimple(el: El, s: Simple): boolean {
  switch (s.k) {
    case 'tag':
      return s.v === '*' || el.tag === s.v;
    case 'class':
      return el.classes.has(s.v);
    case 'id':
      return el.id === s.v;
    case 'attr': {
      if (!el.attrs.has(s.name)) return false;
      const v = el.attrs.get(s.name)!;
      if (s.op === '') return true;
      if (s.op === '=') return v === s.v;
      if (s.op === '^=') return v.startsWith(s.v);
      if (s.op === '$=') return v.endsWith(s.v);
      if (s.op === '*=') return v.includes(s.v);
      if (s.op === '~=') return v.split(/\s+/).includes(s.v);
      return v === s.v || v.startsWith(`${s.v}-`);
    }
    case 'pseudo': {
      if (s.name === 'not') return !splitTop(s.arg ?? '', ',').some((inner) => matchesSelector(el, inner));
      if (s.name === 'is' || s.name === 'where' || s.name === 'matches') return splitTop(s.arg ?? '', ',').some((inner) => matchesSelector(el, inner));
      assert.ok(COULD_MATCH.has(s.name), `pseudo-class this guard does not know: “:${s.name}” — add it to COULD_MATCH, or teach matchesSimple what it means`);
      return true;
    }
    case 'element':
      return false;
  }
}

function matchesFrom(el: El, steps: Step[], i: number): boolean {
  const step = steps[i]!;
  if (!step.simples.every((s) => matchesSimple(el, s))) return false;
  if (i === 0) return true;
  const sibsBefore = () => {
    const sibs = el.parent ? el.parent.children : [];
    return sibs.slice(0, sibs.indexOf(el));
  };
  switch (step.comb) {
    case '>':
      return Boolean(el.parent && el.parent.tag !== '#root' && matchesFrom(el.parent, steps, i - 1));
    case '+': {
      const prev = sibsBefore().pop();
      return Boolean(prev && matchesFrom(prev, steps, i - 1));
    }
    case '~':
      return sibsBefore().some((p) => matchesFrom(p, steps, i - 1));
    default:
      for (let up = el.parent; up && up.tag !== '#root'; up = up.parent) if (matchesFrom(up, steps, i - 1)) return true;
      return false;
  }
}

/** Does ONE complex selector match the element itself (never one of its pseudo-elements)? */
function matchesSelector(el: El, selector: string): boolean {
  const steps = parseComplex(selector);
  if (steps.length === 0 || targetsAPseudoElement(steps)) return false;
  return matchesFrom(el, steps, steps.length - 1);
}

// ── the sheets ──────────────────────────────────────────────────────────────────────────────────────────────────────

const SPACING = /^(margin|padding)(-(top|right|bottom|left|inline|block)(-(start|end))?)?$/;
type SpacingRule = { file: string; selectors: string[]; props: string[] };

function spacingRules(file: string, css: string): SpacingRule[] {
  const out: SpacingRule[] = [];
  postcss.parse(css).walkRules((rule) => {
    const p = rule.parent;
    if (p && p.type === 'atrule' && /keyframes$/.test((p as postcss.AtRule).name)) return;
    const props: string[] = [];
    rule.each((n) => {
      if (n.type === 'decl' && SPACING.test(n.prop.toLowerCase())) props.push(`${n.prop}:${n.value}`);
    });
    if (props.length > 0) out.push({ file, selectors: splitTop(rule.selector, ','), props });
  });
  return out;
}

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (name === 'node_modules' || name.startsWith('.')) return [];
    return statSync(full).isDirectory() ? walk(full) : name.endsWith('.css') ? [full] : [];
  });

/** Every stylesheet of the app that scopes anything under `.onbw`. */
const ONBW_SHEETS = ['app', 'components', 'lib']
  .map((d) => join(WEB, d))
  .filter((d) => existsSync(d))
  .flatMap(walk)
  .map((full) => ({ file: relative(WEB, full), css: readFileSync(full, 'utf8') }))
  .filter((s) => /\.onbw\b/.test(stripComments(s.css)));
const RULES = ONBW_SHEETS.flatMap((s) => spacingRules(s.file, s.css));

// ── the cards, as they render, where they stand ─────────────────────────────────────────────────────────────────────

const SHELL = stripComments(readFileSync(join(WEB, 'app/onboarding/wedding/_components/onboarding-shell.tsx'), 'utf8'));

async function cardMarkups(): Promise<{ name: string; html: string }[]> {
  const { WeddingCard } = await import('../wedding/_components/wedding-cards');
  const { SetupCard } = await import('./setup-card');
  const view = setupViewFor({ ...WEDDING_PROFILE, onboardingEngine: true }, profileSetup(WEDDING_PROFILE), pickableInviteThemes());
  const engine = resolveSetupSteps(view, CREATION_ASKS.wedding).filter((c) => (WEDDING_ENGINE_CARDS as readonly string[]).includes(c));
  assert.deepEqual([...engine].sort(), [...WEDDING_ENGINE_CARDS].sort(), 'the engine no longer resolves the wedding’s photo and look cards');
  const wedding = (card: (typeof WEDDING_CARD_IDS)[number], over: Partial<typeof EMPTY_ONBOARDING_STATE> = {}) =>
    renderToStaticMarkup(
      createElement(WeddingCard, {
        card,
        state: { ...EMPTY_ONBOARDING_STATE, ...over },
        patch: () => {},
        n: 1,
        total: 9,
        activeFaiths: null,
        budgetBands: BUDGET_BANDS_FALLBACK,
        searchVenues: async () => [],
      }),
    );
  return [
    ...WEDDING_CARD_IDS.map((card) => ({ name: card, html: wedding(card) })),
    { name: 'w_kind (church picked — the second menu)', html: wedding('w_kind', { kind: 'religious', faith: ['catholic'] }) },
    { name: 'w_area (we already have our venue)', html: wedding('w_area', { venues: { ...EMPTY_VENUES, open: true } }) },
    ...engine.map((card) => ({
      name: card,
      html: renderToStaticMarkup(createElement(SetupCard, { card, view, answers: { ...setupDefaults(view), photo: 'upload' as const }, onChange: () => {}, onNext: () => {}, n: 7, total: 9 })),
    })),
  ];
}

/** The card inside the wrappers the shell really gives it. */
function standIn(cardId: string, html: string): { root: El; card: El } {
  const root = parseHtml(`<div class="onbw" data-flow-screen="${cardId}"><div class="phone"><div class="body"><section class="screen active" id="screen-${cardId}">${html}</section></div></div></div>`);
  const card = all(root).find((e) => e.attrs.has('data-setup-card'));
  assert.ok(card, `${cardId}: no [data-setup-card] in what rendered — the frame lost the mark the reset stops at`);
  return { root, card };
}

const show = (el: El) => `<${el.tag}${el.id ? `#${el.id}` : ''}${[...el.classes].slice(0, 4).map((c) => `.${c}`).join('')}>`;

type Hit = { card: string; el: string; selector: string; props: string; file: string };
function hits(rules: SpacingRule[], cards: { name: string; html: string }[]): { hits: Hit[]; elements: number } {
  const out: Hit[] = [];
  let elements = 0;
  for (const c of cards) {
    const { card } = standIn(c.name.split(' ')[0]!, c.html);
    for (const el of all(card)) {
      elements++;
      for (const r of rules) for (const sel of r.selectors) if (matchesSelector(el, sel)) out.push({ card: c.name, el: show(el), selector: sel, props: r.props.join(';'), file: r.file });
    }
  }
  return { hits: out, elements };
}

// ── the claims ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('the stand-in wrappers are the shell’s own', () => {
  assert.match(SHELL, /<div className="onbw" data-flow-screen=\{activeId\}>/, 'the shell’s root is no longer <div className="onbw" …>');
  assert.match(SHELL, /<div className="phone"/, 'the shell lost its .phone frame');
  assert.match(SHELL, /<div className="body">/, 'the shell lost its .body scroller');
  const sections = SHELL.match(/<section key=\{card\} className=\{`screen\$\{activeId === card \? ' active' : ''\}`\} id=\{`screen-\$\{card\}`\}>/g) ?? [];
  assert.equal(sections.length, 2, 'the two card mounts (the engine’s and the wedding’s) no longer sit in <section class="screen active" id="screen-…">');
  assert.match(SHELL, /import '\.\.\/_styles\/onboarding\.css';/);
  assert.match(SHELL, /import '\.\.\/_styles\/onboarding-desktop\.css';/);
});

test('no .onbw rule sets a margin or a padding on any element of any setup card', async () => {
  const cards = await cardMarkups();
  const found = hits(RULES, cards);
  assert.ok(ONBW_SHEETS.length >= 2, `only ${ONBW_SHEETS.length} sheet(s) mention .onbw — the walk lost the onboarding sheets`);
  assert.ok(RULES.length >= 300, `only ${RULES.length} margin/padding rules were read from the .onbw sheets — expected the hundreds they hold`);
  assert.ok(cards.length >= 10 && found.elements >= 120, `only ${found.elements} card elements over ${cards.length} renders were walked`);
  const first = found.hits.slice(0, 12).map((h) => `  ${h.card} ${h.el}  ←  ${h.selector} {${h.props}}  (${h.file})`);
  assert.equal(found.hits.length, 0, `${found.hits.length} time(s) an .onbw rule sets a margin or padding on a setup card’s element — the card’s own spacing loses to it:\n${first.join('\n')}`);
});

test('the reset still holds everywhere else under .onbw', async () => {
  const [first] = await cardMarkups();
  const { root, card } = standIn(first!.name, first!.html);
  const resets = RULES.filter((r) => r.props.includes('margin:0') && r.props.includes('padding:0') && r.selectors.some((s) => /^\.onbw \*/.test(s)));
  assert.equal(resets.length, 1, 'the old sheet’s reset (.onbw * … {margin:0;padding:0}) is gone or doubled — the old screens were written against it');
  const outside = all(root).filter((e) => e.tag !== '#root' && !e.classes.has('onbw') && !all(card).includes(e));
  assert.deepEqual(outside.map((e) => [...e.classes][0]), ['phone', 'body', 'screen']);
  for (const el of outside) assert.ok(resets[0]!.selectors.some((s) => matchesSelector(el, s)), `the reset no longer reaches ${show(el)}`);
});

test('the detector can fire: the sheet as it was, a tag rule, a colliding class', async () => {
  const cards = await cardMarkups();
  const total = hits([], cards).elements;
  const asItWas = hits(spacingRules('as-it-was.css', '.onbw *{box-sizing:border-box;margin:0;padding:0}'), cards);
  assert.equal(asItWas.hits.length, total, 'the old universal reset is not seen on every card element — a green above would mean nothing');
  const tagRule = hits(spacingRules('tag.css', '.onbw input{padding:0}.onbw .body > .screen button:hover{margin-top:0}'), cards);
  assert.ok(tagRule.hits.some((h) => h.el.startsWith('<input')), 'a tag rule on the fields is not seen');
  assert.ok(tagRule.hits.some((h) => h.el.startsWith('<button')), 'a child-combinator + :hover rule on the buttons is not seen');
  const collide = hits(spacingRules('collide.css', '.onbw .flex{padding:0 10px}'), cards);
  assert.ok(collide.hits.length > 0, 'an old class with a Tailwind name is not seen');
  const fenced = hits(spacingRules('fenced.css', '.onbw *:not(:where([data-setup-card],[data-setup-card] *)){margin:0;padding:0}.onbw .songbank .song-seg > button{padding:0 10px}.onbw .field::placeholder{padding:0}'), cards);
  assert.equal(fenced.hits.length, 0, 'the fenced reset, a rule scoped to another screen, or a pseudo-element rule is wrongly reported');
});
