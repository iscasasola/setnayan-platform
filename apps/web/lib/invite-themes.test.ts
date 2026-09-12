/**
 * lib/invite-themes.test.ts — the five invite themes keep their promises.
 *
 * Each test names a promise a couple or a guest would feel if it broke: a live
 * invite repainted without anyone choosing, a Pro theme shown to an event that
 * does not hold Event Hub Pro, a feel with no theme to suggest, a theme the app
 * offers that the database refuses to store.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEL_OPTIONS } from '@/lib/match-criteria';
import {
  INVITE_THEME_IDS,
  INVITE_THEMES,
  pickableInviteThemes,
  resolveInviteTheme,
  suggestedInviteTheme,
} from '@/lib/invite-themes';

const HERE = dirname(fileURLToPath(import.meta.url));

test('nothing repaints a live invite: unsaved, junk or unshipped all render as House', () => {
  for (const saved of [null, undefined, '', 'Capiz', 'marble', 42, 'galeriya', 'abaca']) {
    assert.equal(resolveInviteTheme({ saved, ownsPro: true }), 'house', `${String(saved)} must render as House`);
  }
  // …and a theme whose skin HAS shipped renders itself, which is what makes the
  // line above a real check rather than "everything is House".
  assert.equal(resolveInviteTheme({ saved: 'velvet', ownsPro: true }), 'velvet', 'Velvet shipped its skin (2026-09-11) and must render');
});

test('a Pro theme is shown only while the event holds Event Hub Pro', () => {
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: true }), 'capiz');
  assert.equal(resolveInviteTheme({ saved: 'capiz', ownsPro: false }), 'house', 'a lapsed or never-bought Pro theme leaked through');
  assert.equal(resolveInviteTheme({ saved: 'house', ownsPro: false }), 'house');
});

test('House is the one free theme, and the other four are Pro', () => {
  const free = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].tier === 'free');
  assert.deepEqual(free, ['house'], 'the owner ruled "Generic is the Free"; the other four are Event Hub Pro');
  assert.equal(INVITE_THEME_IDS.length, 5);
});

test('every onboarding feel is suggested exactly one theme — no couple is suggested nothing', () => {
  for (const { value } of FEEL_OPTIONS) {
    const homes = INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].feels.includes(value));
    assert.equal(homes.length, 1, `feel "${value}" belongs to ${homes.length} themes`);
  }
});

test('the picker pre-selects from the feel, but only a theme the couple can actually use', () => {
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: true }), 'capiz');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'timeless', ownsPro: false }), 'house');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ownsPro: true }), 'velvet');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'glam', ownsPro: false }), 'house');
  // An unshipped skin is never suggested, even to a Pro couple whose feel points
  // at it — 'modern' is Galeriya's feel and Galeriya has no skin yet.
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: 'modern', ownsPro: true }), 'house');
  assert.equal(suggestedInviteTheme({ saved: null, moodFeelKey: null, ownsPro: true }), 'house');
  // A saved choice always wins over the feel.
  assert.equal(suggestedInviteTheme({ saved: 'house', moodFeelKey: 'timeless', ownsPro: true }), 'house');
});

test('the picker offers only shipped skins', () => {
  assert.deepEqual(
    pickableInviteThemes().map((t) => t.id),
    INVITE_THEME_IDS.filter((id) => INVITE_THEMES[id].ready),
  );
  assert.ok(pickableInviteThemes().some((t) => t.id === 'house'), 'House must always be pickable');
});

test('the app and the database agree on the five names', () => {
  const dir = join(HERE, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_the_invite_link_wears_a_theme.sql'));
  assert.ok(file, 'the migration that adds events.invite_theme is gone or renamed');
  const sql = readFileSync(join(dir, file), 'utf8');
  const m = sql.match(/invite_theme IN \(([^)]*)\)/);
  assert.ok(m, 'the CHECK constraint on invite_theme is gone');
  const inDb = (m[1] ?? '').split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
  assert.deepEqual(
    [...inDb].sort(),
    [...INVITE_THEME_IDS].sort(),
    'a theme the app offers would be refused by the database, or the reverse',
  );
});
