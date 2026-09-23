/**
 * a-section-background-is-a-ref.test.ts — THE PHOTO, NOT ITS POSITION.
 *
 * Two failures this guards, and neither is visible from the dashboard:
 *
 *   🪤 A BACKGROUND KEYED ON A LIST INDEX would silently move to a different
 *      photo the moment the couple added or removed one from their gallery.
 *      Nothing red, nothing logged — the wrong picture on a wedding page.
 *
 *   🔒 A `config_json` IS COUPLE-WRITABLE, and `displayUrlForStoredAsset` signs
 *      what it is handed. A ref naming a private bucket, or a ref belonging to
 *      SOMEBODY ELSE'S event, must be refused before it is ever stored.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

(globalThis as unknown as { React: unknown }).React = React;

import { hubCanvasClass, hubCanvasMediaRefs, hubCanvasVars, sanitizeHubCanvas } from './hub-canvas';

const PUBLIC = 'r2://setnayan-media/events/E1/our-photos/a.jpg';
const OTHER = 'r2://setnayan-media/events/E9/our-photos/z.jpg';
const PRIVATE_IDS = 'r2://setnayan-vendor-verification/E1/id.jpg';
const PRIVATE_THREAD = 'r2://setnayan-thread-files/E1/receipt.pdf';

test('⭐ a background survives as the PHOTO ITSELF, not a position', () => {
  const c = sanitizeHubCanvas({ canvas: { media: PUBLIC, preset: 'calm' } });
  assert.equal(c.media, PUBLIC, 'the ref is stored verbatim');
  // A number, a position, an index — none of them is a photo.
  for (const notARef of [0, 1, '1', '', null, [], {}]) {
    assert.equal(
      sanitizeHubCanvas({ canvas: { media: notARef } }).media,
      undefined,
      `${JSON.stringify(notARef)} must not become a background`,
    );
  }
});

test('🔒 a private bucket is refused on the way IN, before anything signs it', () => {
  for (const ref of [PRIVATE_IDS, PRIVATE_THREAD, 'r2://made-up-bucket/x.jpg']) {
    assert.equal(
      sanitizeHubCanvas({ canvas: { media: ref } }).media,
      undefined,
      `${ref} must never reach the signer from a section background`,
    );
  }
  // Non-vacuity: the public bucket is genuinely accepted.
  assert.equal(sanitizeHubCanvas({ canvas: { media: PUBLIC } }).media, PUBLIC);
});

test('🔒 the writer also proves the photo belongs to THIS event', () => {
  // Holding the bucket is not enough: the public bucket holds every event's
  // website media, so a ref from somebody else's wedding passes that test.
  const src = readFileSync(
    join(__dirname, '..', 'app', 'dashboard', '[eventId]', 'website', 'widgets', 'actions.ts'),
    'utf8',
  );
  const at = src.indexOf('export async function setWidgetBackground');
  assert.ok(at > 0, 'the action exists');
  const body = src.slice(at);
  assert.match(body, /select\('landing_page_hero_image_url, our_photos'\)/, "it reads the event's own photos");
  assert.match(body, /ownRefs\.has\(ref\)/, 'and refuses a ref that is not among them');
  // 🪤 `hubMediaRef`, not `siteMediaServeRef` — the looser one passes a bare
  // string through as a "legacy URL" and accepts `"1"`, which is exactly the
  // stringified index this whole field exists to refuse.
  assert.match(body, /hubMediaRef\(wanted\)/, 'after holding it to the public bucket, strictly');
  assert.match(body, /requireHostMembershipOrThrow/, 'and only a host may write it');
  assert.match(body, /delete canvas\.media;/, 'and "None" genuinely removes it');
  assert.match(body, /\.\.\.existing, canvas/, 'merging, never replacing, config_json');
  // The ref must not be trusted from the form alone.
  assert.ok(
    body.indexOf('ownRefs') < body.indexOf('canvas.media = ref'),
    'the ownership check comes BEFORE the write',
  );
});

test('⭐ one page signs every background ONCE, deduped', () => {
  const rows = [
    { config_json: { canvas: { media: PUBLIC } } },
    { config_json: { canvas: { media: PUBLIC } } },   // two sections, one photo
    { config_json: { canvas: { media: OTHER } } },
    { config_json: null },
    { config_json: { canvas: { media: PRIVATE_IDS } } },
  ];
  const refs = hubCanvasMediaRefs(rows);
  assert.deepEqual(refs.sort(), [OTHER, PUBLIC].sort(), 'deduped, and the private one never appears');
});

test('⛔ a ref that FAILED to sign renders no background — not an empty plate', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HubCanvasFrame } = await import('../app/[slug]/_components/hub-canvas-frame');
  const widget = { widget_id: 'W1', event_id: 'E1', widget_type: 'countdown', config_json: { canvas: { media: PUBLIC } } } as never;

  // The map is empty — a deleted object, a refused bucket, a signing outage.
  const unsigned = renderToStaticMarkup(
    React.createElement(HubCanvasFrame, { widget, mediaUrls: {} }, React.createElement('p', null, 'hi')),
  );
  assert.match(unsigned, /hub-no-media/, 'the section says it has no picture');
  assert.doesNotMatch(unsigned, /hub-canvas-media/, 'and draws no layer for one');
  assert.doesNotMatch(unsigned, /--hub-media/, 'and no empty background-image');
  assert.match(unsigned, /<p>hi<\/p>/, 'the words are still there');

  // And with a URL, the picture is drawn.
  const signed = renderToStaticMarkup(
    React.createElement(
      HubCanvasFrame,
      { widget, mediaUrls: { [PUBLIC]: 'https://example.test/a.jpg?sig=1' } },
      React.createElement('p', null, 'hi'),
    ),
  );
  assert.match(signed, /hub-has-media/);
  assert.match(signed, /hub-canvas-media/);
  assert.match(signed, /--hub-media:\s*url\(&quot;https:\/\/example\.test\/a\.jpg\?sig=1&quot;\)/);
});

test('⛔ the words always sit ABOVE the picture, and the scrim is not optional', () => {
  const css = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8');
  const at = css.indexOf('.hub-has-media {');
  assert.ok(at > 0, 'the background rules exist');
  const block = css.slice(at, at + 1800);
  assert.match(block, /\.hub-canvas-media\s*\{[\s\S]*?z-index:\s*0/, 'the picture is the lower layer');
  assert.match(block, /\.hub-canvas-body\s*\{[\s\S]*?z-index:\s*1/, 'the words are the upper one');
  /*
    Words over an arbitrary photo can land white-on-white; this product cannot
    know what the couple uploaded, so the scrim is load-bearing.

    🪤 AND THIS ASSERTION USED TO BE VACUOUS. It searched an 1,800-character
    window for `linear-gradient` after the `::after` selector — and the
    DARK-MODE copy of the same rule sits inside that window. Replacing the light
    gradient with `background: none` left the guard green while every couple on
    a light phone got unreadable words over their own photo. A window anchored
    on a selector will happily answer with a different rule's body.

    So it reads THIS rule's own braces, both times the rule appears.
  */
  const scrims = ruleBodies(css, '.hub-canvas-media::after');
  assert.equal(scrims.length, 2, 'one scrim for each theme — light and dark');
  for (const body of scrims) {
    assert.match(body, /linear-gradient\(/, 'each scrim is an actual gradient, in its own body');
    assert.doesNotMatch(body, /background:\s*none/, 'and none of them is switched off');
  }
});

/** Every `{…}` body belonging to `selector`, brace-counted, in source order. */
function ruleBodies(css: string, selector: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (;;) {
    const at = css.indexOf(selector, from);
    if (at < 0) return out;
    const open = css.indexOf('{', at);
    if (open < 0) return out;
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) {
          out.push(css.slice(open + 1, i));
          from = i;
          break;
        }
      }
    }
    if (from <= at) return out;
  }
}

test('⛔ a value the contract emits for the picture is never the string "undefined"', () => {
  const c = sanitizeHubCanvas({ canvas: { media: PUBLIC, focal: 7, zoom: 150 } });
  const vars = hubCanvasVars(c, 'https://example.test/a.jpg');
  assert.equal(vars['--hub-focal'], '0% 100%');
  assert.equal(vars['--hub-zoom'], '1.5');
  for (const [k, v] of Object.entries(vars)) {
    assert.doesNotMatch(v, /undefined|null/, `${k} renders a real value`);
  }
  // With no URL the property is ABSENT rather than empty.
  assert.equal('--hub-media' in hubCanvasVars(c, null), false);
  assert.match(hubCanvasClass(c, false), /\bhub-no-media\b/);
});
