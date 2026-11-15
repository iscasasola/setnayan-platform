/**
 * album-video-cost.test.ts — an imported video costs 3× what Papic charges for its seconds (owner 2026-11-14,
 * specs DECISION_LOG "FIVE OWNER ANSWERS IN ONE MESSAGE" (6): "x3 of the video based on their seconds as compared to
 * papic"). Every expectation is computed from Papic's own ladder — no number is typed here either.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PAPIC_CLIP_COST_BANDS, PAPIC_UPLOAD_MULTIPLIER, papicCaptureCost, papicSnippetCost } from './papic-cameras-pure';
import { PAPIC_LONGEST_CLIP_MS, albumVideoCredits } from './album-video-cost';

describe('the formula: 3 × Papic for the same seconds', () => {
  it('up to Papic’s longest clip, it IS a clip added by hand — every band, every second', () => {
    for (let s = 1; s * 1000 <= PAPIC_LONGEST_CLIP_MS; s++) {
      assert.equal(albumVideoCredits(s * 1000), papicCaptureCost('clip', s * 1000, 'upload'), `${s}s`);
      assert.equal(albumVideoCredits(s * 1000), papicSnippetCost(s * 1000) * PAPIC_UPLOAD_MULTIPLIER, `${s}s`);
    }
  });
  it('seconds round up, like the ladder', () => {
    assert.equal(albumVideoCredits(2100), albumVideoCredits(3000));
  });
  it('a longer video is priced as back-to-back Papic clips, the last for its own seconds', () => {
    const top = papicSnippetCost(PAPIC_LONGEST_CLIP_MS);
    const twoFull = 2 * PAPIC_LONGEST_CLIP_MS;
    assert.equal(albumVideoCredits(twoFull), 2 * top * PAPIC_UPLOAD_MULTIPLIER);
    assert.equal(albumVideoCredits(twoFull + 3000), (2 * top + papicSnippetCost(3000)) * PAPIC_UPLOAD_MULTIPLIER);
  });
  it('never cheaper for a longer video', () => {
    let last = 0;
    for (let s = 1; s <= 300; s++) {
      const c = albumVideoCredits(s * 1000)!;
      assert.ok(c >= last, `${s}s cost ${c} < ${last}`);
      last = c;
    }
  });
  it('an unknown length is not priced — the import is refused', () => {
    for (const v of [null, undefined, Number.NaN, 0, -5, Number.POSITIVE_INFINITY]) assert.equal(albumVideoCredits(v as number), null);
  });
  it('the ladder it reads is the one Papic charges with', () => {
    assert.equal(PAPIC_LONGEST_CLIP_MS, PAPIC_CLIP_COST_BANDS.at(-1)!.maxSeconds * 1000);
  });
});

describe('no number is typed, and both seams use the one formula', () => {
  it('the cost module writes no weight of its own', () => {
    const src = stripComments(readFileSync(join(import.meta.dirname, 'album-video-cost.ts'), 'utf8'));
    const numbers = (src.match(/(?<![\w.'"-])\d+(?![\w'"])/g) ?? []).filter((n) => !['0', '1', '1000'].includes(n));
    assert.deepEqual(numbers, [], 'a credit weight was typed into album-video-cost.ts — read it from papic-cameras-pure');
  });
  it('the import route CHARGES albumVideoCredits on a length IT measured', () => {
    const route = stripComments(readFileSync(join(import.meta.dirname, '../app/api/vendor/papic-portfolio-import/route.ts'), 'utf8'));
    assert.match(route, /probeMp4DurationMs\(/, 'the route must measure the video itself');
    assert.match(route, /albumVideoCredits\(\s*measuredMs\s*\)/, 'the route must price the MEASURED length');
    assert.match(route, /credits_spent:\s*credits\b/, 'the row must record the credits charged');
  });
  it('the import form SHOWS the cost before the import, from the same formula', () => {
    const form = stripComments(
      readFileSync(join(import.meta.dirname, '../app/vendor-dashboard/on-the-day/live/[eventId]/_components/portfolio-import-form.tsx'), 'utf8'),
    );
    assert.match(form, /albumVideoCredits\(/, 'the form must price with albumVideoCredits');
    assert.match(form, /albumVideoCostWords\(/, 'the form must say the cost in words');
    assert.match(form, /data-video-cost-confirm/, 'the cost must be confirmed before the upload starts');
  });
});
