/**
 * 🌄 THE MAIN BACKGROUND'S EXTRAS REACH THE PAGE (owner 2026-10-06 DECISION_LOG
 * "STUDIO › LOOK IS THE GLOBAL LOOK"; stored 2026-10-07 "THE MISSING FIELDS ARE
 * APPROVED"): Pattern · Focus · Blur · Shade.
 *
 * Holds: each is stored ON the main background, only where it means something,
 * and dropped otherwise; a change of extras alone is a free Apply item (never
 * Pro); the resolved ground carries them; the guest layer lays Shade's veil and
 * flips the words on a dark one, blurs, focuses and draws the pattern — the
 * shipped rule (`mainGroundShade`) decides the veil, so the floor holds.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hubMainTakes, resolveMainGround, sanitizeHubMainGround } from './hub-canvas';
import { mainGroundChange } from './hub-draft';
import { mainGroundShade, shadeWordVars } from './main-ground-shade';
import { AA_BODY, contrastRatio } from './hub-legibility';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const TINT = { match: false, frame: ['#f4efe6', '#1e1a12'] };

test('each extra is kept only where it means something', () => {
  const photo = sanitizeHubMainGround({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/c.jpg', tint: TINT, shade: 'dark', blur: 'soft', focus: 'top' });
  assert.deepEqual([photo && 'shade' in photo && photo.shade, photo && 'blur' in photo && photo.blur, photo && 'focus' in photo && photo.focus], ['dark', 'soft', 'top']);
  const clip = sanitizeHubMainGround({ kind: 'snippet', media: 'r2://setnayan-media/events/E1/main-background/c.mp4', shade: 'lighter', focus: 'top' });
  assert.equal(clip && 'focus' in clip ? clip.focus : undefined, undefined, 'a clip takes no Focus');
  assert.equal(clip && 'shade' in clip ? clip.shade : undefined, 'lighter');
  assert.deepEqual(sanitizeHubMainGround({ ground: 'none', shade: 'dark' }), { ground: 'none' }, 'the plain colour takes no Shade');
  assert.deepEqual(sanitizeHubMainGround({ ground: 'pattern', pattern: 'lace' }), { ground: 'pattern', pattern: 'lace' });
  assert.equal(sanitizeHubMainGround({ ground: 'pattern', pattern: 'paisley' }), null, 'an unknown pattern is dropped, never guessed');
  const asIs = sanitizeHubMainGround({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/c.jpg', shade: 'as-is', blur: 'huge' });
  assert.ok(asIs && !('shade' in asIs) && !('blur' in asIs), '"As is" and an unknown blur are never stored');
  assert.deepEqual(hubMainTakes({ ground: 'none' }), { shade: false, blur: false, focus: false });
  assert.deepEqual(hubMainTakes(photo), { shade: true, blur: true, focus: true });
});

test('extras alone are a free change; the resolved ground carries them', () => {
  const live = sanitizeHubMainGround({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/c.jpg', tint: TINT });
  const next = sanitizeHubMainGround({ kind: 'photo', media: 'r2://setnayan-media/events/E1/main-background/c.jpg', tint: TINT, shade: 'darker', blur: 'strong' });
  assert.notEqual(JSON.stringify(live), JSON.stringify(next), 'the Apply item must see the change');
  assert.equal(mainGroundChange(live, next), 'none', 'a shade or a blur is design, never Pro');
  assert.equal(mainGroundChange({ ground: 'none' }, { ground: 'pattern', pattern: 'dots' }), 'none', 'a pattern is free');
  const r = resolveMainGround(next, { photoRef: null, videoRef: null }, (x) => x);
  assert.deepEqual(r?.look, { shade: 'darker', blur: 'strong' });
});

test('a dark shade flips the words to the paper, and the floor holds', () => {
  const page = { paper: '#fbfaf7', ink: '#2c2a29' };
  const dark = mainGroundShade('darker', page, ['#ffffff', '#808080']);
  assert.ok(dark.bodyContrast >= AA_BODY);
  assert.deepEqual(shadeWordVars(dark, page), { '--color-ink': '251 250 247', '--color-cream': '44 42 41' });
  assert.ok(contrastRatio(page.paper, page.ink) >= AA_BODY);
  assert.deepEqual(shadeWordVars(mainGroundShade('lighter', page, ['#000000']), page), {}, 'a paper veil changes no word');
});

test('the guest layer lays the veil, the blur, the focus and the pattern', () => {
  const layer = read('app/[slug]/_lib/main-ground-layer.tsx');
  assert.match(layer, /const shade = look\.shade \? mainGroundShade\(look\.shade, page, mainGround\.tint\?\.frame \?\? \[\]\) : null;/);
  assert.match(layer, /\.\.\.\(shade \? shadeWordVars\(shade, page\) : \{\}\)/);
  assert.match(layer, /veil=\{shade \? \{ color: shade\.veil, opacity: shade\.opacity \} : null\}/);
  assert.match(layer, /blur=\{look\.blur \?\? null\}\s*focus=\{look\.focus \?\? null\}/);
  assert.match(layer, /<MainGroundPattern pattern=\{main\.pattern\}/);
  const ground = read('app/[slug]/_components/main-ground.tsx');
  assert.match(ground, /\{veil \? \(\s*<div\s*data-main-ground-scrim=""\s*data-main-ground-shade=""/);
  assert.match(ground, /backgroundPosition: position, \.\.\.blurStyle/);
  assert.match(ground, /export function MainGroundPattern/);
});

test('Studio › Look › Background draws Pattern · Focus · Blur · Shade as dropdowns into the draft', () => {
  const tools = read('app/dashboard/[eventId]/launch/_components/studio-tools.tsx');
  for (const k of ['pattern', 'focus', 'blur', 'shade']) assert.match(tools, new RegExp(`dataAttr="data-studio-${k}-pick"`), `${k} ▾ is gone`);
  assert.match(tools, /draftPatch\(eventId, \{ widgets: \{ hero: \{ main: next \} \} \}\)/);
  assert.match(read('app/dashboard/[eventId]/launch/_components/maker-details.tsx'), /k === 'background' && st\.main !== undefined \? <StudioTool part="main-extras"/);
});
