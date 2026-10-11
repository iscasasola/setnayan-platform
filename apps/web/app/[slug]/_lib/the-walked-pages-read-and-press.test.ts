/**
 * ON THE PAGES THE GUEST WALKED: THE WORDS CAN BE READ, AND THE WAY BACK CAN BE PRESSED.
 *
 * A guest's walk, 2026-10-11 (faults N22 · N23): 78 pieces of text under 4.5:1 and a list of presses under 44px —
 * among them the sub-pages' back links and the grey sentences of their waiting states. This holds the ones on the
 * pages that walk's fixes already touched (the list is the bill: each row is a place a guest reads or presses).
 * It is NOT a sweep of the whole Event Hub — the rest of N22/N23 is reported, not built.
 *
 *   READ  — the element that holds the sentence wears an ink no fainter than 4.5:1 on the page (worked out from
 *           the house tokens in `globals.css`), or one of the page's solid colours.
 *   PRESS — the link is at least 44px tall.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the everyone page's back link put back to
 * `min-h-[40px] … text-ink/60` → red twice (read and press), naming the line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const WEB = join(ROOT, '..', '..');

function inkContrast(alphaPct: number): number {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const token = (name: string) => {
    const m = css.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    assert.ok(m, `--color-${name} was not found in globals.css`);
    return [Number(m![1]), Number(m![2]), Number(m![3])] as const;
  };
  const ink = token('ink');
  const page = token('cream');
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c: readonly number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const a = alphaPct / 100;
  const mixed = ink.map((v, i) => v * a + page[i]! * (1 - a));
  const [hi, lo] = [lum(page), lum(mixed)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** The classes of the element that holds `words` — the nearest `className="…"` before them. */
function classesAround(rel: string, words: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  const at = src.indexOf(words);
  assert.ok(at > 0, `${rel}: ${JSON.stringify(words)} is no longer on the page — this row is pointing at nothing`);
  const before = src.slice(Math.max(0, at - 700), at);
  const all = [...before.matchAll(/className="([^"]*)"/g)];
  assert.ok(all.length > 0, `${rel}: no element was found around ${JSON.stringify(words)}`);
  return all[all.length - 1]![1]!.split(/\s+/);
}

/** The classes of the LINK that holds `words` — not of an icon drawn inside it. */
function linkClassesAround(rel: string, words: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  const at = src.indexOf(words);
  assert.ok(at > 0, `${rel}: ${JSON.stringify(words)} is no longer on the page — this row is pointing at nothing`);
  const before = src.slice(Math.max(0, at - 700), at);
  const all = [...before.matchAll(/<(?:Link|a|SeatBackLink)\b[^>]*?className="([^"]*)"/g)];
  assert.ok(all.length > 0, `${rel}: no link was found around ${JSON.stringify(words)}`);
  return all[all.length - 1]![1]!.split(/\s+/);
}

/** Colours that are solid on their ground (not a tint of ink). */
const SOLID = /^text-(?:ink|white|cream|terracotta-700|link)$/;

const READ: Array<[string, string]> = [
  ['everyone/page.tsx', 'The entourage hasn&rsquo;t been shared yet.'],
  ['everyone/page.tsx', 'No one else has said yes yet.'],
  ['everyone/page.tsx', 'The rest of the guest list is for invited guests.'],
  ['everyone/page.tsx', 'Back to the invitation'],
  ['seat/page.tsx', '{body}</p>'],
  ['find-my-table/page.tsx', '{body}</p>'],
  ['hub/page.tsx', "withDayNote('Your table shows here on the day.'"],
];

const PRESS: Array<[string, string]> = [
  ['everyone/page.tsx', 'Back to the invitation'],
  ['seat/page.tsx', 'Back to your invitation'],
  ['find-my-table/page.tsx', 'Back to your invitation'],
  ['find-seat/page.tsx', 'Back to the invitation\n      </SeatBackLink>'],
  ['venue/page.tsx', '← Back to the {noun}'],
];

test('READ — each sentence on the walked pages is at least 4.5:1 on the page', () => {
  assert.ok(inkContrast(60) < 4.5 && inkContrast(65) >= 4.5, `the measure moved: ink/60 ${inkContrast(60).toFixed(2)}, ink/65 ${inkContrast(65).toFixed(2)}`);
  const faint: string[] = [];
  for (const [rel, words] of READ) {
    const cls = classesAround(rel, words);
    if (cls.some((c) => SOLID.test(c))) continue;
    const tint = cls.map((c) => c.match(/^text-ink\/(\d+)$/)).find(Boolean);
    assert.ok(tint, `${rel}: the element around ${JSON.stringify(words)} sets no ink of its own (${cls.join(' ')}) — re-aim this row at the element that does`);
    const ratio = inkContrast(Number(tint![1]));
    if (ratio < 4.5) faint.push(`app/[slug]/${rel}: ${JSON.stringify(words.slice(0, 50))} is ${ratio.toFixed(2)}:1 (text-ink/${tint![1]})`);
  }
  assert.deepEqual(faint, []);
});

test('PRESS — each way back on the walked pages is at least 44px tall', () => {
  const small: string[] = [];
  for (const [rel, words] of PRESS) {
    const cls = linkClassesAround(rel, words);
    const tall = cls.some((c) => /^min-h-\[(\d+)px\]$/.test(c) && Number(c.match(/\d+/)![0]) >= 44) || cls.some((c) => /^(?:h|min-h)-(?:11|12|14|16)$/.test(c));
    if (!tall) small.push(`app/[slug]/${rel}: the link ${JSON.stringify(words.slice(0, 40))} is under 44px (${cls.join(' ')})`);
  }
  assert.deepEqual(small, []);
});
