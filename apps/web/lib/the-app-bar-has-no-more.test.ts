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
 *      or the rail / ☰ drawer — in any phase, for any event shape.
 *   3. 🔁 FLIPPED ON PURPOSE (owner 22 Oct 2026, verbatim *"Yes remove more"*,
 *      DECISION_LOG "MORE LEAVES THE WEB BAR TOO"): the web has no More either —
 *      bar, rail (the desktop "More Services" row and its pop-up) and ☰. Until
 *      then property 3 read "the web keeps More, five tabs". Every service More
 *      listed on the web is a row on Home › Your services, by the same
 *      catalogue and the same `offered` rule — nothing is lost.
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
import { builderRailItems, plannerRailItems, togetherRailItems } from './free-tools-rail';
import { railToolsSignedIn } from './studio-rail';
import { GENERIC_PROFILE, SIMPLE_PROFILE, TRAVEL_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from './event-type-profile';
import { addOnOfferedForEvent } from './add-on-event-scope';
import { homePaidFacts } from './home-paid-services';
import { HOME_PAID_SKU, homeServices } from './home-first-screen';
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
  const rows = buildCustomerNavGroups(EVENT, ctx).flatMap((g) => g.items.map((i) => i.href));
  const tools = [...plannerRailItems(EVENT), ...builderRailItems(EVENT), ...togetherRailItems(EVENT)].map((t) => t.href);
  return new Set([...rows, ...tools].map(pathOf));
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

test('🌐 the web has no More either — four tabs, no More Services row in the rail or ☰ (owner 22 Oct 2026)', () => {
  let n = 0;
  for (const ctx of shapes(false)) {
    n += 1;
    const bar = buildCustomerMenuTree(EVENT, ctx);
    assert.equal(bar.some((m) => m.key === 'studio'), false, `${ctx.name}: the web bar has More again`);
    assert.equal(bar.some((m) => m.href.includes('more=services')), false, `${ctx.name}: a web tab opens Home ?more=services`);
    assert.equal(eventMenuRows(buildEventMenuSections(EVENT, ctx)).some((r) => r.key === 'studio'), false, `${ctx.name}: tree`);
    const rail = buildCustomerNavGroups(EVENT, ctx).flatMap((g) => g.items);
    assert.equal(rail.some((i) => i.key === 'studio' || i.href.includes('more=services')), false, `${ctx.name}: the desktop rail / ☰ keeps More Services`);
    if (ctx.websiteEnabled && !ctx.hideKeys?.length) {
      assert.deepEqual(bar.map((m) => m.key), ['home', 'guests', 'explore', 'launch'], `${ctx.name}: the web bar is not the four`);
    }
  }
  assert.equal(n, 24, 'premise: the shape sweep shrank');
  assert.ok(servicesFor(false).length >= 4, 'premise: the web still has the paid services to place');
});

/** Home › Your services on the web, built as the event page builds it (the same `offered` rule). */
function homeServiceHrefs(offered: (a: (typeof ADD_ONS)[number]) => boolean, owned: boolean): Set<string> {
  const reads = Object.fromEntries(Object.values(HOME_PAID_SKU).map((s) => [s, { active: owned, pending: false }]));
  const facts = homePaidFacts({
    eventId: EVENT,
    catalogue: ADD_ONS,
    reads,
    prices: new Map(),
    offered,
    sellableNow: () => true,
    aiSellable: true,
    refusesPath: () => false,
  });
  const rows = homeServices({ next: 'plan', storeShell: false, papic: 'On', ai: 'Try it', eventId: EVENT, paid: facts });
  return new Set(rows.flatMap((r) => (r.key === 'papic' ? [`/dashboard/${EVENT}/studio/papic`] : r.paid ? [pathOf(r.paid.href)] : [])));
}

test('🌐 every service More listed on the web has its row on Home › Your services — every type, owned or not', () => {
  for (const profile of [WEDDING_PROFILE, GENERIC_PROFILE, SIMPLE_PROFILE, TRAVEL_PROFILE, WAKE_PROFILE]) {
    const offered = (a: (typeof ADD_ONS)[number]) => addOnOfferedForEvent(a, profile, null);
    for (const owned of [false, true]) {
      const more = ourServicesMenuChildren(
        buildOurServices({
          eventId: EVENT,
          catalogue: ADD_ONS,
          owned: { active: owned ? new Set(ADD_ONS.flatMap((a) => (a.serviceKey ? [a.serviceKey] : []))) : new Set(), pending: new Set() },
          prices: new Map(),
          offered,
          sellableNow: () => true,
          aiSellable: true,
          papicOwnedBy: ['PAPIC_GUEST'],
          refusesPath: () => false,
        }),
      );
      const home = homeServiceHrefs(offered, owned);
      for (const m of more) {
        assert.ok(
          home.has(pathOf(m.href)),
          `${profile.eventType} (owned=${owned}): "${m.label}" (${m.href}) was reachable through More on the web and has no row on Home › Your services — add it there, do not bring More back`,
        );
      }
    }
  }
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

test('wiring: the event layout hands the bar `storeShell` and no services list (there is nothing to open)', () => {
  const layout = fs.readFileSync(path.join(EV, 'layout.tsx'), 'utf8');
  assert.match(layout, /<CustomerBottomNav[^>]*storeShell=\{storeShell\}/);
  assert.doesNotMatch(layout, /<CustomerBottomNav[^>]*services=/, 'the bar is handed a services list again');
  assert.equal(fs.existsSync(path.join(EV, '_components', 'more-services-sheet.tsx')), false, 'the More chooser sheet is back');
  // …and Home's Your services keeps the shell filter (the app shows no paid row — App Review 3.1.1).
  const page = fs.readFileSync(path.join(EV, 'page.tsx'), 'utf8');
  assert.match(page, /!\(storeShell && STORE_SHELL_HIDDEN_ADDON_KEYS\.has\(a\.key\)\)/);
});
