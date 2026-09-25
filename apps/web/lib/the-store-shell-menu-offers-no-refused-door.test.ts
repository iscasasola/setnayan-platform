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
 * bottom bar (`buildCustomerMenuTree`), the moment strip
 * (`eventMomentForPath` → `eventMomentChildren`) and the tree they all read
 * (`buildEventMenuSections`) — is walked in every phase, with the real Studio
 * rows a wedding gets, and EVERY href is checked against the SAME refusal
 * middleware applies (`isStoreShellWebOnlyPath`). The refused list is never
 * restated here, so a product added to it tomorrow is covered the day it is.
 *
 * 🪞 BOTH WAYS. With `storeShell: false` the same walk MUST find refused doors
 * (Papic, Setnayan AI…) — otherwise the store-shell half would be passing on a
 * tree that never contained anything to refuse, which is a guard that cannot
 * go red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildCustomerMenuTree,
  buildEventMenuSections,
  eventMenuRowClaims,
  eventMomentChildren,
  eventMomentForPath,
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

  for (const m of buildCustomerMenuTree(EVENT_ID, { ...ctx, dayOfOpen: true })) {
    doors.push({ menu: 'bar', label: m.label, href: m.href });
    for (const c of m.children ?? []) {
      if (c.href) doors.push({ menu: 'bar child', label: c.label, href: c.href });
    }
  }

  // The strip, from EVERY page any row claims — that is every page it can dock on.
  for (const s of sections) {
    for (const r of s.rows) {
      for (const at of eventMenuRowClaims(r)) {
        const moment = eventMomentForPath(at, sections);
        for (const c of eventMomentChildren(at, moment)) {
          if (c.href) doors.push({ menu: `strip@${at}`, label: c.label, href: c.href });
        }
      }
    }
  }
  return doors;
}

const refusedAmong = (doors: Door[]) => doors.filter((d) => isStoreShellWebOnlyPath(path(d.href)));

/* ══ 0 · THE PREMISE — the walk reaches refused doors when nothing filters ══ */

test('🪞 on the web, the same walk DOES offer refused doors (so the next test can fail)', () => {
  for (const phase of PHASES) {
    const refused = refusedAmong(everyDoor(phase, false));
    const labels = new Set(refused.map((d) => d.label));
    assert.ok(
      labels.has('Papic'),
      `${phase}: the web menus no longer offer Papic at all — this guard would be walking a ` +
        `tree with nothing to refuse. Found refused: ${[...labels].join(', ') || '(none)'}`,
    );
    assert.ok(
      refused.some((d) => d.menu === 'bar'),
      `${phase}: no refused door reaches the BAR on the web — the blank-slot case is no longer exercised`,
    );
    assert.ok(
      refused.some((d) => d.menu.startsWith('strip@')),
      `${phase}: no refused door reaches a moment STRIP on the web — the Setnayan-AI-on-the-Suite case is no longer exercised`,
    );
  }
});

/* ══ 1 · THE ASSERTION ═══════════════════════════════════════════════════ */

test('🍎 in the store shell, no event menu offers a door the app would refuse', () => {
  for (const phase of PHASES) {
    const offenders = refusedAmong(everyDoor(phase, true)).map(
      (d) => `${d.menu}: "${d.label}" → ${d.href}`,
    );
    assert.deepEqual(
      [...new Set(offenders)],
      [],
      `${phase}: the store shell would draw these, and each one lands on "Not available in the ` +
        'app" (or, on the bar, leaves a blank slot once the link guard hides it):',
    );
  }
});

test('🍎 the store-shell bar RE-SPREADS: fewer tabs, none blank, none repeated', () => {
  for (const phase of PHASES) {
    const web = buildCustomerMenuTree(EVENT_ID, { phase, websiteEnabled: true, studioRows: STUDIO_ROWS });
    const app = buildCustomerMenuTree(EVENT_ID, {
      phase,
      websiteEnabled: true,
      studioRows: STUDIO_ROWS,
      storeShell: true,
    });
    assert.equal(app.length, web.length - 1, `${phase}: the app bar should be the web bar minus Papic`);
    assert.ok(!app.some((m) => m.key === 'papic'), `${phase}: Papic is still a tab in the store shell`);
    assert.ok(app.length >= 3, `${phase}: only ${app.length} tab(s) left — something else was dropped`);
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
