/**
 * 🎞 THE COVER TAKES A VIDEO — and "Uploaded" always means it is on the cover.
 *
 * Owner 2026-10-16, on cale-ice, Cover Scene › Background › Upload ◆: *"we are trying to apply the background for the
 * cover and uploaded a video"* → *"it did say uploaded but nothing showed"* → *"after the upload there is no more next
 * step?"*. Measured: the Upload accepted the clip, compressed and uploaded it, `FileUpload` said "Uploaded" — and the
 * cover's `onChange` then ran `if (kind === 'clip') return setClipKept(true);`: nothing was saved, nothing was shown,
 * the sheet stayed open, and ✓ Apply did not move. The same clip was uploaded three times. A failure that rendered as
 * success. Ruling the same day: *"Yes — let a cover video (15 s or less, muted) play for guests on the event's own
 * page. Keep it as a still on public pages strangers see (Real Stories)."*
 *
 *   (1) THE UI AND THE SANITISER AGREE — a video the Upload takes is a clip the sanitiser keeps, and a video the
 *       sanitiser would drop is refused IN PLACE before a byte is sent; under both positions of the switch
 *   (2) A FINISHED UPLOAD BECOMES THE COVER — a clip is saved as `{ kind: 'snippet', media, poster }` (its still grabbed
 *       and uploaded beside it), the sheet closes (`uploadDone`), and no clip is ever thrown away
 *   (3) THE CLIP IS A CARD — the couple's clips stand beside "Your photo" in the Upload row, ▶-marked, the worn one
 *       ringed; tapping one makes it the cover's clip with its still
 *   (4) THE EVENT'S OWN PAGE PLAYS IT — the cover layer resolves the clip and its still, and `CoverSceneGround` draws
 *       the shipped `SceneClip` loop; a closed switch gives the still only
 *   (5) STRANGERS SEE A STILL — nothing a stranger sees (/realstories, the editorial site, the OG routes) can reach the
 *       cover's clip: only the guest page (and the dev lab) draws the cover layer, the hero boomerang switch stays
 *       closed, and the cover's save never writes the hero video column
 *   (6) IT STAYS THE COUPLE'S — Apply holds a cover clip and still to this event's own media, and a cover upload is
 *       listed among the event's own uploads (so its card survives the save's refresh, and the meter counts it)
 *
 * Each claim was broken once and seen red (the sabotage run is in the PR body).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import {
  COVER_SCENE_CLIP_CLOSED_LINE,
  coverClipCardName,
  coverSceneTakesClips,
  coverSceneUploadLabel,
  coverSceneUploadRefusal,
} from './cover-scene';
import { sanitizeHubCanvas, sanitizeHubCoverGround } from './hub-canvas';
import { GUEST_COVER_CLIP_PLAYBACK, GUEST_HERO_VIDEO_PLAYBACK, coverClipRefForGuests } from './guest-hero-video';
import { sceneUploadRefs } from './scene-media-choices';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    if (request === 'next/navigation') return { useRouter: () => ({ refresh() {} }), usePathname: () => '/', useSearchParams: () => new URLSearchParams() };
    return load.call(this, request, ...rest);
  };
}

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROWS = 'app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background.tsx';
const EV = '11111111-2222-4333-8444-555555555555';
const CLIP = `r2://setnayan-media/events/${EV}/scene-background/0b2c9a1e-1d43-4ba3-9c84-be4e558d8142-bbb.mp4`;
const STILL = `r2://setnayan-media/events/${EV}/scene-background/7f3e2d10-aaaa-4bbb-8ccc-123456789abc-still.jpg`;

test('(1) the Upload takes a video exactly when the sanitiser keeps it — a refused one is said in place, before upload', () => {
  for (const open of [true, false]) {
    const taken = coverSceneUploadRefusal('video/mp4', open) === null;
    const kept = sanitizeHubCoverGround({ kind: 'snippet', media: CLIP, poster: STILL }, open) !== null;
    assert.equal(taken, kept, `switch ${open ? 'open' : 'closed'}: the Upload ${taken ? 'takes' : 'refuses'} a clip the sanitiser ${kept ? 'keeps' : 'drops'}`);
    assert.equal(coverSceneTakesClips(open), open);
    assert.equal(coverSceneUploadRefusal('video/quicktime', open), open ? null : COVER_SCENE_CLIP_CLOSED_LINE);
    assert.equal(coverSceneUploadRefusal('image/jpeg', open), null, 'a photo was refused');
    assert.equal(coverSceneUploadLabel(open), open ? 'Upload a photo or clip' : 'Upload a photo', 'the label promises what the Upload does not take');
  }
  assert.match(COVER_SCENE_CLIP_CLOSED_LINE, /Scene ◆/, 'a refused video is not told where a video CAN go');
  /* The switch the owner opened 2026-10-16 — and the canvas sanitiser (what every save and every page reads) follows it. */
  assert.equal(GUEST_COVER_CLIP_PLAYBACK, true, 'the cover clip switch closed — the owner opened it 2026-10-16');
  assert.deepEqual(sanitizeHubCanvas({ canvas: { ground: { kind: 'snippet', media: CLIP, poster: STILL } } }).ground, { kind: 'snippet', media: CLIP, poster: STILL });
  /* The cover's Upload wires the decision in: the refusal runs before the duration check, the label is the decision's. */
  const rows = read(ROWS);
  assert.match(rows, /validateFile=\{async \(file\) => coverSceneUploadRefusal\(file\.type\) \?\? durationOk\(file\)\}/, 'the Upload does not refuse a video the cover cannot wear');
  assert.match(rows, /label=\{coverSceneUploadLabel\(\)\}/);
  assert.match(rows, /maxVideoDurationS=\{MAKER_MAX_CLIP_SECONDS\}/, 'the 15 s backstop is gone');
});

test('(2) a finished upload becomes the cover at once — a clip with its still — and the sheet closes', () => {
  const rows = read(ROWS);
  /* 🚫 THE BUG: a clip returned before the save. No branch of the upload may end without a `put` again. */
  assert.doesNotMatch(rows, /kind === 'clip'\) return|setClipKept|clipKept/, 'the Upload throws a clip away again');
  const onUploaded = rows.slice(rows.indexOf('const onUploaded'), rows.indexOf('const durationOk'));
  assert.ok(onUploaded.length > 100, 'anti-vacuity: the upload handler');
  assert.match(onUploaded, /put\(file\.kind === 'snippet' \? \{ kind: 'snippet', media: ref, \.\.\.\(file\.poster \? \{ poster: file\.poster \} : \{\}\) \} : \{ kind: 'photo', media: ref \}\);/, 'the upload is not saved as the cover’s background');
  assert.match(onUploaded, /setUploadDone\(\(n\) => n \+ 1\)/, 'a finished upload does not close the sheet');
  /* …and nothing between "the upload landed" and its save may end the handler — the bug was exactly such a return. */
  const landed = onUploaded.indexOf('if (!ref || !file) return;');
  assert.ok(landed > 0, 'anti-vacuity: the landed guard');
  const toSave = onUploaded.slice(landed + 'if (!ref || !file) return;'.length, onUploaded.indexOf('put(file.kind'));
  assert.doesNotMatch(toSave, /\breturn\b/, 'a landed upload can end before it is saved (a clip thrown away again)');
  assert.match(rows, /uploadDone=\{uploadDone\}/);
  /* The still: grabbed from the picked file and uploaded beside the clip, into the event's own folder. */
  assert.match(rows, /const still = await extractPosterFrame\(file\);\s*const poster = still \? await uploadStill\(still, eventId, SCENE_BACKGROUND_FOLDER\) : null;/);
  /* The always-on grey line that said a video would not play is gone (the owner: remove it). */
  assert.doesNotMatch(rows, /don’t play for guests on the cover/);
  /* …and the sheet really closes on a new count (`StageBackground`), for the cover and every stage alike. */
  const sheet = read('app/dashboard/[eventId]/launch/_components/stage-panel/stage-background.tsx');
  assert.match(sheet, /useEffect\(\(\) => \{\s*if \(uploadDone > 0\) setUploading\(false\);\s*\}, \[uploadDone\]\);/, 'a finished upload leaves the sheet sitting on "Uploaded"');
  const stage = read('app/dashboard/[eventId]/website/editor/_components/scene-background-row.tsx');
  assert.match(stage, /else put\(photoBg\(ref\)\);\s*setUploadDone\(\(n\) => n \+ 1\);/, 'a stage upload leaves its sheet open');
});

test('(3) the couple’s clips are cards beside "Your photo" — ▶-marked, the worn one ringed', async () => {
  const { CoverSceneGroundRows } = await import('@/app/dashboard/[eventId]/launch/_components/stage-panel/cover-words-background');
  const draw = (ground: unknown, uploads: unknown[]) =>
    renderToStaticMarkup(
      React.createElement(CoverSceneGroundRows, {
        eventId: EV,
        canvas: sanitizeHubCanvas({ canvas: { ground } }),
        draftAction: (async () => ({ ok: true })) as never,
        themeColours: ['#2C2A29'],
        photoChoices: [{ ref: `r2://setnayan-media/events/${EV}/std-background/p.jpg`, url: 'https://media.test/p.jpg' }],
        videoChoice: null,
        sceneUploads: uploads as never,
        mediaCapBytes: 500 * 1024 * 1024,
        proHref: null,
      }),
    );
  const one = draw({ kind: 'snippet', media: CLIP, poster: STILL }, [{ ref: CLIP, url: 'https://media.test/bbb.mp4', kind: 'snippet', poster: STILL, posterUrl: 'https://media.test/still.jpg' }]);
  const tiles = [...one.matchAll(/<button[^>]*aria-pressed="(true|false)"[^>]*aria-label="([^"]*)"[^>]*data-stage-bg-tile="([^"]+)"/g)].map((m) => ({ on: m[1] === 'true', name: m[2], key: m[3] }));
  assert.deepEqual(tiles.map((t) => t.name), ['Your video', 'Your photo'], 'the clip is not a card beside "Your photo"');
  assert.deepEqual(tiles.filter((t) => t.on).map((t) => t.key), [CLIP], 'the worn clip is not the ringed card');
  assert.match(one, /▶ <!-- -->Your video|▶ Your video/, 'the clip card carries no ▶');
  assert.match(one, /background-image:url\(&quot;https:\/\/media\.test\/still\.jpg&quot;\)/, 'the clip card does not show its still');
  /* Two clips: each named by its file, never two identical cards. */
  assert.equal(coverClipCardName(CLIP, 2), 'bbb.mp4');
  assert.equal(coverClipCardName(CLIP, 1), 'Your video');
  /* Tapping a clip card makes it the cover's clip WITH its still. */
  const rows = read(ROWS);
  /* (…and keeps the cover's one Darker ↔ Lighter where it was — `...keep`, 2026-10-17.) */
  assert.match(rows, /const clip = clips\.find\(\(c\) => c\.ref === key\);[\s\S]{0,400}?put\(clip \? \{ kind: 'snippet', media: key, \.\.\.\(clip\.poster \? \{ poster: clip\.poster \} : \{\}\)(, \.\.\.keep)? \} : \{ kind: 'photo', media: key(, \.\.\.keep)? \}\);/);
});

test('(4) the event’s own page plays the cover clip (the shipped loop); a closed switch shows its still only', async () => {
  const saved = process.env.R2_PUBLIC_URL;
  process.env.R2_PUBLIC_URL = 'https://media.test';
  try {
    const { coverSceneLayer } = await import('@/app/[slug]/_lib/cover-scene-layer');
    const layer = coverSceneLayer({ kind: 'snippet', media: CLIP, poster: STILL }, { heroPhotoUrl: 'https://cdn.test/hero.jpg' });
    assert.ok(layer, 'a stored cover clip drew no layer');
    assert.match(layer!.clip ?? '', /^https:\/\/media\.test\/events\/.+-bbb\.mp4$/, 'the clip does not reach the guest page');
    assert.match(layer!.still ?? '', /-still\.jpg$/, 'the clip has no still (reduced motion, Save-Data, before it plays)');
    assert.equal(layer!.shape, 'full');
    const { CoverSceneGround } = await import('@/app/[slug]/_components/cover-scene-ground');
    const html = renderToStaticMarkup(React.createElement(CoverSceneGround, { layer: layer! }));
    assert.match(html, /<video[^>]*>/, 'the cover clip does not play');
    assert.match(html, /muted/);
    /* The page hands the hero row's ground to this layer — the one guest-page call. */
    assert.match(read('app/[slug]/_components/site-body.tsx'), /ground: coverSceneLayer\(heroCanvas\.ground, \{ heroPhotoUrl: heroPhotoUrl \?\? null \}\)/);
    /* The gate itself: closed, the clip is null and only the still is left to draw. */
    assert.equal(coverClipRefForGuests(CLIP, false), null);
    assert.equal(coverClipRefForGuests(CLIP, true), CLIP);
    assert.match(read('app/[slug]/_lib/cover-scene-layer.ts'), /const clip = publicUrl\(coverClipRefForGuests\(ground\.media\)\);/, 'the cover layer plays a clip without asking the switch');
  } finally {
    if (saved === undefined) delete process.env.R2_PUBLIC_URL;
    else process.env.R2_PUBLIC_URL = saved;
  }
});

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

test('(5) strangers see a still: only the guest page draws the cover layer; the hero boomerang stays closed', () => {
  const files = [...walk(join(WEB, 'app')), ...walk(join(WEB, 'lib'))];
  assert.ok(files.length > 500, 'anti-vacuity: the source tree');
  const importers = (re: RegExp) =>
    files.filter((f) => re.test(readFileSync(f, 'utf8'))).map((f) => relative(WEB, f)).sort();
  /* The cover layer (the only thing that turns `canvas.ground` into a playing clip) is drawn by the event's own guest
     page and the dev lab — never by /realstories, the editorial site, a discover card or an OG route. */
  assert.deepEqual(importers(/from ['"][^'"]*_lib\/cover-scene-layer['"]/), ['app/[slug]/_components/cover-scene-ground.tsx', 'app/[slug]/_components/pahina-masthead.tsx', 'app/[slug]/_components/site-body.tsx', 'app/dev/maker-lab/guest/page.tsx'], 'a new surface draws the cover layer — is it one strangers see?');
  assert.deepEqual(importers(/\bcoverClipRefForGuests\b/), ['app/[slug]/_lib/cover-scene-layer.ts', 'lib/guest-hero-video.ts'], 'the cover clip gate is used outside the cover layer');
  for (const f of files.map((x) => relative(WEB, x)).filter((x) => /^app\/(\(shell\)\/)?realstories\/|^app\/\[slug\]\/_components\/editorial\/|^app\/api\/og\//.test(x))) {
    const src = readFileSync(join(WEB, f), 'utf8');
    assert.doesNotMatch(src, /cover-scene-layer|GUEST_COVER_CLIP_PLAYBACK|\.ground\b/, `${f} (a page strangers see) reads the cover's ground`);
  }
  /* /realstories and the editorial site draw the hero video column only through the CLOSED hero switch… */
  assert.equal(GUEST_HERO_VIDEO_PLAYBACK, false, 'the hero boomerang opened — strangers would see a couple’s clip');
  assert.match(read('app/[slug]/_components/editorial/data.ts'), /heroVideoRefForGuests\(\s*asString\(\(event as Record<string, unknown>\)\.landing_page_hero_video_r2_key\)/);
  /* …and the cover's one save never writes that column (a clip is not the hero photo either). */
  const rows = read(ROWS);
  assert.doesNotMatch(rows, /landing_page_hero_video_r2_key/, 'the cover’s save writes the hero video — strangers would see it');
  assert.match(rows, /const heroPhoto = canvasNext\.ground\?\.kind === 'photo' \? canvasNext\.ground\.media : null;/, 'a clip is written through as the hero photo');
});

test('(6) the cover clip stays the couple’s own — Apply holds it to this event; it is one of the event’s uploads', () => {
  const apply = read('app/dashboard/[eventId]/website/hub-draft-actions.ts');
  assert.match(apply, /const ground = \[drafted\?\.media, drafted\?\.poster, cover\?\.media, cover\?\.poster\]\.filter/, 'Apply lets a cover clip from anywhere through');
  const listed = sceneUploadRefs(EV, [{ canvas: { ground: { kind: 'snippet', media: CLIP, poster: STILL } } }]);
  assert.deepEqual(listed, [{ ref: CLIP, kind: 'snippet', poster: STILL }], 'the cover’s own upload is not among the event’s uploads (its card vanishes after the refresh)');
  assert.deepEqual(sceneUploadRefs(EV, [{ canvas: { ground: { kind: 'snippet', media: 'r2://setnayan-media/events/other/scene-background/x.mp4' } } }]), [], 'another folder’s clip was listed');
});

test('(7) the Maker’s ▶ whole-page preview is the guest page: full window, and its bar waits for the cover to be gone', async () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8').replace(/\s+/g, ' ');
  assert.match(css, /\[data-maker-shell\]\[data-stage-previewing\] \[data-maker-canvas-frames\] \{ position: fixed; inset: 0; z-index: 20; border-radius: 0; box-shadow: none; \}/, 'the preview is still a card under a band (owner: "full screen?")');
  assert.match(css, /\[data-maker-shell\]\[data-stage-previewing\]\[data-canvas-cover='wait'\] \[data-stage-guest-bar\] \{ translate: 0 100%; opacity: 0; visibility: hidden; \}/, 'the preview draws its guest bar over the cover');
  /* The shown canvas frame mirrors its marker onto the Maker shell — run the shipped script in a frame. */
  const { CoverSceneMenuWaits, MAKER_CANVAS_COVER_ATTR } = await import('@/app/[slug]/_components/cover-scene-menu');
  assert.equal(MAKER_CANVAS_COVER_ATTR, 'data-canvas-cover');
  const code = renderToStaticMarkup(React.createElement(CoverSceneMenuWaits)).replace(/^<script[^>]*>|<\/script>$/g, '').replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const run = (frameState: string | null) => {
    const shellAttrs: Record<string, string> = {};
    const shell = { setAttribute: (k: string, v: string) => void (shellAttrs[k] = v) };
    const attrs: Record<string, string> = {};
    const style = { setAttribute: (k: string, v: string) => void (attrs[k] = v), getAttribute: (k: string) => attrs[k] ?? null };
    let y = 0;
    const header = { offsetParent: {}, getBoundingClientRect: () => ({ top: -y, bottom: 800 - y }) };
    const listeners: Record<string, Array<() => void>> = {};
    const frameElement = frameState === null ? null : { getAttribute: () => frameState, ownerDocument: { querySelector: (s: string) => (s === '[data-maker-shell]' ? shell : null) } };
    const win = { frameElement, addEventListener: (t: string, f: () => void) => void (listeners[t] ??= []).push(f) };
    const doc = { readyState: 'complete', head: { appendChild: () => {} }, createElement: () => style, querySelector: (s: string) => (s.startsWith('style') ? null : header), addEventListener: () => {} };
    new Function('window', 'document', 'addEventListener', 'removeEventListener', 'setTimeout', 'IntersectionObserver', code)(win, doc, win.addEventListener, () => {}, (f: () => void) => f(), undefined);
    const scroll = (to: number) => { y = to; for (const f of listeners.scroll ?? []) f(); return shellAttrs[MAKER_CANVAS_COVER_ATTR]; };
    return { now: () => shellAttrs[MAKER_CANVAS_COVER_ATTR], scroll };
  };
  const shown = run('shown');
  assert.equal(shown.now(), 'wait', 'the preview’s bar is not held off the cover');
  assert.equal(shown.scroll(799), 'wait');
  assert.equal(shown.scroll(800), 'open', 'the preview’s bar does not come in once the cover is gone');
  assert.equal(shown.scroll(10), 'wait');
  assert.equal(run('hidden').now(), undefined, 'a warm hidden frame wrote onto the Maker shell');
  assert.equal(run(null).now(), undefined, 'a guest page in no frame wrote somewhere');
});
