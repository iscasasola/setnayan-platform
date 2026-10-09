/**
 * studio-mood-board-posts-the-same.test.ts — STUDIO › MOOD BOARD & DRESS CODE SENDS WHAT IT ALWAYS SENT (2026-10-09; the page moved
 * onto the Form row / ActionButton / top-toast templates).
 *
 * The page writes to the couple's DRAFT (the five colours, the room, a role's colours, a role's outfit, the Do's & Don'ts) and LIVE
 * (a photo into a part, a photo out, a supplier's change undone). A control that is redrawn but posts a different field — or none —
 * renders exactly like success. So `studio-mood-board-posts-the-same.golden.json` holds the FormData the page built BEFORE any control
 * moved (recorded from the real page in Chromium; see its `_about`), and this test RUNS the builders the page now posts through
 * (`lib/studio-mood-board-saves.ts`) on those same payloads and compares — field names, order and values, exactly. It also holds that
 * the page POSTS through those builders and through the shipped actions only (the component cannot be driven without a DOM in this
 * runner — the browser run is what drove it; this holds the wiring), and that a refused write says so in plain words and never
 * looks saved (the golden's `after`).
 *
 * SABOTAGE (each seen RED, then restored): a builder drops `intent` · the palette's patch key renamed · the file lands after the colours
 * (the old order) · the removal's fields lose `slot_position` · the page hand-builds a patch beside the builder · a refusal printed raw
 * again · the do's form loses its draft flag · Keep starts calling the undo.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MOOD_BOARD_NOT_SAVED, dressCodeDraftFields, paletteDraftFields, slotRemoveFields, slotUploadFields } from './studio-mood-board-saves';
import { isPlainSentence } from '../app/dashboard/[eventId]/guests/_components/plain-refusal';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
type Call = { action: string; args: Array<{ formData: Array<[string, string]> } | string> };
type Entry = { calls: Call[]; says_before?: string[]; after?: { says?: string[]; photos?: number; stillThere?: number }; options?: string[] };
const golden = JSON.parse(readFileSync(join(__dirname, 'studio-mood-board-posts-the-same.golden.json'), 'utf8')) as Record<string, Entry>;
const the = (name: string, i = 0): Call => {
  const c = golden[name]?.calls[i];
  assert.ok(c, `the golden has no call ${i} for ${name}`);
  return c;
};
const pairs = (c: Call): Array<[string, string]> => {
  const fd = c.args.find((a): a is { formData: Array<[string, string]> } => typeof a === 'object');
  assert.ok(fd, 'a call without a FormData');
  return fd.formData;
};
const asPairs = (o: Record<string, string>): Array<[string, string]> => Object.entries(o);
const STUDIO = 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx';
const DOS = 'app/dashboard/[eventId]/studio/mood-board/_components/studio-dos.tsx';

const DRAFT_SCENARIOS = ['m1_main', 'm2_two_quick', 'm3_part_set', 'm3_part_follow', 'm4_auto', 'm5_role_add', 'm5_role_change', 'm5_role_remove', 'm10_use_five', 'm11_undo', 'm14_use_slot'];

test('1 · every colour write is the whole painted board as `role_palette`, through the draft door', () => {
  for (const s of DRAFT_SCENARIOS) {
    const c = the(s);
    assert.equal(c.action, 'hubDraftAction', s);
    assert.equal(c.args[0], 'E1', `${s}: the event is the first argument`);
    const p = pairs(c);
    assert.deepEqual(p.map(([k]) => k), ['intent', 'patch'], `${s}: field names and order`);
    const palette = (JSON.parse(p[1]![1]) as { events: { role_palette: unknown } }).events.role_palette;
    assert.deepEqual(asPairs(paletteDraftFields(palette)), p, `${s}: the builder does not rebuild what the page sent`);
  }
});

test('2 · quick picks are coalesced as before (never more writes than the page made)', () => {
  assert.equal(golden.m2_two_quick!.calls.length, 2, 'two picks a pause apart wrote twice before; the page is held to that');
  assert.equal(golden.m1_main!.calls.length, 1);
  assert.equal(golden.m11_undo!.calls.length, 1, 'an Undo is one write of the earlier board');
  assert.match(read(STUDIO), /timer\.current = window\.setTimeout\(flushPalette, SAVE_AFTER_MS\);/, 'a pick is no longer held for the pause before it is sent');
  assert.match(read(STUDIO), /const SAVE_AFTER_MS = 600;/);
});

test('3 · an outfit is the whole dress code as `dress_code_config`, through the same door', () => {
  const c = the('m6_wear');
  assert.equal(c.action, 'hubDraftAction');
  const p = pairs(c);
  assert.deepEqual(p.map(([k]) => k), ['intent', 'patch']);
  const cfg = (JSON.parse(p[1]![1]) as { events: { dress_code_config: unknown } }).events.dress_code_config;
  assert.deepEqual(asPairs(dressCodeDraftFields(cfg)), p);
});

test('4 · a photo goes in with its place, the file, then the colours read from it — and comes out with its place', () => {
  const up = the('m7_upload');
  assert.equal(up.action, 'uploadMoodboardSlot');
  const p = pairs(up);
  assert.deepEqual(p.map(([k]) => k), ['event_id', 'slot_key', 'slot_position', 'file', 'palette_json'], 'the old field order');
  const swatches = JSON.parse(p[4]![1]) as string[];
  const built = asPairs(slotUploadFields({ eventId: 'E1', slot: 'flowers', pos: 2, swatches }));
  assert.deepEqual(built.map(([k]) => k), ['event_id', 'slot_key', 'slot_position', 'palette_json']);
  assert.deepEqual(built.filter(([k]) => k !== 'palette_json'), p.slice(0, 3).map(([k, v]) => [k, v]));
  assert.equal(built.find(([k]) => k === 'palette_json')![1], p[4]![1]);
  assert.match(p[3]![1], /^FILE\(rose\.png,image\/png\)$/);
  assert.match(read(STUDIO), /if \(k === 'palette_json'\) fd\.set\('file', small\);\s*fd\.set\(k, v\);/, 'the file no longer sits before the colours');
  const rm = the('m8_remove');
  assert.equal(rm.action, 'removeMoodboardSlot');
  assert.deepEqual(asPairs(slotRemoveFields({ eventId: 'E1', slot: 'flowers', pos: 1 })), pairs(rm));
});

test('5 · a supplier’s change: Keep sends nothing, Undo it sends the event and the change', () => {
  assert.deepEqual(golden.m9_keep!.calls, []);
  const u = the('m9_undo_it');
  assert.equal(u.action, 'rejectColourChange');
  assert.deepEqual(u.args, ['E1', 'c1']);
  const src = read(STUDIO);
  assert.match(src, /await rejectColourChange\(eventId, c\.id\)/);
  assert.match(src, /<ActionButton tone="neutral" label="Keep" icon=\{Check\} onClick=\{\(\) => settle\(c\.id\)\} \/>/, 'Keep does something other than set the change aside');
});

test('6 · the do’s and don’ts post the two lists through the form’s own action, into the draft, once a row is kept', () => {
  const d1 = pairs(the('d1_edit'));
  assert.deepEqual(d1.map(([k]) => k), ['draft', 'dos', 'donts'], 'draft flag first, then each list — the same fields the bare inputs posted');
  assert.deepEqual(d1[0], ['draft', '1']);
  assert.equal(the('d1_edit').action, 'updateDressCodeLists');
  assert.equal(the('d1_edit').args[0], 'E1');
  assert.deepEqual(pairs(the('d2_add')).map(([k]) => k), ['draft', 'dos', 'dos', 'donts'], 'an added row is a second `dos`');
  assert.deepEqual(golden.d3_unchanged!.calls, [], 'a row left unchanged sends nothing');
  const src = read(DOS);
  assert.match(src, /<form action=\{submit\}/);
  assert.match(src, /await updateDressCodeLists\(eventId, fd\)/);
  assert.match(src, /<HubDraftField \/>/, 'the lists no longer carry the draft flag');
  assert.match(src, /<DraftsAsYouGo settle \/>/, 'the lists no longer draft when a row is left');
  assert.equal((src.match(/fieldName=\{field\}/g) ?? []).length, 1, 'a row does not post under the list’s name');
  assert.match(src, /<DosList key=\{`dos:/);
  assert.match(src, /<DosList key=\{`donts:/);
});

test('7 · the look the lists are drawn in goes through the one scene-canvas door, as the toolbar sent it', () => {
  const src = read(DOS);
  assert.match(src, /useSceneCanvas\(\s*eventId,\s*'dress_code',\s*draftedCanvasOr\('dress_code', canvas\),\s*hubDraftAction,\s*\(next\) => noteDraftedCanvas\('dress_code', next, canvas\),\s*\{ redraw: true \},?\s*\)/);
  assert.match(src, /if \(look === DOS_LOOK_DEFAULT\) delete c\.dos;\s*else c\.dos = look;/, '"Two notes" is the absence; any other look is stored as `canvas.dos`');
});

test('8 · the page posts only through the builders and the context’s actions', () => {
  const src = read(STUDIO);
  assert.equal((src.match(/hubDraftAction\(eventId, fd\)/g) ?? []).length, 2, 'the page’s draft writes changed (colours · outfit) — re-read this guard');
  assert.doesNotMatch(src, /fd\.set\('(?:intent|patch|event_id|slot_key|slot_position|palette_json)'|JSON\.stringify\(\{ events/, 'a payload is hand-built beside the builder');
  assert.doesNotMatch(src, /from '\.\.\/\.\.\/\.\.\/(?:website\/hub-draft-actions|colour-access-actions|wizard-actions)'|from '\.\.\/actions'/, 'the page imports a real action again (the lab could then reach the database)');
  assert.match(src, /const \{ hubDraftAction, rejectColourChange, uploadMoodboardSlot, removeMoodboardSlot, applyGalleryPick, fetchGalleryAssets \} = useMoodBoardActions\(\);/);
  assert.doesNotMatch(src, /makerSave\([^)]*requestMakerRefresh/, 'a pick costs a whole-Maker render again');
});

test('9 · a write that is refused or dropped SAYS SO in plain words, and never looks saved', () => {
  for (const [k, e] of Object.entries(golden)) {
    for (const w of e.after?.says ?? []) assert.ok(isPlainSentence(w), `${k}: the page says "${w}", which is not a plain sentence`);
  }
  assert.deepEqual(golden.f1_refused!.after!.says, [MOOD_BOARD_NOT_SAVED.palette], 'a refused colour save prints the database words, or nothing');
  assert.deepEqual(golden.f2_thrown!.after!.says, [MOOD_BOARD_NOT_SAVED.palette], 'a dropped connection looks like a saved pick');
  assert.deepEqual(golden.f3_upload_refused!.after!.says, [MOOD_BOARD_NOT_SAVED.upload]);
  assert.deepEqual(golden.f4_undo_it_refused!.after!.says, [MOOD_BOARD_NOT_SAVED.undo]);
  assert.equal(golden.f4_undo_it_refused!.after!.stillThere, 1, 'a change that could not be undone leaves its card');
  assert.deepEqual(golden.f5_remove_refused!.after!.says, [MOOD_BOARD_NOT_SAVED.remove]);
  assert.equal(golden.f5_remove_refused!.after!.photos, 2, 'a photo that would not come off must still be on the board (it looked removed before)');
  const src = read(STUDIO);
  assert.doesNotMatch(src, /failed\((?:r|res)\.(?:error|message)\)|refuse\((?:r|res)\.(?:error|message)\)|\{(?:r|res)\.(?:error|message)\}/, 'the server’s own text is printed raw');
  assert.ok((src.match(/plainRefusal\(/g) ?? []).length >= 4, 'a refusal is not said through plainRefusal');
  assert.match(src, /setPalette\(savedPalette\.current\);/, 'a refused colour save no longer puts the board back');
  assert.match(src, /if \(before\) setTile\(slot, pos, before\);/, 'a refused photo removal no longer puts the photo back');
  assert.match(src, /setDress\(before\);/, 'a refused outfit no longer goes back');
});
