/**
 * 👗 v206 (owner, 28 Nov: "why is it when the waist goes down, the hips goes down as well?"): the waist no longer drags
 * her hips down. Held to prototype v206's own sliders (`v206-waist-hips.fixture.json`): hips she gave never move and the
 * waist stops at 6/10 of them with its line; hips she has not given come back as the waist rises; a hip change forgets
 * the wanted hips and holds the waist in range.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { startingGownBody, type GownBodyKey } from '../gown-config';
import { GOWN_WHR_MIN, gownLimit, gownSetNumber, gownWaistStopNote } from './body-rules';

type Step = { k: 'waist' | 'hips'; v: number; waist: number; hips: number; want: number | null; note: string };
const REF = JSON.parse(readFileSync(join(__dirname, 'v206-waist-hips.fixture.json'), 'utf8')) as { scen: { name: string; given: Record<string, boolean>; start: { waist: number; hips: number }; steps: Step[] }[] };

test('waist and hips move as v206 moves them, step by step', () => {
  for (const sc of REF.scen) {
    let vals = { ...startingGownBody().vals }, given = Object.keys(sc.given) as GownBodyKey[], want: number | null = null;
    assert.deepEqual([vals.waist, vals.hips], [sc.start.waist, sc.start.hips], `${sc.name}: the default figure`);
    sc.steps.forEach((st, i) => {
      // A range slider holds its value inside its own min and max (her limits), as the prototype's does.
      const [lo, hi] = gownLimit(vals, st.k), asked = Math.min(hi, Math.max(lo, st.v));
      const r = gownSetNumber(vals, given, st.k, asked, want);
      vals = r.vals; given = r.given; want = r.hipWant;
      assert.deepEqual([vals.waist, vals.hips, want], [st.waist, st.hips, st.want], `${sc.name} step ${i} (${st.k} → ${st.v})`);
      // The line is said on the move that stopped the waist, word for word.
      const stopped = st.k === 'waist' && st.waist > asked && given.includes('hips');
      assert.equal(r.note, stopped ? st.note : '', `${sc.name} step ${i}: the line`);
    });
  }
});

test('her own hips are never changed by the waist; the floor is 6/10 of them', () => {
  const v = { ...startingGownBody().vals, hips: 100 };
  const r = gownSetNumber(v, ['hips'], 'waist', 40);
  assert.equal(r.vals.hips, 100);
  assert.equal(r.vals.waist, Math.ceil(100 * GOWN_WHR_MIN));
  assert.equal(r.note, gownWaistStopNote(60, 100));
});
