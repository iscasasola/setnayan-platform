/**
 * Regression: deleting a table must not crash the seat-plan editor.
 *
 * Owner report (2026-07-16): "tried deleting tables" → the app threw and rendered
 * the global error boundary ("Something on our end didn't work"). ROOT CAUSE: an
 * infinite render loop ("Maximum update depth exceeded"). Delete is the only op
 * that mutates the TABLE SET through `useOptimistic` (applyTableOpt), and
 * `useOptimistic` yields a fresh `tables` array reference on every render while
 * the optimistic and base states settle. The two canvas layout effects — the
 * auto-place resolver and the "N overlaps" mount-audit — key off that reference
 * AND write state (setPositions / setMountAudit), so an in-flight delete made
 * them re-run → rewrite state → re-render → re-run every frame until React's
 * update-depth cap tripped. Only observable in the PLAN (canvas) view — the LIST
 * view doesn't mount the canvas, so those effects short-circuit (rect width 0).
 * The stricter post-#3305 collision model amplified it (tables started moving
 * during the churn). Pure-geometry unit tests never covered this event path,
 * which is why it passed CI. FIX: both effects skip while `isPending`.
 *
 * This test renders the real <SeatingEditor/> in jsdom and drives an actual
 * delete. It FAILS on main (the loop throws) and passes with the isPending guard.
 * Run: node --experimental-test-module-mocks --import tsx --test <this file>
 */
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import * as ReactNS from 'react';
(globalThis as any).React = ReactNS;

// ---- jsdom global environment ----
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
(globalThis as any).window = dom.window;
(globalThis as any).document = dom.window.document;
try { Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true }); } catch {}
(globalThis as any).HTMLElement = dom.window.HTMLElement;
(globalThis as any).Node = dom.window.Node;
(globalThis as any).getComputedStyle = dom.window.getComputedStyle;
(globalThis as any).requestAnimationFrame = (cb: any) => setTimeout(() => cb(Date.now()), 0);
(globalThis as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
class RO { observe() {} unobserve() {} disconnect() {} }
(globalThis as any).ResizeObserver = RO; (dom.window as any).ResizeObserver = RO;
class IO { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } }
(globalThis as any).IntersectionObserver = IO; (dom.window as any).IntersectionObserver = IO;
dom.window.matchMedia = ((q: string) => ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } })) as any;
// jsdom returns a 0-size rect for every element, which makes the canvas layout
// effects short-circuit; give the canvas a real size so they run (and can loop).
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  return { x: 0, y: 0, top: 0, left: 0, right: 900, bottom: 640, width: 900, height: 640, toJSON() {} } as any;
};
dom.window.HTMLElement.prototype.setPointerCapture = function () {};
dom.window.HTMLElement.prototype.releasePointerCapture = function () {};
dom.window.HTMLElement.prototype.hasPointerCapture = function () { return false; };

// ---- module mocks (heavy/server-only deps) — must precede the SUT import ----
const asyncNoop = async () => {};
const actionNames = ['createTable','deleteTable','assignGuest','swapSeats','swapTableOccupants','assignGroup','autoSeatGuests','setSeatingAutoplace','setSeatingGroupAdjacency','setGhostBoothsEnabled','dismissGhostBooth','restoreGhostBooths','saveFloorPlan','saveVenuePhotoVisibility','savePriorityOrder','addSeatingConstraint','removeSeatingConstraint','toggleSeatLock','lockAndFill','updateTablePosition','unassignGuest','updateTableRotation','updateTableType','setTableSeat','publishSeating','updateTableLabel','linkTables','unlinkTable','seatRoleAtTable','saveBooths','saveSigns','setGuestSeatingPriority','autoArrange','buildSeatingDraft'];
const actionsMock: Record<string, any> = {};
for (const n of actionNames) actionsMock[n] = asyncNoop;
mock.module('../actions', { namedExports: actionsMock });
mock.module('./use-seating-lock', { namedExports: { useSeatingLock: () => ({ lockId: 'lock-1', status: 'editing', notifyLost() {}, acquire() {}, holderHeartbeatAt: null }) } });
mock.module('./use-seating-presence', { namedExports: { useSeatingPresence: () => ({ peers: new Map(), broadcastSelection() {}, broadcastCursor() {} }) } });
mock.module('./use-seating-live-refresh', { namedExports: { useSeatingLiveRefresh: () => {} } });
mock.module('next/navigation', { namedExports: { useRouter: () => ({ push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} }), useSearchParams: () => new URLSearchParams(), usePathname: () => '/' } });
mock.module('@/lib/supabase/client', { namedExports: { createClient: () => ({ channel: () => ({ on() { return this; }, subscribe() { return this; } }), removeChannel() {} }) } });

// ---- fixtures ----
function mkTable(id: string, x: number, y: number, extra: any = {}): any {
  return { table_id: id, public_id: 'P-' + id, event_id: 'evt-1', table_label: 'Table ' + id, table_type: 'long_banquet_10', capacity: 10, sort_order: 1, x_pos: x, y_pos: y, rotation_deg: 0, removed_seats: [], qr_token: null, qr_published_at: null, link_group_id: null, link_group_label: null, ...extra };
}
function mkGuest(id: string, seatedTable: string | null, seat: number | null): any {
  return { guest_id: id, name: 'Guest ' + id, side: 'both', rsvp: 'attending', group_id: null, seated_table_id: seatedTable, seat_number: seat, seat_locked: false, seating_priority: null, plus_one_allowed: false, plus_one_of_guest_id: null, dietary_restrictions: null };
}
function floorPlan(scaled: boolean): any {
  return { event_id: 'evt-1', venue_width_m: scaled ? 20 : null, venue_length_m: scaled ? 30 : null, stage_x: 50, stage_y: 8, stage_w: 20, stage_h: 8, entrance_enabled: false, entrance_x: 50, entrance_y: 94, entrance_kind: 'door', entrance_depth_m: 3, dance_enabled: false, dance_x: 50, dance_y: 50, dance_w: 20, dance_h: 20, service_entrance_enabled: false, service_entrance_x: 97, service_entrance_y: 50, cocktail_enabled: false, cocktail_x: 50, cocktail_y: 50, cocktail_w: 20, cocktail_h: 15, cocktail_label: 'Cocktails', cocktail_vendor_edit: false, cocktail_linked: false, ghost_booths_enabled: false };
}

async function setup(opts: { view: 'plan' | 'list'; scaled: boolean; tables: any[]; guests: any[] }) {
  const React = await import('react');
  const rtl = await import('@testing-library/react');
  const { SeatingEditor } = await import('./seating-editor');
  const props: any = {
    eventId: 'evt-1', roleSetKey: 'wedding', tables: opts.tables, guests: opts.guests, groups: [],
    floorPlan: floorPlan(opts.scaled), booths: [], signs: [], bookedVendors: [], constraints: [],
    me: { id: 'u1', name: 'Me' }, eventDate: null, genderSeparationNote: null, seatShortfall: 0,
    nonDeclinedCount: opts.guests.length, totalSeats: 20, autoplaceEnabled: false, adjacencyEnabled: false,
    reservedCount: opts.guests.length, toSeatReserved: 0, setSeatingAutoplace: asyncNoop,
    setSeatingGroupAdjacency: asyncNoop, initialView: opts.view,
  };
  let utils: any;
  await rtl.act(async () => { utils = rtl.render(React.createElement(SeatingEditor, props)); await new Promise((r) => setTimeout(r, 40)); });
  return { ...rtl, ...utils };
}

const PE = (dom.window as any).PointerEvent || dom.window.Event;
const mkPE = (type: string, extra: any) => { try { return new PE(type, { bubbles: true, cancelable: true, ...extra }); } catch { const e: any = new dom.window.Event(type, { bubbles: true, cancelable: true }); Object.assign(e, extra); return e; } };
// Select a plan-view table by tapping a hub (pointerdown sets dragRef; pointerup
// bubbles to the canvas which, with moved:false, sets highlightId → popup opens).
async function selectATable(utils: any) {
  for (const el of Array.from(utils.container.querySelectorAll('div')) as any[]) {
    await utils.act(async () => {
      el.dispatchEvent(mkPE('pointerdown', { pointerId: 1, clientX: 360, clientY: 320, button: 0 }));
      el.dispatchEvent(mkPE('pointerup', { pointerId: 1, clientX: 360, clientY: 320, button: 0 }));
      await new Promise((r: any) => setTimeout(r, 10));
    });
    const del = utils.queryByLabelText(/^Delete table$/i);
    if (del) return del;
  }
  return null;
}

const pair = () => [mkTable('T1', 40, 50), mkTable('T2', 60, 50)];

// THE regression — fails on main with "Maximum update depth exceeded".
test('PLAN view: deleting a selected table does not exhaust the update depth', async () => {
  const utils = await setup({ view: 'plan', scaled: true, tables: pair(), guests: [mkGuest('G2', 'T2', 0)] });
  const del = await selectATable(utils);
  assert.ok(del, 'a table was selected (popup Delete button present)');
  await utils.act(async () => { del.click(); await new Promise((r: any) => setTimeout(r, 80)); });
  utils.cleanup();
});

// Selecting alone (no delete) is fine on main too — pins that the delete is the trigger.
test('PLAN view: selecting a table (no delete) does not loop', async () => {
  const utils = await setup({ view: 'plan', scaled: true, tables: pair(), guests: [mkGuest('G2', 'T2', 0)] });
  assert.ok(await selectATable(utils), 'a table was selected');
  utils.cleanup();
});

test('LIST view: deleting a table does not crash; survivor + guest at deleted table renders', async () => {
  const utils = await setup({ view: 'list', scaled: true, tables: pair(), guests: [mkGuest('G1', 'T1', 0), mkGuest('G2', 'T2', 0)] });
  const btn = utils.queryByLabelText(/Delete Table T2/i) || utils.queryAllByLabelText(/Delete/i)[1];
  assert.ok(btn, 'found a delete button');
  await utils.act(async () => { btn.click(); await new Promise((r: any) => setTimeout(r, 60)); });
  utils.cleanup();
});

test('LEGACY link group: lone surviving member (mid-state) renders in plan + list', async () => {
  const lone = [mkTable('T1', 45, 50, { link_group_id: 'G', link_group_label: 'Head Table' })];
  const a = await setup({ view: 'plan', scaled: true, tables: lone, guests: [mkGuest('G2', 'T1', 0)] }); a.cleanup();
  const b = await setup({ view: 'list', scaled: true, tables: lone, guests: [mkGuest('G2', 'T1', 0)] }); b.cleanup();
});

test('delete ALL tables down to zero (list) does not crash', async () => {
  const utils = await setup({ view: 'list', scaled: true, tables: [mkTable('T1', 40, 40), mkTable('T2', 60, 60)], guests: [mkGuest('G1', 'T1', 0), mkGuest('G2', 'T2', 0)] });
  for (const d of utils.queryAllByLabelText(/^Delete Table/i)) { await utils.act(async () => { d.click(); await new Promise((r: any) => setTimeout(r, 30)); }); }
  utils.cleanup();
});
