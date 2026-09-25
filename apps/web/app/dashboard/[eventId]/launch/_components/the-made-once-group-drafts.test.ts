/**
 * the-made-once-group-drafts.test.ts — Logo · Hero · Reveal write to the DRAFT,
 * never live, and say so when they fail (Event Hub Maker Phase 6).
 *
 * The owner edits his own PUBLIC Event Hub in the Maker (2026-09-25). Anything
 * in these three workspaces that reached a live column mid-edit would show his
 * guests a half-made page. So, as properties of the source (per file, counts
 * printed):
 *
 *   1. every `<form>` in the made-once panels carries `<HubDraftField />`;
 *   2. no made-once file calls a LIVE writer of the same columns
 *      (`chooseRevealTemplate`, `saveStudioAction`, `clearStudioAction`,
 *      `commitMonogram`, `updateSiteChrome`) — they post `hubDraftAction` instead;
 *   3. the inspector hands Logo · Hero · Reveal (and the hero scene's content)
 *      to the made-once workspaces;
 *   4. the Save-the-Date reveal card renders a refused save as a line
 *      (`{ok:false}` used to be silence).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const DIR = 'app/dashboard/[eventId]/launch/_components';
const PANELS = `${DIR}/maker-made-once.tsx`;
const FILES = [PANELS, `${DIR}/maker-reveal.tsx`, `${DIR}/maker-logo.tsx`];

test('every form in the made-once panels posts to the draft', () => {
  const src = read(PANELS);
  const forms = src.split(/<form\b/).slice(1);
  console.log(`[made-once] forms in ${PANELS}: ${forms.length}`);
  assert.ok(forms.length >= 2, 'anti-vacuity: the hero upload and its removal are forms');
  for (const f of forms) {
    const body = f.slice(0, f.indexOf('</form>'));
    assert.match(body, /<HubDraftField\s*\/>/, `a made-once form writes live: <form${body.slice(0, 80)}…`);
  }
});

test('no made-once file calls a live writer — the one draft action instead', () => {
  const LIVE = /\b(chooseRevealTemplate|saveStudioAction|clearStudioAction|commitMonogram|updateSiteChrome)\b/;
  let draftCalls = 0;
  for (const rel of FILES) {
    const src = read(rel);
    const hit = src.match(LIVE);
    assert.equal(hit, null, `${rel} calls a live writer: ${hit?.[0]}`);
    draftCalls += (src.match(/\bhubDraftAction\s*\(/g) ?? []).length;
  }
  console.log(`[made-once] hubDraftAction calls: ${draftCalls}`);
  assert.ok(draftCalls >= 2, 'the reveal and the logo must post to the draft');
});

test('the logo autosaves: after a pause, on the way out, and when the tab is hidden', () => {
  const src = read(`${DIR}/maker-logo.tsx`);
  for (const [what, re] of [
    ['a pause after a change', /setTimeout\([^)]*flush/],
    ['the tab hidden', /visibilitychange/],
    ['the page left', /pagehide/],
    ['Back to scenes', /const close = useCallback\(\(\) => \{\s*void flush\(/],
  ] as const) {
    assert.match(src, re, `the logo does not save on ${what}`);
  }
  assert.match(src, /monogram_custom_svg:\s*m\.mark\.svg/, 'the autosave must carry the mark');
  assert.match(src, /monogram_studio_config:/, 'the autosave must carry the re-editable design');
});

test('the inspector opens the made-once workspaces for Logo · Hero · Reveal and the hero scene', () => {
  const shell = read('app/dashboard/[eventId]/website/editor/_components/editor-shell.tsx');
  assert.match(shell, /selection\.key === 'logo' \|\| selection\.key === 'hero' \|\| selection\.key === 'reveal'\)\s*&&\s*madeOnce\?\.\[selection\.key\]/);
  assert.match(shell, /scene\?\.type === 'hero' && madeOnce\?\.hero/);
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  for (const c of ['MakerHeroPanel', 'MakerRevealPanel', 'MakerLogoPanel']) {
    assert.match(page, new RegExp(`<${c}\\b`), `the editor page no longer mounts ${c}`);
  }
});

test('a refused reveal save on the Save-the-Date card renders a line, never silence', () => {
  const card = read('app/dashboard/[eventId]/_components/reveal-preview-card.tsx');
  assert.match(card, /else setFailed\(revealSaveFailure\(r\.error\)\)/, 'an {ok:false} must set the failure line');
  assert.match(card, /role="alert"[^>]*data-reveal-save-failed/, 'the failure must render');
});
