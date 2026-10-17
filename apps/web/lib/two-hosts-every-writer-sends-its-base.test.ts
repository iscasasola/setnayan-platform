/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — ROUND 2 (owner 2026-10-18, "all builds for today"). Round 1 (#6626) built
 * the one pattern ("merge from base", `lib/merge-from-base.ts`) and wired the writers that lose the most; this file
 * holds the writers round 2 brought onto the SAME pattern. `two-hosts-never-overwrite.test.ts` holds round 1.
 *
 * 🛡 Each test was sabotaged red, then restored (listed in the PR body).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { forgetCanvasSent, sendCanvasBase } from './maker-draft-store';
import { rebaseHubDraftPatch } from './hub-draft-rebase';
import { emptyHubDraft, mergeHubDraft } from './hub-draft';
import { MERGE_BASE_FIELD } from './merge-base-field';
import { eventDetailsToWrite, formFieldsOf } from './event-details-merge';
import type { HubSectionCanvas } from './hub-canvas';

const code = (...p: string[]) => stripComments(readFileSync(join(__dirname, '..', ...p), 'utf8'));
const baseOf = (fd: FormData, type: string) => (JSON.parse(String(fd.get(MERGE_BASE_FIELD))) as { widgets: Record<string, { canvas: HubSectionCanvas }> }).widgets[type]!.canvas;

/* ── 1 · the Maker's other canvas panels ──────────────────────────────────── */

test('1a · a canvas save carries what this screen LAST SENT for the scene — the server’s canvas until something was sent', () => {
  const type = `t1a-${Math.random()}`;
  const server: HubSectionCanvas = { elements: { eyebrow: { size: 100 } } };
  const first: HubSectionCanvas = { elements: { eyebrow: { size: 110 } } };
  const fd1 = new FormData();
  sendCanvasBase(fd1, type, server, first);
  assert.deepEqual(baseOf(fd1, type), server, 'the first save is not based on the canvas the page drew');
  // The page has not been drawn again (held saves): the next save — by ANY panel on this scene — builds on what was sent.
  const fd2 = new FormData();
  sendCanvasBase(fd2, type, server, { elements: { eyebrow: { size: 110, color: '#111111' } } });
  assert.deepEqual(baseOf(fd2, type), first, 'a second save is based on the old render, not on what this screen sent');
  // A newer render (the server moved past it): that is the base again.
  const drawn: HubSectionCanvas = { elements: { eyebrow: { size: 110, color: '#111111' } }, entrance: { key: 'names' } as HubSectionCanvas['entrance'] };
  const fd3 = new FormData();
  sendCanvasBase(fd3, type, drawn, { ...drawn, kind: 'color' } as HubSectionCanvas);
  assert.deepEqual(baseOf(fd3, type), drawn, 'a save after a newer render is still based on an older send');
  // A refused send is forgotten: the base goes back to the canvas the page drew.
  forgetCanvasSent(type);
  const fd4 = new FormData();
  sendCanvasBase(fd4, type, drawn, drawn);
  assert.deepEqual(baseOf(fd4, type), drawn);
  // A writer that builds on its own copy says what it built on — exactly that is the base.
  const own: HubSectionCanvas = { design: 'crest' } as HubSectionCanvas;
  const fd5 = new FormData();
  sendCanvasBase(fd5, type, drawn, { ...own, design: 'letter' } as HubSectionCanvas, own);
  assert.deepEqual(baseOf(fd5, type), own, 'a pick built on its own copy is not based on that copy');
});

test('1b · the incident shape on the cover: this screen moves the entrance, the other host had sized the cover line — both stay', () => {
  const type = `hero`;
  forgetCanvasSent(type);
  const drawn: HubSectionCanvas = { elements: { eyebrow: { size: 100 } } };
  // The other host's save already in the draft: the cover line at 120 %.
  const theirs: HubSectionCanvas = { elements: { eyebrow: { size: 120 } } };
  const current = mergeHubDraft(emptyHubDraft(), { widgets: { hero: { canvas: theirs } } });
  // This screen, still on the old render, picks an entrance (the cover's Animate).
  const mine: HubSectionCanvas = { ...drawn, entrance: { key: 'names' } as HubSectionCanvas['entrance'] };
  const fd = new FormData();
  sendCanvasBase(fd, type, drawn, mine);
  const base = JSON.parse(String(fd.get(MERGE_BASE_FIELD)));
  const r = rebaseHubDraftPatch(current, { widgets: { hero: { canvas: mine } } }, base, { events: {}, canvas: {} });
  const out = mergeHubDraft(current, r.patch).widgets.hero!.canvas as HubSectionCanvas;
  assert.equal(out.elements?.eyebrow?.size, 120, 'the other host’s cover-line size was wiped by this screen’s whole canvas');
  assert.equal((out.entrance as { key: string } | undefined)?.key, 'names', 'this screen’s entrance was lost');
  assert.equal(r.moved, true, 'the screen is not told another screen’s change reached it');
  forgetCanvasSent(type);
});

test('1c · every canvas panel named in round 1 as LEFT now sends its base, and forgets it when refused', () => {
  const panels: Array<[string, string[], RegExp]> = [
    ['element sheet', ['app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'element-sheet.tsx'], /sendCanvasBase\(fd, widgetType, server, canvas\)/],
    ['hero design', ['app', 'dashboard', '[eventId]', 'launch', '_components', 'maker-hero-design.tsx'], /sendCanvasBase\(fd, 'hero', canvas, next, built\)/],
    ['cover animate', ['app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-panel', 'cover-animate.tsx'], /sendCanvasBase\(fd, 'hero', o\.hero, next\)/],
    ['cover lines', ['app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-panel', 'cover-lines.tsx'], /sendCanvasBase\(fd, 'hero', server, next\)/],
    ['cover background', ['app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-panel', 'cover-words-background.tsx'], /sendCanvasBase\(fd, 'hero', canvas, canvasNext, before\)/],
    ['part look', ['app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-panel', 'part-look.ts'], /sendCanvasBase\(fd, t\.widgetType, server, next\)/],
  ];
  for (const [name, path, sends] of panels) {
    const src = code(...path);
    assert.match(src, sends, `${name} no longer sends the canvas it was based on`);
    assert.match(src, /forgetCanvasSent\(/, `${name} keeps a refused send as the next save’s base`);
  }
  // The element sheet's own writer is the one its picks go through.
  assert.match(code('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'element-sheet.tsx'), /saveCanvas\(draftAction, eventId, target\.widgetType, next, serverCanvas\)/);
});

/* ── 2 · the Event Details form (Event settings) ──────────────────────────── */

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

test('2a · Event settings writes only what THIS screen changed — the other host’s region and feel stand', () => {
  const opened = { event_id: 'E1', region: 'ncr', mood_feel_key: 'romantic', budget_pesos: '500000', bride_first: 'Claire', bride_last: 'Cruz', groom_first: 'Indalecio', groom_last: 'Reyes' };
  // This phone changes the budget only; meanwhile the other host moved the region and the feel.
  const posted = form({ ...opened, budget_pesos: '650000' });
  posted.set(MERGE_BASE_FIELD, JSON.stringify(formFieldsOf(form(opened))));
  const w = eventDetailsToWrite(posted);
  assert.equal(w.based, true);
  assert.equal(w.fd.get('budget_pesos'), '650000', 'this screen’s change was not written');
  assert.equal(w.fd.get('event_id'), 'E1', 'the event was dropped');
  for (const f of ['region', 'mood_feel_key', 'bride_first', 'groom_last']) assert.equal(w.fd.has(f), false, `${f} was written back from a stale form`);
  assert.equal(w.fd.has(MERGE_BASE_FIELD), false, 'the base reached the writer as a field');
});

test('2b · fields that are one fact go together; no base = the whole form, as before', () => {
  const opened = { event_id: 'E1', bride_first: 'Claire', bride_last: 'Cruz', groom_first: 'Indalecio', groom_last: 'Reyes', bazi_birthdata_consent: '1', partner_a_birth_date: '1995-01-02', partner_a_birth_time: '', partner_b_birth_date: '', partner_b_birth_time: '' };
  const posted = form({ ...opened, bride_last: 'Cruz-Reyes', partner_b_birth_date: '1994-03-04' });
  posted.set(MERGE_BASE_FIELD, JSON.stringify(formFieldsOf(form(opened))));
  const w = eventDetailsToWrite(posted);
  for (const f of ['bride_first', 'bride_last', 'groom_first', 'groom_last']) assert.equal(w.fd.has(f), true, `a name is composed from all four boxes — ${f} was left out`);
  for (const f of ['bazi_birthdata_consent', 'partner_a_birth_date', 'partner_b_birth_date']) assert.equal(w.fd.has(f), true, `the birth data goes with its consent — ${f} was left out`);
  const whole = eventDetailsToWrite(form({ ...opened, region: 'ncr' }));
  assert.equal(whole.based, false);
  assert.equal(whole.fd.get('region'), 'ncr', 'a post without a base must still write the whole form');
});

test('2c · the form sends what it started from, and the writer leaves out what it did not change', () => {
  const formSrc = code('app', 'dashboard', '[eventId]', 'details', '_components', 'details-form.tsx');
  assert.match(formSrc, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(savedFields\.current\)\)/, 'Event settings no longer sends what it started from');
  assert.match(formSrc, /savedFields\.current = sending;/, 'the next save is based on the form as first opened, not as last saved');
  const action = code('app', 'dashboard', '[eventId]', 'actions.ts');
  assert.match(action, /const toWrite = eventDetailsToWrite\(posted\);\s*const formData = toWrite\.fd;/, 'updateEventMatchCriteria reads the whole posted form again');
  assert.match(action, /!based \|\| formData\.has\('region'\) \? \{ region \}/, 'the region is written even when this screen did not change it');
  assert.match(action, /!based \|\| formData\.has\('mood_feel_key'\) \? \{ mood_feel_key: moodFeelKey \}/, 'the feel is written even when this screen did not change it');
  assert.match(action, /\(!based \|\| formData\.has\('bazi_birthdata_consent'\)\) &&/, 'an unchanged birth-data section is purged by a based save');
});
