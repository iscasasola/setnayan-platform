/**
 * 📷 THE MAKER OFFERS NO CAMERA STYLE — there is ONE guest camera.
 *
 * Owner, 24 Oct 2026, verbatim: *"place this as a style template for the camera. remove the other style template"*
 * — then, final: *"Free: plain camera with a small Setnayan mark on saved photos. Pro: their logo on the shutter,
 * theme colours, and their monogram on saved photos. No frames."* The three looks of 06 Oct (Classic · Your brand ·
 * Challenges) and the Maker's Camera Style dropdown are gone; what a camera wears is decided by the event's Logo & QR
 * part or Full Pro (`lib/camera-dress.ts`), never by a pick.
 *
 * Held as PROPERTIES, not phrasings:
 *   1. no file of the Maker (its launch tree, its work area, the hub draft) reads or writes `camera_look`, or offers
 *      the Camera a set of choices — no Style cards, no dropdown, no save from the Camera's rows;
 *   2. the Camera part names no layouts;
 *   3. a `camera_look` a save carries never reaches the draft, so nothing can be applied for it;
 *   4. Pro decides the dress: gate 31 is the Logo & QR part's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { MAKER_PARTS } from './maker-parts';
import { HUB_PRO_GATES } from './hub-parts';
import { emptyHubDraft, mergeHubDraft, sanitizeHubDraft } from './hub-draft';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(WEB, dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(join(WEB, rel)).isDirectory()) walk(rel, out);
    else if (/\.tsx?$/.test(name) && !/\.test\./.test(name)) out.push(rel);
  }
  return out;
}

const MAKER_FILES = [
  ...walk('app/dashboard/[eventId]/launch'),
  ...walk('app/dashboard/[eventId]/website/editor'),
  ...walk('app/dev/maker-lab'),
  'lib/hub-draft.ts',
  'lib/hub-draft-change-lines.ts',
  'lib/hub-pro-effects.ts',
  'lib/maker-parts.ts',
];

test('1 · nothing in the Maker reads or writes a camera look, or imports the retired look modules', () => {
  const hits: string[] = [];
  for (const rel of MAKER_FILES) {
    const src = read(rel);
    if (/camera_look|cameraLook|CameraLook|CAMERA_LOOK|from '@\/lib\/camera-look(-key)?'/.test(src)) hits.push(rel);
  }
  assert.deepEqual(hits, [], `a camera look is back in the Maker: ${hits.join(', ')}`);
});

test('1 · the Camera’s own files offer no choice and save nothing', () => {
  const panel = 'app/dashboard/[eventId]/launch/_components/stage-panel';
  const cameraFiles = walk(panel).filter((f) => /\/camera-[a-z-]+\.tsx$/.test(f));
  assert.ok(cameraFiles.length > 0, 'no camera file found — the walk is looking in the wrong place');
  for (const rel of cameraFiles) {
    const src = read(rel);
    assert.doesNotMatch(src, /<StyleCards|<PickMenu|role="radio"|hubDraftAction|makerSave|fd\.set\('patch'/, `${rel} offers the Camera a choice or saves one`);
  }
});

test('2 · the Camera part names no layouts', () => {
  assert.equal(MAKER_PARTS.camera.layouts.kind, 'none');
});

test('3 · a `camera_look` a save carries never reaches the draft', () => {
  assert.equal(sanitizeHubDraft({ events: { style_preferences: { camera_look: 'brand' } } })?.events.style_preferences, undefined);
  const d = mergeHubDraft(emptyHubDraft(), { events: { style_preferences: { camera_look: 'challenges', qr: { pattern: 'dots' } } } });
  assert.ok(!('camera_look' in ((d.events.style_preferences as Record<string, unknown> | undefined) ?? {})), 'a camera look was drafted');
});

test('4 · the camera’s dress is the Logo & QR part’s (gate 31), never a style pick', () => {
  const gate = HUB_PRO_GATES.find((g) => g.id === '31');
  assert.ok(gate, 'gate 31 is gone');
  assert.equal(gate.home, 'logo_qr');
  assert.match(gate.gate, /camera/i);
});
