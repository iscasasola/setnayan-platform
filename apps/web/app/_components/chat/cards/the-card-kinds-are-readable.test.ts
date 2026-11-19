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
/** Every declared value of one token, in file order: [light, dark]. */
function triples(name: string): number[][] {
  return [...css.matchAll(new RegExp(`^\\s*${name}:\\s*(\\d+) (\\d+) (\\d+);`, 'gm'))].map((m) => [Number(m[1]), Number(m[2]), Number(m[3])]);
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
    for (const cls of [`border-kind-${k}`, `bg-kind-${k}-bg text-kind-${k}`, `bg-kind-${k}-bg/55`]) assert.ok(bits.includes(`'${cls}'`), `card-bits has no '${cls}'`);
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
  assert.match(bits, /const Icon = TOPIC_ICON\[topic\]/, 'the kind colours the topic\'s icon; it never picks one');
  assert.match(bits, /turn === 'me' \? 'shadow-sn-frame' : 'shadow-sn-hair'/, 'only a card that waits on the reader lifts');
  assert.match(bits, /<details[\s\S]{0,400}<summary/, 'a settled card folds to one line whose press opens it');
});

test('4 · the frame keeps a phone\'s width on a computer', () => {
  const bits = stripComments(read(`${CARDS}/card-bits.tsx`));
  assert.match(bits, /`w-full max-w-\[30rem\] \$\{tone === 'mine' \? 'ml-auto' : ''\}`/);
  assert.equal((bits.match(/\$\{place\(tone\)\}/g) ?? []).length, 3, 'every face of the frame — card, settled line, folded card — takes the same width');
});
