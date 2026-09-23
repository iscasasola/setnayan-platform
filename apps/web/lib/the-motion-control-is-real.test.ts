/**
 * the-motion-control-is-real.test.ts — THE CONTROL MOVES THE PAGE.
 *
 * "How it moves" is four buttons in the editor rail. The failure this guards
 * against is the house one, one layer up from the canvas CSS: a control that
 * looks like a choice, stores a value, and changes nothing a guest can see.
 *
 * So this renders the PANEL and reads the emitted HTML, then follows the value
 * it posts all the way to the classes the guest page carries.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

import {
  HUB_MOTION_PRESETS,
  HUB_MOTION_PRESET_LABEL,
  hubCanvasClass,
  sanitizeHubCanvas,
} from './hub-canvas';
import type { InvitationWidgetRow } from './invitation-widgets';

const noop = () => {};

function row(over: Partial<InvitationWidgetRow> = {}): InvitationWidgetRow {
  return {
    widget_id: 'W1',
    event_id: 'E1',
    widget_type: 'our_love_story',
    display_order: 1,
    is_visible: true,
    is_always_on: false,
    tier: 'free',
    config_json: null,
    created_at: null,
    updated_at: null,
    ...over,
  } as InvitationWidgetRow;
}

const PHOTO = 'r2://setnayan-media/events/E1/our-photos/a.jpg';
const CHOICES = [{ ref: PHOTO, url: 'https://example.test/a.jpg' }] as const;

async function paint(rows: InvitationWidgetRow[], withMotion = true): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SectionsPanel } = await import(
    '../app/dashboard/[eventId]/website/editor/_components/sections-panel'
  );
  return renderToStaticMarkup(
    React.createElement(SectionsPanel, {
      eventId: 'E1',
      rows,
      contentMap: { our_love_story: true },
      toggleAction: noop,
      moveUpAction: noop,
      moveDownAction: noop,
      setModeAction: noop,
      // The background picker and the crop under it are always wired in this
      // harness: the crop's own gate is the PHOTO, and a test that satisfied
      // it by withholding the action would prove nothing about the photo.
      setBackgroundAction: noop,
      setCropAction: noop,
      photoChoices: CHOICES,
      ...(withMotion ? { setMotionAction: noop } : {}),
    }),
  );
}

test('⭐ all four presets are offered, by name, on every section', async () => {
  const html = await paint([row()]);
  assert.match(html, /How it moves/);
  for (const p of HUB_MOTION_PRESETS) {
    assert.match(
      html,
      new RegExp(`value="${p}"`),
      `the "${HUB_MOTION_PRESET_LABEL[p]}" button must post its own preset`,
    );
  }
});

test('⭐ the couple’s saved choice is the one shown as pressed', async () => {
  const html = await paint([row({ config_json: { canvas: { preset: 'cinematic' } } })]);
  // The pressed chip is the saved one, and only that one.
  const pressed = [...html.matchAll(/aria-pressed="true"[\s\S]{0,260}?>([^<]+)</g)].map((m) =>
    m[1]?.trim(),
  );
  assert.ok(pressed.includes('Cinematic'), `expected Cinematic pressed, saw ${JSON.stringify(pressed)}`);
  assert.equal(pressed.includes('Calm'), false, 'and not the default it is not set to');
});

test('⛔ the timing override only appears once a preset is chosen', async () => {
  // Offering "Auto / Plays once / Follows the scroll" on a section with no
  // preset would be a control refining a decision nobody has made.
  const none = await paint([row()]);
  assert.doesNotMatch(none, /Follows the scroll/, 'nothing to refine yet');
  const some = await paint([row({ config_json: { canvas: { preset: 'calm' } } })]);
  assert.match(some, /Follows the scroll/);
  assert.match(some, /name="timeline" value="auto"/, 'and Auto is offered as a way back');
});

test('⛔ every posted preset survives the sanitizer and lands on the page', async () => {
  // The whole chain, in one assertion: the value the button posts → what the
  // action would store → the class the guest page carries. A preset that the
  // sanitizer dropped would leave a button that changes nothing.
  const html = await paint([row()]);
  for (const p of HUB_MOTION_PRESETS) {
    assert.match(html, new RegExp(`name="preset" value="${p}"`));
    const stored = sanitizeHubCanvas({ canvas: { preset: p } });
    assert.equal(stored.preset, p, `"${p}" must survive the round trip`);
    assert.match(hubCanvasClass(stored), /\bhub-in-\w+\b/, 'and reach the guest page as a class');
  }
  // Non-vacuity: the four presets must not all paint the same page.
  const classes = new Set(
    HUB_MOTION_PRESETS.map((p) => hubCanvasClass(sanitizeHubCanvas({ canvas: { preset: p } }))),
  );
  assert.equal(classes.size, HUB_MOTION_PRESETS.length, 'four buttons, four different pages');
});

test('⛔ the writer MERGES config_json — a sibling setting is never deleted', () => {
  // `config_json` is a shared bag typed `unknown`; any widget may keep its own
  // settings there. Writing `{ canvas }` over the top would delete them
  // silently, and only the guest page would show it.
  const src = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts'),
    'utf8',
  );
  const at = src.indexOf('export async function setWidgetMotion');
  assert.ok(at > 0, 'the action exists');
  const body = src.slice(at);
  assert.match(body, /const next = \{ \.\.\.existing, canvas \}/, 'it spreads what was already there');
  assert.match(body, /\.select\('widget_id, config_json'\)/, 'read from the row, not from the form');
  assert.match(body, /if \(timelineRaw === 'auto'\) delete canvas\.timeline;/, 'Auto deletes the key');
  assert.match(body, /requireHostMembershipOrThrow/, 'and only a host may write it');
});

test('⛔ a caller that has not wired the action gets no dead controls', async () => {
  const html = await paint([row()], false);
  assert.doesNotMatch(html, /How it moves/, 'no heading for a control that cannot post');
  assert.match(html, /Auto/, 'precondition: the rest of the panel still renders');
});

/* ══════════════════════════════════════════════════════════════════════════
   THE CROP — only where there is something to crop
   ══════════════════════════════════════════════════════════════════════════ */

test('⛔ no photo, no crop controls — a focal point with nothing to crop moves nothing', async () => {
  const withPhoto = await paint([
    row({ config_json: { canvas: { preset: 'calm', media: PHOTO } } }),
  ]);
  const without = await paint([row({ config_json: { canvas: { preset: 'calm' } } })]);
  assert.match(withPhoto, /What to keep in frame/, 'the keypad is offered once a photo is set');
  assert.doesNotMatch(without, /What to keep in frame/, 'and withheld while there is none');
  assert.doesNotMatch(without, /name="focal"/, 'not even a hidden one');
});

test('⭐ all nine focal points and all three distances are offered', async () => {
  const html = await paint([
    row({ config_json: { canvas: { preset: 'calm', media: PHOTO } } }),
  ]);
  for (let f = 1; f <= 9; f += 1) {
    assert.match(html, new RegExp(`name="focal" value="${f}"`), `focal ${f} must be reachable`);
  }
  for (const z of [100, 120, 150]) {
    assert.match(html, new RegExp(`name="zoom" value="${z}"`));
  }
  assert.match(html, /aria-label="Keep area 1 of 9 in frame"/, 'and each is named for a screen reader');
});

test('⛔ the crop writer refuses a section with no background, server-side too', () => {
  const src = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts'),
    'utf8',
  );
  const at = src.indexOf('export async function setWidgetCrop');
  assert.ok(at > 0, 'the action exists');
  const body = src.slice(at);
  assert.match(body, /if \(!canvas\.media\) \{/, 'a crop with nothing to crop is refused');
  assert.match(body, /requireHostMembershipOrThrow/, 'and only a host may write it');
  assert.match(body, /\.\.\.existing, canvas/, 'merging, never replacing, config_json');
  // 🔑 Its OWN action, not a third field on setWidgetBackground — that one reads
  // an empty `media` as "take the background off", so a crop form that did not
  // carry the photo would clear it on every tap.
  assert.doesNotMatch(body.slice(0, body.indexOf('export async function', 10)), /name="media"|formData\.get\('media'\)/);
});
