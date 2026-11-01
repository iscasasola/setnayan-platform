/**
 * hub-music-silent-hint.test.ts — "NO SOUND? YOUR PHONE MAY BE ON SILENT." (PR #7129, owner 2026-11-01).
 *
 * Owner's real iPhone on silent: the Event Hub's song started, the bars moved, nothing was heard. Ruling, verbatim:
 * *"keep it silently playing but a message saying the audio is playing but your phone is in silent/muted?"*
 *
 * THE PROPERTY:
 *   1. the hint is for iPhones and iPads only (an iPad that says "Macintosh" included); never Android or a computer;
 *   2. it shows each time the song really starts (the success path of the ONE start — tap or unveil), never on a
 *      refused start, and goes away when the guest stops the song;
 *   3. it fades by itself, with no fade under reduced motion;
 *   4. the silent switch is still respected: nothing in the web app sets `navigator.audioSession` to anything.
 * (1) is EXECUTED; (2)–(4) are read from comment-stripped source (the component needs a DOM and a real gesture).
 *
 * 🛡 Sabotaged, each red then restored:
 *   • `songStartNeedsSilentHint` returns true always            → 1 red (Android, Mac, Windows);
 *   • `showSilentHint()` removed from `startSong`               → 2 red;
 *   • `showSilentHint()` moved into the `catch`                 → 2 red;
 *   • the device gate dropped from `showSilentHint`             → 2 red;
 *   • `motion-reduce:transition-none` removed                   → 3 red;
 *   • `navigator.audioSession.type = 'playback'` added          → 4 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { SILENT_HINT_COPY, SILENT_HINT_FADE_MS, SILENT_HINT_SHOW_MS, songStartNeedsSilentHint } from './hub-music-silent-hint';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const MUSIC = stripComments(readFileSync(join(WEB, 'app/[slug]/_components/background-music.tsx'), 'utf8'));

const UA = {
  iphoneSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/27.0 Mobile/15E148 Safari/604.1',
  iphoneApp: 'Mozilla/5.0 (iPhone; CPU iPhone OS 27_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/2',
  ipadSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15',
  ipadApp: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 SetnayanApp SetnayanSignIn/1 SetnayanIAP/1',
  android: 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Mobile Safari/537.36',
  androidApp: 'Mozilla/5.0 (Linux; Android 15; Pixel 9; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0 Mobile Safari/537.36 SetnayanApp',
  macSafari: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.5 Safari/605.1.15',
  macDesktopApp: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) SetnayanApp/desktop',
  windows: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36',
};

/** The body of a `function name(...) { … }` in the stripped component, up to its closing brace at two spaces. */
function fnBody(name: string): string {
  const at = MUSIC.search(new RegExp(`(async )?function ${name}\\(`));
  assert.ok(at >= 0, `\`${name}\` is gone from background-music.tsx — this guard would be vacuous`);
  const end = MUSIC.indexOf('\n  }\n', at);
  assert.ok(end > at);
  return MUSIC.slice(at, end);
}

test('🔕 1 — the hint is for iPhones and iPads only (Safari, the app, the sheet, an iPad that says "Macintosh")', () => {
  assert.equal(songStartNeedsSilentHint(UA.iphoneSafari, 5), true, 'iPhone Safari / the View Event Hub sheet');
  assert.equal(songStartNeedsSilentHint(UA.iphoneApp, 5), true, 'the iPhone app’s web view');
  assert.equal(songStartNeedsSilentHint(UA.ipadSafari, 5), true, 'iPad Safari (a Macintosh UA with touch points)');
  assert.equal(songStartNeedsSilentHint(UA.ipadApp, 5), true, 'the iPad app');
  for (const [name, ua, touch] of [
    ['Android Chrome', UA.android, 5],
    ['the Android app', UA.androidApp, 5],
    ['a Mac', UA.macSafari, 0],
    ['the desktop app on a Mac', UA.macDesktopApp, 0],
    ['Windows', UA.windows, 0],
    ['no user-agent', undefined, undefined],
  ] as const) {
    assert.equal(songStartNeedsSilentHint(ua, touch), false, `${name} has no silent switch that mutes the page — no hint there`);
  }
});

test('🔕 2 — it shows each time the song REALLY starts, through the one start, and goes when the guest stops it', () => {
  const start = fnBody('startSong');
  const tryPart = start.slice(0, start.indexOf('catch'));
  const catchPart = start.slice(start.indexOf('catch'));
  const played = tryPart.indexOf('await el.play()');
  const shown = tryPart.indexOf('showSilentHint()');
  assert.ok(played > 0, 'startSong no longer awaits el.play()');
  assert.ok(shown > played, 'a started song no longer shows the silent hint (or shows it before play() has resolved)');
  assert.equal(catchPart.includes('showSilentHint'), false, 'a refused start must not say "Music is on"');

  // The unveil and the button both go through startSong — the hint follows every start, not one of them.
  assert.match(MUSIC, /startRef\.current\(el\)/, 'the unveil no longer starts the song through startSong');
  assert.match(fnBody('toggle'), /await startSong\(el\)/, 'the button no longer starts the song through startSong');

  // Gated on the device, read from the browser (an iPad needs its touch points).
  const show = fnBody('showSilentHint');
  assert.match(show, /songStartNeedsSilentHint\(navigator\.userAgent, navigator\.maxTouchPoints\)/, 'the hint is no longer gated to iPhone/iPad');
  assert.ok(show.indexOf('songStartNeedsSilentHint') < show.indexOf("setSilentHint('on')"), 'the gate must come before the hint shows');

  // Stopping the song takes the hint away.
  const toggle = fnBody('toggle');
  const paused = toggle.indexOf('el.pause()');
  assert.ok(paused > 0 && toggle.indexOf('hideSilentHint()', paused) > paused, 'stopping the song leaves "Music is on" on screen');

  // And the words rendered are the shared copy, not a second spelling.
  assert.match(MUSIC, /\{SILENT_HINT_COPY\}/, 'the hint’s words are not rendered');
  assert.match(SILENT_HINT_COPY, /\bmay\b/, 'a page cannot read the silent switch — the hint must not claim to know');
});

test('🔕 3 — it fades by itself, and does not animate under reduced motion', () => {
  assert.ok(SILENT_HINT_SHOW_MS >= 2000 && SILENT_HINT_SHOW_MS <= 8000, 'a few seconds, not a flash and not a fixture');
  const show = fnBody('showSilentHint');
  assert.match(show, /setTimeout\(\(\) => setSilentHint\('fading'\), SILENT_HINT_SHOW_MS\)/, 'the hint no longer starts fading by itself');
  assert.match(show, /setTimeout\(\(\) => setSilentHint\('off'\), SILENT_HINT_SHOW_MS \+ SILENT_HINT_FADE_MS\)/, 'the hint no longer leaves');
  const chip = MUSIC.slice(MUSIC.indexOf('data-silent-hint'), MUSIC.indexOf('{SILENT_HINT_COPY}'));
  assert.ok(chip.length > 0, 'the hint chip is gone');
  assert.match(chip, /transition-opacity/, 'the hint no longer fades');
  assert.match(chip, /motion-reduce:transition-none/, 'the fade must hold still under prefers-reduced-motion');
  assert.match(chip, /pointer-events-none/, 'the hint must never catch a tap meant for the page');
  assert.ok(SILENT_HINT_FADE_MS > 0);
});

test('🔕 4 — the song still respects the silent switch: nothing sets navigator.audioSession', () => {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) {
        if (/audioSession/.test(stripComments(readFileSync(p, 'utf8')))) offenders.push(p.slice(WEB.length + 1));
      }
    }
  };
  for (const d of ['app', 'lib', 'components']) walk(join(WEB, d));
  assert.deepEqual(offenders, [], 'owner 2026-11-01: keep respecting the silent switch — do not set audioSession (e.g. to "playback")');
});
