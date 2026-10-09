/**
 * the-day-toolbar-is-the-prototypes.test.ts — THE DAY'S PARTS, TOOL BY TOOL, ARE THE APPROVED PROTOTYPE'S.
 *
 * Owner, 2026-10-09 (`TOOLBAR-SPEC-2026-10-09.md`, "The Day › Camera"; the approved clickable prototype
 * `public/review/studio-head-prototype.html`, walked headless at 375 × 812 on 2026-10-09 — every part of The Day,
 * each of the four tools — and written down below): *"Camera is a full screen design"* · *"edit is greyed out too.
 * only have style"*.
 *
 * Seen on the Maker lab before this (375 × 812, The Day): the Camera could not be picked at all — its page was a grey
 * shape with no marker, so nothing was picked on arriving and every tool was "live" over four empty rows, its three
 * looks unreachable; and on "Happening now" Style slid over four empty rows.
 *
 *   (1) THE RECORD — every part of The Day, Edit's first row and whether Style is live, as the prototype draws them,
 *       EXECUTED against the app's own rules (`makerPartQuietRow`, `makerPartToolWorks`). The few places the app does
 *       not follow the prototype are NAMED, each with its reason — never silently different.
 *   (2) THE CAMERA HAS ONLY STYLE — Edit, Background and Animate are grey and each says the prototype's own line;
 *       Style is the three looks THAT EXIST (never the proposed Minimal and Film), as the toolbar's Style cards.
 *   (3) THE CAMERA'S PAGE IS THE CAMERA — RENDERED: one screen per look from the camera's own pieces (the logo on
 *       the shutter for Your brand, the chips for Challenges, the corners in the look's tint); drawn on the canvas's
 *       own Camera page, edge to edge; a tap picks it and is never "a tap on the ground"; picked on arriving only
 *       when nothing is held; its frame is drawn inside its edge.
 *   (4) "HAPPENING NOW" HAS NO LOOK — Style is grey there and says so.
 *   (5) NONE OF IT RIDES THE MAKER'S FIRST LOAD — the camera's page is reached only through the lazy toolbar.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from './strip-comments';
import { CAMERA_LOOKS, CAMERA_LOOK_LABEL } from './camera-look';
import {
  MAKER_CAMERA_LAYOUTS,
  MAKER_CAMERA_TOOL_WHY,
  MAKER_PARTS,
  MAKER_PARTS_NO_LOOK,
  MAKER_PART_TOOLS,
  MAKER_STAGE_PAGES,
  makerPartQuietRow,
  makerPartToolFor,
  makerPartToolWhy,
  makerPartToolWorks,
  type MakerPartKey,
} from './maker-parts';

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
const L = 'app/dashboard/[eventId]/launch/_components';

/**
 * THE PROTOTYPE'S RECORD FOR THE DAY (walked 2026-10-09): Edit's row 1 — a door's words, `field` (the part's words
 * typed there), or null (only the move row) — and whether Style is live. `grey`: Edit itself is grey.
 */
const RECORD: Readonly<Record<string, ReadonlyArray<readonly [MakerPartKey, string | null, boolean]>>> = {
  live: [
    ['reveal', 'Open in Studio › Look', true],
    ['spotlight', 'Open in Studio › Look', false],
    ['announce', null, true],
    ['livehub', null, true],
    ['logo', 'Open in Studio › Logo', true],
    ['ename', 'field', true],
    ['names', 'field', true],
    ['heroline', 'field', true],
    ['date', 'Change it in Suppliers', true],
    ['place', 'Change it in Suppliers', true],
    ['herolink', 'field', true],
    ['schedule', 'Open in Studio › Schedule', true],
  ],
  home: [
    ['venue', 'Change it in Suppliers', true],
    ['dress', 'Open in Studio › Mood Board & Dress Code', true],
    ['march', 'Open in Studio › Wedding March', true],
    ['bring', 'Open in Studio › Info', true],
  ],
  camera: [['camera', 'grey', true]],
  gallery: [
    ['gallery', null, true],
    ['myphotos', null, true],
  ],
  me: [
    ['seats', 'Open in Studio › Seat plan', true],
    ['pass', 'Open in Studio › Prints', false],
  ],
};

/**
 * WHERE THE APP DOES NOT FOLLOW THE RECORD — named, with the reason (each told to the owner; none is silent):
 *   door   the prototype draws a door the app has no page behind: "Open in Studio › Look" names no place for the
 *          Reveal or "Happening now" (Look holds neither), and the pass's ticket style is picked RIGHT THERE under
 *          Style (the shipped ticket cards — editing in place beats a jump), so it needs no door to Prints. These
 *          three are the same on Save the Date and the Invitation, which ship them without a door.
 *   style  the pass's Style is LIVE in the app (its ticket cards) where the prototype greys it.
 */
const NOT_AS_DRAWN: { door: readonly MakerPartKey[]; style: readonly MakerPartKey[] } = { door: ['reveal', 'spotlight', 'pass'], style: ['pass'] };

/** The parts whose words the page draws are TYPED in Edit (`stage-panel/part-words.ts`) — a line of the cover that takes a caret. */
const TYPED: readonly MakerPartKey[] = ['ename', 'names', 'heroline', 'herolink'];

test('(1) the record: every part of The Day — Edit’s first row and Style — is the prototype’s, and each difference is named', () => {
  const pages = MAKER_STAGE_PAGES.event!;
  assert.deepEqual(Object.keys(pages), Object.keys(RECORD), 'The Day’s pages are not the prototype’s five');
  let rows = 0;
  for (const [page, parts] of Object.entries(RECORD)) {
    assert.deepEqual([...pages[page]!], parts.map(([k]) => k), `${page}: the parts are not the prototype’s, in its order`);
    for (const [k, door, style] of parts) {
      rows += 1;
      const q = makerPartQuietRow(k);
      if (door === 'grey') {
        assert.equal(makerPartToolWorks(k, 'edit'), false, `${k}: Edit is live`);
      } else if (door === 'field') {
        assert.ok(TYPED.includes(k), `${k}: the record types words the page does not take`);
        assert.ok(MAKER_PARTS[k].canvas === 'f:hero' && MAKER_PARTS[k].el, `${k} is not a line of the cover`);
      } else if (NOT_AS_DRAWN.door.includes(k)) {
        assert.equal(q, null, `${k} gained a door — take it off NOT_AS_DRAWN and hold its words here`);
      } else {
        assert.equal(q?.words ?? null, door, `${k}: Edit’s door`);
      }
      const styleNow = makerPartToolWorks(k, 'style');
      if (NOT_AS_DRAWN.style.includes(k)) assert.notEqual(styleNow, style, `${k}: Style now follows the record — take it off NOT_AS_DRAWN`);
      else assert.equal(styleNow, style, `${k}: Style`);
    }
  }
  assert.equal(rows, 21, 'anti-vacuity: the record is 21 part placements');
  /* Every difference named is a part of The Day (a stale name would hide a real one). */
  const all = Object.values(RECORD).flatMap((p) => p.map(([k]) => k));
  for (const k of [...NOT_AS_DRAWN.door, ...NOT_AS_DRAWN.style]) assert.ok(all.includes(k), `${k} is not a part of The Day`);
});

test('(2) the Camera has only Style: the three grey tools say the prototype’s own lines; Style is the three looks that exist', async () => {
  assert.deepEqual(MAKER_CAMERA_TOOL_WHY, { edit: 'Nothing to edit on the camera.', bg: 'The camera is the whole screen.', animate: 'Nothing to animate on the camera.' });
  for (const t of ['edit', 'bg', 'animate'] as const) {
    assert.equal(makerPartToolWorks('camera', t), false);
    assert.equal(makerPartToolWhy('camera', t), MAKER_CAMERA_TOOL_WHY[t]);
  }
  /* Only the Camera speaks those lines. */
  for (const k of Object.keys(MAKER_PARTS) as MakerPartKey[]) {
    if (k !== 'camera') for (const t of MAKER_PART_TOOLS) assert.doesNotMatch(makerPartToolWhy(k, t), /camera/i, `${k} · ${t}`);
  }
  assert.equal(makerPartToolWorks('camera', 'style'), true);
  for (const t of MAKER_PART_TOOLS) assert.equal(makerPartToolFor('camera', t), 'style', 'the Camera opens on a grey tool');
  /* THE LOOKS THAT EXIST — three, by the Maker's names; the prototype's two proposals are nowhere. */
  assert.deepEqual(CAMERA_LOOKS.map((l) => CAMERA_LOOK_LABEL[l]), ['Classic', 'Your brand', 'Challenges']);
  assert.deepEqual([...MAKER_CAMERA_LAYOUTS], ['Classic', 'Your brand', 'Challenges']);
  for (const f of ['lib/camera-look.ts', 'lib/camera-look-key.ts', `${L}/stage-panel/camera-look.tsx`, `${L}/stage-panel/camera-face.tsx`, `${L}/stage-panel/camera-page.tsx`]) {
    assert.doesNotMatch(read(f), /\bMinimal\b|\bFilm\b|'minimal'|'film'/, `${f}: a camera look the owner has not approved is drawn`);
  }
  /* The Camera's Style is ONE strip of the toolbar's Style cards over exactly those three, laid in the toolbar's rows —
     and nothing else is drawn in its rows but a save's error. (The cards themselves are rendered and held by
     `every-style-card-is-phone-shaped.test.ts`; this file's own save is a server action no test run can load.) */
  const src = read(`${L}/stage-panel/camera-look.tsx`);
  assert.match(src, /const CAMERA_LOOK_OPTIONS = CAMERA_LOOKS\.map\(\(look\) => \(\{ id: look as string, name: CAMERA_LOOK_LABEL\[look\] \}\)\);/);
  assert.match(src, /<StageStyle\s+rows\s+look=\{\s*<>\s*<StyleCards\s+options=\{CAMERA_LOOK_OPTIONS\}\s+value=\{shown\}/, 'the Camera’s cards are not laid in the toolbar’s rows');
  assert.match(src, /label="Camera look"/);
  const body = src.slice(src.indexOf('<StageStyle'), src.indexOf('</StageStyle>') > 0 ? src.indexOf('</StageStyle>') : src.indexOf('background={null}'));
  assert.equal((body.match(/<(?!StageStyle|StyleCards|CameraLookFace|p\b|>|\/)/g) ?? []).length, 0, 'something besides the three looks is drawn in the Camera’s rows');
  /* What a pick saves is what it always saved: the one draft door, the camera's own key. */
  assert.match(src, /fd\.set\('intent', 'save'\);\s*fd\.set\('patch', JSON\.stringify\(\{ events: \{ style_preferences: \{ \[CAMERA_LOOK_PREF_KEY\]: look \} \} \}\)\);\s*const door = draftDoor\(\);\s*const r = await makerSave\(\(\) => door\(eventId, fd\), \(\) => router\.refresh\(\)\);/);
  /* …through the door the work area lends — `hubDraftAction` itself on a real event (the lab lends its stand-in). */
  assert.match(src, /return \(got as MakerPartRaw \| null\)\?\.elementEditing\?\.draftAction \?\? hubDraftAction;/);
  assert.match(read('app/dashboard/[eventId]/website/editor/page.tsx'), /draftAction: hubDraftAction,/, 'the work area’s door is no longer the one draft action');
  assert.equal(src.split('door(eventId, fd)').length - 1, 1, 'the Camera’s look has a second writer');
  assert.doesNotMatch(src, /hubDraftAction\(/, 'the Camera calls the action past the work area’s door');
  /* A refused save takes the pick back — on the cards AND on the page (one value). */
  assert.equal((src.match(/setPickedLook\(null\);\s*setError\(/g) ?? []).length, 2);
});

test('(3) the Camera’s page IS the camera: one screen per look from its own pieces, on the canvas’s Camera page, picked by a tap and on arriving', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CameraLookFace } = await import(`../${L}/stage-panel/camera-face`);
  const LOGO = '<svg data-test-logo="1"></svg>';
  const screen = (look: string) => renderToStaticMarkup(React.createElement(CameraLookFace, { look, logo: LOGO, accent: '#7A1F2B', screen: true }));
  const classic = screen('classic');
  const brand = screen('brand');
  const challenges = screen('challenges');
  for (const [look, html] of [['classic', classic], ['brand', brand], ['challenges', challenges]] as const) {
    assert.match(html, new RegExp(`^<span aria-hidden="true" data-camera-look-face="${look}" data-camera-look-screen="" class="absolute inset-0 block overflow-hidden `), `${look}: the screen does not fill its page`);
    assert.equal(html.split('data-focus-corners=""').length - 1, 1, `${look}: the focus corners are the shipped ones, once`);
    assert.equal(html.split('data-camera-look-shutter=""').length - 1, 1);
    assert.doesNotMatch(html, /<button|<a |<video|<input/, `${look}: the drawing can be pressed — the camera is never opened in the Maker`);
  }
  /* Classic: no design — white corners, a plain shutter, no chips. */
  assert.match(classic, /border-color:#FFFFFF/i);
  assert.doesNotMatch(classic, /data-test-logo|data-camera-look-chips/);
  /* Your brand: the logo ON the shutter, the corners in the theme's colour. */
  assert.match(brand, /data-camera-look-logo=""[^>]*><svg data-test-logo="1"><\/svg>/);
  assert.match(brand, /border-color:#7A1F2B/i);
  assert.doesNotMatch(brand, /data-camera-look-chips/);
  /* Challenges: the chips above the shutter; white corners; no logo. */
  assert.equal(challenges.split('data-camera-look-chips=""').length - 1, 1);
  assert.match(challenges, /border-color:#FFFFFF/i);
  assert.doesNotMatch(challenges, /data-test-logo/);

  const page = read(`${L}/stage-panel/camera-page.tsx`);
  /* ON THE CANVAS'S OWN CAMERA PAGE — the page the real canvas draws for the tab (`site-body.tsx` `rest()`)… */
  assert.match(page, /const CAMERA_PAGE = '\[data-stages-page="camera"\]';/);
  assert.match(read('app/[slug]/_components/site-body.tsx'), /<div key=\{p\} \{\.\.\.\{ \[HUB_TAB_ATTR\]: p \}\} data-stages-page=\{p\} hidden=\{p !== active \? true : undefined\}>\s*<MakerPageStandIn page=\{p\}/, 'the canvas no longer marks its Camera page — the camera has nowhere to be drawn');
  /* …of THIS stage's canvas, and only once that page has FINISHED LOADING (its bridge has bound its parts): a node put
     into a page its own React has not taken over yet is a hydration failure — the whole page thrown away and drawn
     again. A canvas with no Camera page gets no camera. */
  assert.match(page, /const CANVAS_IS_UP = '\[data-setnayan-editor-bound\]';/);
  assert.match(read('app/[slug]/_components/editor-bridge.tsx'), /el\.dataset\.setnayanEditorBound = '1';/, 'the bridge no longer marks a page that is up — the camera would never be drawn');
  assert.match(page, /if \(new URL\(f\.src, window\.location\.href\)\.searchParams\.get\('phase'\) !== stage\) continue;/);
  assert.match(page, /if \(doc\?\.querySelector\(CANVAS_IS_UP\) && doc\.querySelector\(CAMERA_PAGE\)\) out\.push\(doc\);/);
  /* A canvas still on its way is looked for again a bounded number of times — never for ever, never on a guess. */
  assert.match(page, /if \(tries\.current >= FIND_TRIES\) return;\s*tries\.current \+= 1;\s*const again = window\.setTimeout\(\(\) => setCanvas\(\(n\) => n \+ 1\), FIND_EVERY_MS\);/);
  /* …and in the page ON ITS WAY too (the buffered frame a save loads behind the one on screen): every canvas frame of
     the stage is asked, the moment one says it is ready — so the old grey shape never flashes between two looks. */
  assert.match(page, /const CANVAS_FRAMES = 'iframe\[data-maker-canvas-frame\]';/);
  assert.match(page, /if \(d\?\.source === 'setnayan-site' && d\.t === 'ready'\) setCanvas\(\(n\) => n \+ 1\);/);
  /* EDGE TO EDGE: fixed to the page's own edges, as tall as the page that can be SEEN (measured, never guessed). */
  assert.match(page, /host\.style\.cssText = 'position:fixed;left:0;right:0;top:0;height:100vh;z-index:5;cursor:pointer;overflow:hidden';/);
  assert.match(page, /const bottom = Math\.min\(fr\.bottom, lt \? lt\.top : window\.innerHeight, bar && bar\.height > 0 \? bar\.top : window\.innerHeight\);/);
  assert.match(page, /if \(h !== null\) for \(const host of hosts\) host\.style\.height = `\$\{h\}px`;/);
  /* The canvas's own stand-in steps aside while the camera is drawn, and comes back when it is not. */
  assert.match(page, /css\.textContent = `\$\{CAMERA_PAGE\}>:not\(#\$\{HOST_ID\}\)\{display:none!important\}/);
  assert.match(page, /function takeOff\(hosts: readonly HTMLElement\[\]\): void \{\s*for \(const h of hosts\) \{\s*h\.ownerDocument\.getElementById\(CSS_ID\)\?\.remove\(\);\s*h\.remove\(\);/);
  assert.match(page, /if \(on\) return;\s*takeOff\(made\.current\);/, 'the camera stays on a page that is not the Camera’s');
  /* A TAP PICKS IT — and never reaches the page's "tap on the ground", which lets a part go. */
  assert.match(page, /host\.addEventListener\('click', \(e\) => \{\s*e\.preventDefault\(\);\s*e\.stopPropagation\(\);\s*onPickRef\.current\(\);\s*\}\);/);
  /* PICKED ON ARRIVING — once, and only when no part is held (the page before's part has been let go by then). */
  assert.match(page, /const drawn = hosts\.length > 0;\s*useEffect\(\(\) => \{\s*if \(!drawn\) return;\s*const t = window\.setTimeout\(\(\) => \{\s*if \(!heldRef\.current\) onPickRef\.current\(\);\s*\}, ARRIVE_MS\);/);
  /* The look drawn is the ONE value the cards show, at the screen's size; its frame is inside its edge, only while picked. */
  assert.match(page, /const look = useCameraLookShown\(\);/);
  assert.match(page, /<CameraLookFace look=\{look\} logo=\{brand\.logo\} accent=\{brand\.accent\} screen \/>/);
  assert.match(page, /\{picked \? \(\s*<>[\s\S]*?data-camera-part-frame="" className="pointer-events-none absolute inset-0 z-\[3\] border-\[3px\] border-sn-accent"[\s\S]*?>\s*Camera\s*<\/span>/);
  /* The toolbar mounts it for The Day's Camera page only, never under the RSVP stage. */
  const tools = read(`${L}/stage-tools.tsx`);
  assert.match(tools, /\{rsvpOpen \? null : \(\s*<CameraPage stage=\{stage\} on=\{makerPartsOnPage\(stage, shownPage\)\.includes\('camera'\)\} picked=\{open && cameraOpen\} held=\{picked !== null\} onPick=\{\(\) => pickPartRef\.current\('camera'\)\} \/>\s*\)\}/);
  /* Only The Day has a Camera page. */
  const withCamera = Object.entries(MAKER_STAGE_PAGES).flatMap(([s, pages]) => Object.entries(pages).filter(([, parts]) => parts.includes('camera')).map(([p]) => `${s}/${p}`));
  assert.deepEqual(withCamera, ['event/camera']);
});

test('(4) “Happening now” has no look: Style is grey there and says so — and it opens on Edit', () => {
  assert.deepEqual([...MAKER_PARTS_NO_LOOK], ['spotlight']);
  assert.equal(makerPartToolWorks('spotlight', 'style'), false);
  assert.equal(makerPartToolWhy('spotlight', 'style'), 'Style has nothing to change on this part.');
  for (const t of MAKER_PART_TOOLS) assert.equal(makerPartToolFor('spotlight', t), 'edit');
  /* It is truly a part with nothing to pick: no styles, no words of its own, a fixed block. */
  const def = MAKER_PARTS.spotlight;
  assert.deepEqual(def.layouts, { kind: 'none' });
  assert.ok(def.canvas === 'f:spotlight' && !def.el);
  /* The toolbar asks the rule for Style too — a grey Style is never pressed. */
  assert.match(read(`${L}/stage-tools.tsx`), /const toolWorks = \(t: MakerPartTool\) => !picked \|\| \(\(t === 'edit' \|\| t === 'style' \|\| !styleOnly\) && makerPartToolWorks\(picked, t\)\);/);
});

test('(5) none of it rides the Maker’s first load: the camera’s page is reached only through the lazy toolbar', () => {
  /* Every file under the Maker and its work area that imports the camera's page or its looks. */
  const importers: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk(rel);
      else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && /stage-panel\/camera-(page|look|face)'|from '\.\/camera-(page|look|face)'/.test(read(rel))) importers.push(rel.replace('app/dashboard/[eventId]/', ''));
    }
  };
  walk('app/dashboard/[eventId]');
  assert.deepEqual(
    importers.sort(),
    ['launch/_components/details-lazy.tsx', 'launch/_components/stage-panel/camera-look.tsx', 'launch/_components/stage-panel/camera-page.tsx', 'launch/_components/stage-tools.tsx'],
    'the camera is imported from somewhere new — is it on the first load?',
  );
  /* `details-lazy.tsx` reaches it only by `dynamic(() => import(…))`, in the Maker's own lazy chunk… */
  const lazy = read(`${L}/details-lazy.tsx`);
  assert.match(lazy, /export const CameraPartTools = dynamic\(\(\) => import\(\s*'\.\/stage-panel\/camera-look'\)/);
  assert.doesNotMatch(lazy, /^import [^\n]*camera-(page|look|face)/m);
  /* …and the toolbar itself is loaded the same way, by nobody else. */
  assert.match(lazy, /export const StageTools = dynamic\(\(\) => import\(\s*'\.\/stage-tools'\)/);
  /* (The chunk's name is a comment the reader strips; it is held where it is written.) */
  assert.match(readFileSync(join(WEB, `${L}/details-lazy.tsx`), 'utf8'), /import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/stage-tools'\)/);
  const statics: string[] = [];
  const walk2 = (dir: string) => {
    for (const name of readdirSync(join(WEB, dir))) {
      const rel = `${dir}/${name}`;
      if (statSync(join(WEB, rel)).isDirectory()) walk2(rel);
      else if (/\.tsx?$/.test(name) && !/\.test\./.test(name) && /^import (?!type )[^\n]*from '[^']*\/stage-tools'/m.test(read(rel))) statics.push(rel);
    }
  };
  walk2('app/dashboard/[eventId]');
  walk2('app/dev');
  assert.deepEqual(statics, [], `the toolbar is imported statically — it would ride a first load: ${statics.join(', ')}`);
});
