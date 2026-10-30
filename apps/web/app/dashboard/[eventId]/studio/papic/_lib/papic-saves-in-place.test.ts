/**
 * 📍 NO PAPIC CONTROL NAVIGATES ON A SAVE — every form on the Papic page (and in Home's Papic card, which draws the same
 * components) saves IN PLACE (`papic-stay-form.tsx` → `in-place-actions.ts`).
 *
 * Owner, live 2026-10-26: *"saving minimum and maximum on papic resets the whole screen. this should not happen"* ·
 * *"when i turn of a challenge. it should just remove it"* · *"it jumped to a different page"*. Every Papic action ends
 * in `redirect(...)`; a plain `<form action={…}>` followed it — the page re-drawn from the top, and a challenge's eye
 * (no `return_to`) landed on the Challenges page (`challengeReturnPath`'s default).
 *
 *   (1) no `<form action={fn}>` is left in the Papic page's files — each is a `PapicStayForm` — except the flows that
 *       MUST navigate, each listed with its reason;
 *   (2) the redirect an action ends in is read as an answer: news → saved in place; `…_error=` / `add=full` → said on
 *       the row in the page's own words; signed out / off the event → let through;
 *   (3) the door runs exactly the listed actions — no more, no fewer.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '../../../../../../lib/strip-comments';
import { PAPIC_DOORS, papicInPlaceAnswer } from './papic-in-place';

const PAPIC = join(__dirname, '..');
/** The Papic page's own files and its components (Home's Papic card draws these) — the sub-pages are their own screens. */
const FILES = [
  ...readdirSync(PAPIC).filter((f) => f.endsWith('.tsx')).map((f) => f),
  /* (the stay form itself wraps the one `<form>` every control now goes through) */
  ...readdirSync(join(PAPIC, '_components')).filter((f) => f.endsWith('.tsx') && f !== 'papic-stay-form.tsx').map((f) => `_components/${f}`),
];
/** A form whose action MUST navigate — and why. */
const MUST_NAVIGATE: Record<string, string> = {
  '_components/papic-buy-form.tsx › purchasePapicPoolTopUp': 'a purchase goes on to the pay page',
  'style-picker.tsx › setPapicStyle': 'the no-JavaScript path only — every tap is answered in place by its own button (`setPapicStyleInPlace`)',
};

test('(1) every Papic form saves in place — or is listed as a flow that must navigate', () => {
  const blind: string[] = [];
  let stays = 0;
  for (const f of FILES) {
    const src = stripComments(readFileSync(join(PAPIC, f), 'utf8'));
    stays += (src.match(/<PapicStayForm\b/g) ?? []).length;
    for (const m of src.matchAll(/<form\b[^>]*?\baction=\{([^}]+)\}/g)) {
      const key = `${f} › ${m[1]!.trim()}`;
      if (!(key in MUST_NAVIGATE)) blind.push(key);
    }
  }
  assert.ok(stays >= 25, `only ${stays} Papic forms save in place — the scan is not reading the Papic page`);
  assert.deepEqual(blind, [], `These Papic forms follow their action's redirect — the whole screen resets on a save. Make each a \`PapicStayForm\`:\n  ${blind.join('\n  ')}`);
});

test('(2) a redirect is read as an answer — saved, refused (said), or let through', () => {
  const back = '/dashboard/e1/studio/papic';
  assert.deepEqual(papicInPlaceAnswer(`${back}?allotment_set=1`), { ok: true });
  assert.deepEqual(papicInPlaceAnswer(`${back}/challenges`), { ok: true });
  assert.deepEqual(papicInPlaceAnswer('/dashboard/e1'), { ok: true });
  const min = papicInPlaceAnswer(`${back}?allotment_error=minimum_above_limit`);
  assert.equal(min !== 'navigate' && min.ok, false);
  assert.match((min as { error: string }).error, /cannot be more than the limit/);
  const full = papicInPlaceAnswer(`${back}/challenges?add=full`);
  assert.match((full as { error: string }).error, /Ten challenges/);
  assert.match((papicInPlaceAnswer(`${back}?window_error=whatever`) as { error: string }).error, /Nothing changed/);
  // 🚨 The outcome in the VALUE (2026-10-30): a refused "Let everybody shoot now" lands on `?guestCameras=error#papic`.
  const cams = papicInPlaceAnswer('/dashboard/e1?papic=open&guestCameras=error#papic');
  assert.equal(cams !== 'navigate' && cams.ok, false, 'a refused shoot-now save read as saved');
  assert.equal((papicInPlaceAnswer(`${back}?faceTagging=error`) as { ok: boolean }).ok, false);
  assert.deepEqual(papicInPlaceAnswer('/dashboard/e1?guestCameras=early'), { ok: true });
  assert.equal(papicInPlaceAnswer('/dashboard'), 'navigate');
  assert.equal(papicInPlaceAnswer('/login?next=/dashboard/e1'), 'navigate');
});

test('(3) the door runs exactly the listed actions, and the form sends through it without navigating', () => {
  const door = stripComments(readFileSync(join(PAPIC, 'in-place-actions.ts'), 'utf8'));
  const body = door.slice(door.indexOf('const DOORS'), door.indexOf('};', door.indexOf('const DOORS')));
  const listed = [...body.matchAll(/^\s*(\w+),$/gm)].map((m) => m[1]);
  assert.deepEqual([...listed].sort(), [...PAPIC_DOORS].sort());
  assert.match(door, /if \(answer === 'navigate'\) throw e;\s*return answer;/, 'the door no longer reads the redirect as an answer');
  const form = stripComments(readFileSync(join(PAPIC, '_components/papic-stay-form.tsx'), 'utf8'));
  assert.match(form, /onSubmit=\{\(e\) => \{\s*e\.preventDefault\(\);/, 'the stay form lets the browser submit — and follow the redirect');
  assert.match(form, /await papicSaveInPlace\(door, fd\)/);
  assert.match(form, /role="alert"[^>]*data-papic-stay-error/, 'a refusal is not said on the row');
});
