/**
 * A FLIPPING TOKEN TAKES NO `dark:` OVERRIDE THAT FLIPS IT BACK (2026-11-07).
 *
 * The sibling of `a-mirrored-ramp-takes-no-dark-override.test.ts` (PR #7377), which covers the colour LADDERS
 * (success / warn / danger / info / terracotta / mulberry / gold / champagne / sage). This one covers the THEMED
 * tokens: `cream`, `paper`, `ink`, `ink-soft`, `ink-on-plate`, `raised`, `link`, `accent*`, `surface*`, `sn-*`,
 * `burgundy`, all of them read from tailwind.config.ts, never hand-typed.
 *
 * THE MECHANISM. Those tokens read a CSS variable (`--color-cream`, `--color-ink` …) that `globals.css`
 * redeclares under `html.dark`. So `text-cream` is already the dark #17160F on the dark page and `bg-ink` is
 * already the light #FBFAF7. The token does the flip by itself.
 *
 * THE BUG. A `dark:` override written as "in dark, swap to the opposite token" now flips it BACK:
 * `bg-ink text-cream dark:bg-cream dark:text-ink` paints the button the page's own colour in dark, so its
 * fill disappears (1.00:1 against the page, 1.12:1 against a card), where the plain tokens would have given
 * a light pill at 17.37:1 (supplier-answers-form's "Save answers", fixed in the PR that added this guard).
 *
 * THE RULE, MEASURED, NOT GUESSED. In one string literal, a `dark:` class on a themed token is a flip-back when
 *   1. the same string has the base class for the same property and variants (`!` ignored), on a token whose
 *      light and dark values sit on opposite sides of the luminance midpoint (L = 0.179, where a colour reads
 *      equally against black and white), i.e. the base ALREADY flips; and
 *   2. the override's DARK value lands on the same side as the base's LIGHT value, so it undoes the flip.
 * A base that does not flip (`bg-white dark:bg-raised`, `text-white dark:text-cream` on a lightened fill) is a
 * pairing, not a flip-back, and is never flagged. Neither is a same-token alpha step (`border-ink/12
 * dark:border-ink/15`) or a dark-to-dark lift (`bg-cream dark:bg-raised`).
 *
 * A flagged class is a defect unless ALLOW names it with its measured contrast (a deliberate re-flip, such as
 * white words that would otherwise sit on a light slab). Files other open PRs were rewriting when this shipped
 * would go in DEBT with their count, which may only fall (empty on 2026-11-07: no flagged file was in an open PR).
 *
 * Values are read from `:root` and `html.dark` in globals.css, resolving `var()` chains and fallbacks.
 * Comments are stripped first (`strip-comments`), so a class named in a comment is never counted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import tailwindConfig from '../tailwind.config';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const THIS = relative(WEB, fileURLToPath(import.meta.url));

/**
 * Deliberate re-flips, measured. Key = `<file>|<exact dark: class>`, value = how many times it appears in that
 * file + why. Dark values from globals.css `html.dark`: page #17160F, card (raised) #232019, ink #FBFAF7,
 * cream #17160F.
 */
const ALLOW: Record<string, { count: number; why: string }> = {
  'app/dashboard/(account)/life-flash/_components/flash.tsx|dark:bg-raised': {
    count: 1,
    why:
      'The "Play your Life-Flash" launcher sets WHITE words (text-white) on bg-ink. Deleted, the mirrored bg-ink is ' +
      '#FBFAF7 in dark → white words 1.04:1 (unreadable). With dark:bg-raised (#232019) → 16.25:1.',
  },
  'app/dashboard/[eventId]/launch/_components/look-sample.tsx|dark:text-ink-on-plate': {
    count: 1,
    why:
      'Words on bg-paper-deep, which never darkens with the page. Deleted, text-ink is #FBFAF7 in dark → 1.08:1 on ' +
      'the plate (#F1F1F0). With dark:text-ink-on-plate (#2C2A29) → 12.64:1.',
  },
  'app/_components/toast/peek-toast.tsx|dark:text-ink': {
    count: 1,
    why:
      'The "bad" toast fill is color-mix(--color-danger 68%, black): in dark #A5584F. Deleted, text-cream is #17160F ' +
      'there → 3.54:1 (fails AA). With dark:text-ink (#FBFAF7) → 4.90:1.',
  },
  // ✂ next-card.tsx's four day-card overrides left with the file (THE ONE BUILD, 8 Nov — the supplier Today's Next card,
  // its last mount, is retired; `ugat-both-ends` said: mount it or delete it).
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:bg-raised': {
    count: 1,
    why:
      'The floating cart bar is a dark card in dark on purpose (with its own dark:ring-ink/15 edge), not a white ' +
      'slab over the page. Its words follow it: dark:text-ink on #232019 → 15.57:1. Deleting every override together ' +
      'would read 17.37:1 on a light slab, so both read; the dark card is the design, kept.',
  },
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:text-ink': {
    count: 1,
    why: 'Words on the bar above (#232019): 15.57:1. Deleting only this one would leave #17160F on it → 1.12:1.',
  },
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:text-ink/65': {
    count: 2,
    why:
      'Category / count on the bar (#232019): ink/65 (drawn at the ink/70 text floor) → 6.97:1. Deleted ' +
      '(cream/65 on the dark bar) → 1.08:1.',
  },
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:!text-ink': {
    count: 1,
    why: 'The bar\'s inner button words (#232019 under an ink/8 wash): 12.35:1. Deleted (cream on cream/14) → 1.10:1.',
  },
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:!bg-ink/[0.08]': {
    count: 1,
    why: 'The inner button\'s wash on the dark bar: ink/8 lifts it; cream/14 would be dark-on-dark and vanish.',
  },
  'app/dashboard/[eventId]/vendors/_components/build-cart.tsx|dark:!border-ink/40': {
    count: 1,
    why: 'The inner button\'s edge on the dark bar: ink/40 → 3.64:1 (non-text); cream/40 → 1.05:1, no edge.',
  },
};

/** Files another open PR was rewriting, with their flagged count. May only fall. */
const DEBT: Record<string, { count: number; pr: number }> = {};

/** Families PR #7377's ramp guard owns as OVERRIDES (any shade reads `--ramp-…`). Read, not typed. */
function rampFamilies(colors: Record<string, unknown>): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(colors)) if (JSON.stringify(v ?? '').includes('--ramp-')) out.add(k);
  return out;
}

const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

type RGB = [number, number, number];

function blockVars(css: string, selector: RegExp): Map<string, string> {
  const vars = new Map<string, string>();
  const re = new RegExp(`(?:^|[\\n;}])\\s*${selector.source}\\s*\\{([^}]*)\\}`, 'g');
  for (const m of css.matchAll(re)) {
    for (const d of m[1]!.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) vars.set(d[1]!, d[2]!.trim());
  }
  return vars;
}

function themeVars() {
  const css = stripComments(read('app/globals.css'));
  const light = blockVars(css, /:root/);
  const darkOnly = blockVars(css, /html\.dark/);
  const dark = new Map([...light, ...darkOnly]);
  return { light, dark };
}

/** Resolve a value string (`rgb(var(--x) / <alpha-value>)`, `var(--a, var(--b))`, `#hex`, `r g b`) to RGB. */
function resolve(value: string, vars: Map<string, string>, depth = 0): RGB | null {
  if (depth > 12) return null;
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [0, 2, 4].map((i) => parseInt(hex[1]!.slice(i, i + 2), 16)) as RGB;
  const trip = v.match(/^(\d{1,3})\s+(\d{1,3})\s+(\d{1,3})$/);
  if (trip) return [+trip[1]!, +trip[2]!, +trip[3]!];
  const inner = v.match(/^rgb\((.*)\/\s*<alpha-value>\s*\)$/);
  if (inner) return resolve(inner[1]!, vars, depth + 1);
  const ref = v.match(/^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/);
  if (ref) {
    const own = vars.get(ref[1]!);
    if (own !== undefined) return resolve(own, vars, depth + 1);
    return ref[2] ? resolve(ref[2], vars, depth + 1) : null;
  }
  return null;
}

const lum = ([r, g, b]: RGB) => {
  const c = (x: number) => {
    const s = x / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * c(r) + 0.7152 * c(g) + 0.0722 * c(b);
};
/** Where a colour reads equally against black and white. */
const side = (c: RGB) => (lum(c) > 0.179 ? 'light' : 'dark');

type Tok = { light: RGB; dark: RGB; themed: boolean; ramp: boolean };

/** Every colour token, flattened (`ink-soft`, `ink` …), with its light and dark value. text-* reads textColor first. */
function tokens(): { all: Map<string, Tok>; text: Map<string, Tok> } {
  const cfg = ((tailwindConfig as unknown as { default?: unknown }).default ?? tailwindConfig) as {
    theme: { extend: { colors: Record<string, unknown>; textColor?: Record<string, unknown> } };
  };
  const { light, dark } = themeVars();
  const ramps = rampFamilies(cfg.theme.extend.colors);
  const flatten = (o: Record<string, unknown>) => {
    const out = new Map<string, Tok>();
    const walk = (node: unknown, name: string, fam: string) => {
      if (typeof node === 'string' || typeof node === 'function') {
        let src = String(node);
        if (typeof node === 'function') src = (node as (a: { opacityValue?: string }) => string)({ opacityValue: '1' }).replace(/\/\s*1\)$/, '/ <alpha-value>)');
        const l = resolve(src, light);
        const d = resolve(src, dark);
        if (l && d) out.set(name, { light: l, dark: d, themed: /var\(/.test(src), ramp: ramps.has(fam) });
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) walk(v, k === 'DEFAULT' ? name : name ? `${name}-${k}` : k, fam || k);
      }
    };
    walk(o, '', '');
    return out;
  };
  const all = flatten(cfg.theme.extend.colors);
  const text = new Map([...all, ...flatten(cfg.theme.extend.textColor ?? {})]);
  return { all, text };
}

const PROPS = ['text', 'bg', 'border-t', 'border-r', 'border-b', 'border-l', 'border-x', 'border-y', 'border-s', 'border-e', 'border',
  'ring-offset', 'ring', 'outline', 'from', 'via', 'to', 'fill', 'stroke', 'divide', 'decoration', 'placeholder', 'caret', 'accent', 'shadow'];

/** Split a class into variants + utility on top-level `:` (not inside `[...]`). */
function splitVariants(cls: string): { variants: string[]; utility: string } {
  const parts: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of cls) {
    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === ':' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);
  return { variants: parts.slice(0, -1), utility: parts[parts.length - 1]! };
}

type Parsed = { cls: string; dark: boolean; key: string; prop: string; token: string; tok: Tok };

function parseClass(cls: string, t: ReturnType<typeof tokens>): Parsed | null {
  const { variants, utility } = splitVariants(cls);
  const u = utility.replace(/^!/, '').replace(/\/(?:[\d.]+|\[[^\]]+\])$/, '');
  for (const prop of PROPS) {
    if (!u.startsWith(`${prop}-`)) continue;
    const token = u.slice(prop.length + 1);
    const tok = (prop === 'text' ? t.text : t.all).get(token);
    if (!tok) continue;
    const dark = variants.includes('dark');
    return { cls, dark, key: variants.filter((v) => v !== 'dark').join(':'), prop, token, tok };
  }
  return null;
}

const STRING = /`(?:[^`\\]|\\.)*`|'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"/g;

/** Every flip-back in one source text. */
function flipBacks(src: string, t: ReturnType<typeof tokens>): string[] {
  const found: string[] = [];
  // A template literal is split at `${`, `}` and inner quotes, so the two branches of
  // `${a ? 'bg-ink text-cream' : 'bg-white dark:bg-cream'}` are two class strings, never one.
  const segments = (src.match(STRING) ?? []).flatMap((lit) => lit.slice(1, -1).split(/\$\{|\}|['"`]/));
  for (const seg of segments) {
    if (!seg.includes('dark:')) continue;
    const parsed = seg
      .split(/\s+/)
      .filter(Boolean)
      .map((c) => parseClass(c, t))
      .filter((p): p is Parsed => p !== null);
    for (const o of parsed) {
      if (!o.dark || !o.tok.themed || o.tok.ramp) continue;
      const flipped = parsed.some(
        (b) =>
          !b.dark &&
          b.prop === o.prop &&
          b.key === o.key &&
          b.token !== o.token &&
          side(b.tok.light) !== side(b.tok.dark) &&
          side(o.tok.dark) === side(b.tok.light),
      );
      if (flipped) found.push(o.cls);
    }
  }
  return found;
}

function sources(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const rel = join(dir, name);
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) && rel !== THIS) out.push(rel);
    }
  };
  for (const d of ['app', 'lib', 'components']) walk(d);
  return out;
}

function scan(): Map<string, string[]> {
  const t = tokens();
  const hits = new Map<string, string[]>();
  for (const rel of sources()) {
    const src = stripComments(read(rel));
    if (!src.includes('dark:')) continue;
    const found = flipBacks(src, t);
    if (found.length) hits.set(rel, found);
  }
  return hits;
}

test('the themed tokens and their dark values are read from the sources', () => {
  const t = tokens();
  for (const name of ['cream', 'ink', 'raised']) {
    const tok = t.all.get(name);
    assert.ok(tok?.themed && !tok.ramp, `expected "${name}" to be a themed token`);
  }
  assert.notEqual(side(t.all.get('cream')!.light), side(t.all.get('cream')!.dark), 'cream should flip under html.dark');
  assert.notEqual(side(t.all.get('ink')!.light), side(t.all.get('ink')!.dark), 'ink should flip under html.dark');
  assert.ok(t.all.get('danger-100')?.ramp, 'the ramps are #7377\'s, read as ramps');
});

test('the rule catches a flip-back and leaves pairings alone', () => {
  const t = tokens();
  const m = (s: string) => flipBacks(`"${s}"`, t);
  assert.deepEqual(m('bg-ink text-cream dark:bg-cream dark:text-ink'), ['dark:bg-cream', 'dark:text-ink']);
  assert.deepEqual(m('!bg-ink !text-cream dark:!text-ink'), ['dark:!text-ink']);
  assert.deepEqual(m('text-cream/70 dark:text-ink/70'), ['dark:text-ink/70']);
  assert.deepEqual(m('hover:bg-ink dark:hover:bg-cream bg-white'), ['dark:hover:bg-cream']);
  // Pairings: a base that does not flip, a same-token alpha step, a dark-to-dark lift, a ramp override.
  assert.deepEqual(m('bg-white dark:bg-raised text-ink'), []);
  assert.deepEqual(m('bg-mulberry text-white dark:text-cream'), []);
  assert.deepEqual(m('border border-ink/12 dark:border-ink/15'), []);
  assert.deepEqual(m('bg-cream dark:bg-raised'), []);
  assert.deepEqual(m('text-danger-900 dark:text-danger-100'), []);
  // Different variants are different bases.
  assert.deepEqual(m('hover:bg-ink dark:bg-cream'), []);
  // The two branches of a ternary inside a template are two strings.
  assert.deepEqual(flipBacks("`p-2 ${on ? 'bg-ink text-cream' : 'bg-white dark:bg-cream'}`", t), []);
  assert.deepEqual(flipBacks("`p-2 ${on ? 'text-cream/70 dark:text-ink/70' : 'text-ink/60'}`", t), ['dark:text-ink/70']);
});

test('no dark: override flips a themed token back (outside ALLOW / DEBT)', (t) => {
  const hits = scan();
  const total = [...hits.values()].reduce((n, l) => n + l.length, 0);
  t.diagnostic(`dark: flip-backs of a themed token: ${total} in ${hits.size} files`);

  const problems: string[] = [];
  const allowSeen = new Map<string, number>();
  for (const [file, found] of hits) {
    const debt = DEBT[file];
    const rest: string[] = [];
    for (const cls of found) {
      const key = `${file}|${cls}`;
      if (ALLOW[key]) allowSeen.set(key, (allowSeen.get(key) ?? 0) + 1);
      else rest.push(cls);
    }
    if (debt) {
      if (rest.length > debt.count) {
        problems.push(`${file}: ${rest.length} flip-backs, DEBT allows ${debt.count} (open PR #${debt.pr}) — the count may only fall: ${rest.join(', ')}`);
      }
      continue;
    }
    for (const cls of rest) {
      problems.push(
        `${file}: \`${cls}\` — its base token already flips under html.dark (globals.css), so this dark: class flips it ` +
          `BACK (bg-ink text-cream dark:bg-cream dark:text-ink = a button the colour of the page). Delete the dark: class; ` +
          `if the re-flip is deliberate, add it to ALLOW in ${THIS} with the measured contrast.`,
      );
    }
  }
  for (const [key, { count }] of Object.entries(ALLOW)) {
    const seen = allowSeen.get(key) ?? 0;
    if (seen > count) problems.push(`${key}: ${seen} uses, ALLOW says ${count} — a new one needs its own measured reason`);
    if (seen < count) problems.push(`${key}: ALLOW says ${count}, found ${seen} — stale; lower or delete the entry`);
  }
  for (const [file, { count, pr }] of Object.entries(DEBT)) {
    const n = (hits.get(file) ?? []).filter((c) => !ALLOW[`${file}|${c}`]).length;
    if (n < count) t.diagnostic(`DEBT ${file} (PR #${pr}) is down to ${n} of ${count} — lower or delete its line`);
  }
  assert.equal(problems.length, 0, `\n${problems.join('\n')}`);
});
