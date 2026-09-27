/**
 * the-maker-draws-empty-scenes.test.ts — owner 2026-09-27, on his own page:
 * *"i still cannot edit. the editing body page is not working at all."*
 *
 * Measured live: Love Story, Venue and Message were EMPTY, so the Maker's
 * canvas drew nothing for them and they sank into "Not shown" — the scenes he
 * most needed to fill were the ones he could not tap. This holds:
 *
 *   A. in the Maker, an empty scene is ON the canvas, with its placeholder;
 *      for a guest it is not (their page still skips an empty scene);
 *   T. "Two ways to celebrate" is not on the Invitation or the Day for guests,
 *      so the Maker's canvas and its list omit it too — one rule for both
 *      (owner review 2026-09-27). Post Event keeps it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';

import { stripComments } from './strip-comments';
import { makerDrawsEmpty, makerEmptyPrompt, widgetsGuestsMeet } from './maker-scene-list';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';

(globalThis as unknown as { React: unknown }).React = React;

/* ── `server-only` shim (same as money-reads-are-honest.test.ts): the dispatcher
   reads the event's timezone through a `.server` module. ─────────────────── */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const CjsModule = (createRequire(__filename)('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_maker_empty_scenes__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const BODY = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/site-body.tsx'), 'utf8'));

function row(type: WidgetType): InvitationWidgetRow {
  return {
    widget_id: `id-${type}`, event_id: 'e1', widget_type: type, display_order: 1, is_visible: true,
    is_always_on: false, tier: 'basic', config_json: {}, created_at: '', updated_at: '', mode: 'auto',
  };
}

async function renderDispatcher(type: WidgetType, opts: { guestView: boolean; makerEmpty: boolean }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { PublicHideableWidget } = await import('../app/[slug]/_components/public-hideable-widget');
  const event = {
    event_id: 'e1', slug: 'x', display_name: 'Cale & Ice', event_type: 'wedding', event_date: '2026-12-18',
    venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null,
    love_story: null, special_message: null, what_to_bring: null, our_photos: [],
    dress_code_config: null, photo_moments_config: null,
  } as unknown as Parameters<typeof PublicHideableWidget>[0]['event'];
  return renderToStaticMarkup(
    React.createElement(PublicHideableWidget, {
      widget: row(type),
      event,
      words: { solemn: false, twoPeople: true } as unknown as Parameters<typeof PublicHideableWidget>[0]['words'],
      scheduleBlocks: [],
      isLive: false,
      ourPhotoUrls: [],
      guestView: opts.guestView,
      makerEmpty: opts.makerEmpty,
    }),
  );
}

test('A · in the Maker an EMPTY scene is on the canvas, with its placeholder', async () => {
  for (const type of ['our_love_story', 'venue_map', 'special_message', 'schedule'] as WidgetType[]) {
    const html = await renderDispatcher(type, { guestView: false, makerEmpty: true });
    assert.match(html, new RegExp(`data-maker-empty="${type}"`), `${type}: no placeholder in the Maker`);
    assert.ok(html.includes(makerEmptyPrompt(type)), `${type}: the placeholder does not say what to add`);
  }
  assert.match(makerEmptyPrompt('our_love_story'), /Add your story/);
});

test('A · for a GUEST the same empty scene draws nothing — no placeholder ever reaches them', async () => {
  for (const type of ['our_love_story', 'special_message', 'schedule'] as WidgetType[]) {
    const html = await renderDispatcher(type, { guestView: true, makerEmpty: false });
    assert.doesNotMatch(html, /data-maker-empty/, `${type}: a guest was shown the Maker's placeholder`);
    assert.doesNotMatch(html, /Only you see this/);
  }
});

test('A · SOURCE: the placeholder flag is the Maker canvas only, and the plan keeps empties there', () => {
  assert.match(BODY, /makerEmpty=\{\s*isMakerCanvas && makerDrawsEmpty\(widget\.widget_type\) &&/);
  assert.match(BODY, /content: isMakerCanvas \? \{\} : openBrowseContent,/);
  assert.ok(makerDrawsEmpty('our_love_story') && makerDrawsEmpty('custom_1' as WidgetType));
  assert.ok(!makerDrawsEmpty('rsvp'), 'the RSVP form is never a placeholder');
});

test('T · "Two ways to celebrate" is omitted on EVERY stage — for guests AND in the Maker', () => {
  // Owner 2026-09-27, "EACH STAGE DOES ONE JOB": on no stage, Post Event
  // included (it was the separate decision this line used to hold open).
  const rows = (['schedule', 'tier_comparison', 'venue_map'] as WidgetType[]).map(row);
  for (const stage of ['save_the_date', 'rsvp', 'event', 'editorial'] as const) {
    assert.ok(!widgetsGuestsMeet(rows, stage).some((w) => w.widget_type === 'tier_comparison'), `${stage}: still shown`);
  }
  // The page asks the ONE rule, with no Maker exception.
  assert.match(BODY, /widgets: widgetsGuestsMeet\(widgets, lifecyclePhase\),/);
  assert.doesNotMatch(BODY, /isMakerCanvas \|\| lifecyclePhase === 'editorial'/);
});
