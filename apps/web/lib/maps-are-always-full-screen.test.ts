/**
 * maps-are-always-full-screen.test.ts — GUESTS › MAP, SEATS › 2D AND SEATS › 3D ARE THE WHOLE SCREEN; THERE IS NO ⤢.
 *
 * ⚖ Owner, 2026-10-30, the iPhone app (Seats · 3D: top nav, a GAP, the pinned row, then the plan in a box with a ⤢):
 * *"The 3d plan is still shutting down the app when i try to press the full screen button. And we can remove that button
 * … The menu should be pushed up to there and the whole background will be the 3d plan or the 2d plan or the map. They
 * are all full screen. So we only keep the bottom nav thumb row and the icons of the top nav. The whole screen will be
 * used by the actual screen"*. DECISION_LOG "SEATS 2D · SEATS 3D · THE MAP ARE ALWAYS FULL SCREEN — NO FULL-SCREEN
 * BUTTON".
 *
 * Properties held (each read from the source, anchored per component, or rendered):
 *   (1) NO FULL-SCREEN CONTROL and NO FULLSCREEN API anywhere on the three views — the room, its tools, the seat plan,
 *       the Guests screen, the map. The 2D plan's ⤢-shaped icon survives only on its RESIZE grips (each named
 *       "Resize …" / "… resize the room"); its Fit wears corner brackets (`Scan`).
 *   (2) THE SURFACE: the map and the 2D/3D seat plan sit in the screen's full surface (rendered: the Map's canvas is
 *       inside `data-guests-full-surface`, the List is not); the surface runs from the shell bar's bottom (`--gs-top`)
 *       to the bottom nav (`--sn-bottomdock-h`), lifted from where the screen starts (`--gs-root-top`, measured), in the
 *       flow (never `position: fixed` — the plan's own sheets would sink under the row); the row's holder gives its
 *       height back and the screen is `flow-root`.
 *   (3) THE ROW floats over the plan right under the top nav — above the 3D room's layer, below the plan's dialogs.
 *   (4) NOTHING TO SCROLL: the event column and its wrapper drop their foot padding while a full view shows.
 *   (5) THE PARTS FILL IT: the seat plan fills the surface (no height or bleed of its own); the map fills it and starts
 *       its fit under the row; the 2D zoom stack rides the lower third above the thumb row; the 3D tools stay one row
 *       on the room's bottom edge (the thumb zone).
 *
 * 🛡 Sabotaged (2026-10-30, each run → red → restored): the ⤢ button put back in `room-view-tools.tsx` → (1) RED ·
 * `position: fixed` added to `.fullSurface` → (2) RED · the row's full-view `z-index: 50` → `z-index: 15` → (3) RED ·
 * the `> *` line dropped from the globals rule → (4) RED · `fill ? '100%' :` removed from the seat plan → (5) RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { GUESTS_VIEWS } from './guests-views';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));
const G = 'app/dashboard/[eventId]/guests/_components/';
const S = 'app/dashboard/[eventId]/seating/';
const SCREEN = read(`${G}guests-screen.tsx`);
const CSS = read(`${G}guests-screen.module.css`);
const MAP = read(`${G}guest-map-canvas.tsx`);
const ROOM = read(`${S}lab/_components/seating-lab-3d.tsx`);
const TOOLS = read(`${S}lab/_components/room-view-tools.tsx`);
const EDITOR = read(`${S}_components/seating-editor.tsx`);
const IN_GUESTS = read(`${S}_components/seat-plan-in-guests.tsx`);
const PHONE = read(`${S}_components/seat-plan-phone.tsx`);
const GLOBALS = read('app/globals.css');

const rule = (css: string, sel: string) => {
  const at = css.indexOf(`${sel} {`);
  assert.ok(at > -1, `${sel} is gone — this guard is blind`);
  return css.slice(at, css.indexOf('}', at));
};

test('(1) no full-screen control and no Fullscreen API on the Map, Seats › 2D or Seats › 3D', () => {
  const parts: [string, string][] = [
    ['the 3D room', ROOM],
    ['the 3D tools', TOOLS],
    ['the seat plan', EDITOR],
    ['the seat plan in Guests', IN_GUESTS],
    ['the phone seat plan', PHONE],
    ['the Guests screen', SCREEN],
    ['the map', MAP],
  ];
  for (const [name, src] of parts) {
    assert.doesNotMatch(src, /requestFullscreen|webkitRequestFullscreen|exitFullscreen|fullscreenElement|fullscreenchange/, `${name}: the Fullscreen API is reachable`);
    assert.doesNotMatch(src, /aria-label=\{?['"`][^'"`]*full ?screen/i, `${name}: a full-screen control is drawn`);
    assert.doesNotMatch(src, /\bMinimize2\b/, `${name}: an exit-full-screen icon is drawn`);
    assert.doesNotMatch(src, /onFullscreen|toggleFullscreen|inPageFull|isFullscreen/, `${name}: a full-screen toggle is back`);
  }
  assert.doesNotMatch(TOOLS, /\bMaximize2\b/, 'the 3D tools wear a ⤢ again');
  // The 2D plan's ⤢-shaped icon is a RESIZE grip, every time — never a door to full screen.
  const uses = [...EDITOR.matchAll(/<Maximize2\b/g)].map((m) => m.index!);
  assert.ok(uses.length > 0, 'the resize grips moved — re-aim');
  for (const at of uses) {
    const btn = EDITOR.slice(EDITOR.lastIndexOf('<button', at), at);
    assert.match(btn, /aria-label="(?:Resize [^"]+|Drag to resize the room)"/, 'a ⤢ in the 2D plan is not a resize grip');
  }
  // Fit wears corner brackets.
  const zoom = EDITOR.slice(EDITOR.indexOf('const zoomStack = ('), EDITOR.indexOf('const studioPeople ='));
  assert.match(zoom, /aria-label="Fit all tables in view"[^]*?<Scan className=/, 'Fit does not wear the corner brackets');
});

test('(2) the surface: from under the top nav to the bottom nav, in the flow, holding the Map and the 2D/3D plan', async () => {
  const surface = rule(CSS, '.fullSurface');
  assert.match(surface, /margin-top: calc\(var\(--gs-top, 0px\) - var\(--gs-root-top, 0px\)\);/, 'the surface is not lifted to the bar');
  assert.match(surface, /height: calc\(100dvh - var\(--gs-top, 0px\) - var\(--sn-bottomdock-h, 0px\)\);/, 'the surface does not run to the bottom nav');
  assert.doesNotMatch(CSS.slice(CSS.indexOf('.fullSurface')), /\.fullSurface[^{]*\{[^}]*position:\s*fixed/, 'the surface is fixed — a stacking context the plan’s sheets sink in');
  assert.match(rule(CSS, '.screen[data-guests-full]'), /display: flow-root;/, 'the lift drags the whole screen up (margin collapse)');
  assert.match(rule(CSS, '.screen[data-guests-full] .stickHold'), /min-height: 0;/, 'the row’s holder keeps a band above the plan');
  // The screen measures where it starts (`--gs-root-top`), written only when it changes.
  assert.match(SCREEN, /root\.style\.setProperty\('--gs-root-top', next\)/);
  // The seats body is the surface on 2D/3D only; the map is always in it.
  assert.match(SCREEN, /className=\{fullView && gview === v \? `min-w-0 \$\{styles\.fullSurface\}` : 'min-w-0'\}\s*data-guests-full-surface=\{fullView && gview === v \? '' : undefined\}/);
  const { renderGuestsScreen, guestRow } = await import('../app/dashboard/[eventId]/guests/_components/render-guests-screen');
  const guests = [guestRow(), guestRow({ rsvp_status: 'attending' } as never)];
  const map = await renderGuestsScreen({ guests, views: GUESTS_VIEWS, gview: 'map' });
  const s = map.indexOf('data-guests-full-surface=""');
  assert.ok(s > -1 && map.indexOf('data-guest-map=""', s) > s, 'the Map’s canvas is not inside the full surface');
  const list = await renderGuestsScreen({ guests, views: GUESTS_VIEWS });
  assert.doesNotMatch(list, /data-guests-full-surface/, 'the List is drawn as a full surface');
});

test('(3) the row floats over the plan right under the top nav — above the 3D room, below the plan’s dialogs', () => {
  const row = rule(CSS, '.screen[data-guests-full] .stick.pinned[data-pinned]');
  const z = Number(row.match(/z-index: (\d+);/)?.[1]);
  const room = Number(EDITOR.match(/data-seat-plan-3d="" hidden=\{!in3d\} className="absolute inset-0 z-\[(\d+)\]/)?.[1]);
  assert.ok(room > 0, 'the 3D layer’s z moved — re-aim');
  assert.ok(z > room, `the row (z ${z}) sinks under the 3D room (z ${room})`);
  assert.ok(z < 60, `the row (z ${z}) rises over the plan’s dialogs (z 60)`);
  assert.match(rule(CSS, '.stick.pinned[data-pinned]'), /top: var\(--gs-top, 0px\);/, 'the row is not under the top nav');
  // Its frost is a layer UNDER it, never its own backdrop-filter (that would contain anything fixed it opens).
  assert.doesNotMatch(row, /backdrop-filter/);
  assert.match(rule(CSS, '.screen[data-guests-full] .stick.pinned[data-pinned]::before'), /backdrop-filter: blur\(/);
});

test('(4) nothing to scroll: the event column and its wrapper drop their foot while a full view shows', () => {
  const at = GLOBALS.indexOf('html [data-shell-main]:has([data-guests-full]),');
  assert.ok(at > -1, 'the column keeps its clearance under a full view');
  const r = GLOBALS.slice(at, GLOBALS.indexOf('}', at));
  assert.match(r, /html \[data-shell-main\]:has\(\[data-guests-full\]\) > \*/, 'the page wrapper’s foot (pb-6) still scrolls');
  assert.match(r, /padding-bottom: 0;/);
  // …and it comes after the column's own rules, so it wins.
  assert.ok(at > GLOBALS.indexOf('padding-bottom: var(--sn-thumb-room, 0px);'), 'the rule is overridden by the column’s own');
});

test('(5) the parts fill the surface: seat plan, map, the 2D zoom in the lower third, the 3D tools in the thumb zone', () => {
  assert.match(IN_GUESTS, /el\.closest\('\[data-guests-full-surface\]'\) !== null/);
  assert.match(IN_GUESTS, /height: fill \? '100%' :/, 'the seat plan keeps a height of its own in the surface');
  assert.match(MAP, /const h = surface \? surface\.clientHeight :/, 'the map does not fill the surface');
  assert.match(MAP, /row\.bottom - el\.getBoundingClientRect\(\)\.top/, 'the map fits behind the row');
  assert.match(MAP, /\(box\.h - box\.inset - lower - 24\) \/ map\.height/);
  const zoom = EDITOR.slice(EDITOR.indexOf('const zoomStack = ('), EDITOR.indexOf('const studioPeople ='));
  assert.match(zoom, /\$\{inGuests \? '' : studioSeat \? 'top-3' :/, 'the zoom rides the top of the plan in Guests (under the row)');
  assert.match(zoom, /bottom: 'max\(0\.75rem, calc\(var\(--sn-thumb-room, 0px\) - var\(--sn-bottomdock-h, 0px\)\)\)'/);
  assert.match(EDITOR, /\{inGuests && view === 'plan' \? zoomStack : null\}/, 'the zoom is not drawn on the plan’s cell in Guests');
  assert.match(EDITOR, /\{inGuests \? null : zoomStack\}/);
  assert.match(TOOLS, /data-room-view-tools=""\s*className="pointer-events-none absolute inset-x-0 bottom-0 /, 'the 3D tools left the thumb zone');
});
