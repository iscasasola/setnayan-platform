/**
 * the-store-shell-menu-offers-no-refused-door.test.ts — 2026-09-25.
 *
 * ── WHAT THE OWNER SAW ──────────────────────────────────────────────────────
 * The iOS app (the Capacitor store shell), a couple's event Overview: the
 * bottom bar read `Overview · [blank] · Your Team · Guests · Event Hub …`. And
 * on the Suite, the moment strip offered "Setnayan AI", which opened the
 * "Not available in the app" page — the incomplete-functionality shape App
 * Review rejects.
 *
 * 🔑 ONE ROOT CAUSE FOR BOTH. The menu BUILT rows whose doors
 * `lib/store-shell.ts` refuses (Papic → `/studio/papic`, Setnayan AI →
 * `/studio/setnayan-ai`), and the only thing standing between them and the
 * screen was `StoreShellLinkGuard`, which hides an `<a>` after paint — leaving
 * the bar's `<li>` holding a grid column, and doing nothing about a strip chip,
 * which is a `<button>`, not a link.
 *
 * ── WHAT THIS HOLDS ─────────────────────────────────────────────────────────
 * Every event menu — the rail and ☰ drawer (`buildCustomerNavGroups`), the
 * one bottom bar (`buildCustomerMenuTree`) and the tree they both read
 * (`buildEventMenuSections`) — is walked in every phase, with the real Studio
 * rows a wedding gets, and EVERY href is checked against the SAME refusal
 * middleware applies (`isStoreShellWebOnlyPath`). The refused list is never
 * restated here, so a product added to it tomorrow is covered the day it is.
 *
 * 🔄 STAGE D (2026-09-29) CHANGED WHY IT HOLDS. The menu is five rows and no
 * product is a row any more — Papic and Setnayan AI are cards on Our Services,
 * which filters its own cards in the shell. The strip that offered "Setnayan
 * AI" is retired. So refused products now reach the menu only as CLAIMS (the
 * pages that light Our Services), never as doors — and this pins exactly that:
 * the premise (refused products ARE in the list the menu is handed, and ARE
 * claimed), then the assertion (no door, web or shell, is refused), then the
 * bar (the same five in the shell as on the web — nothing to re-spread).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCustomerMenuTree,
  buildEventMenuSections,
  eventMenuRowClaims,
  eventMenuRows,
  storeShellRefusesMenuRow,
  type EventStudioRow,
} from './customer-menu';
import { isStoreShellWebOnlyPath } from './store-shell';
import { railToolsSignedIn } from './studio-rail';
import { WEDDING_PROFILE } from './event-type-profile';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

const EVENT_ID = 'S89E-TESTEVENT';
const PHASES = ['plan', 'dayof', 'after'] as const;

/** Exactly what `layout.tsx` hands every menu. */
const STUDIO_ROWS: EventStudioRow[] = railToolsSignedIn({
  eventId: EVENT_ID,
  count: 1,
  profile: WEDDING_PROFILE,
}).map((t) => ({ key: t.key, href: t.href, name: t.name }));

const path = (href: string) => href.split('#')[0]!.split('?')[0]!;

type Door = { menu: string; label: string; href: string };

/** Every door every event menu offers, for one phase and one shell. */
function everyDoor(phase: (typeof PHASES)[number], storeShell: boolean): Door[] {
  const ctx = { phase, websiteEnabled: true, seatingEnabled: true, studioRows: STUDIO_ROWS, storeShell };
  const doors: Door[] = [];

  const sections = buildEventMenuSections(EVENT_ID, ctx);
  for (const s of sections) for (const r of s.rows) doors.push({ menu: 'tree', label: r.label, href: r.href });

  for (const g of buildCustomerNavGroups(EVENT_ID, ctx)) {
    for (const i of g.items) doors.push({ menu: 'rail/☰', label: i.label, href: i.href });
  }

  for (const m of buildCustomerMenuTree(EVENT_ID, ctx)) {
    doors.push({ menu: 'bar', label: m.label, href: m.href });
  }
  return doors;
}

const refusedAmong = (doors: Door[]) => doors.filter((d) => isStoreShellWebOnlyPath(path(d.href)));

/* ══ 0 · THE PREMISE — refused products ARE handed to the menu ══════════ */

test('🪞 the menu is handed refused products, and claims their pages — so the next test can fail', () => {
  const refusedProducts = STUDIO_ROWS.filter((r) => isStoreShellWebOnlyPath(path(r.href)));
  assert.ok(
    refusedProducts.some((r) => r.key === 'papic'),
    'the wedding product list no longer contains a refused product (Papic) — this guard would be ' +
      'walking a menu with nothing to refuse',
  );
  for (const phase of PHASES) {
    const claims = eventMenuRows(
      buildEventMenuSections(EVENT_ID, { phase, websiteEnabled: true, seatingEnabled: true, studioRows: STUDIO_ROWS }),
    ).flatMap(eventMenuRowClaims);
    assert.ok(
      claims.some((c) => isStoreShellWebOnlyPath(c)),
      `${phase}: no refused page is even CLAIMED — the premise changed; re-read this guard`,
    );
  }
});

/* ══ 1 · THE ASSERTION ═══════════════════════════════════════════════════ */

test('🍎 no event menu offers a door the app would refuse — in the shell, and on the web too', () => {
  for (const phase of PHASES) {
    for (const shell of [true, false]) {
      const offenders = refusedAmong(everyDoor(phase, shell)).map(
        (d) => `${d.menu}: "${d.label}" → ${d.href}`,
      );
      assert.deepEqual(
        [...new Set(offenders)],
        [],
        `${phase}${shell ? ' (store shell)' : ''}: these doors land on "Not available in the app" ` +
          '(or, on the bar, leave a blank slot once the link guard hides it):',
      );
    }
  }
});

test('🍎 the store-shell bar is the web\'s bar minus an empty More — none blank, none repeated', () => {
  /*
    Owner 2026-10-08 (roadmap Level 1, "the app shows only owned services"):
    with no service the event owns, the app draws NO More tab — never a dead
    one. The other four pillars are the web's own. (With owned services the
    bar is the same five: \`the-app-more-lists-only-owned-services.test.ts\`.)
  */
  for (const phase of PHASES) {
    const web = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO_ROWS });
    const app = buildCustomerMenuTree(EVENT_ID, {
      phase,
      websiteEnabled: true,
      studioRows: STUDIO_ROWS,
      storeShell: true,
    });
    assert.deepEqual(
      app.map((m) => m.key),
      web.map((m) => m.key).filter((k) => k !== 'studio'),
      `${phase}: the app bar lost a pillar, or kept an empty More`,
    );
    assert.equal(web.length, 5, `${phase}: the web bar is not five`);
    assert.equal(app.length, 4, `${phase}: ${app.length} tab(s) in the store shell with nothing owned`);
    for (const m of app) {
      assert.ok(m.label.trim().length > 0 && m.href.length > 0, `${phase}: a tab with no label or href`);
    }
    assert.equal(new Set(app.map((m) => m.key)).size, app.length, `${phase}: a tab appears twice`);
  }
});

test('the one filter answers the refusal list, and nothing else', () => {
  const base = `/dashboard/${EVENT_ID}`;
  assert.equal(storeShellRefusesMenuRow(`${base}/studio/papic`, true), true);
  assert.equal(storeShellRefusesMenuRow(`${base}/studio/papic?from=bar#top`, true), true);
  // The web is never filtered.
  assert.equal(storeShellRefusesMenuRow(`${base}/studio/papic`, false), false);
  assert.equal(storeShellRefusesMenuRow(`${base}/studio/papic`, undefined), false);
  // Planning stays — that is what the store shell exists for.
  for (const open of [base, `${base}/guests`, `${base}/vendors`, `${base}/launch`, `${base}/galleries`]) {
    assert.equal(storeShellRefusesMenuRow(open, true), false, `${open} was refused`);
  }
});
