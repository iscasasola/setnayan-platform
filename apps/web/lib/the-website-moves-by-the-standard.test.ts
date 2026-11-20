/**
 * the-website-moves-by-the-standard.test.ts — 🌐 THE PUBLIC PAGES' MOTION (motion standard § 6, Phase 5; specs
 * `MOTION_STANDARD_2026-11-18.md`; owner 18 Nov 2026: *"one moving background max"*, off on phones).
 *
 * The public pages — `/`, /for-suppliers, /for-coordinators, /features and a shop at /v/… (/pricing has no sheet of its
 * own) — wear six named motions: Reveal · Timeline · Hero settle · Scroll-away · Emphasis · Drift. Their keyframes and
 * tokens are the `sn-w-*` block in `app/globals.css`. This file reads each page's OWN stylesheets (it cannot see a
 * global class a component on the page happens to wear) and holds five claims:
 *
 *   1 · ONE SOURCE — a CSS module cannot read a global keyframe, so the module sheets carry copies; every `sn-w-*`
 *       keyframe anywhere is letter-for-letter the one in globals.css, every one a sheet plays is defined where that
 *       sheet can read it, and the tokens are the standard's numbers.
 *   2 · AT MOST ONE DRIFT A PAGE, NEVER ON A PHONE — a page's sheets declare at most one endless (`infinite`) loop,
 *       and it sits under `@media (min-width: 641px) and (prefers-reduced-motion: no-preference)`.
 *   3 · TRANSFORM AND OPACITY ONLY — no keyframe in a website sheet animates a filter or a layout property.
 *   4 · CONTENT IS VISIBLE WITHOUT ANIMATION — a rule may hide a part (opacity 0, a zero scale) only behind a marker
 *       the page's script sets, or as one of the named interface states below; no animation is filled `both` or
 *       `forwards` (the resting state is the base style); every `sn-w-*` keyframe is one-ended.
 *   5 · THE SCROLL PATH IS FENCED — a scroll timeline appears only under `@supports (animation-timeline: view())`
 *       and, because the global reduced-motion freeze cannot stop a scroll-driven animation, only under
 *       `prefers-reduced-motion: no-preference` (or forced back to `auto` in a reduced-motion block).
 *
 * Seen RED (2026-11-18), each then restored — the sabotage list is in changelog.d/claude-motion-website.md.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Each public page → its own stylesheets. `module: true` = a CSS module (keyframes are local to the file). */
const PAGES: Record<string, Array<{ file: string; module: boolean }>> = {
  '/': [
    { file: 'app/_components/frontdoor/front-door-landing.css', module: false },
    { file: 'app/_components/frontdoor/front-door.css', module: false },
  ],
  '/for-suppliers': [{ file: 'app/for-suppliers/_components/supplier-front.module.css', module: true }],
  '/for-coordinators': [{ file: 'app/(shell)/for-coordinators/_for-coordinators.css', module: false }],
  '/features': [{ file: 'app/features/features-story.module.css', module: true }],
  '/v/[slug]': [
    { file: 'app/v/[slug]/_components/shop-motion.module.css', module: true },
    { file: 'app/v/[slug]/_components/shop-end.css', module: false },
  ],
};
/** The sheets this phase moved onto the named motions (front-door.css is the shell's; shop-end.css the shop's foot). */
const ADOPTED = new Set([
  'app/_components/frontdoor/front-door-landing.css',
  'app/for-suppliers/_components/supplier-front.module.css',
  'app/(shell)/for-coordinators/_for-coordinators.css',
  'app/features/features-story.module.css',
  'app/v/[slug]/_components/shop-motion.module.css',
]);
const SHEETS = Object.values(PAGES).flat();
const GLOBALS = read('app/globals.css');

type Rule = { selector: string; body: string; at: string[] };
type Keyframes = { name: string; body: string };

/** Walk a stylesheet: leaf style rules with the at-rules around them, and each `@keyframes` block whole. */
function walk(css: string): { rules: Rule[]; keyframes: Keyframes[] } {
  const rules: Rule[] = [];
  const keyframes: Keyframes[] = [];
  const go = (src: string, at: string[]) => {
    let i = 0;
    while (i < src.length) {
      const open = src.indexOf('{', i);
      if (open < 0) break;
      // A declaration-only tail before the next block (`a: b;`) is not part of the prelude.
      const prelude = src.slice(i, open).split(';').pop()!.trim();
      let depth = 1;
      let j = open + 1;
      while (j < src.length && depth > 0) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const body = src.slice(open + 1, j - 1);
      const kf = /^@(?:-webkit-)?keyframes\s+(\S+)/.exec(prelude);
      if (kf) keyframes.push({ name: kf[1]!, body });
      else if (prelude.startsWith('@')) go(body, [...at, prelude.replace(/\s+/g, ' ')]);
      else rules.push({ selector: prelude.replace(/\s+/g, ' '), body, at });
      i = j;
    }
  };
  go(css, []);
  return { rules, keyframes };
}

const norm = (s: string) => s.replace(/\s+/g, '').replace(/;}/g, '}').replace(/;$/, '');
const parsed = new Map(SHEETS.map((s) => [s.file, walk(read(s.file))]));
const globalKeyframes = new Map(walk(GLOBALS).keyframes.map((k) => [k.name, k.body]));

/** The value of each `animation` / `animation-name` declaration in a rule body. */
const animationValues = (body: string) =>
  [...body.matchAll(/(?<![\w-])animation(?:-name)?\s*:\s*([^;}]+)/g)].map((m) => m[1]!);

// ── 1 · ONE SOURCE ──────────────────────────────────────────────────────────────────────────────────────────────────
const NAMED = [
  'sn-w-reveal', 'sn-w-fade', 'sn-w-hero-img', 'sn-w-hero-line', 'sn-w-away', 'sn-w-underline', 'sn-w-stamp',
  'sn-w-tl-line', 'sn-w-tl-line-x', 'sn-w-tl-dot', 'sn-w-drift', 'sn-w-drift-x',
];

test('the six named motions are defined once, in globals.css, on the standard’s numbers', () => {
  for (const n of NAMED) assert.ok(globalKeyframes.has(n), `globals.css lost @keyframes ${n}`);
  const token = (name: string) => new RegExp(`${name}:\\s*([^;]+);`).exec(GLOBALS)?.[1]?.trim();
  assert.equal(token('--sn-w-rise'), '12px', 'Reveal travels 12 px');
  assert.equal(token('--sn-w-stagger'), '60ms', 'Reveal neighbours are 60 ms apart');
  assert.equal(token('--sn-w-hero-gap'), '80ms', 'Hero settle: lines 80 ms apart');
  assert.equal(token('--sn-w-hero-from'), '1.06', 'Hero settle: the picture starts at 1.06');
  assert.equal(token('--sn-w-away-fade'), '0.4', 'Scroll-away fades to 40 %');
  assert.equal(token('--sn-w-away-lift'), '-24px', 'Scroll-away lifts 24 px');
});

test('every copy of a named motion equals the one in globals.css, and every one played can be read', () => {
  let copies = 0;
  let plays = 0;
  for (const s of SHEETS) {
    const { rules, keyframes } = parsed.get(s.file)!;
    const local = new Set(keyframes.map((k) => k.name));
    for (const k of keyframes) {
      if (!k.name.startsWith('sn-w-')) continue;
      copies++;
      assert.ok(globalKeyframes.has(k.name), `${s.file}: @keyframes ${k.name} is not one of the named motions in globals.css`);
      assert.equal(norm(k.body), norm(globalKeyframes.get(k.name)!), `${s.file}: its copy of @keyframes ${k.name} drifted from globals.css`);
    }
    for (const r of rules) {
      for (const v of animationValues(r.body)) {
        for (const name of v.match(/(?<![\w-])sn-w-[a-z-]+/g) ?? []) {
          plays++;
          assert.ok(globalKeyframes.has(name), `${s.file}: plays ${name}, which globals.css does not define`);
          if (s.module) assert.ok(local.has(name), `${s.file}: a CSS module plays ${name} but carries no copy of it — it would animate nothing`);
        }
      }
    }
  }
  assert.ok(copies >= 10 && plays >= 20, `premise: found ${copies} copies and ${plays} plays — the scan is not reading the sheets`);
});

// ── 2 · AT MOST ONE DRIFT A PAGE, NEVER ON A PHONE ──────────────────────────────────────────────────────────────────
const isEndless = (body: string) =>
  animationValues(body).some((v) => /\binfinite\b/.test(v)) || /animation-iteration-count\s*:\s*infinite/.test(body);

test('a public page has at most ONE endless loop, and none at 640 px or narrower or under reduced motion', () => {
  let seen = 0;
  for (const [page, sheets] of Object.entries(PAGES)) {
    const loops: string[] = [];
    for (const s of sheets) {
      for (const r of parsed.get(s.file)!.rules) {
        if (!isEndless(r.body)) continue;
        loops.push(`${s.file} → ${r.selector}`);
        const at = r.at.join(' | ');
        const min = /min-width:\s*(\d+)px/.exec(at);
        assert.ok(min && Number(min[1]) >= 641, `${page}: the loop on "${r.selector}" plays on a phone — put it under @media (min-width: 641px)`);
        assert.match(at, /prefers-reduced-motion:\s*no-preference/, `${page}: the loop on "${r.selector}" plays under reduced motion`);
      }
    }
    seen += loops.length;
    assert.ok(loops.length <= 1, `${page} has ${loops.length} endless loops — the owner's rule is one moving background at most:\n  ${loops.join('\n  ')}`);
  }
  // Premise — the scan reads every page's sheets. It counts RULES, not loops: the owner's rule is "one moving background
  // AT MOST", so a page may honestly draw none (the 20 Nov /for-suppliers drawing has no Drift). A loop count here broke
  // the first time a redrawn page followed its drawing.
  for (const [page, sheets] of Object.entries(PAGES)) {
    const rules = sheets.reduce((n, sh) => n + parsed.get(sh.file)!.rules.length, 0);
    assert.ok(rules >= 10, `premise: ${page} parsed only ${rules} rules — the scan is not reading its sheets`);
  }
  assert.ok(seen >= 1, `premise: no Drift loop found on any public page — the loop detector is not matching`);
});

// ── 2b · EVERY MOTION ON THE STANDARD'S TOKENS; THE ONE LOOP IS ROW 43'S DRIFT ─────────────────────────────────────
/**
 * MOTION_STANDARD_2026-11-18 § 2 (the tokens) and § 6 row 43 (Drift: "20 s+ loop · ease in-out · one background per
 * public page at most, desktop only · off; also off on phones"). On every adopted sheet:
 *   · an animation or transition names no raw duration and no raw easing — it reads the `--sn-*` tokens (Tap · Quick ·
 *     Release · Move · Rise · Settle · Spring …), or is `linear` (a scroll-driven motion, whose length is the scroll);
 *   · the ONE exception is an endless loop, which must be a Drift: 20 s or longer, `ease-in-out` — or the Sheen token.
 * Where it sits (desktop only, off under reduced motion, one a page) is the test above.
 * ⏳ /for-suppliers' sheet on THIS branch is main's pre-redraw one; its redraw (PR #8050) moves it onto the tokens and
 * empties TOKENS_LATER. (On #8050 the mirror entry is this page's old sheet.) Nothing else may be added here to go green.
 */
const TOKENS_LATER = new Set(['app/for-suppliers/_components/supplier-front.module.css']);
/** Strip every `var(--sn-…)` (with any fallback, however nested) — what is left is what the sheet typed itself. */
function untokened(v: string): string {
  let out = v;
  for (let i = 0; i < 6; i++) out = out.replace(/var\(\s*--sn-[\w-]+\s*(?:,[^()]*(?:\([^()]*\)[^()]*)*)?\)/g, ' TOKEN ');
  return out;
}
const RAW_TIME = /(?<![\w-])(\d*\.?\d+)(ms|s)\b/g;
const RAW_EASE = /(?<![\w-])(ease-in-out|ease-in|ease-out|ease|cubic-bezier\([^)]*\)|linear\([^)]*\)|steps\([^)]*\)|step-start|step-end)(?![\w-])/g;
const motionValues = (body: string) =>
  [...body.matchAll(/(?<![\w-])(animation|transition)(?:-duration|-timing-function|-delay)?\s*:\s*([^;}]+)/g)].map((m) => ({
    prop: m[1]!,
    value: m[2]!.trim(),
  }));

export function offStandard(sheet: string, rules: Rule[]): string[] {
  const bad: string[] = [];
  for (const r of rules) {
    for (const { prop, value } of motionValues(r.body)) {
      if (/^none\b/.test(value)) continue;
      const left = untokened(value);
      // A page's own alias (`var(--sf-ease)`) is a typed easing with a name on it. A stagger counter — a var with a plain
      // number for its fallback (`var(--i, 0)`) — is a multiplier, not a speed.
      const bare = left.replace(/var\(\s*--[\w-]+\s*,\s*-?\d*\.?\d+\s*\)/g, ' N ');
      if (/var\(\s*--/.test(bare)) bad.push(`${sheet} → ${r.selector}: ${prop} reads a page alias, not a --sn-* token — "${value}"`);
      const times = [...left.matchAll(RAW_TIME)].map((m) => Number(m[1]) * (m[2] === 's' ? 1000 : 1));
      const eases = [...left.matchAll(RAW_EASE)].map((m) => m[1]!);
      const endless = prop === 'animation' && /\binfinite\b/.test(value);
      if (endless) {
        const sheen = /var\(\s*--sn-m-sheen\b/.test(value) && eases.every((e) => e === 'linear');
        const drift = times.length >= 1 && times[0]! >= 20000 && times.slice(1).every((t) => t === 0) && eases.length === 1 && eases[0] === 'ease-in-out';
        if (!sheen && !drift) bad.push(`${sheet} → ${r.selector}: the loop "${value}" is not row 43's Drift (20 s+, ease-in-out)`);
        continue;
      }
      if (times.some((t) => t > 0)) bad.push(`${sheet} → ${r.selector}: ${prop} types a duration — "${value}"; read a --sn-m-* token`);
      if (eases.some((e) => e !== 'linear' || times.some((t) => t > 0))) bad.push(`${sheet} → ${r.selector}: ${prop} types an easing — "${value}"; read --sn-m-settle / --sn-m-spring`);
    }
  }
  return bad;
}

test('every motion on a public page reads the standard’s tokens, and its one loop is row 43’s Drift', () => {
  let checked = 0;
  const bad: string[] = [];
  for (const s of SHEETS) {
    if (!ADOPTED.has(s.file) || TOKENS_LATER.has(s.file)) continue;
    const rules = parsed.get(s.file)!.rules;
    checked += rules.reduce((n, r) => n + motionValues(r.body).length, 0);
    bad.push(...offStandard(s.file, rules));
  }
  assert.deepEqual(bad, [], 'a public page moves off the standard');
  assert.ok(checked >= 40, `premise: only ${checked} animation/transition declarations read`);
  // The checker itself, on what it must refuse and what it must pass — so a regex that matches nothing cannot go green.
  const r = (body: string): Rule => ({ selector: '.x', body, at: [] });
  assert.equal(offStandard('t', [r('animation: sn-w-drift 6s ease-in-out infinite alternate')]).length, 1, 'a 6 s loop passed as a Drift');
  assert.equal(offStandard('t', [r('animation: sn-w-drift 20s linear infinite')]).length, 1, 'a linear loop passed as a Drift');
  assert.equal(offStandard('t', [r('transition: transform .2s ease-out')]).length, 2, 'a typed duration and easing passed');
  assert.equal(offStandard('t', [r('animation: x var(--sn-m-move) cubic-bezier(.3,0,.3,1) backwards')]).length, 1, 'a typed curve passed');
  assert.equal(offStandard('t', [r('transition: transform var(--sn-m-quick) var(--fc-ease)')]).length, 1, 'a page alias passed as a token');
  assert.deepEqual(offStandard('t', [r('animation: sn-w-reveal var(--sn-m-move) var(--sn-m-settle) calc(min(var(--i, 0), 5) * var(--sn-w-hero-gap)) backwards')]), []);
  assert.deepEqual(offStandard('t', [r('animation: sn-w-drift 20s ease-in-out infinite alternate')]), []);
  assert.deepEqual(offStandard('t', [r('transition: transform var(--sn-m-release, .2s) var(--sn-m-settle, cubic-bezier(.2,.8,.2,1))')]), []);
  assert.deepEqual(offStandard('t', [r('animation: sn-w-reveal linear backwards')]), []);
});

// ── 3 · TRANSFORM AND OPACITY ONLY ──────────────────────────────────────────────────────────────────────────────────
const FORBIDDEN =
  /(?<![\w-])(filter|backdrop-filter|width|height|min-width|min-height|max-width|max-height|top|left|right|bottom|inset|margin(?:-\w+)?|padding(?:-\w+)?|grid-template-rows|grid-template-columns|background-position|font-size|line-height|flex-basis|gap)\s*:/g;

test('no keyframe on a public page animates a filter or a layout property', () => {
  let n = 0;
  const check = (where: string, k: Keyframes) => {
    n++;
    const bad = [...k.body.matchAll(FORBIDDEN)].map((m) => m[1]);
    assert.deepEqual(bad, [], `${where}: @keyframes ${k.name} animates ${bad.join(', ')} — transform and opacity only`);
  };
  for (const s of SHEETS) for (const k of parsed.get(s.file)!.keyframes) check(s.file, k);
  for (const name of NAMED) check('app/globals.css', { name, body: globalKeyframes.get(name) ?? '' });
  assert.ok(n >= 30, `premise: only ${n} keyframes read`);
});

// ── 4 · CONTENT IS VISIBLE WITHOUT ANIMATION ────────────────────────────────────────────────────────────────────────
/** A marker only the page's own script sets: a rule behind one cannot hide anything on a page with no script. */
const SCRIPT_MARKERS = ['[data-fl-motion]', '[data-motion]', '[data-fc-motion]', '[data-shop-js]', '.fc-rv'];
/**
 * Interface states that are hidden by design — the slide that is not showing, a dock before it is called, a label
 * that swaps. None is content waiting for an animation. A NEW hidden rule is not added here to go green: put it behind
 * the page's script marker, with a `from`-only keyframe.
 */
const HIDDEN_BY_DESIGN = new Set<string>([
  // the front page: the slideshow's other slides, the word that swaps, the sample phone's other screen and its hint
  '.fd .fl-slide', '.fd .fl-word-out', '.fd .fl-scrolled .fl-scrollhint', '.fd .fl-screen',
  // for-suppliers / for-coordinators: the hero's other slides, the scroll hint once used, the dock before it is called
  '.slide', '.hintGone', '.dock', '.fc .fc-slide', '.fc .fc-hint.fc-gone', '.fc .fc-dock',
  // the features story: the switch's "on" label before it flips, and "off" after
  '.wOn', '.mo[data-on] .swGo .wOff',
]);
const hides = (body: string) =>
  /(?<![\w-])opacity\s*:\s*0(?![.\d])/.test(body) || /scale[XY]?\(\s*0\s*\)/.test(body);

test('a part is hidden only behind the page’s script marker (or as a named interface state)', () => {
  let gated = 0;
  const loose: string[] = [];
  for (const s of SHEETS) {
    if (!ADOPTED.has(s.file)) continue;
    for (const r of parsed.get(s.file)!.rules) {
      if (!hides(r.body)) continue;
      for (const sel of r.selector.split(',').map((x) => x.trim())) {
        if (SCRIPT_MARKERS.some((m) => sel.includes(m))) gated++;
        else if (!HIDDEN_BY_DESIGN.has(sel)) loose.push(`${s.file}: ${sel}`);
      }
    }
  }
  assert.deepEqual(
    loose,
    [],
    'these rules hide a part with no script marker — on a page with no script, or no animation support, it would never be seen',
  );
  assert.ok(gated >= 12, `premise: only ${gated} script-gated hidden rules found`);
});

test('no adopted sheet fills an animation both / forwards, and the named motions are one-ended', () => {
  for (const s of SHEETS) {
    if (!ADOPTED.has(s.file)) continue;
    for (const r of parsed.get(s.file)!.rules) {
      for (const v of [...r.body.matchAll(/(?<![\w-])animation(?:-fill-mode)?\s*:\s*([^;}]+)/g)].map((m) => m[1]!)) {
        assert.doesNotMatch(v, /\b(both|forwards)\b/, `${s.file}: "${r.selector}" fills ${v.trim()} — the resting state is the base style; fill backwards`);
      }
    }
  }
  for (const name of NAMED) {
    const body = globalKeyframes.get(name) ?? '';
    const stops = [...body.matchAll(/([\w%.,\s]+)\{/g)].map((m) => m[1]!.trim());
    assert.equal(stops.length, 1, `@keyframes ${name} must say one end only (from, or to) so the base style is the other`);
  }
});

// ── 5 · THE SCROLL PATH IS FENCED ───────────────────────────────────────────────────────────────────────────────────
test('a scroll timeline sits under @supports and never plays under reduced motion', () => {
  let n = 0;
  for (const s of SHEETS) {
    for (const r of parsed.get(s.file)!.rules) {
      const m = /(?<![\w-])(?:animation|view)-timeline\s*:\s*([^;}]+)/.exec(r.body);
      if (!m) continue;
      const at = r.at.join(' | ');
      if (/prefers-reduced-motion:\s*reduce/.test(at)) {
        assert.match(m[1]!, /^auto\b/, `${s.file}: a reduced-motion block may only switch the timeline off`);
        continue;
      }
      n++;
      assert.match(at, /@supports \(animation-timeline: view\(\)\)/, `${s.file}: "${r.selector}" uses a scroll timeline outside @supports`);
      assert.match(at, /prefers-reduced-motion:\s*no-preference/, `${s.file}: "${r.selector}" rides the scroll under reduced motion — the global freeze cannot stop it`);
      if (/animation-timeline/.test(r.body)) {
        assert.match(r.body, /animation\s*:[^;]*\bbackwards\b/, `${s.file}: "${r.selector}" must fill backwards so nothing lingers after the range`);
      }
    }
  }
  assert.ok(n >= 10, `premise: only ${n} scroll-timeline rules found`);
});
