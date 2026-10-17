/**
 * 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER (owner 2026-10-18) — the shared pattern ("merge from base",
 * `lib/merge-from-base.ts`) and every place it is wired.
 *
 * The incident it answers: 2026-10-17, cale-ice — the Mood Board & Dress Code editor saved its WHOLE board from a copy
 * taken before the other host's change, and two women's colour sets were gone. The db half (the draft row's
 * compare-and-set, the based saves through the real store, as the couple) is
 * `tests/db/two-hosts-never-overwrite.db.test.ts`.
 *
 * 🛡 Sabotaged, each red then restored (2026-10-18) — listed in the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changedFields, mergeFromBase } from './merge-from-base';
import { draftLeftAfterApply, rebaseHubDraftPatch } from './hub-draft-rebase';
import { emptyHubDraft, mergeHubDraft, type HubDraft } from './hub-draft';
import { guestCardMerge, guestColumnWritten } from './guest-card-merge';
import { TWO_SCREENS_NOTE } from './merge-from-base';
import { makerSaveStatusText } from './maker-save-status';
import { dressCodeDraftFields, paletteDraftFields } from './studio-mood-board-saves';

const read = (...p: string[]) => readFileSync(join(__dirname, '..', ...p), 'utf8');

/* ── the pattern ─────────────────────────────────────────────────────────── */

test('1 · two saves from the same base touching DIFFERENT values — both are kept, nothing is said to be a clash', () => {
  const base = { family: ['#111111'], sponsors: ['#222222'], reception: ['#AAAAAA'] };
  // Claire's screen changed Secondary Sponsors and saved first.
  const theirs = { ...base, sponsors: ['#333333', '#444444'] };
  // Indalecio's screen, still on the old board, changed Immediate Family.
  const mine = { ...base, family: ['#555555'] };
  const m = mergeFromBase(base, mine, theirs);
  assert.deepEqual(m.value, { family: ['#555555'], sponsors: ['#333333', '#444444'], reception: ['#AAAAAA'] }, 'a colour set from the other screen was wiped');
  assert.deepEqual(m.clashed, []);
  assert.equal(m.moved, true, 'the screen was not told the board now holds the other change');
});

test('2 · both changed the SAME value — the later save wins, and it is named', () => {
  const base = { family: ['#111111'] };
  const m = mergeFromBase(base, { family: ['#999999'] }, { family: ['#777777'] });
  assert.deepEqual(m.value, { family: ['#999999'] }, 'the later save did not win');
  assert.deepEqual(m.clashed, ['family'], 'a value both screens changed was not named');
  assert.equal(m.moved, false, 'the result IS this save — the screen already shows it');
});

test('3 · a screen that did not say what it started from is taken whole (an older page) — exactly the old behaviour', () => {
  const m = mergeFromBase(undefined, { a: 1 }, { a: 2, b: 3 });
  assert.deepEqual(m, { value: { a: 1 }, clashed: [], moved: false });
});

test('4 · lists of items with an id merge item by item — two people adding moments keep both, a removal is honoured', () => {
  const base = { moments: [{ id: 'm1', line: 'We met' }, { id: 'm2', line: 'First trip' }] };
  // The other screen added m3 and took m2 off.
  const theirs = { moments: [{ id: 'm1', line: 'We met' }, { id: 'm3', line: 'The yes' }] };
  // This screen added m4 and reworded m1.
  const mine = { moments: [{ id: 'm1', line: 'We met at work' }, { id: 'm2', line: 'First trip' }, { id: 'm4', line: 'A puppy' }] };
  const m = mergeFromBase(base, mine, theirs);
  assert.deepEqual(
    (m.value as typeof base).moments.map((x) => `${x.id}:${x.line}`),
    ['m1:We met at work', 'm4:A puppy', 'm3:The yes'],
    'a moment was lost, or one the other screen removed came back',
  );
  assert.deepEqual(m.clashed, []);
  // Edited here, removed there: the later save (this one) keeps it, and says so.
  const e = mergeFromBase(base, { moments: [{ id: 'm1', line: 'We met' }, { id: 'm2', line: 'Second trip' }] }, { moments: [{ id: 'm1', line: 'We met' }] });
  assert.deepEqual((e.value as typeof base).moments.map((x) => x.id), ['m1', 'm2']);
  assert.deepEqual(e.clashed, ['moments.m2']);
});

test('5 · a named set merges as a set — two hosts each painting a role keep both roles painted', () => {
  const base = { touched_roles: ['bridesmaids'] };
  const m = mergeFromBase(base, { touched_roles: ['bridesmaids', 'family'] }, { touched_roles: ['bridesmaids', 'sponsors'] }, { setKeys: ['touched_roles'] });
  assert.deepEqual([...(m.value.touched_roles as string[])].sort(), ['bridesmaids', 'family', 'sponsors']);
  assert.deepEqual(m.clashed, []);
});

/* ── the Maker draft ─────────────────────────────────────────────────────── */

test('6 · a WHOLE value sent with its base is merged onto the draft as it is NOW (the Mood Board incident, replayed)', () => {
  // The draft holds Claire's sponsors; Indalecio's board was copied before that and he changes Immediate Family.
  const current = mergeHubDraft(emptyHubDraft(), { events: { dress_code_config: { women: { family: { style: 'gown' } }, men: {} } } });
  const live = { events: {}, canvas: {} };
  const theirsDraft = { women: { family: { style: 'gown' }, sponsors: { style: 'filipiniana' } }, men: {} };
  const withClaire = mergeHubDraft(current, { events: { dress_code_config: theirsDraft } });
  const base = { events: { dress_code_config: { women: { family: { style: 'gown' } }, men: {} } } };
  const mine = { events: { dress_code_config: { women: { family: { style: 'cocktail' } }, men: {} } } };
  const r = rebaseHubDraftPatch(withClaire, mine, base, live);
  const next = mergeHubDraft(withClaire, r.patch);
  const women = (next.events.dress_code_config as { women: Record<string, { style: string }> }).women;
  assert.equal(women.family?.style, 'cocktail', 'this save was lost');
  assert.equal(women.sponsors?.style, 'filipiniana', 'the other host’s outfit was wiped — the 2026-10-17 incident');
  assert.equal(r.moved, true);
  assert.ok(r.merged.events?.dress_code_config, 'the screen is not handed what it must now show');
  // Without a base the save is exactly what it always was: whole.
  const old = mergeHubDraft(withClaire, rebaseHubDraftPatch(withClaire, mine, undefined, live).patch);
  assert.equal((old.events.dress_code_config as { women: Record<string, unknown> }).women.sponsors, undefined, 'anti-vacuity: the unbased save no longer overwrites — the test proves nothing');
});

test('7 · a value the draft does not hold is compared with LIVE — what the screen showed', () => {
  const live = { events: { dress_code_config: { women: { family: { style: 'gown' } }, men: { sponsors: { style: 'barong' } } } }, canvas: {} };
  const base = { events: { dress_code_config: { women: { family: { style: 'gown' } }, men: {} } } };
  const mine = { events: { dress_code_config: { women: { family: { style: 'cocktail' } }, men: {} } } };
  const r = rebaseHubDraftPatch(emptyHubDraft(), mine, base, live);
  const v = r.patch.events!.dress_code_config as { men: Record<string, { style: string }> };
  assert.equal(v.men.sponsors?.style, 'barong', 'a live value this screen never saw was wiped by its draft save');
});

test('8 · Apply keeps what another screen saved while it ran — drafted, not wiped', () => {
  const applied: HubDraft = mergeHubDraft(emptyHubDraft(), { events: { special_message: 'Old words', what_to_bring: 'Umbrella' } });
  // Apply wrote both live and keeps nothing.
  const left: HubDraft = { v: 1, events: {}, widgets: {}, history: [] };
  // Meanwhile Claire saved new words and a dress code.
  const now = mergeHubDraft(applied, { events: { special_message: 'New words', dress_code_config: { women: {}, men: {} } } });
  const out = draftLeftAfterApply(applied, left, now);
  assert.equal(out.events.special_message, 'New words', 'a save made during Apply was wiped by Apply’s trim');
  assert.ok(out.events.dress_code_config, 'a save made during Apply was wiped by Apply’s trim');
  assert.equal(out.events.what_to_bring, undefined, 'what Apply took live stayed drafted');
  assert.deepEqual(draftLeftAfterApply(applied, left, applied).events, {}, 'with nobody else saving, Apply leaves what it always left');
});

/* ── the guest card ──────────────────────────────────────────────────────── */

function card(fields: Record<string, string | string[] | undefined>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) for (const x of v === undefined ? [] : Array.isArray(v) ? v : [v]) fd.append(k, x);
  return fd;
}
const spelled = (fd: FormData) => JSON.stringify(Object.fromEntries([...new Set(fd.keys())].map((k) => [k, JSON.stringify(fd.getAll(k))])));

test('9 · the guest card writes only what THIS screen changed — the other host’s phone number and the guest’s own reply stay', () => {
  const opened = card({ first_name: 'Ana', last_name: 'Cruz', mobile: '0917', rsvp_status: 'pending', meal_preference: 'no_preference', notes: '', photo_consent: 'on' });
  // This screen fixes the note only.
  const posted = card({ first_name: 'Ana', last_name: 'Cruz', mobile: '0917', rsvp_status: 'pending', meal_preference: 'no_preference', notes: 'Vegan', photo_consent: 'on' });
  // Meanwhile another host changed her mobile, and Ana answered from her phone.
  const row = { first_name: 'Ana', last_name: 'Cruz', mobile: '0999', rsvp_status: 'attending', meal_preference: null, notes: null, photo_consent: true };
  const m = guestCardMerge(spelled(opened), posted, row);
  assert.equal(m.based, true);
  assert.equal(guestColumnWritten('notes', m), true, 'this screen’s change was not written');
  for (const col of ['mobile', 'rsvp_status', 'rsvp_responded_at', 'photo_consent', 'first_name', 'meal_preference']) {
    assert.equal(guestColumnWritten(col, m), false, `${col} was written back from a stale card`);
  }
  assert.deepEqual(m.fresh, { mobile: ['0999'], rsvp_status: ['attending'] }, 'the card is not handed the newest values to show');
  assert.deepEqual(m.clashed, []);
});

test('10 · the guest card: both changed the same field — this later save wins and it is named; no base = whole card, as before', () => {
  const opened = card({ mobile: '0917' });
  const m = guestCardMerge(spelled(opened), card({ mobile: '0918' }), { mobile: '0999' });
  assert.equal(guestColumnWritten('mobile', m), true);
  assert.deepEqual(m.clashed, ['mobile']);
  assert.deepEqual(m.fresh, {});
  const whole = guestCardMerge(null, card({ mobile: '0918' }), { mobile: '0999' });
  assert.equal(whole.based, false);
  assert.equal(guestColumnWritten('rsvp_status', whole), true, 'a post without a base must still write the whole card');
  // A box ticked off: it is a change (an unticked box posts nothing).
  const off = guestCardMerge(spelled(card({ photo_consent: 'on' })), card({}), { photo_consent: true });
  assert.equal(guestColumnWritten('photo_consent', off), true, 'unticking consent was not written');
  assert.ok(changedFields({ a: '["1"]' }, { a: '["1"]', b: '["on"]' }).has('b'), 'ticking a box was not a change');
});

/* ── the words, and the wiring ───────────────────────────────────────────── */

test('11 · the note is one calm line, said through the Maker’s status words', () => {
  assert.equal(TWO_SCREENS_NOTE, 'Changed on another screen a moment ago — showing the newest.');
  assert.equal(makerSaveStatusText({ state: 'elsewhere', text: TWO_SCREENS_NOTE }), TWO_SCREENS_NOTE);
  assert.doesNotMatch(TWO_SCREENS_NOTE, /website|celebration|conflict|error/i);
});

test('12 · every place the pattern is wired still carries it', () => {
  // The Mood Board's two whole values carry their base.
  assert.deepEqual(JSON.parse(paletteDraftFields({ a: 1 }, { a: 0 }).base!), { events: { role_palette: { a: 0 } } });
  assert.deepEqual(JSON.parse(dressCodeDraftFields({ a: 1 }, { a: 0 }).base!), { events: { dress_code_config: { a: 0 } } });
  const studio = read('app', 'dashboard', '[eventId]', 'studio', 'mood-board', '_components', 'mood-board-studio.tsx');
  assert.match(studio, /paletteDraftFields\(wrote, sentPalette\.current\)/, 'the board no longer sends what it was based on');
  assert.match(studio, /dressCodeDraftFields\(next, before\)/, 'the dress code no longer sends what it was based on');
  assert.match(studio, /r\.elsewhere\?\.merged\.events\?\.role_palette/, 'the board no longer shows the merged colours');
  // The Love Story carries its base.
  const story = read('app', 'dashboard', '[eventId]', 'website', 'our-story', '_components', 'love-story-live.tsx');
  assert.match(story, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(\{ events: \{ love_story: sentStory \} \}\)\)/, 'the Love Story no longer sends what it was based on');
  // The guest card carries its base, and its Undo too.
  const auto = read('app', 'dashboard', '[eventId]', 'guests', '_components', 'guest-card-autosave.tsx');
  assert.match(auto, /send\(withBase\(fd, change \? change\.prev : lastSaved\.current\)\)/, 'the card no longer sends the card it started from');
  assert.match(auto, /send\(withBase\(snap, lastSaved\.current\)\)/, 'the card’s Undo no longer sends the card it started from');
  // updateGuest writes only what changed, and reads the row's values for what it does not write.
  const guest = read('app', 'dashboard', '[eventId]', 'guests', '[guestId]', 'actions.ts');
  assert.match(guest, /Object\.entries\(wholeCard\)\.filter\(\(\[column\]\) => writes\(column\)\)/, 'updateGuest writes the whole card again');
  assert.match(guest, /if \(!writes\('photo_consent'\)\) photo_consent = prevGuest\.photo_consent;/, 'consent side effects read the stale card');
  // Every draft write in the one action goes through the compare-and-set door.
  const action = read('app', 'dashboard', '[eventId]', 'website', 'hub-draft-actions.ts');
  assert.doesNotMatch(action, /\bwriteHubDraft\(/, 'hubDraftAction writes the draft without the compare-and-set again');
  assert.match(action, /updateHubDraft<HubDraftRebased>\(supabase, eventId, async \(cur\) => \{\s*const c = cur \?\? emptyHubDraft\(\);\s*const rebased = await rebaseOnDraft\(supabase, eventId, c, patch, base\);/, 'a save is no longer merged from its base onto the draft as it is now');
  const store = read('lib', 'hub-draft-store.ts');
  assert.match(store, /if \(expect\) q = q\.eq\(expect\.column, expect\.value\);/, 'the draft write no longer asks whether the row is still the one read');
  assert.match(store, /\.select\('draft_json, revision'\)/, 'the draft is no longer read with its version');
  assert.match(store, /await writeHubDraft\(supabase, eventId, built\.next, appliedSnapshot, row\.stamp\);/, 'updateHubDraft no longer writes against the version it read');
  // The Maker's two whole-canvas writers (a scene's tabs and Style rows; a part's Colour · Size · Width) carry their base.
  const sceneCanvas = read('app', 'dashboard', '[eventId]', 'website', 'editor', '_components', 'use-scene-canvas.ts');
  assert.match(sceneCanvas, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(\{ widgets: \{ \[widgetType\]: \{ canvas: base \} \} \}\)\);/, 'a scene’s canvas no longer sends what it was based on');
  const partLook = read('app', 'dashboard', '[eventId]', 'launch', '_components', 'stage-panel', 'part-look.ts');
  assert.match(partLook, /fd\.set\(MERGE_BASE_FIELD, JSON\.stringify\(\{ widgets: \{ \[t\.widgetType\]: \{ canvas: baseCanvasFor\(t\.widgetType, server\) \?\? \{\} \} \} \}\)\);/, 'a part’s look no longer sends what it was based on');
  // One place says the note for every Maker save.
  assert.match(read('lib', 'maker-refresh.ts'), /const note = \(result as \{ elsewhere\?: \{ note\?: string \} \} \| null\)\?\.elsewhere\?\.note;\s*if \(note\) \{\s*announceMakerSave\(\{ state: 'elsewhere', text: note \}\);\s*requestCanvasRedraw\(\);/, 'a Maker save no longer says another screen’s change reached it');
});
