/**
 * the-look-sheet-is-calm.test.ts — THE LOOK SHEET IS CALM: HALF HEIGHT WITH THE
 * PAGE VISIBLE, NO IN-SHEET SAVE, NO CAPTIONS, DROPDOWNS, ONE SLIM HEADER.
 *
 * Owner, live iPhone test 2026-10-05 (prod 30f9154), in "Finish your Event Hub
 * → Save the Date · 3 of 6 → Look": the sheet covered ~75% of the screen and the
 * page above it was a blank strip, so a theme change could not be seen; Font and
 * Magic Move each had their own Save; captions sat under the controls; Art
 * direction and Magic Move were radio cards; "Your page / All themes" was a pill
 * row; the header read "Theme · Peek · × · bar · Save the Date · 3 of 6 ▾ · All
 * items", then "SAVE THE DATE", then "Theme" again. The rulings it rests on:
 * DECISION_LOG 2026-10-04 "FOUR FIXES BEFORE BUILD" (half height, drag up for
 * more) and "ONE SEGMENTED CONTROL"; INTERACTION_RULES §8 (live preview, saves
 * to the DRAFT, Apply publishes); the standing "no captions under controls" and
 * "any set of choices is one dropdown".
 *
 * Held on RENDERS where it can be (the guided workspace, the Look panel's real
 * controls), each a property rather than a phrasing:
 *   (1) the guided step's sheet RESTS ≤ 50% of a 375 × 812 screen, at half, and
 *       every new step comes back to half (`restOn`);
 *   (2) its header is ONE row: the step ▾ (All items inside it) · Peek · × —
 *       no progress bar, no All items button, no stage eyebrow, no second title;
 *   (3) no Save button inside Look — every Look form drafts itself;
 *   (4) no caption under a Look control — every line of text is a label;
 *   (5) Art direction and Magic Move are ONE dropdown each, never radios;
 *   (6) "Your page / All themes" is the one segmented control;
 *   (7) the theme list is the intended set: every ready theme on the web, the
 *       free ones only in the app-store shell (App Review 3.1.1 — deliberate).
 *
 * Lives in `lib/` because node's test glob does not descend into `[eventId]`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { stripComments } from './strip-comments';
import { renderSettled } from './render-settled.test-helper';
import { buildGuidedPlan, type GuidedItem } from './details-guided-flow';
import { phoneHeightPx } from './maker-phone-room';
import { FREE_THEMES, pickableInviteThemes } from './invite-themes';
import { tilesShown } from './maker-theme-tiles';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const L = 'app/dashboard/[eventId]/launch/_components';
const E = 'app/dashboard/[eventId]/website/editor/_components';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const PHONE = { width: 375, height: 812 };
const noop = () => {};

/** The opening tag of the first element carrying `attr`. */
function tagWith(html: string, attr: string): string {
  const at = html.indexOf(attr);
  assert.ok(at > 0, `anti-vacuity: no ${attr} in the render`);
  return html.slice(html.lastIndexOf('<', at), html.indexOf('>', at) + 1);
}

/** The guided workspace on a step, as the Maker draws it (stub editors; the real sheet and header). */
async function paintStep(step: 'names' | 'theme') {
  const { DetailsWorkspace } = await import(`../${L}/details-workspace`);
  const navItems = ['names', 'date', 'theme', 'address'].map((k) => ({ key: k, group: 'g', label: k, icon: null, done: k === 'date' }));
  const plan = buildGuidedPlan(navItems as GuidedItem[], { solemn: false, parentsOffered: true });
  return renderSettled(
    React.createElement(DetailsWorkspace, {
      groups: [{ key: 'g', label: 'G', items: navItems }],
      bodies: { names: 'NAMES-BODY', date: 'DATE-BODY', theme: 'THEME-BODY', address: 'ADDRESS-BODY' },
      editors: Object.fromEntries(['names', 'date', 'theme', 'address'].map((k) => [k, React.createElement('i', { 'data-stub-editor': k })])),
      initial: step,
      guide: {
        plan,
        open: true,
        entry: { kind: 'step', step, round: 'save_the_date' },
        addressed: true,
        actions: { previewHref: null, shareUrl: null, sendHref: '/x' },
      },
    }),
  );
}

/* ── (1) half, at rest ─────────────────────────────────────────────────── */

test('(1) the guided step’s sheet rests at half — ≤ 50% of a 375 × 812 screen — and each step comes back to half', async () => {
  for (const step of ['theme', 'names'] as const) {
    const html = await paintStep(step);
    const aside = tagWith(html, 'data-half-sheet=');
    assert.match(aside, /data-half-sheet="half"/, `${step}: the step does not open at half`);
    const cls = /\bclass="([^"]*)"/.exec(aside)?.[1] ?? '';
    const px = phoneHeightPx(cls, PHONE.height);
    assert.ok(px !== null, `${step}: the sheet declares no phone height`);
    assert.ok(px! <= PHONE.height * 0.5, `${step}: the sheet rests at ${Math.round(px!)} px — over half of ${PHONE.height}`);
    assert.ok(px! >= PHONE.height * 0.3, `${step}: the sheet is a sliver (${Math.round(px!)} px) — no room for the field`);
  }
  // Each step opens at rest: the workspace hands the step to the sheet, and the sheet lowers on a new one.
  const ws = read(`${L}/details-workspace.tsx`);
  const sheet = ws.slice(ws.indexOf('<MakerHalfSheet'), ws.indexOf('</MakerHalfSheet>'));
  assert.match(sheet, /restOn=\{stepHere\?\.key \?\? null\}/, 'a step dragged up stays up on the next step');
  const half = read(`${L}/maker-sheet.tsx`);
  assert.match(half, /if \(raisedRef\.current\) dispatch\(\{ t: 'dragDown' \}\);\s*\}, \[restOn\]\);/, 'the sheet does not come back to half on a new step');
});

/* ── (2) one slim header ───────────────────────────────────────────────── */

test('(2) the step sheet’s header is ONE row: step ▾ · Peek · × — no bar, no All items button, no eyebrow, no second title', async () => {
  const html = await paintStep('theme');
  const at = html.indexOf('data-half-sheet=');
  const sheet = html.slice(at, html.indexOf('</aside>', at));
  const head = sheet.slice(sheet.indexOf('data-half-sheet-head'), sheet.indexOf('data-half-sheet-close'));
  assert.ok(head.length > 0, 'anti-vacuity: the header row was not found');
  assert.match(head, /data-half-sheet-lead=""[\s\S]*data-details-guide-steps=""/, 'the step ▾ is not in the header row');
  assert.match(head, /data-half-sheet-peek=""/, 'Peek is not in the header row');
  assert.match(head, /Save the Date · \d of \d/, 'the step ▾ does not say where the step sits');
  // The title stays for a desk and for the slim bar — hidden on a phone, where the step ▾ says it.
  assert.match(head, /<p class="[^"]*max-lg:hidden[^"]*">Theme<\/p>/, 'the title is drawn on a phone beside the step ▾');
  // Nothing else stacks under it on a phone.
  assert.doesNotMatch(sheet, /data-details-guide-all=""/, 'an All items button came back beside the step ▾');
  assert.doesNotMatch(sheet, /rounded-full bg-terracotta-700" style="width/, 'the progress bar came back in the sheet');
  assert.equal((sheet.match(/data-details-guide-steps=""/g) ?? []).length, 1, 'the step ▾ is drawn twice');
  assert.doesNotMatch(sheet, /uppercase tracking-\[0\.2em\][^>]*>Save the Date/, 'the stage eyebrow came back in the sheet');
  // All items is a row of the step ▾ itself.
  const top = read(`${L}/details-guide-top.tsx`);
  assert.match(top, /\.\.\.\(inSheet \? \[\{ key: ALL_ITEMS, label: 'All items' \}\] : \[\]\)/, 'All items is not in the step ▾');
  assert.match(top, /if \(k === ALL_ITEMS\) \{\s*onAllItems\(\);/, 'All items in the step ▾ does nothing');
});

/* ── (3)(4)(5) the Look panel's own controls ───────────────────────────── */

type LookControls = { font: string; colours: string; 'colours (no Mood Board, owned)': string; 'colours (locked)': string; 'step head': string };

async function paintLookControls(): Promise<LookControls> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColorsPanel } = await import(`../${E}/pro-panels`);
  const { GuideHead } = await import(`../${L}/details-guide`);
  const base = { action: noop, eventId: 'E1', bgColor: '#aabbcc', buttonColor: '#112233', artDirection: 'candlelight' as const, fontKey: null, magicTraveller: 'mark' };
  const r = (el: React.ReactElement) => renderToStaticMarkup(el);
  return {
    font: r(React.createElement(ColorsPanel, { ...base, rowKey: 'font', part: 'font', proMark: 'try' })),
    colours: r(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'colours', proMark: 'try' })),
    'colours (no Mood Board, owned)': r(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'colours', proMark: 'owned' })),
    'colours (locked)': r(React.createElement(ColorsPanel, { ...base, rowKey: 'colors', part: 'colours', proLocked: true, proLock: null })),
    'step head': r(
      React.createElement(GuideHead, {
        step: { key: 'theme', stages: ['save_the_date'], title: 'Theme', shows: 'The look of your whole Event Hub and every print.', optional: false, items: ['theme'], piece: null, left: [], state: 'left' },
        roundTitle: 'Save the Date',
        itemLabel: 'Theme',
        compact: true,
        bare: true,
      }),
    ),
  };
}

test('(3) no Save button inside Look — every Look form drafts each change itself, into the draft', async () => {
  const parts = await paintLookControls();
  for (const [name, html] of Object.entries(parts)) {
    assert.doesNotMatch(html, /type="submit"/, `${name}: a submit button came back inside Look`);
    assert.doesNotMatch(html, /<button[^>]*>\s*(Save|Saving…)\s*<\/button>/, `${name}: a Save button came back inside Look`);
    if (/<form/.test(html)) {
      assert.match(html, /data-drafts-as-you-go=""/, `${name}: a Look form with no Save and no drafting — a change could never be kept`);
      assert.match(html, /name="draft" value="1"/, `${name}: a Look form drafts live, not into the draft`);
    }
  }
  // The drafting posts through the form's OWN action, compares before it sends, and waits for a draft on its way.
  const go = read(`${E}/drafts-as-you-go.tsx`);
  assert.match(go, /if \(now === last\) return;\s*last = now;\s*form\.requestSubmit\(\);/, 'an unchanged form would draft (opening must never write)');
  assert.match(go, /if \(pendingRef\.current\) \{/, 'a second draft does not wait for the first');
});

test('(4) no caption under a Look control — every line of text in Look is a label, never a sentence', async () => {
  const parts = await paintLookControls();
  for (const [name, html] of Object.entries(parts)) {
    /* Visible text blocks: <p>, <small> and the step head — what a phone reads under a control. */
    const lines = [...html.matchAll(/<(p|small)\b[^>]*>([\s\S]*?)<\/\1>/g)]
      .filter((m) => !/role="alert"/.test(m[0]) && !/class="sr-only"/.test(m[0]))
      .map((m) => m[2]!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    for (const line of lines) {
      const words = line.split(' ').length;
      assert.ok(words <= 3 && !/[.!?]$/.test(line), `${name}: a caption under a control — “${line}”`);
    }
  }
  // The theme menu (it imports the draft action, which no render test can load — held at the
  // source): the dropdown and its (i), and nothing under them but a refusal.
  const menu = read(`${L}/maker-theme-picker.tsx`);
  const body = menu.slice(menu.indexOf('export function MakerThemeMenu'));
  assert.ok(body.includes('<PickMenu'), 'anti-vacuity: the theme menu was not found');
  assert.equal((body.match(/<p\b/g) ?? []).length, (body.match(/<p role="alert"/g) ?? []).length, 'a caption came back under the theme ▾');
  // The palette row (needs the scene door, so held at the source): no line under its dropdown.
  const style = read(`${E}/scene-style-row.tsx`);
  const palette = style.slice(style.indexOf('export function PaletteLookCanvasRow'));
  assert.ok(palette.includes('<PaletteLookRow'), 'anti-vacuity: the palette row was not found');
  assert.doesNotMatch(palette, /<p className="text-\[12px\] text-ink\/60"/, 'a caption came back under the palette');
  // The background's "None" choice: no line under it.
  assert.doesNotMatch(read(`${E}/main-background-panel.tsx`), /data-main-ground-note=/, 'a caption came back under Background › None');
});

test('(5) Art direction and Magic Move are ONE dropdown each, with the ◆ beside the name — never radios', async () => {
  const { colours } = await paintLookControls();
  assert.doesNotMatch(colours, /type="radio"/, 'a radio list came back in Colours');
  for (const [what, attr, field, value] of [
    ['Art direction', 'data-art-direction-pick', 'site_art_direction', 'candlelight'],
    ['Magic Move', 'data-magic-move-pick', 'site_magic_traveller', 'mark'],
  ] as const) {
    const btn = tagWith(colours, attr);
    assert.match(btn, /aria-haspopup="listbox"/, `${what} is not a dropdown`);
    assert.match(btn, new RegExp(`aria-label="${what}: `), `${what}'s dropdown has no name`);
    assert.equal((colours.match(new RegExp(`name="${field}"`, 'g')) ?? []).length, 1, `${what} posts more than one field`);
    assert.match(colours, new RegExp(`<input type="hidden" name="${field}" value="${value}"/>`), `${what} does not post its pick`);
    // ◆ beside the name, before its dropdown.
    const label = colours.slice(colours.lastIndexOf('<p class=', colours.indexOf(attr)), colours.indexOf(attr));
    assert.match(label, new RegExp(`${what}<`), `${what} lost its label`);
    assert.match(label, /data-paid-mark|aria-label="[^"]*Event Hub Pro/i, `${what} lost its ◆`);
  }
});

/* ── (6) the segmented control ─────────────────────────────────────────── */

test('(6) "Your page / All themes" is the one segmented control — wine on the chosen segment', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { DetailsLookPageBody } = await import(`../${L}/details-look-pages`);
  const html = renderToStaticMarkup(React.createElement(DetailsLookPageBody, { gallery: null }));
  const sw = html.slice(html.indexOf('data-look-view-switch'), html.indexOf('</div></div>', html.indexOf('data-look-view-switch')));
  assert.match(sw, /role="group" aria-label="What the page shows" class="flex min-w-0 flex-wrap gap-0\.5 rounded-lg bg-ink\/\[0\.06\]/, 'not the shared ISegmented track');
  assert.match(sw, /aria-pressed="true"[^>]*class="[^"]*bg-mulberry text-white[^"]*"[^>]*>Your page</, 'the chosen segment is not wine');
  assert.match(sw, /aria-pressed="false"[^>]*>All themes</);
  assert.doesNotMatch(read(`${L}/details-look-pages.tsx`), /data-look-view=/, 'the old pill row came back');
});

/* ── (7) the theme list ────────────────────────────────────────────────── */

test('(7) the theme list is the intended set: every ready theme on the web; the free ones only in the app-store shell', () => {
  const all = pickableInviteThemes().map((t) => ({ id: t.id, name: t.name, tier: t.tier }));
  assert.ok(all.length >= 10, `anti-vacuity: ${all.length} themes`);
  assert.ok(all.some((t) => t.tier === 'pro'), 'anti-vacuity: no Pro theme to hide');
  // On the web: all of them, Pro ones too (tried here, paid at Apply), whoever owns what.
  for (const ownsPro of [false, true]) {
    assert.deepEqual(tilesShown(all, { ownsPro, storeShell: false, current: 'house' }).map((t) => t.id), all.map((t) => t.id), `the web hides a theme (ownsPro=${ownsPro})`);
  }
  // In the app-store shell (App Review 3.1.1, owner 2026-09-05): the free ones — the three the owner saw.
  const free = FREE_THEMES.map((t) => t.id);
  assert.deepEqual(tilesShown(all, { ownsPro: false, storeShell: true, current: 'house' }).map((t) => t.id), free);
  assert.deepEqual(FREE_THEMES.map((t) => t.name), ['Classic', 'Modern', 'Cyber Neon'], 'the free set moved — the finding in the PR names these three');
  // The menu lists what `tilesShown` returns, each Pro one marked ◆ where it may be tried.
  const menu = read(`${L}/maker-theme-picker.tsx`);
  const at = menu.indexOf('export function MakerThemeMenu');
  assert.ok(at > 0, 'anti-vacuity: the menu was not found');
  const body = menu.slice(at);
  assert.match(body, /const shown = tilesShown\(themes, \{ ownsPro, storeShell, current: picked \}\);/);
  assert.match(body, /options=\{shown\.map\(\(t\) => \(\{ key: t\.id, label: t\.tier === 'pro' && !\(storeShell && !ownsPro\) \? `\$\{t\.name\} ◆` : t\.name \}\)\)\}/);
  // The Maker hands it every pickable theme — never a pre-filtered list.
  assert.match(read('app/dashboard/[eventId]/launch/page.tsx'), /const themes = pickableInviteThemes\(\);/);
});
