/**
 * one-home-per-setting.test.ts — EVERY SETTING HAS ONE HOME, AND ITS HOME DRAWS IT ONCE.
 *
 * Owner 2026-10-26: *"each menu has their own settings… If Access is on the guest card, then why would we have access
 * on the whole event settings?"*; approved 2026-10-27 (settings per menu, PLAN § 7 guard 1). `SETTINGS_ROWS`
 * (`lib/event-settings-record.ts`) is the port-control map: each row names ONE menu. Held:
 *   1 · each menu that owns rows has a settings surface this test can render, and its door is live;
 *   2 · rendered (to static HTML, the repo's render-helper pattern), each surface draws every one of its rows at least
 *       once across its states and NEVER twice in one state; and draws no row the map gives another menu;
 *   3 · Event Details opens none of a moved row (its editor map no longer names it).
 * The counts are printed per surface.
 *
 * A menu joins `SURFACES` in the PR that moves its rows home (PLAN § 5: B Guests, C Hub, D Prints, E Event Settings;
 * Suppliers 2026-10-27 — the owner reversed call 3, "SUPPLIERS GETS ITS ⚙").
 *
 * Sabotage (2026-10-27): `<RequestsRow …/>` drawn twice → 2 red; `requests` given `menu: 'hub'` → 1 and 2 red; the
 * Finalize row dropped from `GuestSetupRows` → 2 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { SETTINGS_ROWS, settingsRowsOf, type SettingsRowKey } from './event-settings-record';
import { SETTINGS_ENTRY, SETTINGS_MENUS, type SettingsMenu } from './menu-settings';
import { RECORD_ROW_EDITOR } from './event-details-record';

/** Each menu's settings surface, drawn in each of the states that change which rows show. */
const SURFACES: Partial<Record<SettingsMenu, () => Promise<string[]>>> = {
  guests: async () => {
    const { renderSetup } = await import('../app/dashboard/[eventId]/_components/guest-setup/render-setup');
    // "They reply" draws the asks and Reply by; a personal choice the Invitations; "Anyone with the link" the one link.
    return Promise.all((['list', 'personal', 'one_qr'] as const).map((getIn) => renderSetup({ getIn })));
  },
  // ⚙ Suppliers (owner 2026-10-27, "SUPPLIERS GETS ITS ⚙"): every row read · every read refused · a delegate (no photos).
  suppliers: async () => {
    await import('../app/dashboard/[eventId]/_components/guest-setup/render-setup'); // stubs `server-only` for the actions' modules
    const React = (await import('react')).default;
    (globalThis as unknown as { React: unknown }).React = React;
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { SuppliersSettingsRows } = await import('../app/dashboard/[eventId]/vendors/_components/suppliers-settings-rows');
    const draw = (view: import('./suppliers-settings').SuppliersSettingsView) =>
      renderToStaticMarkup(React.createElement(SuppliersSettingsRows, { eventId: 'e1', view }));
    return [
      draw({
        costs: { mode: 'final_only', deadline: '2027-01-10' },
        payments: [{ id: 'p1', when: 'Nov 3', words: 'Lumen Studio · Downpayment ₱10,000' }],
        photos: [
          { vendorRowId: 'v1', name: 'Lumen Studio', hidden: false },
          { vendorRowId: 'v2', name: 'Sinag Films', hidden: true },
        ],
        photosRead: true,
      }),
      draw({ costs: null, payments: null, photos: null, photosRead: false }),
      draw({ costs: { mode: 'realtime', deadline: null }, payments: [], photos: null, photosRead: true }),
    ];
  },
};

const ALL_KEYS = Object.keys(SETTINGS_ROWS) as SettingsRowKey[];

test('1 · every menu that owns rows has a surface here, and its ⚙ is live', () => {
  for (const menu of SETTINGS_MENUS) {
    if (settingsRowsOf(menu).length === 0) continue;
    assert.ok(SURFACES[menu], `${menu} owns settings rows but this check cannot draw its surface`);
    assert.equal(SETTINGS_ENTRY[menu].live, true, `${menu} owns settings rows but its ⚙ is not live`);
  }
});

test('2 · each surface draws its own rows — each once — and nobody else’s', async () => {
  const printed: string[] = [];
  for (const [menu, draw] of Object.entries(SURFACES) as [SettingsMenu, () => Promise<string[]>][]) {
    const states = await draw();
    const own = settingsRowsOf(menu);
    const seen = new Set<string>();
    for (const html of states) {
      for (const key of ALL_KEYS) {
        const n = [...html.matchAll(new RegExp(`data-setup-row="${key}"`, 'g'))].length;
        if (n === 0) continue;
        assert.equal(SETTINGS_ROWS[key].menu, menu, `${menu} draws "${key}", which lives on ${SETTINGS_ROWS[key].menu}`);
        assert.equal(n, 1, `${menu} draws "${key}" ${n} times in one state`);
        seen.add(key);
      }
    }
    const missing = own.filter((k) => !seen.has(k));
    assert.deepEqual(missing, [], `${menu} never draws: ${missing.join(' · ')}`);
    printed.push(`${menu}: ${seen.size}/${own.length} rows over ${states.length} states`);
  }
  assert.ok(printed.length > 0, 'no surface was drawn — this check counts nothing');
  console.log(`  one home: ${printed.join(' · ')}`);
});

test('3 · Event Details opens no row that moved to a menu', () => {
  const twice = ALL_KEYS.filter((k) => k in RECORD_ROW_EDITOR);
  assert.deepEqual(twice, [], `Event Details still opens: ${twice.join(' · ')}`);
});
