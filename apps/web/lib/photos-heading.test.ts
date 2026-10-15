/**
 * ✍ THE PHOTOS SCENE'S OWN HEADING (owner 2026-10-15, DECISION_LOG "GLIMPSE PHOTO STYLE APPROVED; THE PHOTOS SCENE
 * GETS A TYPED HEADING"): typed once, kept on the scene's own row (`config_json.photos_heading`), drafted until
 * ✓ Apply, drawn by EVERY Photos style — and with none typed, the scene is exactly today's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CUSTOM_COLUMN_TITLE_MAX } from '@/app/[slug]/_components/editorial/custom-columns';
import { PHOTOS_HEADING_KEY, PHOTOS_HEADING_MAX, configWithPhotosHeading, photosHeadingOf, sanitizePhotosHeading, storedPhotosHeading } from './photos-heading';
import { classifyHubDraft, overlayHubDraftWidgets, sanitizeHubDraft, type HubLiveState } from './hub-draft';
import type { InvitationWidgetRow } from './invitation-widgets';

/* The neighbouring render tests' harness: `"jsx": "preserve"`, so React is global before the dynamic imports. */
(globalThis as unknown as { React: unknown }).React = React;
const h = React.createElement;

const row = (p: Partial<InvitationWidgetRow> & Pick<InvitationWidgetRow, 'widget_type'>): InvitationWidgetRow => ({
  widget_id: `w-${p.widget_type}`,
  event_id: 'e1',
  display_order: 5,
  is_visible: true,
  is_always_on: false,
  tier: 'basic',
  config_json: {},
  created_at: '',
  updated_at: '',
  mode: 'auto',
  ...p,
});

test('a heading is one trimmed line, held to the scene-of-their-own heading cap; anything else is no heading', () => {
  assert.equal(PHOTOS_HEADING_MAX, CUSTOM_COLUMN_TITLE_MAX, 'the cap is a heading’s cap, one home');
  assert.equal(sanitizePhotosHeading('  Glimpse   of\nUs '), 'Glimpse of Us');
  for (const bad of ['', '   ', null, 42, 'x'.repeat(PHOTOS_HEADING_MAX + 1), 'a\u0007b']) assert.equal(sanitizePhotosHeading(bad), null, JSON.stringify(bad));
  assert.equal(photosHeadingOf({ [PHOTOS_HEADING_KEY]: 'Us' }), 'Us');
  assert.equal(photosHeadingOf(null), null);
  assert.equal(storedPhotosHeading([row({ widget_type: 'countdown', config_json: { photos_heading: 'no' } }), row({ widget_type: 'our_photos', config_json: { photos_heading: 'Yes' } })]), 'Yes');
  assert.deepEqual(configWithPhotosHeading({ std_lead: 'photos' }, 'Us'), { std_lead: 'photos', photos_heading: 'Us' }, 'a sibling key is kept');
  assert.deepEqual(configWithPhotosHeading({ std_lead: 'photos', photos_heading: 'Us' }, null), { std_lead: 'photos' });
});

test('drafted on the Photos row only; a blank one means "no heading", never a refusal', () => {
  const d = sanitizeHubDraft({ widgets: { our_photos: { photos_heading: '  Glimpse of Us ' }, countdown: { photos_heading: 'Nope' } } });
  assert.deepEqual(d.widgets.our_photos, { photos_heading: 'Glimpse of Us' });
  assert.equal(d.widgets.countdown, undefined, 'another scene carries no Photos heading');
  assert.deepEqual(sanitizeHubDraft({ widgets: { our_photos: { photos_heading: '' } } }).widgets.our_photos, { photos_heading: null });
  assert.deepEqual(sanitizeHubDraft({ widgets: { our_photos: { photos_heading: null } } }).widgets.our_photos, { photos_heading: null });
  assert.equal(sanitizeHubDraft({ widgets: { our_photos: { photos_heading: 'x'.repeat(200) } } }).widgets.our_photos, undefined, 'over the cap is dropped, not cut');
});

test('the Maker draws the drafted heading; Apply names ONE free change, and none when it matches live', () => {
  const live: HubLiveState = { events: {}, widgets: [row({ widget_type: 'our_photos', config_json: { std_lead: 'photos' } })] };
  const draft = sanitizeHubDraft({ widgets: { our_photos: { photos_heading: 'Glimpse of Us' } } });
  const [drawn] = overlayHubDraftWidgets(live.widgets as readonly InvitationWidgetRow[], draft);
  assert.deepEqual(drawn!.config_json, { std_lead: 'photos', photos_heading: 'Glimpse of Us' });
  const items = classifyHubDraft(draft, live).items;
  assert.equal(items.length, 1);
  assert.deepEqual({ ...items[0] }, { kind: 'widget', widgetType: 'our_photos', widgetId: 'w-our_photos', field: 'photos_heading', value: 'Glimpse of Us', change: 'change', pro: false });
  const same: HubLiveState = { events: {}, widgets: [row({ widget_type: 'our_photos', config_json: { photos_heading: 'Glimpse of Us' } })] };
  assert.deepEqual(classifyHubDraft(draft, same).items, [], 'the same heading is no change');
  const cleared = sanitizeHubDraft({ widgets: { our_photos: { photos_heading: '' } } });
  assert.equal(classifyHubDraft(cleared, same).items[0]?.value, null, 'clearing it is one change, back to none');
});

test('every Photos style draws the heading under "Our photos"; with none, not one byte changes', async () => {
  const { OurPhotosWidget } = await import('@/app/[slug]/_components/our-photos-widget');
  const urls = ['https://m/1.jpg', 'https://m/2.jpg', 'https://m/3.jpg'];
  for (const sceneStyle of [null, 'mosaic', 'grid', 'film-strip', 'glimpse']) {
    const plain = renderToStaticMarkup(h(OurPhotosWidget, { urls, sceneStyle }));
    assert.equal(renderToStaticMarkup(h(OurPhotosWidget, { urls, sceneStyle, heading: null })), plain, `${sceneStyle}: no heading is today's scene`);
    assert.ok(!plain.includes('data-photos-heading'), `${sceneStyle}: no heading drawn when none was typed`);
    const out = renderToStaticMarkup(h(OurPhotosWidget, { urls, sceneStyle, heading: 'Glimpse of Us' }));
    assert.match(out, /<h2[^>]*data-photos-heading=""[^>]*>Glimpse of Us<\/h2>/, `${sceneStyle}: the heading is drawn`);
    assert.ok(out.indexOf('Our photos') < out.indexOf('Glimpse of Us'), `${sceneStyle}: under the "Our photos" line`);
    assert.ok(out.indexOf('Glimpse of Us') < out.indexOf('https://m/1.jpg'), `${sceneStyle}: above the photos`);
  }
});

test('both guest dispatchers hand the row’s heading to the scene', async () => {
  const { readFileSync } = await import('node:fs');
  for (const f of ['public-hideable-widget.tsx', 'hideable-widget-render.tsx']) {
    const src = readFileSync(new URL(`../app/[slug]/_components/${f}`, import.meta.url), 'utf8');
    assert.match(src, /<OurPhotosWidget urls=\{ourPhotoUrls\} sceneStyle=\{sceneStyle\} heading=\{photosHeadingOf\(widget\.config_json\)\} \/>/, `${f} drops the heading`);
  }
});
