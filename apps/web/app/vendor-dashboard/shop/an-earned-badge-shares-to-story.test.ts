/**
 * ↗ AN EARNED BADGE SHARES TO STORY — owner, 21 Nov 2026: *"i thought we also have share icons for the different
 * badges you achieved."* The award kit's "↗ Share to story" (v84 `bz-share`, plain glass) and its lazy 10-second
 * `StoryVideo` were built and approved, but only `app/dev/award-lab` passed `onShare`. The live Shop › Badges row
 * opened the earned badge with no share at all.
 *
 * Properties:
 *   1 · the live row's `BadgeFullscreen` passes `onShare`, and the share mounts the kit's `StoryVideo`;
 *   2 · ONLY an earned badge shares: `onShare` lives inside the earned branch of `BadgeOpen`, and the locked look
 *       (`BadgeSheet`) carries no share of any kind;
 *   3 · the story gets the REAL picture: the v84 badge is a `.webp`, which the kit's `serializeArt` cannot read (it
 *       reads only an `<svg>`, so it hands back ""), and an SVG decoded as an image cannot load a file from outside
 *       itself (measured 21 Nov in Chromium: the file URL draws the broken-image icon, the data URL draws the badge).
 *       So the row reads the picture through `pictureStorySvg`, which carries it inside the SVG as a data URL.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-21):
 *   · deleting `onShare={share}` from the row's `<BadgeFullscreen` → tests 1 and 2 red;
 *   · moving `onShare={share}` onto `<LockedTile` in `BadgeSheet` → tests 1 and 2 red;
 *   · making `share` call `make(kitSvg)` straight away instead of `pictureStorySvg(...)` → test 3 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';
import { pictureSvg } from '@/app/_components/award/picture-story-svg';
import { artBox } from '@/app/_components/award/story-rig';
import { BADGE_ART_H, BADGE_ART_W } from '@/lib/shop-badge-shelf';

const WEB = join(import.meta.dirname, '..', '..', '..');
const ROW = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/shop/_components/shop-badge-row.tsx'), 'utf8'));

/** The body of a top-level `function name(` up to the next top-level `function` (or the end of the file). */
function fnBody(name: string): string {
  const a = ROW.indexOf(`function ${name}(`);
  assert.ok(a >= 0, `${name} is not in the badge row any more`);
  const next = ROW.slice(a + 1).search(/\n(?:export )?function /);
  return next < 0 ? ROW.slice(a) : ROW.slice(a, a + 1 + next);
}

/** The JSX opening element `<Tag ... />` or `<Tag ...>` starting at the first `<Tag` in `src`. */
function element(src: string, tag: string): string {
  const a = src.indexOf(`<${tag}`);
  assert.ok(a >= 0, `<${tag} is not drawn here`);
  let depth = 0;
  for (let i = a + 1; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) return src.slice(a, i + 1);
  }
  return src.slice(a);
}

test('1 · the live badge row passes onShare to the earned full screen, and the share opens the story', () => {
  const open = fnBody('BadgeOpen');
  assert.match(element(open, 'BadgeFullscreen'), /\bonShare=\{share\}/, 'the earned badge opens with no "Share to story"');
  assert.match(open, /const share = \(/, 'the share handler is gone');
  assert.match(open, /onStory\(/, 'the share does not hand anything to the story');
  const row = fnBody('ShopBadgeRow');
  assert.match(element(row, 'BadgeOpen'), /\bonStory=\{setStory\}/, 'the row does not hear the share');
  assert.match(row, /<StoryVideo\b/, 'the row mounts no StoryVideo');
  assert.match(ROW, /from '@\/app\/_components\/award\/story-video'/, 'the story is not the kit’s lazy door');
});

test('2 · only an EARNED badge shares — the locked look has no share', () => {
  const open = fnBody('BadgeOpen');
  const earned = open.indexOf("if (tile.state === 'earned' && tile.family");
  assert.ok(earned >= 0, 'the earned branch of BadgeOpen moved');
  const shareAt = open.indexOf('onShare=');
  assert.ok(shareAt > earned, 'onShare sits outside the earned branch');
  const branchEnd = open.indexOf('return <BadgeSheet');
  assert.ok(branchEnd > shareAt, 'onShare reaches the locked badge');
  assert.equal((ROW.match(/\bonShare=/g) ?? []).length, 1, 'a second onShare appeared in the badge row');
  const sheet = fnBody('BadgeSheet');
  assert.doesNotMatch(sheet, /onShare|onStory|StoryVideo|Share to story/, 'a locked badge offers a share');
});

test('3 · the story gets the real v84 picture, carried inside the SVG', () => {
  const open = fnBody('BadgeOpen');
  const share = open.slice(open.indexOf('const share = ('), open.indexOf('return (', open.indexOf('const share = (')));
  assert.match(share, /pictureStorySvg\(src, BADGE_ART_W, BADGE_ART_H\)\.then\(make,/, 'the share does not read the badge picture');
  // the kit's own SVG read is only the fall-back, inside the failure path
  assert.doesNotMatch(share.slice(0, share.indexOf('.then(make,')), /make\(kitSvg\)/, 'the share sends the kit’s (empty) SVG first');

  const svg = pictureSvg('data:image/webp;base64,AAAA', BADGE_ART_W, BADGE_ART_H);
  assert.match(svg, /<image href="data:image\/webp;base64,AAAA"/, 'the picture is not inside the SVG');
  assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  // the story scene sizes the award from its viewBox: the v84 canvas (300 × 286) fills the 900 × 858 stage
  const box = artBox(svg);
  assert.deepEqual(box.vb, [0, 0, BADGE_ART_W, BADGE_ART_H]);
  assert.ok(Math.abs(box.dw - 900) < 1 || Math.abs(box.dh - 858) < 1, `the badge is drawn at ${box.dw} × ${box.dh}`);
});
