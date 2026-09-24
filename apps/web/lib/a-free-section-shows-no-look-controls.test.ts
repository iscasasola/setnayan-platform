/**
 * a-free-section-shows-no-look-controls.test.ts — the editor half, RENDERED.
 *
 * Owner, 2026-09-24 ("A"): how a section looks and moves is Event Hub Pro. The
 * widget actions refuse a free couple (held by `hub-look-is-pro.test.ts`); this
 * file paints the real `SectionsPanel` and asserts what a free couple SEES:
 *
 *   • no motion presets, no photo picker, no crop keypad — nothing that would
 *     only bounce them to the buy page on tap;
 *   • the ONE lock, once, above the list;
 *   • what they already chose stays removable: "Reset how it moves" and
 *     "Remove this section's photo" — the two writes that are never gated;
 *   • and an OWNING couple still gets every control (a gate that can only
 *     answer one way renders exactly like a gate that works).
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

async function paint(r: InvitationWidgetRow, ownsPro: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel } = await import(
    '../app/dashboard/[eventId]/website/editor/_components/sections-panel'
  );
  return renderToStaticMarkup(
    React.createElement(SectionsPanel, {
      eventId: 'E1',
      rows: [r],
      contentMap: { our_love_story: true },
      toggleAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      setModeAction: noop,
      setMotionAction: noop,
      setBackgroundAction: noop,
      setCropAction: noop,
      photoChoices: CHOICES,
      ownsPro,
      lookLock: React.createElement('p', null, LOCK),
    }),
  );
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('a free couple with nothing chosen sees the lock once and no look controls', async () => {
  const html = await paint(row(), false);
  console.log(`[free-section] lock=${count(html, LOCK)} howItMoves=${count(html, 'How it moves')} crop=${count(html, 'What to keep in frame')}`);
  assert.equal(count(html, LOCK), 1);
  assert.doesNotMatch(html, /How it moves/);
  assert.doesNotMatch(html, /What to keep in frame/);
  assert.doesNotMatch(html, /name="preset"/);
  assert.doesNotMatch(html, new RegExp(`value="${PHOTO}"`), 'no photo may be offered to pick');
  assert.doesNotMatch(html, /Reset how it moves/, 'nothing to reset');
  assert.doesNotMatch(html, /Remove this section/, 'nothing to remove');
  // The page we write stays theirs to arrange: order + show/hide are free.
  assert.match(html, /name="next_mode"/);
});

test('a free couple who already chose a look can take it off — and only that', async () => {
  const html = await paint(row({ canvas: { preset: 'cinematic', media: PHOTO, focal: 3 } }), false);
  assert.equal(count(html, LOCK), 1);
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
  assert.match(html, /How it moves/);
  assert.match(html, /name="preset"/);
  assert.match(html, new RegExp(`name="media" value="${PHOTO}"`));
  assert.match(html, /What to keep in frame/);
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

test('a free couple can recolour the background — and sees no Pro field to post', async () => {
  const html = await paintColors(true);
  assert.match(html, /name="bg_color"/, 'the background colour is free');
  assert.equal(count(html, LOCK), 1);
  // Absent fields are "unchanged" in updateSiteColors — so NONE may render.
  for (const f of ['button_color', 'site_art_direction', 'site_font_key', 'site_magic_traveller']) {
    assert.doesNotMatch(html, new RegExp(`name="${f}"`), f);
  }
  assert.match(html, /type="submit"/, 'the background can still be saved');
});

test('an owning couple sees the whole Colours row, and no lock', async () => {
  const html = await paintColors(false);
  assert.equal(count(html, LOCK), 0);
  for (const f of ['bg_color', 'button_color', 'site_art_direction', 'site_font_key', 'site_magic_traveller']) {
    assert.match(html, new RegExp(`name="${f}"`), f);
  }
});
