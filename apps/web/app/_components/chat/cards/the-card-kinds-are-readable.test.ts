/**
 * 🎨 THE NINE CARD KINDS, HELD (Unichat part A, 20 Nov 2026 — drawing UNICHAT-LIVE-2026-11-19).
 *
 * `lint:contrast` reads only `className="…"` literals, and the kind classes live in ONE map in `card-bits.tsx` — so
 * that lint cannot see them. This is the arithmetic it would have done, read from the real tokens in `globals.css`:
 *   1 · every kind's ink reaches 4.5:1 on its own pale fill AND on the frame it sits on, in light and in dark;
 *   2 · the map names every kind with whole class names, and Tailwind knows each one;
 *   3 · a card in the stream wears the ONE look (`KindCard`) — the old frame is left only on a not-sent-yet draft;
 *   4 · the frame does not stretch on a computer (owner 20 Nov: "card don't need to stretch").
 * Run from apps/web: tsx --test app/_components/chat/cards/the-card-kinds-are-readable.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const CARDS = 'app/_components/chat/cards';
const KINDS = ['quote', 'counter', 'offer', 'meeting', 'decision', 'payment', 'form', 'file', 'plain'] as const;

const css = read('app/globals.css');
/**
 * Every declared value of one token, in file order: [light, dark]. A value that POINTS at a job token
 * (`--sn-frame-bg: var(--color-raised)`, the one colour set, 21 Nov 2026) is that token's value in the same theme.
 */
function triples(name: string): number[][] {
  const out: number[][] = [];
  const seen = new Map<string, number>();
  for (const m of css.matchAll(new RegExp(`^\\s*${name}:\\s*(?:(\\d+) (\\d+) (\\d+)|var\\((--[\\w-]+)\\));`, 'gm'))) {
    if (m[4]) {
      const i = seen.get(m[4]) ?? 0;
      seen.set(m[4], i + 1);
      const to = triples(m[4])[i];
      if (to) out.push(to);
    } else out.push([Number(m[1]), Number(m[2]), Number(m[3])]);
  }
  return out;
}
function luminance(rgb: number[]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

test('1 · every kind ink reads at 4.5:1 on its own fill and on the frame, light and dark', () => {
  const frame = triples('--sn-frame-bg');
  assert.equal(frame.length, 2, 'the frame has a light and a dark value');
  let judged = 0;
  for (const k of KINDS) {
    const ink = triples(`--sn-kind-${k}`);
    const fill = triples(`--sn-kind-${k}-bg`);
    assert.equal(ink.length, 2, `--sn-kind-${k} needs a light and a dark value`);
    assert.equal(fill.length, 2, `--sn-kind-${k}-bg needs a light and a dark value`);
    for (const [i, theme] of (['light', 'dark'] as const).entries()) {
      for (const [on, bg] of [['its fill', fill[i]!], ['the frame', frame[i]!]] as const) {
        const c = contrast(ink[i]!, bg);
        assert.ok(c >= 4.5, `${k} · ${theme} · on ${on}: ${c.toFixed(2)}:1`);
        judged++;
      }
    }
  }
  assert.equal(judged, 36);
  // Anti-vacuity: the arithmetic can fail — the drawing's own file grey (#857F79) does, on its fill.
  assert.ok(contrast([133, 127, 121], [244, 242, 239]) < 4.5);
});

test('2 · the one map names every kind in whole class names Tailwind knows', () => {
  const bits = stripComments(read(`${CARDS}/card-bits.tsx`));
  const tw = read('tailwind.config.ts');
  for (const k of KINDS) {
    for (const cls of [`border-kind-${k}`, `bg-kind-${k}-bg text-kind-${k}`, `bg-kind-${k}-bg/55 dark:bg-kind-${k}-bg`]) assert.ok(bits.includes(`'${cls}'`), `card-bits has no '${cls}'`);
    assert.ok(tw.includes(`${k}: 'rgb(var(--sn-kind-${k}) / <alpha-value>)'`), `tailwind has no kind.${k}`);
    assert.ok(tw.includes(`'${k}-bg': 'rgb(var(--sn-kind-${k}-bg) / <alpha-value>)'`), `tailwind has no kind.${k}-bg`);
  }
  // Words on a kind are the kind's own ink — never white typed by hand.
  assert.doesNotMatch(bits, /\btext-white\b/);
});

test('3 · a card in the stream wears the one look; the old frame is only a draft\'s', () => {
  const files = readdirSync(join(WEB, CARDS)).filter((f) => f.endsWith('.tsx') && f !== 'card-bits.tsx');
  let worn = 0;
  for (const f of files) {
    const src = stripComments(read(`${CARDS}/${f}`));
    worn += (src.match(/<KindCard\b/g) ?? []).length;
    for (const m of src.matchAll(/<ChatCardShell\b[^>]*>/g)) assert.match(m[0], /kicker="You · not sent yet"/, `${f}: a sent card still wears the old frame`);
  }
  assert.ok(worn >= 12, `only ${worn} cards wear KindCard`);
  const bits = stripComments(read(`${CARDS}/card-bits.tsx`));
  // Ruled 20 Nov ("match the drawing"): ⇄ counter · ≡ plan · ₱ quote, and the review ask's ☆ (it borrows the quote's
  // colour in the drawing, never its ₱); every other kind keeps its topic's glyph.
  assert.match(bits, /DEAL_MARK[^=]*= \{ counter: ArrowLeftRight, plan: List, quote: PhilippinePeso, review: Star \}/, 'the drawing\'s deal marks');
  assert.match(stripComments(read(`${CARDS}/handover-card.tsx`)), /kind="quote"\s+mark="review"/, 'the review ask wears the drawing\'s ☆, not the quote\'s ₱');
  assert.match(bits, /: TOPIC_ICON\[topic\];/, 'every other card keeps its topic\'s icon');
  assert.match(stripComments(read(`${CARDS}/negotiate-cards.tsx`)), /mark=\{kind === 'plan' \? 'plan' : undefined\}/, 'a payment plan wears the plan mark');
  assert.match(bits, /turn === 'me' \? 'shadow-sn-frame' : 'shadow-sn-hair'/, 'only a card that waits on the reader lifts');
  assert.match(bits, /<details[\s\S]{0,400}<summary/, 'a settled card folds to one line whose press opens it');
});

test('5 · every dark kind ink reads at 4.5:1 on every surface DARK_MODE_STANDARD_2026-11-20 §2 names', () => {
  // The standard's surfaces by job, both families (events terracotta + supplier navy). Its token PRs (#7993/#7997)
  // are not on main yet, so the card may land on any of these once they are: page, card, tile, wash.
  const surfaces: Record<string, number[]> = {
    'events page': [18, 17, 16], 'events card': [28, 26, 22], 'events tile': [38, 35, 30], 'events wash': [48, 44, 38],
    'navy page': [13, 22, 38], 'navy card': [23, 35, 56], 'navy tile': [31, 47, 74], 'navy wash': [40, 58, 88],
  };
  let judged = 0;
  for (const k of KINDS) {
    const dark = triples(`--sn-kind-${k}`)[1]!;
    for (const [name, bg] of Object.entries(surfaces)) {
      const c = contrast(dark, bg);
      assert.ok(c >= 4.5, `${k} · dark · on ${name}: ${c.toFixed(2)}:1`);
      judged++;
    }
  }
  assert.equal(judged, 72);
});

test('4 · the frame keeps a phone\'s width on a computer', () => {
  const bits = stripComments(read(`${CARDS}/card-bits.tsx`));
  assert.match(bits, /`w-full max-w-\[30rem\] \$\{tone === 'mine' \? 'ml-auto' : ''\}`/);
  assert.equal((bits.match(/\$\{place\(tone\)\}/g) ?? []).length, 3, 'every face of the frame — card, settled line, folded card — takes the same width');
});
