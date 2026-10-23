/**
 * the-app-bar-has-no-more.test.ts — 2026-10-21.
 *
 * ── WHAT THE OWNER SAW ──────────────────────────────────────────────────────
 * TestFlight build 5 (the iPhone app = the store shell, `lib/store-shell.ts`),
 * signed in on the demo event: *"pressing more on the bottom nav jumps me to
 * home. but i do not see the other services there"*. Then: *"if all is at
 * home already, then we can remove more"*.
 *
 * ── WHY MORE WAS A HOME LINK IN THE APP ─────────────────────────────────────
 * More lists the five services (Setnayan AI · Papic · Live Watch · Music Maker
 * · Patiktok). All five are paid, and the store shell drops every paid add-on
 * (`STORE_SHELL_HIDDEN_ADDON_KEYS`, App Review 3.1.1), so the app's list was
 * always empty: `CustomerBottomNav` never mounted the sheet and the tab fell
 * back to its address, Home `?more=services`. On the iPad rail and in the ☰
 * drawer the same row was the same Home link.
 *
 * ── THE PROPERTY ────────────────────────────────────────────────────────────
 *   1. In the store shell no event menu builds More — not the bar, the tree,
 *      or the rail / ☰ drawer — in any phase, for any event shape. The web
 *      keeps it (the paid services live there).
 *   2. Every destination More would have offered in the app is still linked
 *      from Home or the ☰ drawer. Today that is only Home itself (its door),
 *      because the app's service list is empty. If a service ever survives the
 *      shell's filter, it must be added to ☰ (owner: "the fix is to add it to
 *      the ☰ menu, not to keep More") or this test fails.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADD_ONS } from './add-ons-catalog';
import { buildOurServices, ourServicesMenuChildren } from './our-services';
import { buildCustomerMenuTree, buildEventMenuSections, eventMenuRows, type CustomerMenuCtx } from './customer-menu';
import { STORE_SHELL_HIDDEN_ADDON_KEYS, isStoreShellWebOnlyPath } from './store-shell';
import { studioHubHref } from './studio-hub';
import { railToolsSignedIn } from './studio-rail';
import { WEDDING_PROFILE } from './event-type-profile';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

const LIB = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(LIB, '..', 'app', 'dashboard', '[eventId]');
const EVENT = 'S89E-TESTEVENT';
const PHASES = ['plan', 'dayof', 'after'] as const;
const STUDIO_ROWS = railToolsSignedIn({ eventId: EVENT, count: 1, profile: WEDDING_PROFILE }).map((t) => ({
  key: t.key,
  href: t.href,
  name: t.name,
}));
const pathOf = (href: string) => href.split('#')[0]!.split('?')[0]!;

/** The services the layout hands More, with the layout's own shell filter. */
function servicesFor(storeShell: boolean, owned: ReadonlySet<string> = new Set()) {
  return ourServicesMenuChildren(
    buildOurServices({
      eventId: EVENT,
      catalogue: ADD_ONS,
      owned: { active: owned, pending: new Set() },
      prices: new Map(),
      offered: (a) => !(storeShell && STORE_SHELL_HIDDEN_ADDON_KEYS.has(a.key)),
      sellableNow: () => true,
      aiSellable: true,
      papicOwnedBy: ['PAPIC_GUEST'],
      refusesPath: (p) => storeShell && isStoreShellWebOnlyPath(p),
    }),
  );
}

/** Every event shape the bar can take. */
function* shapes(storeShell: boolean): Generator<CustomerMenuCtx & { name: string }> {
  for (const phase of PHASES)
    for (const websiteEnabled of [true, false])
      for (const seatingEnabled of [true, false])
        for (const hideKeys of [[], ['explore']])
          yield {
            name: `${phase} hub=${websiteEnabled} seats=${seatingEnabled} hide=${hideKeys.join(',') || '-'}`,
            phase,
            websiteEnabled,
            seatingEnabled,
            hideKeys,
            studioRows: STUDIO_ROWS,
            storeShell,
            services: servicesFor(storeShell),
          };
}

/** What the app's ☰ drawer (and iPad rail) links to inside an event. */
function drawerHrefs(ctx: CustomerMenuCtx): Set<string> {
  // Only the event's own menu: inside an event the rail is focused, and since
  // 2026-10-23 the shell takes no Planner · Builder · Together lists at all.
  const rows = buildCustomerNavGroups(EVENT, ctx).flatMap((g) => g.items.map((i) => i.href));
  return new Set(rows.map(pathOf));
}

/* ══ 1 · the app builds no More, anywhere ════════════════════════════════ */

test('🍎 in the store shell no event menu builds More — bar, tree, rail or ☰', () => {
  let n = 0;
  for (const ctx of shapes(true)) {
    n += 1;
    const bar = buildCustomerMenuTree(EVENT, ctx);
    assert.equal(bar.some((m) => m.key === 'studio'), false, `${ctx.name}: the app bar has More`);
    assert.equal(bar.some((m) => m.href.includes('more=services')), false, `${ctx.name}: a bar tab opens Home ?more=services`);
    assert.ok(bar.some((m) => m.key === 'home'), `${ctx.name}: the app bar lost Home`);
    assert.equal(eventMenuRows(buildEventMenuSections(EVENT, ctx)).some((r) => r.key === 'studio'), false, `${ctx.name}: tree`);
    const rail = buildCustomerNavGroups(EVENT, ctx).flatMap((g) => g.items);
    assert.equal(rail.some((i) => i.key === 'studio' || i.href.includes('more=services')), false, `${ctx.name}: rail/☰`);
  }
  assert.equal(n, 24, 'premise: the shape sweep shrank');
});

test('🌐 the web keeps More — five tabs with a Hub, its services listed', () => {
  for (const ctx of shapes(false)) {
    if (!ctx.websiteEnabled || ctx.hideKeys?.length) continue;
    const bar = buildCustomerMenuTree(EVENT, ctx);
    assert.equal(bar.length, 5, `${ctx.name}: the web bar is not five`);
    assert.ok(bar.some((m) => m.key === 'studio'), `${ctx.name}: the web lost More`);
  }
  assert.ok(servicesFor(false).length >= 4, 'premise: the web lists the paid services under More');
});

/* ══ 2 · nothing More offered in the app is lost ═════════════════════════ */

test('🍎 every destination More offered in the app is linked from Home or ☰', () => {
  for (const owned of [new Set<string>(), new Set(ADD_ONS.flatMap((a) => (a.serviceKey ? [a.serviceKey] : [])))]) {
    const appServices = servicesFor(true, owned);
    // What More opened in the app: its own door, plus whatever it listed.
    const formerDestinations = [studioHubHref(EVENT), ...appServices.map((s) => s.href)].map(pathOf);
    for (const ctx of shapes(true)) {
      const bar = new Set(buildCustomerMenuTree(EVENT, ctx).map((m) => pathOf(m.href)));
      const drawer = drawerHrefs(ctx);
      for (const d of formerDestinations) {
        assert.ok(
          bar.has(d) || drawer.has(d),
          `${ctx.name}: ${d} was reachable through More in the app and is now in neither the bar's Home nor ☰ — ` +
            'add it to the ☰ drawer (owner 2026-10-21), do not bring More back',
        );
      }
    }
  }
  // Premise: More's door IS Home, so Home is the one destination today.
  assert.equal(pathOf(studioHubHref(EVENT)), `/dashboard/${EVENT}`);
});

/* ══ wiring — the layout really hands the bar the shell and the filter ═══ */

test('wiring: the event layout drops the paid keys in the shell and hands the bar `storeShell`', () => {
  const layout = fs.readFileSync(path.join(EV, 'layout.tsx'), 'utf8');
  assert.match(layout, /!\(storeShell && STORE_SHELL_HIDDEN_ADDON_KEYS\.has\(a\.key\)\)/);
  assert.match(layout, /<CustomerBottomNav[^>]*storeShell=\{storeShell\}/);
});
