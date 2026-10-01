/**
 * a-theme-pick-hands-the-look-back.test.ts — ONE theme pick sets the background,
 * the fonts and the colours, in ONE draft patch.
 *
 * Owner 2026-09-30 ("THE MAKER RE-PLAN IS CUT TO ITS CORE": *Theme sets
 * background + fonts + colours*; the Maker-in-four prototype: *"one pick sets
 * background, fonts and colours. Then Make it my own"*). The theme owns them; the
 * couple's own page colour, button colour and typeface are what they changed
 * AFTER picking — so a new pick returns all three to the theme, in the same
 * save (one Undo, one count on Apply) and never as a Pro item. They can still
 * override each after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { THEME_OWN_LOOK_RESET } from './theme-own-look';
import { INVITE_THEMES } from './invite-themes';
import {
  emptyHubDraft,
  mergeHubDraft,
  overlayHubDraftEvent,
  planHubDraftApply,
  undoHubDraft,
  type HubLiveState,
} from './hub-draft';

const WEB = join(__dirname, '..');
const PICKER = 'app/dashboard/[eventId]/launch/_components/maker-theme-picker.tsx';
const patchOf = (id: string) => ({ events: { invite_theme: id, ...THEME_OWN_LOOK_RESET } });
const live = (over: Record<string, unknown> = {}): HubLiveState =>
  ({ events: { invite_theme: 'house', site_bg_color: '#112233', site_button_color: '#aa5500', site_font_key: 'playfair', ...over }, widgets: [] }) as HubLiveState;

test('the reset is exactly background, button colour and typeface — nothing else', () => {
  assert.deepEqual(Object.keys(THEME_OWN_LOOK_RESET).sort(), ['site_bg_color', 'site_button_color', 'site_font_key']);
  assert.ok(Object.values(THEME_OWN_LOOK_RESET).every((v) => v === null), 'a reset is a null, i.e. "the theme’s own"');
});

test('ONE patch: the theme and the three overrides land in one draft save, and the page wears the theme’s own', () => {
  const d = mergeHubDraft(emptyHubDraft(), patchOf('galeriya'));
  assert.equal(d.history.length, 1, 'the pick took more than one save');
  const seen = overlayHubDraftEvent(live().events, d) as Record<string, unknown>;
  assert.equal(seen.invite_theme, 'galeriya');
  assert.equal(seen.site_bg_color, null, 'the old page colour still covers the theme’s background');
  assert.equal(seen.site_button_color, null, 'the old button colour still covers the theme’s');
  assert.equal(seen.site_font_key, null, 'the old typeface still covers the theme’s fonts');
  // The theme really owns something to hand back: its own palette and faces.
  assert.ok(INVITE_THEMES.galeriya.palette.canvas && INVITE_THEMES.galeriya.fonts.heading);
});

test('Undo takes the whole pick back at once — the theme AND the overrides', () => {
  const d = mergeHubDraft(emptyHubDraft(), patchOf('galeriya'));
  const back = overlayHubDraftEvent(live().events, undoHubDraft(d)) as Record<string, unknown>;
  assert.equal(back.invite_theme, 'house');
  assert.equal(back.site_bg_color, '#112233');
  assert.equal(back.site_font_key, 'playfair');
});

test('Apply counts it once, and giving the look back is never Pro', () => {
  const d = mergeHubDraft(emptyHubDraft(), patchOf('galeriya')); // a free theme
  const plan = planHubDraftApply(d, live(), false);
  assert.equal(plan.refused.length, 0, 'clearing an override was held for Pro');
  assert.deepEqual(
    plan.apply.map((a) => (a as { column?: string }).column).sort(),
    ['invite_theme', 'site_bg_color', 'site_button_color', 'site_font_key'],
  );
  assert.ok(plan.apply.filter((a) => (a as { column?: string }).column !== 'invite_theme').every((a) => (a as { pro: boolean }).pro === false));
  // A Pro theme is still held for Pro alone — the three removals do not ride along as Pro, nor hide it.
  const pro = planHubDraftApply(mergeHubDraft(emptyHubDraft(), patchOf('vintage')), live(), false);
  assert.equal(pro.refused.length, 1);
  assert.equal(pro.apply.filter((a) => (a as { pro: boolean }).pro).length, 0);
});

test('an event with no overrides changes nothing but the theme at Apply', () => {
  const bare = { events: { invite_theme: 'house', site_bg_color: null, site_button_color: null, site_font_key: null }, widgets: [] } as HubLiveState;
  const plan = planHubDraftApply(mergeHubDraft(emptyHubDraft(), patchOf('galeriya')), bare, false);
  assert.deepEqual(plan.apply.map((a) => (a as { column?: string }).column), ['invite_theme']);
});

test('by source: the picker is the one writer, sends the reset in the SAME patch, and never touches the hero background', () => {
  const src = stripComments(readFileSync(join(WEB, PICKER), 'utf8'));
  assert.equal([...src.matchAll(/hubDraftAction\(/g)].length, 1);
  assert.match(src, /JSON\.stringify\(\{ events: \{ invite_theme: id, \.\.\.THEME_OWN_LOOK_RESET \} \}\)/);
  assert.doesNotMatch(src, /widgets:\s*\{/, 'a theme pick reaches into a scene');
  const lib = stripComments(readFileSync(join(WEB, 'lib/theme-own-look.ts'), 'utf8'));
  assert.doesNotMatch(lib, /import /, 'the Maker’s bundle is at its ceiling — this file takes no imports');
});
