/**
 * Event Hub Pro's row says what Pro unlocked ON THIS EVENT — "Pro on · <theme>
 * theme · <background>" (owner "approve all", 2026-10-14) — in the Look ›
 * Background panel's own vocabulary, read from what the hub wears.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { hubProLookWords } from './hub-pro-look-words';
import { INVITE_THEMES } from './invite-themes';

const withMain = (main: unknown) => ({ main });

test('the couple\'s clip is a video background; their photo a photo background', () => {
  assert.equal(hubProLookWords({ theme: 'house', heroConfig: withMain({ kind: 'snippet', media: 'r2://setnayan-media/u/clip.mp4' }) }).background, 'video background');
  assert.equal(hubProLookWords({ theme: 'house', heroConfig: withMain({ kind: 'photo', media: 'r2://setnayan-media/u/p.jpg' }) }).background, 'photo background');
});

test('the theme names itself; an unknown theme is left out, never guessed', () => {
  assert.equal(hubProLookWords({ theme: 'house', heroConfig: null }).theme, INVITE_THEMES.house.name);
  assert.deepEqual(hubProLookWords({ theme: 'not-a-theme', heroConfig: null }), { theme: null, background: null });
});

test('no Main background: the theme\'s own ground — moving when it has a loop, else colour', () => {
  for (const [id, t] of Object.entries(INVITE_THEMES)) {
    const words = hubProLookWords({ theme: id, heroConfig: null });
    assert.equal(words.background, t.media ? 'moving background' : 'colour background', id);
  }
  assert.equal(hubProLookWords({ theme: 'house', heroConfig: withMain({ ground: 'none' }) }).background, 'colour background');
});
