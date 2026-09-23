/**
 * each-background-kind-reaches-the-page.test.ts
 *
 * The contract knows three kinds. This proves each one arrives at the guest
 * page as a DIFFERENT THING, because a discriminator that every branch renders
 * identically is a setting the couple can change with no effect — the defect
 * this whole canvas build exists to remove, one layer down.
 *
 * 🔑 A SNIPPET IS A `<video>`, NOT A BACKGROUND-IMAGE. `background-image`
 * cannot play a video; emitting the url that way would paint the poster frame
 * under the real element, which reads as a photo that mysteriously starts
 * moving. A COLOUR touches neither — it is the ground itself.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hubCanvasClass, hubCanvasVars } from './hub-canvas';
import { PUBLIC_R2_BUCKET } from './r2-client-ref';

const REF = `r2://${PUBLIC_R2_BUCKET}/events/E1/a.jpg`;
const URL_ = 'https://media.test/a.jpg';

test('⛔ a PHOTO paints --hub-media; a snippet must NOT', () => {
  const photo = hubCanvasVars({ media: REF, kind: 'photo' }, URL_);
  assert.equal(photo['--hub-media'], `url("${URL_}")`, 'a photo is a background-image');

  const snip = hubCanvasVars({ media: REF, kind: 'snippet' }, URL_);
  assert.equal(
    snip['--hub-media'],
    undefined,
    'a snippet emitted a background-image — the poster would sit under the video',
  );
});

test('⛔ a COLOUR paints its own property and never --hub-media', () => {
  const v = hubCanvasVars({ kind: 'color', color: '#a9834b' }, null);
  assert.equal(v['--hub-bg-color'], '#a9834b');
  assert.equal(v['--hub-media'], undefined);
  // And a colour section still gets focal/zoom vars — harmless, and it keeps
  // one shape for every kind rather than a conditional the next reader trips on.
  assert.ok(v['--hub-focal']);
});

test('⛔ the three kinds carry three different classes', () => {
  const cls = (c: Parameters<typeof hubCanvasClass>[0], m = true) => hubCanvasClass(c, m).split(' ');
  assert.ok(cls({ media: REF, kind: 'photo' }).includes('hub-bg-photo'));
  assert.ok(cls({ media: REF, kind: 'snippet' }).includes('hub-bg-snippet'));
  assert.ok(cls({ kind: 'color', color: '#a9834b' }).includes('hub-bg-color'));
  // A legacy row — media, no kind — is a photo, and says so in the class too.
  assert.ok(cls({ media: REF }).includes('hub-bg-photo'), 'a pre-kind row must read as a photo');
});

test('⛔ a section with NO background carries no kind class at all', () => {
  // Byte-safety: a page that never used the canvas must render what it always did.
  const cls = hubCanvasClass({}, false).split(' ');
  assert.ok(!cls.some((c) => c.startsWith('hub-bg-')), `an empty canvas claimed a ground: ${cls}`);
  assert.ok(cls.includes('hub-no-media'));
});

test('⛔ the stylesheet can actually paint each kind', async () => {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { stripComments } = await import('./strip-comments');
  const css = stripComments(readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8'));

  // A <video> ignores background-image, so it needs object-fit — the one
  // difference between the two media kinds that is easy to miss.
  assert.match(css, /\.hub-bg-snippet > video\.hub-canvas-media \{[^}]*object-fit:\s*cover/);
  assert.match(css, /\.hub-bg-snippet > video\.hub-canvas-media \{[^}]*object-position:\s*var\(--hub-focal\)/);
  // 🔑 A replaced element carries NO generated content, so the photo's own
  // ::after scrim silently does nothing over a video. The parent must draw it,
  // or the couple's words sit unreadable over bright footage.
  assert.match(css, /\.hub-bg-snippet::after \{[^}]*background:\s*linear-gradient/);
  assert.match(css, /\.hub-bg-color \{[^}]*background-color:\s*var\(--hub-bg-color\)/);
});
