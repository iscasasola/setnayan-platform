/**
 * 🔁 A NEW VERSION ARRIVING MID-SESSION NEVER THROWS THE COUPLE OUT OF WHAT THEY WERE DOING.
 *
 * Owner, 08 Oct, on the live Maker (Studio › Look, a background pick already in his draft), verbatim: *"clicking
 * on music reset the maker and reloaded"*. Measured by the controller: production's version changed in that same
 * minute (health read one build at 05:26:06Z and the next at 05:26:59Z).
 *
 * The press itself reloads nothing — `StudioLookBar` calls a client `select`, and its segments are `type="button"`
 * (test 5). What reloads is Next's router, when page data is answered by a newer build
 * (`fetch-server-response.js`: `getAppBuildId() !== response.b` → `doMpaNavigation`, a hard navigation to the page
 * it is on — test 6 pins that this is still what the pinned Next does), or `app/error.tsx` for a chunk that moved.
 * And "reset" was the MAKER's own doing: it treated its own reload as a cold door and landed on Studio's tiles.
 *
 * Executed on the real functions (`lib/maker-resume.ts`); a source read only where the rule is a wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';

import {
  MAKER_RELOADING_WORDS,
  MAKER_UPDATING_WORDS,
  makerCameBackToItself,
  makerDoorLanding,
  makerLeavingWords,
  makerResumeKey,
  noteMakerResume,
  takeMakerResume,
  type MakerLoad,
} from './maker-resume';
import { STUDIO_TILE_KEYS } from './studio-tile-defs';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LAUNCH = 'app/dashboard/[eventId]/launch/_components';
const SHELL = src(`${LAUNCH}/maker-shell.tsx`);

const MAKER = 'https://setnayan.com/dashboard/S89E-1/launch';
const HERE = `${MAKER}?tool=details&item=music`;
const load = (over: Partial<MakerLoad>): MakerLoad => ({ type: 'navigate', loaded: HERE, referrer: '', href: HERE, ...over });

/** A session storage, as the browser gives it. */
function storage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
  };
}
const KEY = makerResumeKey('sn-maker:S89E-1');
const TILES = [...STUDIO_TILE_KEYS];

/* ══ 1 · WHICH LOADS ARE THE PAGE COMING BACK TO ITSELF ══════════════════════ */

test('1 · a reload, and Next’s hard navigation of a page to itself, are the page coming back — a door from anywhere else is not', () => {
  // The browser's reload, the stale-bundle reload, the "Reload" of the updated-site bar: `location.reload()`.
  assert.equal(makerCameBackToItself(load({ type: 'reload', referrer: 'https://setnayan.com/dashboard' })), true);
  // Next's build-mismatch reload: `location.assign(canonicalUrl)` — a NAVIGATION whose referrer is this very page.
  assert.equal(makerCameBackToItself(load({ referrer: `${MAKER}?tool=details&item=background` })), true, 'the measured case');
  // Cold doors: Home's next-step card, a link in an email, a typed address, a new tab.
  assert.equal(makerCameBackToItself(load({ referrer: 'https://setnayan.com/dashboard/S89E-1' })), false, 'a door from Home');
  assert.equal(makerCameBackToItself(load({ referrer: '' })), false, 'a typed or bookmarked address');
  assert.equal(makerCameBackToItself(load({ referrer: 'https://mail.example.com/' })), false);
  assert.equal(makerCameBackToItself(load({ referrer: 'https://setnayan.com/dashboard/OTHER/launch' })), false, 'another event’s Maker');
  // Back / Forward into the Maker is the person moving, not the page reloading.
  assert.equal(makerCameBackToItself(load({ type: 'back_forward', referrer: MAKER })), false);
  // 🔑 The document was loaded (even RELOADED) on another page and the Maker was reached without a load: that
  //    reload was Home's, not the Maker's.
  assert.equal(makerCameBackToItself(load({ type: 'reload', loaded: 'https://setnayan.com/dashboard' })), false);
  // Nothing reported, or nonsense: a cold door.
  assert.equal(makerCameBackToItself(load({ type: null, loaded: null })), false);
  assert.equal(makerCameBackToItself(load({ type: 'reload', loaded: 'not a url', href: 'not a url' })), false);
});

/* ══ 2 · THE NOTE IS ONE-SHOT, THIS TAB'S, AND NEVER TRUSTED BLINDLY ═════════ */

test('2 · the note is read once and ALWAYS thrown away — honoured only for a page that came back to itself', () => {
  const where = { side: 'studio' as const, at: 'look', item: 'music' };
  // Came back: honoured, and gone.
  let s = storage();
  noteMakerResume(s, KEY, where);
  assert.deepEqual(takeMakerResume(s, KEY, true, { done: false }), where);
  assert.equal(s.data.has(KEY), false, 'the note outlived its one use');
  // A cold door: NOT honoured — and still thrown away, so it cannot be honoured by a later reload of a page
  // that was never there.
  s = storage();
  noteMakerResume(s, KEY, where);
  assert.equal(takeMakerResume(s, KEY, false, { done: false }), null, 'a cold door was sent where the last visit was');
  assert.equal(s.data.has(KEY), false);
  // One answer per document: the Maker reached again without a load (Home and back) is a cold door.
  s = storage();
  const once = { done: false };
  noteMakerResume(s, KEY, where);
  assert.deepEqual(takeMakerResume(s, KEY, true, once), where);
  noteMakerResume(s, KEY, where);
  assert.equal(takeMakerResume(s, KEY, true, once), null, 'a second mount in the same document resumed');
  // Anything that is not a note this version wrote is no note.
  for (const junk of ['', 'null', '{', '[]', '{"side":"admin","at":"look"}', '{"side":"studio"}', `{"side":"studio","at":"${'x'.repeat(60)}"}`]) {
    assert.equal(takeMakerResume(storage({ [KEY]: junk }), KEY, true, { done: false }), null, junk);
  }
  assert.deepEqual(takeMakerResume(storage({ [KEY]: '{"side":"stages","at":"home","item":7}' }), KEY, true, { done: false }), { side: 'stages', at: 'home', item: null });
  // Storage that refuses (private mode) is not an error: the Maker opens as a cold door.
  const refusing = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); }, removeItem: () => {} };
  assert.equal(takeMakerResume(refusing, KEY, true, { done: false }), null);
  assert.doesNotThrow(() => noteMakerResume(refusing, KEY, where));
});

/* ══ 3 · WHERE THE MAKER LANDS ═══════════════════════════════════════════════ */

test('3 · rule 3 stands for a cold door; the page’s own reload goes back where it was', () => {
  // A cold door into Event Details: Studio's HOME, the selection dropped (DECISION_LOG 2026-10-07 rule 3).
  assert.deepEqual(makerDoorLanding(null, TILES), { side: 'studio', at: 'home', keep: false });
  // The owner's case: Studio › Look (on Music) — back on Look, the selection kept.
  assert.deepEqual(makerDoorLanding({ side: 'studio', at: 'look' }, TILES), { side: 'studio', at: 'look', keep: true });
  // Every Studio tool comes back as itself.
  for (const t of TILES) assert.deepEqual(makerDoorLanding({ side: 'studio', at: t }, TILES), { side: 'studio', at: t, keep: true }, t);
  // It was on the STAGES side (the address still carried an old `?tool=details`): it stays on the stage.
  assert.deepEqual(makerDoorLanding({ side: 'stages', at: 'home' }, TILES), { side: 'stages', at: 'home', keep: false });
  assert.deepEqual(makerDoorLanding({ side: 'stages', at: 'look' }, TILES), { side: 'stages', at: 'home', keep: false });
  // Studio's home, or a tool this event does not have: Studio's home.
  assert.deepEqual(makerDoorLanding({ side: 'studio', at: 'home' }, TILES), { side: 'studio', at: 'home', keep: false });
  assert.deepEqual(makerDoorLanding({ side: 'studio', at: 'prints' }, TILES.filter((t) => t !== 'prints')), { side: 'studio', at: 'home', keep: false });
  assert.deepEqual(makerDoorLanding({ side: 'studio', at: '__proto__' }, TILES), { side: 'studio', at: 'home', keep: false });
});

test('3 · the whole walk: Look › Music, a new version reloads the page, the Maker opens on Look › Music', () => {
  const s = storage();
  // The Maker notes where it is as it changes (Studio, the Look tool, the Music section)…
  noteMakerResume(s, KEY, { side: 'studio', at: 'look', item: 'music' });
  // …Next hard-navigates the page to itself (a newer build answered the refresh)…
  const back = takeMakerResume(s, KEY, makerCameBackToItself(load({ referrer: `${MAKER}?tool=details&item=music` })), { done: false });
  assert.deepEqual(back, { side: 'studio', at: 'look', item: 'music' });
  // …and the Details selection the address names lands on the tool, not on the tiles.
  assert.deepEqual(makerDoorLanding(back, TILES), { side: 'studio', at: 'look', keep: true });
  // The SAME address opened from Home a minute later is a cold door: the tiles.
  noteMakerResume(s, KEY, { side: 'studio', at: 'look', item: 'music' });
  const cold = takeMakerResume(s, KEY, makerCameBackToItself(load({ referrer: 'https://setnayan.com/dashboard/S89E-1' })), { done: false });
  assert.deepEqual(makerDoorLanding(cold, TILES), { side: 'studio', at: 'home', keep: false });
});

test('3 · WIRING: the shell reads the note once at mount, lands through the one rule, and keeps the note as it moves', () => {
  assert.match(SHELL, /takeMakerResume\(window\.sessionStorage, makerResumeKey\(memoryKey\), makerCameBackToItself\(makerLoadNow\(\)\)\)/);
  // Rule 3's own condition is unchanged — and its landing is the one function.
  const at = SHELL.indexOf("if (!ss || side !== 'stages' || selection?.kind !== 'tool' || selection.key !== 'details') return;");
  assert.ok(at > 0, 'the Stages side still sends a Details selection away');
  const body = SHELL.slice(at, at + 1400);
  assert.match(body, /cameBack\.current = null;/, 'the note is spent by its one use');
  assert.match(body, /const land = makerDoorLanding\(back, studio\?\.tiles\.map\(\(t\) => t\.key\) \?\? \[\]\);/);
  assert.match(body, /if \(land\.side === 'studio'\) setSide\('studio'\);\s*setStudioAt\(land\.at as StudioTileKey \| 'home'\);/);
  assert.match(body, /if \(!land\.keep\) select\(null\);/, 'a cold door drops the selection');
  // The note: side · tool · item, written as they change, only once memory has been read.
  assert.match(SHELL, /if \(!restored\.current \|\| !stagesStudio\) return;\s*noteMakerResume\(window\.sessionStorage, makerResumeKey\(memoryKey\), \{ side, at: studioAt, item: detailsItem \}\);/);
  // The item comes back too, checked against the real items.
  assert.match(SHELL, /if \(isDetailsItemKey\(back\.item\)\) setDetailsItem\(back\.item\);/);
});

/* ══ 4 · SAID IN WORDS FIRST ═════════════════════════════════════════════════ */

test('4 · "Updating Setnayan…" is said only when the page reloads ITSELF by script', () => {
  const nav = (over: Partial<Parameters<typeof makerLeavingWords>[0]>) => makerLeavingWords({ userInitiated: false, type: 'push', to: HERE, sameDocument: false, here: HERE, ...over });
  assert.equal(MAKER_UPDATING_WORDS, 'Updating Setnayan…');
  assert.equal(MAKER_RELOADING_WORDS, 'Reloading Setnayan…');
  // Next's build-mismatch navigation (`location.assign` / `location.replace` of its own address): a new version.
  assert.equal(nav({ type: 'push' }), MAKER_UPDATING_WORDS);
  assert.equal(nav({ type: 'replace', to: `${MAKER}?tool=details&item=background` }), MAKER_UPDATING_WORDS);
  // A script reload (a chunk that moved, a request the phone cut, the updated-site bar's Reload): it says what it
  // does — it is not always an update, and the page never claims one it cannot know.
  assert.equal(nav({ type: 'reload' }), MAKER_RELOADING_WORDS);
  // Never for the person going somewhere: a link, the browser's own Reload, Back / Forward…
  assert.equal(nav({ userInitiated: true }), null);
  assert.equal(nav({ userInitiated: true, type: 'reload' }), null);
  assert.equal(nav({ type: 'traverse' }), null);
  // …a move inside the page (every section press, every save's address change)…
  assert.equal(nav({ sameDocument: true, type: 'replace' }), null, 'a section press said "Updating"');
  // …or a navigation to any other page (sign-in after a session ended, Home, another event).
  assert.equal(nav({ to: 'https://setnayan.com/login?next=x' }), null);
  assert.equal(nav({ to: 'https://setnayan.com/dashboard/S89E-1' }), null);
  assert.equal(nav({ to: 'not a url' }), null);
  // WIRING: lazy, mounted by the shell, drawn straight into the document.
  const lazy = readFileSync(join(WEB, `${LAUNCH}/details-lazy.tsx`), 'utf8');
  assert.match(lazy, /export const MakerUpdating = dynamic\(\(\) => import\(\/\* webpackChunkName: "maker-details" \*\/ '\.\/maker-updating'\)/);
  assert.match(SHELL, /<MakerUpdating \/>/);
  assert.doesNotMatch(SHELL, /from '\.\/maker-updating'/, 'the announcer rides the Maker’s first load');
  const upd = src(`${LAUNCH}/maker-updating.tsx`);
  assert.match(upd, /nav\.addEventListener\('navigate', onNavigate\);/);
  assert.match(upd, /el\.textContent = words;/);
  assert.match(upd, /window\.setTimeout\(\(\) => el\.remove\(\), 8000\);/, 'a navigation that never happens leaves the line up for good');
});

/* ══ 5 · THE PRESS ITSELF RELOADS NOTHING ════════════════════════════════════ */

test('5 · a Look section press is a client state change: its segments can never submit a form', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const kit = await import(`../app/dashboard/[eventId]/website/editor/_components/inspector-kit`);
  // Both take their content as children — passed the way createElement takes
  // them, which its types only allow once `children` is not a required prop.
  const ISegmented = kit.ISegmented as unknown as React.FunctionComponent<Record<string, unknown>>;
  const ISeg = kit.ISeg as unknown as React.FunctionComponent<Record<string, unknown>>;
  const html = renderToStaticMarkup(
    React.createElement('form', null,
      React.createElement(ISegmented, { label: 'Look' },
        ...['Background', 'Colours', 'Fonts', 'Music'].map((k) => React.createElement(ISeg, { key: k, on: k === 'Background', data: k, onClick: () => {} }, k)))),
  );
  const buttons = html.match(/<button\b[^>]*>/g) ?? [];
  assert.equal(buttons.length, 4);
  for (const b of buttons) assert.match(b, /type="button"/, `a segment would submit the form it sits in: ${b}`);
  // …and the bar's press is `select` from the Details context — never a link, a router call or a form.
  const tools = src(`${LAUNCH}/studio-tools.tsx`);
  const bar = tools.slice(tools.indexOf('export function StudioLookBar'), tools.indexOf('export function StudioLookBar') + 900);
  assert.match(bar, /onClick=\{\(\) => k !== item && select\?\.\(k\)\}/);
  assert.doesNotMatch(bar, /router\.|<form|href=|location\./);
});

/* ══ 6 · THE MECHANISM IS STILL WHAT THE PINNED NEXT DOES ════════════════════ */

test('6 · Next still hard-navigates a page to itself when page data comes from another build (re-read on every upgrade)', () => {
  const next = (rel: string) => readFileSync(join(WEB, 'node_modules/next/dist/client/components', rel), 'utf8');
  const fetchRsc = next('router-reducer/fetch-server-response.js');
  assert.match(fetchRsc, /getAppBuildId\)\(\) !== response\.b\) \{\s*return doMpaNavigation\(res\.url\);/, 'the build-id check moved — re-read how a deploy reloads an open page');
  const router = next('app-router.js');
  assert.match(router, /if \(pushRef\.mpaNavigation\)/);
  assert.match(router, /location\.assign\(canonicalUrl\)/);
  assert.match(router, /location\.replace\(canonicalUrl\)/);
});
