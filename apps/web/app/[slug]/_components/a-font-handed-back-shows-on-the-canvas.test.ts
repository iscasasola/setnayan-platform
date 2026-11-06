/**
 * a-font-handed-back-shows-on-the-canvas.test.ts — 🪆 TEXT AND LABELS & BUTTONS, HANDED BACK ("Event Hub font") IN THE
 * MAKER, SHOW HANDED BACK ON THE CANVAS — NOT THE LIVE FONT UNTIL APPLY (2026-10-18).
 *
 * The Names font had this fixed on 2026-10-17 (`the-names-font-reaches-every-name.test.ts`: the canvas's drafted look
 * is a SECOND scope inside the layout's, so the nearest worn scope must decide). Its builder named Text and Labels &
 * buttons as the same gap, not walked. Walked 2026-10-18 on the REAL guest markup under the app's compiled CSS, in the
 * canvas's two scopes (Chromium + WebKit, PR shots): handed back over a live pick, the buttons stayed the live face
 * (Classic and a theme), a theme's eyebrows stayed it, and on Classic the text stayed it. Held here, on the rules'
 * own selector text, evaluated by a small matcher against every way the scopes nest:
 *   (1) the eyebrow and button rules hold exactly where the nearest worn scope chose the font;
 *   (2) Text: a worn Classic scope without the mark, inside one with it, takes back the page's own face (what `<body>`'s
 *       `font-sans` resolves to, captured on `body`); a theme's scope (it sets its own) and a scope that chose Text are
 *       left alone; and the Text rule itself is still the one on the scope.
 * NOT TESTED HERE: a browser computing the face — the walk is in the PR.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const CSS = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));

/* ── a small selector matcher: tag, `.class`, `[attr]`, `[attr~='w']`, `:not(<list>)`, `:is(<list>)`, descendant ── */
type El = Record<string, string>; // attributes; `#tag` is the tag name, `class` the classes
type Compound = { tag?: string; classes: string[]; attrs: Array<{ name: string; word?: string }>; nots: Complex[][]; ises: Complex[][] };
type Complex = Compound[];

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
const parseList = (s: string): Complex[] => splitTop(s, ',').map((c) => splitTop(c, ' ').map(parseCompound));
function parseCompound(s: string): Compound {
  const c: Compound = { classes: [], attrs: [], nots: [], ises: [] };
  let rest = s.trim();
  const tag = /^[a-z][a-z0-9]*/.exec(rest);
  if (tag) {
    c.tag = tag[0];
    rest = rest.slice(tag[0].length);
  }
  while (rest) {
    if (rest.startsWith('*')) rest = rest.slice(1);
    else if (rest.startsWith('.')) {
      const m = /^\.([a-zA-Z0-9_-]+)/.exec(rest)!;
      c.classes.push(m[1]!);
      rest = rest.slice(m[0].length);
    } else if (rest.startsWith('[')) {
      const end = rest.indexOf(']');
      const m = /^([a-z-]+)(?:~='([^']*)')?$/.exec(rest.slice(1, end));
      assert.ok(m, `the matcher cannot read ${rest.slice(0, end + 1)}`);
      c.attrs.push({ name: m[1]!, ...(m[2] !== undefined ? { word: m[2] } : {}) });
      rest = rest.slice(end + 1);
    } else if (rest.startsWith(':not(') || rest.startsWith(':is(')) {
      const open = rest.indexOf('(');
      let depth = 0;
      let i = open;
      for (; i < rest.length; i += 1) {
        if (rest[i] === '(') depth += 1;
        if (rest[i] === ')' && (depth -= 1) === 0) break;
      }
      (rest.startsWith(':not(') ? c.nots : c.ises).push(parseList(rest.slice(open + 1, i)));
      rest = rest.slice(i + 1);
    } else assert.fail(`the matcher cannot read "${rest}"`);
  }
  return c;
}
function matchesCompound(c: Compound, chain: El[], at: number): boolean {
  const el = chain[at]!;
  if (c.tag && el['#tag'] !== c.tag) return false;
  const classes = (el.class ?? '').split(/\s+/);
  if (!c.classes.every((k) => classes.includes(k))) return false;
  for (const a of c.attrs) {
    if (!(a.name in el)) return false;
    if (a.word !== undefined && !el[a.name]!.split(/\s+/).includes(a.word)) return false;
  }
  if (!c.ises.every((list) => list.some((cx) => matchesComplex(cx, chain, at)))) return false;
  return c.nots.every((list) => !list.some((cx) => matchesComplex(cx, chain, at)));
}
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
const matches = (selectorList: string, chain: El[]) => parseList(selectorList).some((cx) => matchesComplex(cx, chain, chain.length - 1));

/** Every rule (selector, body) that sets `prop` to a value matching `value`. */
const rulesSetting = (prop: string, value: RegExp) =>
  [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((m) => ({ selector: m[1]!.trim().replace(/\s+/g, ' '), body: m[2]!.replace(/\s+/g, ' ').trim() }))
    .filter((r) => new RegExp(`(^|;)\\s*${prop}\\s*:\\s*${value.source}`).test(r.body));

/* Scopes as the pages wear them (`GuestLookScope`): the layout's, then — on the canvas — `HostDraftLook`'s inside it. */
const scope = (roles: string | null, opts: { worn?: boolean; theme?: string } = {}): El => ({
  '#tag': 'div',
  class: 'sn-editorial contents text-ink',
  ...(opts.worn === false ? {} : { 'data-guest-look': '' }),
  ...(opts.theme ? { 'data-hub-theme': opts.theme } : {}),
  ...(roles ? { 'data-hub-roles': roles } : {}),
});
const CASES = (mark: string): Array<[string, El[], boolean]> => [
  ['a guest page, the font chosen', [scope(`names ${mark}`)], true],
  ['a guest page, nothing chosen', [scope(null)], false],
  ['a guest page, other fonts chosen', [scope('names body')], false],
  ['no look scope at all', [], false],
  ['the canvas: live has it, the draft agrees', [scope(mark), scope(`${mark} names`)], true],
  ['the canvas: live has none, the draft chooses it', [scope(null), scope(mark)], true],
  ['the canvas: live has it, the draft hands it back', [scope(mark), scope('names')], false],
  ['the canvas: live has it, the draft hands every font back', [scope(mark), scope(null)], false],
  ['the canvas on a theme: live has it, the draft hands it back', [scope(mark, { theme: 'galeriya' }), scope(null, { theme: 'galeriya' })], false],
  ['a scope that is not worn is transparent', [scope(mark), scope(null, { worn: false })], true],
];

test('(1) LABELS & BUTTONS: the eyebrow and button rules hold exactly where the NEAREST worn scope chose the font', () => {
  const eyebrowRules = rulesSetting('font-family', /var\(--font-mono\)/).filter((r) => r.selector.includes("data-hub-roles~='eyebrow'"));
  const buttonRules = rulesSetting('font-family', /var\(--hub-role-button-font\)/);
  assert.equal(eyebrowRules.length, 1, `the eyebrow's Labels rule: ${JSON.stringify(eyebrowRules)}`);
  assert.equal(buttonRules.length, 1, `the buttons' Labels rule: ${JSON.stringify(buttonRules)}`);
  const targets: Array<[string, string, El[]]> = [
    [eyebrowRules[0]!.selector, 'eyebrow', [{ '#tag': 'p', class: 'pahina-eyebrow' }]],
    [buttonRules[0]!.selector, 'button', [{ '#tag': 'a', class: 'button-primary flex' }]],
    [buttonRules[0]!.selector, 'button', [{ '#tag': 'button', class: 'button-secondary' }]],
    [buttonRules[0]!.selector, 'button', [{ '#tag': 'label', 'data-rsvp-answer': 'yes' }]],
    [buttonRules[0]!.selector, 'button', [{ '#tag': 'div', 'data-arrival-action': '' }, { '#tag': 'a', class: 'bg-mulberry' }]],
  ];
  let checked = 0;
  for (const [selector, mark, el] of targets) {
    for (const [where, scopes, expected] of CASES(mark)) {
      assert.equal(matches(selector, [...scopes, ...el]), expected, `${mark} · ${el.map((e) => e.class ?? e['#tag']).join(' ')}: ${where}`);
      checked += 1;
    }
    /* Nothing else moves: a plain text or a `font-mono` utility is never a Labels target. */
    assert.equal(matches(selector, [scope(mark), { '#tag': 'p', class: 'font-mono' }]), false, `${mark}: a font-mono text moved`);
  }
  assert.equal(checked, targets.length * CASES('x').length);
});

test('(2) TEXT: a worn Classic scope without the mark, inside one with it, takes back the page’s own face — and only that scope', () => {
  const resets = rulesSetting('font-family', /var\(--hub-page-text-face\)/);
  assert.equal(resets.length, 1, `the Text hand-back rule: ${JSON.stringify(resets)}`);
  const reset = resets[0]!;
  assert.match(reset.body, /--font-sans:\s*var\(--hub-page-text-face\)/, 'the hand-back leaves `font-sans` texts on the live face');
  /* The page's own face is what `<body>`'s `font-sans` resolves to, captured on `body`. */
  assert.ok(rulesSetting('--hub-page-text-face', /var\(--font-sans\)/).some((r) => r.selector === 'body'), 'the page’s own text face is not captured on body');
  assert.match(stripComments(readFileSync(join(WEB, 'app/layout.tsx'), 'utf8')), /<body className="[^"]*\bfont-sans\b/, 'body no longer takes its face from `font-sans` — the capture names the wrong face');
  /* The Text rule itself is still the scope's own. */
  assert.ok(rulesSetting('font-family', /var\(--font-body\)/).some((r) => r.selector === "[data-hub-roles~='body']"));
  const cases: Array<[string, El[], boolean]> = [
    ['the canvas, Classic: live has Text, the draft hands it back', [scope('body'), scope(null)], true],
    ['…the draft keeps other fonts', [scope('body names'), scope('names eyebrow button')], true],
    ['the canvas, Classic: the draft agrees', [scope('body'), scope('body')], false],
    ['the canvas on a theme (its own block sets the face)', [scope('body', { theme: 'galeriya' }), scope(null, { theme: 'galeriya' })], false],
    ['a guest page, one scope', [scope('body')], false],
    ['a guest page, nothing chosen', [scope(null)], false],
    ['live has none, the draft chooses Text', [scope(null), scope('body')], false],
    ['a scope that is not worn', [scope('body'), scope(null, { worn: false })], false],
  ];
  for (const [where, chain, expected] of cases) assert.equal(matches(reset.selector, chain), expected, where);
});
