/**
 * hub-look-given.test.ts — the viewer-free theme rule IS the hub's rule.
 *
 * `lib/hub-look-given.ts` is `resolveHubTheme` / `resolveHubLook`
 * (`app/[slug]/_lib/hub-look.ts`) with their one read — "does this event own
 * Event Hub Pro?" — lifted out into an argument. Two things are held:
 *
 *   1 · EXECUTED: for every theme the product ships, owned and not, the theme
 *       it answers is the one the gate's own rule (`resolveInviteTheme`) gives,
 *       and ownership is consulted only for a saved Pro theme.
 *   2 · PINNED: the text of the two originals. They could not be made to CALL
 *       this file (they live under `app/[slug]`, which the change that added it
 *       was told not to edit), so if either is edited this fails — and names
 *       the file that must be changed with it. Delete this pin the day the
 *       originals delegate here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { INVITE_THEMES, resolveInviteTheme, type InviteThemeId } from './invite-themes';
import { heroGroundNeedsOwnership, heroMayBePageGround } from './page-ground';
import { hubLookDrawsOwnPhoto, hubThemeGiven, ownershipCanChangeTheCover, wantsProTheme } from './hub-look-given';
import { stripComments } from './strip-comments';

const IDS = Object.keys(INVITE_THEMES) as InviteThemeId[];
const event = (invite_theme: string | null) => ({ display_name: 'Cale & Ice', invite_theme, monogram_text: null, monogram_color: null });

test('1 · every shipped theme, owned and not: the gate’s own answer, and a Pro theme only for an owner', () => {
  assert.ok(IDS.length >= 4, `expected the shipped themes, found ${IDS.length}`);
  let pro = 0;
  for (const id of IDS) {
    const isPro = INVITE_THEMES[id].tier === 'pro';
    if (isPro) pro += 1;
    assert.equal(wantsProTheme(id), isPro, id);
    for (const owned of [true, false]) {
      const got = hubThemeGiven(event(id), owned).theme;
      assert.equal(got, resolveInviteTheme({ saved: id, ownsPro: isPro ? owned : false }), `${id} owned=${owned}`);
      if (isPro && !owned) assert.equal(got, 'house', `${id}: a paid theme was worn without the unlock`);
      if (isPro && owned) assert.equal(got, id, `${id}: a paid-for theme was hidden`);
      if (!isPro) assert.equal(got, hubThemeGiven(event(id), !owned).theme, `${id}: ownership changed a free theme`);
    }
  }
  assert.ok(pro >= 1, 'no Pro theme in the table — the paid arm was never exercised');
});

test('1b · nothing saved, and a value nobody ships, are House — whoever owns what', () => {
  for (const saved of [null, '', 'not-a-theme']) {
    for (const owned of [true, false]) assert.equal(hubThemeGiven(event(saved), owned).theme, 'house');
  }
});

test('1c · the own photo behind the door: the hub’s two rules, in the hub’s order', () => {
  for (const id of IDS) {
    for (const owned of [true, false]) {
      const ownsPro = heroGroundNeedsOwnership(id) ? owned : false;
      assert.equal(hubLookDrawsOwnPhoto(id, owned), heroMayBePageGround(id, ownsPro), `${id} owned=${owned}`);
    }
  }
});

test('1d · where ownership cannot change the cover, the theme and the photo gate say so', () => {
  for (const saved of [...IDS, null, 'not-a-theme']) {
    if (ownershipCanChangeTheCover(saved)) continue;
    const a = hubThemeGiven(event(saved), true);
    const b = hubThemeGiven(event(saved), false);
    assert.equal(a.theme, b.theme, String(saved));
    assert.equal(heroGroundNeedsOwnership(a.theme), false, `${saved}: ownership decides this theme's ground after all`);
  }
});

const ORIGINAL = join(__dirname, '..', 'app', '[slug]', '_lib', 'hub-look.ts');
/** sha-256 of the two originals, comments stripped and whitespace collapsed. */
const PINNED = '1c5f4be5a3901799368b25241606264a9527aba197bb442ee8a1b59b69af620f';

test('2 · the originals have not moved since this copy of their rule was taken', () => {
  const src = stripComments(readFileSync(ORIGINAL, 'utf8'));
  const from = src.indexOf('export async function resolveHubTheme(');
  assert.ok(from > -1, 'resolveHubTheme moved — re-anchor this pin');
  const body = src.slice(from).replace(/\s+/g, ' ').trim();
  assert.match(body, /export async function resolveHubLook\(/, 'resolveHubLook moved — re-anchor this pin');
  const hash = createHash('sha256').update(body).digest('hex');
  assert.equal(
    hash,
    PINNED,
    'resolveHubTheme / resolveHubLook (app/[slug]/_lib/hub-look.ts) changed. lib/hub-look-given.ts is the ' +
      'same rule with the ownership read handed in, and the home page draws every Discover card from it — ' +
      'make the same change there (or, better, make the originals call it), then pin the new hash: ' +
      hash,
  );
});
