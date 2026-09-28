/**
 * a-free-section-tries-every-look-control.test.ts — the editor half, RENDERED.
 * (Was `a-free-section-shows-no-look-controls.test.ts` — re-pointed 2026-09-28.)
 *
 * Owner, 2026-09-24 ("A"): how a section looks and moves is Event Hub Pro.
 * Owner, 2026-09-28, verbatim: *"they can edit it with pro features. but need to
 * upgrade to pro when clicked on apply and point out the effect chosen that
 * caused them to upgrade to pro"*. So in the Maker every look control posts to
 * the DRAFT and Apply is the gate (held by `lib/try-pro-pay-at-apply.test.ts`).
 * This file paints the real `SectionsPanel` and asserts what a couple SEES:
 *
 *   • ON THE WEB a free couple gets EVERY control — presets, the photo picker,
 *     the crop keypad, the transitions — each form drafting, each Pro group
 *     wearing ◆ PRO (`data-paid-mark="try"`), and NO lock;
 *   • IN THE APP-STORE SHELL (`hideLocked`) a free couple still sees no look
 *     control — the shell rule is unchanged — and what they already chose stays
 *     removable ("Reset how it moves", "Remove this section's photo");
 *   • and an OWNING couple gets every control with the diamond (a gate that can
 *     only answer one way renders exactly like a gate that works).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

import type { InvitationWidgetRow } from './invitation-widgets';

const noop = () => {};
const PHOTO = 'r2://setnayan-media/events/E1/our-photos/a.jpg';
const CHOICES = [{ ref: PHOTO, url: 'https://example.test/a.jpg' }] as const;
const LOCK = 'LOCK-PANEL-SENTINEL';

function row(config_json: unknown = null): InvitationWidgetRow {
  return {
    widget_id: 'W1',
    event_id: 'E1',
    widget_type: 'our_love_story',
    display_order: 1,
    is_visible: true,
    is_always_on: false,
    tier: 'free',
    config_json,
    created_at: null,
    updated_at: null,
  } as unknown as InvitationWidgetRow;
}

async function paint(
  r: InvitationWidgetRow | InvitationWidgetRow[],
  ownsPro: boolean,
  colorChoices: readonly string[] = [],
  hideLocked = false,
): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel } = await import(
    '../app/dashboard/[eventId]/website/editor/_components/sections-panel'
  );
  return renderToStaticMarkup(
    React.createElement(SectionsPanel, {
      eventId: 'E1',
      rows: Array.isArray(r) ? r : [r],
      contentMap: { our_love_story: true },
      toggleAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      setModeAction: noop,
      setMotionAction: noop,
      setBackgroundAction: noop,
      setCropAction: noop,
      photoChoices: CHOICES,
      colorChoices,
      ownsPro,
      hideLocked,
      transitionLocked: !ownsPro,
      customLock: React.createElement('p', null, LOCK),
    }),
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('💎 on the web a free couple gets every look control, drafted, marked ◆ PRO — and no lock', async () => {
  // Two sections, so the first has a hand-over into the next (Scrub · Auto).
  const second = { ...row(), widget_id: 'W2', widget_type: 'schedule', display_order: 2 } as InvitationWidgetRow;
  const html = await paint([row({ canvas: { media: PHOTO } }), second], false);
  console.log(`[free-section:web] lock=${count(html, LOCK)} howItMoves=${count(html, 'How it moves')} try=${count(html, 'data-paid-mark="try"')} padlock=${count(html, 'data-paid-mark="locked"')}`);
  assert.equal(count(html, LOCK), 0, 'a lock panel is drawn for a control that works');
  assert.match(html, /How it moves/);
  assert.match(html, /name="preset"/, 'the presets are not offered');
  assert.match(html, new RegExp(`name="media" value="${PHOTO}"`), 'the photo picker is not offered');
  assert.match(html, /What to keep in frame/, 'the crop is not offered');
  assert.match(html, /name="transition" value="scrub"/, 'Scrub is not offered');
  assert.doesNotMatch(html, /Unlock with Event Hub Pro/, 'a transition still sends them to the buy page');
  assert.ok(count(html, 'data-paid-mark="try"') >= 1, 'no ◆ PRO mark on the Pro controls');
  assert.equal(count(html, 'data-paid-mark="locked"'), 0, 'a padlock on a control that works');
  // Every look form drafts — Apply is the gate, never the form.
  const forms = html.split('<form').slice(1);
  const lookForms = forms.filter((f) => /name="(preset|transition|media|focal)"/.test(f));
  assert.ok(lookForms.length > 3, `anti-vacuity: only ${lookForms.length} look forms`);
  for (const f of lookForms) assert.match(f, /name="draft" value="1"/, 'a look form writes live');
});

test('in the app-store shell a free couple sees no look controls (the shell rule, unchanged)', async () => {
  const html = await paint(row(), false, [], true);
  assert.equal(count(html, LOCK), 0, 'the shell shows no pitch');
  assert.doesNotMatch(html, /How it moves/);
  assert.doesNotMatch(html, /What to keep in frame/);
  assert.doesNotMatch(html, /name="preset"/);
  assert.doesNotMatch(html, new RegExp(`value="${PHOTO}"`), 'no photo may be offered to pick');
  assert.doesNotMatch(html, /Reset how it moves/, 'nothing to reset');
  assert.doesNotMatch(html, /Remove this section/, 'nothing to remove');
  // The page we write stays theirs to arrange: order + show/hide are free.
  assert.match(html, /name="next_mode"/);
});

test('in the app-store shell a free couple who already chose a look can take it off — and only that', async () => {
  const html = await paint(row({ canvas: { preset: 'cinematic', media: PHOTO, focal: 3 } }), false, [], true);
  assert.match(html, /Reset how it moves/);
  assert.match(html, /name="reset" value="1"/);
  assert.match(html, /Remove this section(&rsquo;|’|&#x27;|')s photo/);
  assert.match(html, /name="media" value=""/);
  assert.doesNotMatch(html, /name="preset"/, 'no preset may be re-chosen');
  assert.doesNotMatch(html, /name="focal"/, 'the crop may not be moved');
  assert.doesNotMatch(html, new RegExp(`name="media" value="${PHOTO}"`));
});

test('an owning couple still gets every control, and no lock', async () => {
  const html = await paint(row({ canvas: { preset: 'calm', media: PHOTO } }), true);
  assert.equal(count(html, LOCK), 0);
  assert.equal(count(html, 'data-paid-mark="try"'), 0, 'an owning couple is shown ◆ PRO as if unpaid');
  assert.match(html, /How it moves/);
  assert.match(html, /name="preset"/);
  assert.match(html, new RegExp(`name="media" value="${PHOTO}"`));
  assert.match(html, /What to keep in frame/);
});

/* ── A section's COLOUR is free (owner 2026-09-24: "changing background color
   is free. making media a background is pro.") — Phase 0 ④. The free rail used
   to hide the colour swatches with the photo picker; a colour write is never
   refused (`sectionBackgroundChange`), so a free couple must be OFFERED it. */
const SWATCHES = ['#a9834b', '#35403a'] as const;

test('a free couple is offered the section colour — and, in the app-store shell, no photo to pick', async () => {
  const html = await paint(row(), false, SWATCHES, true);
  for (const hex of SWATCHES) {
    assert.match(html, new RegExp(`name="color" value="${hex}"`), `swatch ${hex}`);
  }
  // One form per swatch, the light surface that always leads them (owner
  // 2026-09-27: "opaque glass, frosted glass does not work" — a glass reads as
  // glass when it is light), plus the scene Background row's own "Full colour"
  // choice — never a colour-clearing chip: "No background" is the one None
  // now, and it means no box.
  assert.match(html, /name="color" value="#ffffff"/, 'the light surface is not offered');
  const light = html.indexOf('aria-label="Use #ffffff as the background"');
  assert.ok(light >= 0, 'anti-vacuity: the light swatch is not drawn');
  assert.ok(
    light < html.indexOf(`aria-label="Use ${SWATCHES[0]} as the background"`),
    'the light surface must come first',
  );
  assert.equal(count(html, 'name="kind" value="color"'), SWATCHES.length + 2, 'an extra colour form appeared');
  // Both glasses START light — never from the couple's darkest swatch (#35403a here).
  for (const glass of ['glass', 'frost']) {
    const form = new RegExp(`name="kind" value="${glass}"/><input type="hidden" name="color" value="([^"]+)"`).exec(html);
    assert.ok(form, `anti-vacuity: no ${glass} choice`);
    assert.equal(form[1], '#ffffff', `${glass} does not start as the light surface`);
  }
  assert.match(html, /data-scene-bg-choice="none"/, 'No background is always offered — it is free');
  assert.doesNotMatch(html, new RegExp(`value="${PHOTO}"`), 'no photo may be offered to pick');
  assert.doesNotMatch(html, /name="kind" value="snippet"/, 'no video may be offered either');
  assert.doesNotMatch(html, /What to keep in frame/);
});

test('a free couple with a colour set can change it or clear it', async () => {
  const html = await paint(row({ canvas: { kind: 'color', color: SWATCHES[0] } }), false, SWATCHES);
  assert.match(html, new RegExp(`aria-label="Current background colour ${SWATCHES[0]}"`));
  // "No background" is the free way off a colour (2026-09-27) — it posts
  // kind=none, which also means no box.
  assert.match(html, /name="kind" value="none"/, 'No background clears the colour');
  assert.match(html, /aria-pressed="true" data-scene-bg-choice="color"/, 'the colour is not shown as chosen')
  assert.doesNotMatch(html, /Remove this section/, 'a colour is not media — nothing to remove');
});

test('in the app-store shell a free couple with a Scrub hand-over (#5951) can reset it', async () => {
  const html = await paint(row({ canvas: { transition: 'scrub' } }), false, [], true);
  assert.match(html, /Reset how it moves/);
  assert.doesNotMatch(html, /name="transition"/, 'the transition may not be re-chosen');
});

test('an owning couple sees the same colour swatches beside the photos', async () => {
  const html = await paint(row(), true, SWATCHES);
  for (const hex of SWATCHES) assert.match(html, new RegExp(`name="color" value="${hex}"`));
  assert.match(html, new RegExp(`name="media" value="${PHOTO}"`));
});

/* ── The Colours row (owner 2026-09-24: "changing background color is free") ── */

async function paintColors(proLocked: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColorsPanel } = await import(
    '../app/dashboard/[eventId]/website/editor/_components/pro-panels'
  );
  return renderToStaticMarkup(
    React.createElement(ColorsPanel, {
      action: noop,
      eventId: 'E1',
      rowKey: 'colors',
      bgColor: '#f5efe6',
      buttonColor: null,
      artDirection: null,
      proLocked,
      proLock: React.createElement('p', null, LOCK),
    }),
  );
}

test('in the app-store shell (proLocked) a free couple can recolour the background and the buttons — and sees no Pro field to post', async () => {
  const html = await paintColors(true);
  assert.match(html, /name="bg_color"/, 'the background colour is free');
  // 💎 The button colour joined it 2026-09-28 (owner: "change … color … only
  // when you start adding themes will it be pro").
  assert.match(html, /name="button_color"/, 'the button colour is free');
  assert.equal(count(html, LOCK), 1);
  // Absent fields are "unchanged" in updateSiteColors — so NONE may render.
  for (const f of ['site_art_direction', 'site_font_key', 'site_magic_traveller']) {
    assert.doesNotMatch(html, new RegExp(`name="${f}"`), f);
  }
  assert.match(html, /type="submit"/, 'the background can still be saved');
});

test('💎 a free couple on the web sees the whole Colours row with ◆ PRO on its Pro half', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ColorsPanel } = await import('../app/dashboard/[eventId]/website/editor/_components/pro-panels');
  const html = renderToStaticMarkup(
    React.createElement(ColorsPanel, {
      action: noop,
      eventId: 'E1',
      rowKey: 'colors',
      bgColor: '#f5efe6',
      buttonColor: null,
      artDirection: null,
      proLocked: false,
      proMark: 'try',
    }),
  );
  for (const f of ['site_art_direction', 'site_font_key', 'site_magic_traveller']) {
    assert.match(html, new RegExp(`name="${f}"`), f);
  }
  assert.equal(count(html, 'data-paid-mark="try"'), 3, 'Art direction · Typeface · Magic Move each wear ◆ PRO');
  assert.match(html, /name="draft" value="1"/, 'the Colours row writes live');
});

test('an owning couple sees the whole Colours row, and no lock', async () => {
  const html = await paintColors(false);
  assert.equal(count(html, LOCK), 0);
  for (const f of ['bg_color', 'button_color', 'site_art_direction', 'site_font_key', 'site_magic_traveller']) {
    assert.match(html, new RegExp(`name="${f}"`), f);
  }
});
