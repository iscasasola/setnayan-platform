/**
 * SEC-6 — closing the snippet bypass (Event Hub Maker Phase 4).
 *
 * The audit found: `setWidgetBackground` accepts the couple's OWN
 * `landing_page_hero_video_r2_key` as a section background `kind: 'snippet'`
 * (see that action's docblock — it is the ONLY snippet source), and
 * `HubCanvasFrame` played it on the guest page with no screening check at
 * all — bypassing `GUEST_HERO_VIDEO_PLAYBACK`/`heroVideoRefForGuests`, the
 * exact gate the hero video ITSELF goes through everywhere else it reaches a
 * guest (`app/[slug]/_lib/loaders.ts`, `lib/showcase-db.ts`,
 * `app/[slug]/_components/editorial/data.ts`).
 *
 * `HubCanvasFrame` is a `.tsx` component with no `.test.tsx` counterpart
 * anywhere in this repo — tested here two ways: the underlying decision
 * (`resolveHubBackground` + `heroVideoRefForGuests`, both pure) exercised
 * exactly as the component composes them, and a source scan pinning that the
 * component actually calls that composition rather than the raw lookup.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { resolveHubBackground, sanitizeHubCanvas } from '@/lib/hub-canvas';
import { GUEST_HERO_VIDEO_PLAYBACK, heroVideoRefForGuests } from '@/lib/guest-hero-video';
import { stripComments } from '@/lib/strip-comments';

/** Reproduces exactly the gate `HubCanvasFrame` applies, for a direct test. */
function gatedMediaUrl(canvasRaw: unknown, mediaUrls: Record<string, string>): string | null {
  const canvas = sanitizeHubCanvas(canvasRaw);
  const rawMediaUrl = canvas.media ? (mediaUrls[canvas.media] ?? null) : null;
  const bg = resolveHubBackground(canvas);
  return bg && bg.kind === 'snippet' ? (heroVideoRefForGuests(bg.media) ? rawMediaUrl : null) : rawMediaUrl;
}

test('today, with playback closed, a snippet background NEVER reaches a guest — regardless of a valid signed URL', () => {
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false, 'this test documents behaviour while the flag is closed');
  const ref = 'r2://setnayan-media/events/e1/hero-video/clip.mp4';
  const url = gatedMediaUrl(
    { media: ref, kind: 'snippet' },
    { [ref]: 'https://signed.example/clip.mp4' },
  );
  assert.equal(url, null, 'the unscreened hero-video snippet must not reach the guest render');
});

test('a PHOTO background is never touched by the hero-video gate', () => {
  const ref = 'r2://setnayan-media/events/e1/gallery/photo.jpg';
  const url = gatedMediaUrl(
    { media: ref, kind: 'photo' },
    { [ref]: 'https://signed.example/photo.jpg' },
  );
  assert.equal(url, 'https://signed.example/photo.jpg', 'a photo background must render exactly as before this fix');
});

test('a colour background never reaches the media gate at all', () => {
  const url = gatedMediaUrl({ kind: 'color', color: '#ffffff' }, {});
  assert.equal(url, null);
});

test('a ref whose signing failed (not in mediaUrls) still resolves to null, same as a blocked snippet', () => {
  const ref = 'r2://setnayan-media/events/e1/hero-video/clip.mp4';
  const url = gatedMediaUrl({ media: ref, kind: 'snippet' }, {});
  assert.equal(url, null);
});

test('the day GUEST_HERO_VIDEO_PLAYBACK opens for a screened ref, the gate passes it through', () => {
  // heroVideoRefForGuests itself is closed-by-constant; this proves the GATE's
  // wiring (not the flag) will pass a truthy ref through once open — i.e. the
  // fix composes with the flag rather than hardcoding "always block".
  const openGate = (ref: string | null) => (ref ? ref : null); // what heroVideoRefForGuests does when OPEN
  const ref = 'r2://setnayan-media/events/e1/hero-video/clip.mp4';
  const canvas = sanitizeHubCanvas({ media: ref, kind: 'snippet' });
  const bg = resolveHubBackground(canvas);
  assert.ok(bg?.kind === 'snippet');
  const rawMediaUrl = 'https://signed.example/clip.mp4';
  const gated = openGate(bg.media) ? rawMediaUrl : null;
  assert.equal(gated, rawMediaUrl);
});

// ── Source scan: pin that the COMPONENT actually calls the composition ─────
const SRC_PATH = join(import.meta.dirname, 'hub-canvas-frame.tsx');
const raw = readFileSync(SRC_PATH, 'utf8');
const code = stripComments(raw);

test('HubCanvasFrame imports and calls heroVideoRefForGuests before using the snippet media URL', () => {
  assert.match(code, /import \{ heroVideoRefForGuests \} from '@\/lib\/guest-hero-video';/);
  assert.match(
    code,
    /bg && bg\.kind === 'snippet'\s*\?\s*\(heroVideoRefForGuests\(bg\.media\) \? rawMediaUrl : null\)\s*:\s*rawMediaUrl/,
  );
});

test('the video element only renders once mediaUrl has passed the gate — no second, ungated read of canvas.media', () => {
  // The <video> tag must read the GATED `mediaUrl`, never `canvas.media` or a
  // raw `mediaUrls[...]` lookup directly — that would be a second doorway.
  const videoBlock = code.slice(code.indexOf('<video'), code.indexOf('/>', code.indexOf('<video')));
  assert.match(videoBlock, /src=\{mediaUrl\}/);
  assert.doesNotMatch(videoBlock, /mediaUrls\?\.\[/);
});
