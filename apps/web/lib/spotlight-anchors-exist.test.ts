/**
 * spotlight-anchors-exist.test.ts — 🔦 EVERY SPOTLIGHT STEP POINTS AT SOMETHING THAT IS THERE.
 *
 * A spotlight step names the real button by its `data-tour` token (`lib/tours.ts` → `spotlight`).
 * A token nobody draws is a step the tour silently skips (the engine waits, then jumps ahead) — so a
 * rename that drops an anchor would shorten the tour with no error anywhere. This fails instead.
 *
 * It also holds the two promises the engine makes about weight:
 *  · the engine (`spotlight-tour.tsx`) is reached ONLY through `React.lazy` in `spotlight-mount.tsx`,
 *    so a page whose tour is done never downloads it and the Maker's first load never carries it;
 *  · the spotlight never draws the old centred card (owner 2026-10-03: the carousels stay off).
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { TOURS, TOUR_KEYS } from './tours';
import { stripComments } from './strip-comments';

const WEB = process.cwd();
const ROOTS = ['app', 'components', 'lib'];

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const FILES = ROOTS.flatMap((r) => walk(join(WEB, r)));
const SOURCES = FILES.map((f) => ({ f: relative(WEB, f), src: readFileSync(f, 'utf8') }));

/** Does this source draw the token — as `data-tour="…"` / `tour="…"`, chosen inside a data-tour expression
 *  (`data-tour={key === 'share' ? 'guests-setup' : undefined}`), or handed to the ONE thumb row as a seat's
 *  `tour: '…'` (2026-10-22 — `components/thumb-row.tsx` stamps it as `data-tour`, pinned below)? */
function drawnIn(token: string, src: string): boolean {
  const t = token.replace(/[-]/g, '\\-');
  const lit = new RegExp(`(?:data-tour|\\btour)=["'{\`]+${t}["'}\`]`);
  const chosen = new RegExp(`data-tour=\\{[^}]*['"]${t}['"]`);
  const seat = new RegExp(`\\btour: ['"]${t}['"]`);
  return lit.test(src) || chosen.test(src) || seat.test(src);
}

/** Every file that draws the token. */
function drawn(token: string): string[] {
  return SOURCES.filter(({ src }) => drawnIn(token, src)).map(({ f }) => f);
}

const steps = TOUR_KEYS.flatMap((k) => (TOURS[k].spotlight?.steps ?? []).map((s) => ({ k, s })));

test('there are spotlight tours to check (the scan is not looking at nothing)', () => {
  assert.ok(steps.length >= 15, `only ${steps.length} spotlight steps — did the scripts move out of lib/tours.ts?`);
  // + the four supplier page tours (owner 2026-10-22, journey_fixes Supplier 3).
  for (const k of ['host_spotlight_v1', 'host_day_spotlight_v1', 'supplier_spotlight_v1', 'vendor_shop_v1', 'vendor_dates_v1', 'vendor_money_v1', 'vendor_hub_v1'] as const) {
    assert.ok(TOURS[k].spotlight, `${k} has no spotlight script`);
  }
});

test('every spotlight anchor is drawn by a real element', () => {
  const missing: string[] = [];
  for (const { k, s } of steps) {
    // Checked below: the bar derives tab-* from each tab's address.
    if (s.anchor.startsWith('tab-')) continue;
    if (drawn(s.anchor).length === 0) missing.push(`${k} → ${s.anchor}`);
  }
  assert.deepEqual(missing, [], 'a spotlight step names a data-tour token no element carries');
});

test('the ONE thumb row stamps a seat’s tour token on a real element', () => {
  const row = SOURCES.find(({ f }) => f === join('components', 'thumb-row.tsx'));
  assert.ok(row, 'components/thumb-row.tsx moved');
  assert.match(row.src, /data-thumb-seat="field" data-tour=\{field\.tour\}/, 'the field seat no longer draws its tour token');
  assert.match(row.src, /tour: r\.tour,/, 'a round no longer draws its tour token');
});

test('each `tour` prop a home hands on is stamped as a real data-tour (2026-10-25)', () => {
  const hops: Array<[string, RegExp]> = [
    [join('components', 'thumb-row.tsx'), /data-thumb-seat="menu" data-tour=\{r\.tour\}/], // the ≡ menu seat (Guests' Sort)
    [join('app', 'dashboard', '(account)', '_components', 'account-thumb-row.tsx'), /data-thumb-tool="" data-tour=\{tour\}/],
    [join('app', 'dashboard', '(account)', '_components', 'account-thumb-row.tsx'), /data-thumb-field=\{words\} data-tour=\{tour\}/],
    [join('app', '_components', 'search-box.tsx'), /data-tour=\{tour\}/],
    [join('app', '_components', 'unread-messages-badge.tsx'), /data-tour=\{tour\}/],
    [join('app', 'vendor-dashboard', '_components', 'open-fold-button.tsx'), /tour=\{tour\}/],
    [join('components', 'action-button.tsx'), /data-tour=\{(?:props|p)\.tour\}/],
  ];
  for (const [f, re] of hops) {
    const src = SOURCES.find((x) => x.f === f)?.src;
    assert.ok(src, `${f} moved`);
    assert.match(stripComments(src), re, `${f} no longer stamps the tour token it is handed`);
  }
});

// (The Home doors — Guests · Suppliers · Event Hub — are gone, owner 2026-10-23: "remove Home's three pills". Their
//  home-<key> tokens went with them, so a step naming one is now an ordinary missing anchor, caught above; the
//  Event Hub step rides the bar's tab-launch.)

test('bar tabs carry tab-<last path segment>, and every tab step names a real tab', () => {
  const nav = SOURCES.find(({ f }) => f.endsWith('_components/nav/bottom-nav.tsx'));
  assert.ok(nav, 'bottom-nav.tsx moved');
  assert.match(nav.src, /data-tour=\{tabTourToken\(item\.href\)\}/, 'the bar no longer stamps its tabs');
  const tabs = steps.filter(({ s }) => s.anchor.startsWith('tab-')).map(({ s }) => s.anchor.slice(4));
  assert.ok(tabs.length >= 4, 'expected the guests / vendors / shop / customers tab steps');
  // + the account bar (Events · Discover · Memories · People — `customer_account_bar_v2`, owner 2026-10-22/25).
  const menus = SOURCES.filter(({ f }) => /customer-menu\.ts$|vendor-bottom-nav\.tsx$|account-bottom-nav\.tsx$/.test(f)).map(({ src }) => src).join('\n');
  for (const seg of tabs) {
    // A tab's token ignores its query (`/dashboard?hub=1` → tab-dashboard), as `tabTourToken` does.
    const href = seg === 'vendor-dashboard' ? /['"`]\/vendor-dashboard['"`]/ : new RegExp(`/${seg}(?:\\?[^'"\`]*)?['"\`]`);
    assert.match(menus, href, `no bar tab has an address ending in /${seg} — the tab-${seg} step would never light`);
  }
});

test('the engine is reached only through React.lazy in the mount', () => {
  const importers = SOURCES.filter(({ src }) => /from\s+['"](?:\.\/|@\/app\/_components\/)spotlight-tour['"]/.test(src));
  assert.deepEqual(importers.map(({ f }) => f), [], 'a file imports the spotlight engine statically — it rides in that page’s first load');
  const mount = SOURCES.find(({ f }) => f.endsWith('_components/spotlight-mount.tsx'));
  assert.ok(mount, 'spotlight-mount.tsx moved');
  assert.match(mount.src, /lazy\(\(\) => import\('\.\/spotlight-tour'\)/, 'the mount no longer lazy-loads the engine');
});

test('the spotlight never draws the old centred card', () => {
  for (const name of ['spotlight-tour.tsx', 'spotlight-mount.tsx', 'spotlight.tsx']) {
    const f = SOURCES.find(({ f }) => f.endsWith(`_components/${name}`));
    assert.ok(f, `${name} moved`);
    assert.doesNotMatch(f.src, /from\s+['"][^'"]*(?:guided-tour|mini-tour)[^'"]*['"]/, `${name} imports the switched-off carousel`);
  }
});

/**
 * 🏠 EACH STOP IS DRAWN BY THE COMPONENT THAT RENDERS ITS PART (owner 2026-10-25, "the spotlight tour is missing so
 * many parts for each page"). "Some file somewhere writes the token" (above) passes when the token survives only in a
 * dead copy, a lab, or a comment. So every anchor names its HOME — the component that draws that part on the real
 * page — and the home's comment-stripped source must draw it. A new stop without a home fails here, so nobody can add
 * a step that points at nothing; a home left behind after a stop is cut fails too.
 */
const ANCHOR_HOME: Record<string, string | string[]> = {
  'shop-segments': 'app/vendor-dashboard/shop/_components/shop-segments.tsx',
  'shop-page-list': 'app/vendor-dashboard/website/_components/page-parts.tsx',
  'shop-details-row': 'app/vendor-dashboard/website/_components/page-parts.tsx',
  'hub-next-days': 'app/vendor-dashboard/on-the-day/page.tsx',
  'hub-empty': 'app/vendor-dashboard/on-the-day/page.tsx',
  'hub-day-launch': 'app/vendor-dashboard/on-the-day/page.tsx',
  'hub-setup': 'app/vendor-dashboard/on-the-day/page.tsx',
  'dates-calendar': 'app/vendor-dashboard/customers/_components/customers-calendar.tsx',
  'dates-check': 'app/vendor-dashboard/customers/_components/check-a-date.tsx',
  'dates-add': 'app/vendor-dashboard/customers/page.tsx',
  'money-summary': 'app/vendor-dashboard/customers/_components/money-view.tsx',
  'money-next': 'app/vendor-dashboard/customers/_components/money-view.tsx',
  'money-log': 'app/vendor-dashboard/customers/_components/money-log.tsx',
  'money-fees': 'app/vendor-dashboard/customers/_components/money-view.tsx',
  'create-event': 'app/dashboard/(launcher)/page.tsx',
  'home-tiles': 'app/dashboard/[eventId]/_components/home-control-row.tsx',
  'guests-add': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'guests-setup': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'suppliers-find': 'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx',
  'day-live': 'app/dashboard/[eventId]/page.tsx',
  'day-planning': 'app/dashboard/[eventId]/page.tsx',
  'post-story': 'app/dashboard/[eventId]/_components/after/finished-event-summary.tsx',
  'post-photos': 'app/dashboard/[eventId]/_components/after/finished-event-summary.tsx',
  'today-next': ['app/_components/next-card.tsx', 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'],
  'shop-details': 'app/vendor-dashboard/shop/page.tsx',
  'shop-add-service': 'app/vendor-dashboard/services/_components/services-manager.tsx',
  'customers-list': 'app/vendor-dashboard/customers/_components/customers-roster.tsx',
  // 📌 The money count is the pinned row's filter since 2026-10-28 — drawn by `TodayCounts`.
  'today-money': 'app/vendor-dashboard/_components/today-counts.tsx',
  'maker-hint': 'app/dashboard/[eventId]/launch/_components/maker-shell.tsx',
  'maker-tools': 'app/dashboard/[eventId]/launch/_components/maker-lower-third.tsx',
  'maker-apply': 'app/dashboard/[eventId]/website/_components/hub-draft-bar.tsx',
  'budget-summary': 'app/dashboard/[eventId]/budget/_components/budget-summary.tsx',
  'budget-list': 'app/dashboard/[eventId]/budget/_components/budget-screen.tsx',
  'budget-thumb': 'app/dashboard/[eventId]/budget/_components/budget-screen.tsx',
  'papic-band': 'app/dashboard/[eventId]/studio/papic/_components/papic-top-band.tsx',
  'papic-coverage': 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx',
  'papic-settings': 'app/dashboard/[eventId]/studio/papic/_components/papic-camera-settings.tsx',
  'seat-plan-auto': 'app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx',
  'seat-plan-unseated': 'app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx',
  'seat-plan-view': 'app/dashboard/[eventId]/seating/_components/seat-plan-phone.tsx',
  'mood-board-palette': ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx', 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'],
  'mood-board-reception': ['app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx', 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx'],
  'mood-board-share': 'app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx',
  'home-today': 'app/dashboard/[eventId]/_components/home-parts.tsx',
  'home-faces': 'app/dashboard/[eventId]/_components/home-control-row.tsx',
  'home-services': 'app/dashboard/[eventId]/_components/home-first-screen.tsx',
  'home-switch-on': 'app/dashboard/[eventId]/_components/home-first-screen.tsx',
  'memories-albums': 'app/_components/memories/event-memories-gallery.tsx',
  'memories-settings': 'app/_components/memories/event-memories-gallery.tsx',
  'memories-grid': 'app/_components/memories/event-memories-gallery.tsx',
  'memories-search': 'app/_components/memories/event-memories-gallery.tsx',
  'memories-add': 'app/_components/memories/event-memories-gallery.tsx',
  'people-counts': 'app/dashboard/(account)/people/_components/people-roster-view.tsx',
  'people-loved-ones': 'app/dashboard/(account)/people/_components/people-roster-view.tsx',
  'people-view': 'app/dashboard/(account)/people/_components/people-roster-view.tsx',
  'people-find': 'app/dashboard/(account)/people/_components/find-or-invite.tsx',
  'events-planning': 'app/dashboard/(launcher)/page.tsx',
  'events-worth': 'app/dashboard/(launcher)/page.tsx',
  'account-avatar': 'app/_components/account-switcher/account-switcher.tsx',
  'guests-views': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'guests-counts': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'guests-row': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'guests-sort': 'app/dashboard/[eventId]/guests/_components/guests-screen.tsx',
  'suppliers-segments': 'app/dashboard/[eventId]/vendors/_components/services-takeover.tsx',
  'suppliers-category': 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx',
  'suppliers-add-own': 'app/dashboard/[eventId]/vendors/_components/find-thumb-row.tsx',
  'library-event': 'app/dashboard/(account)/library/_components/memories-chapters.tsx',
  'library-show': 'app/dashboard/(account)/library/_components/memories-thumb.tsx',
  'library-search': 'app/dashboard/(account)/library/_components/memories-thumb.tsx',
  'supplier-messages': 'app/vendor-dashboard/layout.tsx',
  'today-numbers': 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
  'today-coming-up': 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
  'today-shop': 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
  'customers-segments': 'app/vendor-dashboard/customers/_components/customers-segments.tsx',
  'customers-filter': 'app/vendor-dashboard/customers/_components/customers-roster.tsx',
  'customers-search': 'app/vendor-dashboard/customers/page.tsx',
  'customers-add': 'app/vendor-dashboard/customers/page.tsx',
  'collections-filter': 'app/vendor-dashboard/collections/_components/collections-list.tsx',
  'collections-list': 'app/vendor-dashboard/collections/_components/collections-list.tsx',
  'collections-add': 'app/vendor-dashboard/collections/page.tsx',
  'camera-credits': 'app/papic/guest/_components/papic-guest-capture.tsx',
  'camera-challenge': 'app/papic/guest/_components/papic-guest-capture.tsx',
  'camera-mode': 'app/papic/guest/_components/papic-guest-capture.tsx',
  'camera-shots': 'app/papic/guest/_components/papic-guest-capture.tsx',
  'camera-shutter': 'app/papic/guest/_components/papic-guest-capture.tsx',
  'me-camera': 'app/papic/me/[token]/page.tsx',
  'me-photos': 'app/papic/me/[token]/page.tsx',
  'me-download': 'app/papic/me/[token]/page.tsx',
  'me-story': 'app/papic/me/[token]/_components/guest-story-maker.tsx',
  // /pricing's first-visit tour (2026-10-25, prototype pricing_ours_only revision 5).
  'pricing-why': 'app/(shell)/pricing/page.tsx',
  'pricing-prices': 'app/(shell)/pricing/page.tsx',
  'pricing-quiz': 'app/(shell)/pricing/page.tsx',
};

test('every spotlight stop names its home component, and that component draws it', () => {
  const anchors = new Set(steps.map(({ s }) => s.anchor).filter((a) => !a.startsWith('tab-')));
  const homeless = [...anchors].filter((a) => !(a in ANCHOR_HOME));
  assert.deepEqual(homeless, [], 'a spotlight stop has no home component in ANCHOR_HOME — say which component draws it');
  const orphaned = Object.keys(ANCHOR_HOME).filter((a) => !anchors.has(a));
  assert.deepEqual(orphaned, [], 'ANCHOR_HOME lists a stop no tour makes any more — take it out');
  const notDrawn: string[] = [];
  for (const [anchor, home] of Object.entries(ANCHOR_HOME)) {
    for (const f of Array.isArray(home) ? home : [home]) {
      const src = SOURCES.find((x) => x.f === f)?.src;
      if (src === undefined) {
        notDrawn.push(`${anchor} → ${f} (file moved or gone)`);
        continue;
      }
      if (!drawnIn(anchor, stripComments(src))) notDrawn.push(`${anchor} → ${f}`);
    }
  }
  assert.deepEqual(notDrawn, [], 'a spotlight stop’s home component no longer draws its data-tour token — the step would point at nothing');
});
