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
