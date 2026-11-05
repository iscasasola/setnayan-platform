/**
 * THE HOME'S COVER BAND CANCELS EXACTLY THE GUTTER IT SITS IN — quality sweep 2026-10-19, row C13.
 *
 * `HomeCoverBand` runs edge to edge by pulling itself out of the event layout's gutter with negative margins
 * (`-mx-4 -mt-3 sm:-mx-6 sm:-mt-6 lg:-mx-8`) and padding back by the same amount. That is only true while the two
 * agree at every width: a band that pulls out further than its parent pads overflows the page sideways — the sweep
 * measured 16 px past the right edge at 1280 on `/dev/home-lab`, whose wrapper padded `px-4` at every width while the
 * band pulled `lg:-mx-8`. The real Home (the event layout's `px-4 sm:px-6 lg:px-8`) agreed; the lab did not, so the
 * lab drew a fault the Home does not have.
 *
 * This resolves each class string the way Tailwind's min-width cascade does — the value at a width is the last one
 * set at or below it — and requires the band's pull to equal the gutter at base · sm · md · lg · xl, for the event
 * layout AND for the lab that claims to draw "what the Home shows".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const BPS = ['', 'sm', 'md', 'lg', 'xl'] as const;

/** `prop` (`px`, `pt`, `-mx`, `-mt`) resolved at each breakpoint from a class string, in px (Tailwind's 4-px scale). */
function resolve(cls: string, prop: 'px' | 'pt' | '-mx' | '-mt'): number[] {
  const set = new Map<string, number>();
  for (const t of cls.split(/\s+/)) {
    const m = t.match(/^(?:(sm|md|lg|xl):)?(-?)(px|pt|mx|mt)-(\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const name = `${m[2]}${m[3]}`;
    if (name !== prop) continue;
    set.set(m[1] ?? '', Number(m[4]) * 4);
  }
  const out: number[] = [];
  let cur = 0;
  for (const bp of BPS) {
    if (set.has(bp)) cur = set.get(bp)!;
    out.push(cur);
  }
  return out;
}

function bandClass(): string {
  const src = read('app/dashboard/[eventId]/_components/home-cover-band.tsx');
  const m = src.match(/data-home-cover=[\s\S]*?className=\{`([^`$]*)/);
  assert.ok(m, 'HomeCoverBand no longer draws a data-home-cover band with a className');
  return m![1]!;
}

function assertFits(wrapper: string, where: string) {
  const band = bandClass();
  for (const [pad, pull] of [
    ['px', '-mx'],
    ['pt', '-mt'],
  ] as const) {
    const gutter = resolve(wrapper, pad);
    const bleed = resolve(band, pull);
    BPS.forEach((bp, i) => {
      assert.equal(
        bleed[i],
        gutter[i],
        `${where} at ${bp || 'base'}: the band pulls ${pull} ${bleed[i]}px but its wrapper pads ${pad} ${gutter[i]}px — ` +
          (bleed[i]! > gutter[i]! ? 'it overflows the page' : 'it no longer reaches the edge'),
      );
    });
  }
}

test('the premise: the band pulls itself out by a negative margin at every width', () => {
  const band = bandClass();
  assert.ok(resolve(band, '-mx').every((v) => v > 0), `the band has no sideways pull at some width (${band})`);
});

test('the real Home: the event layout pads exactly what the band pulls', () => {
  const layout = read('app/dashboard/[eventId]/layout.tsx');
  const m = layout.match(/<div className="(mx-auto w-full [^"]*)">/);
  assert.ok(m, 'the event layout content wrapper (mx-auto w-full …) was not found');
  assertFits(m![1]!, 'the event layout');
});

test('/dev/home-lab wraps the Home in the same gutter, so it draws what the Home draws', () => {
  const lab = read('app/dev/home-lab/page.tsx');
  const i = lab.indexOf('<HomeFirstScreen');
  assert.ok(i > 0, '/dev/home-lab no longer draws HomeFirstScreen');
  const before = lab.slice(0, i);
  const wrappers = [...before.matchAll(/<div className=(?:"([^"]*)"|\{`([^`$]*)`\})>/g)];
  assert.ok(wrappers.length > 0, 'no wrapper div before HomeFirstScreen in /dev/home-lab');
  const last = wrappers[wrappers.length - 1]!;
  assertFits(last[1] ?? last[2] ?? '', '/dev/home-lab');
});
