/**
 * the-app-more-lists-only-owned-services.test.ts — 2026-10-08.
 *
 * ── WHAT THE OWNER SAW ──────────────────────────────────────────────────────
 * In the iPhone app (the Capacitor store shell), "More" on an event's bottom
 * bar did nothing. The store shell drops every paid add-on
 * (`STORE_SHELL_HIDDEN_ADDON_KEYS`, App Review 3.1.1), so the services list was
 * empty, `CustomerBottomNav` never mounted the More sheet, and the tab fell
 * back to its address — Home `?more=services` — which opens nothing.
 *
 * ── THE OWNER'S RULE (DECISION_LOG 2026-10-08, "ROADMAP LOCKED: LEVEL 1") ──
 * "the app shows only owned services":
 *   (a) in the app, More lists the services this event ALREADY OWNS — no
 *       price, no buy / activate, no "buy on the website" wording;
 *   (b) owning none, the app draws no More tab at all — never a dead one;
 *   (c) the web keeps today's behaviour.
 *
 * ⚠ A ROW MUST ALSO OPEN SOMETHING. A service's door that the app refuses
 * (`isStoreShellWebOnlyPath` → "Not available in the app") is not listed even
 * when owned — a row that bounces is the same dead tap in another shape. Test
 * 3 pins what that means TODAY, so nobody reads (a) as live before the doors
 * open.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ADD_ONS } from './add-ons-catalog';
import { buildOurServices, ourServicesMenuChildren, type OurServicesInput } from './our-services';
import { buildCustomerMenuTree, buildEventMenuSections, eventMenuRows, type CustomerMenuCtx } from './customer-menu';
import { isStoreShellWebOnlyPath } from './store-shell';
import { stripComments } from './strip-comments';
import { buildCustomerNavGroups } from '@/app/dashboard/[eventId]/_components/customer-nav-config';

const LIB = path.dirname(fileURLToPath(import.meta.url));
const EV = path.resolve(LIB, '..', 'app', 'dashboard', '[eventId]');
const EVENT = 'S89E-TESTEVENT';

const sku = (key: string) => ADD_ONS.find((a) => a.key === key)!.serviceKey!;

/** Everything offered and sellable, every price known — the most a card could sell. */
function input(over: Partial<OurServicesInput> = {}): OurServicesInput {
  return {
    eventId: EVENT,
    catalogue: ADD_ONS,
    owned: { active: new Set(), pending: new Set() },
    prices: new Map(ADD_ONS.flatMap((a) => (a.serviceKey ? [[a.serviceKey, '₱999'] as const] : []))),
    offered: () => true,
    sellableNow: () => true,
    aiSellable: true,
    papicOwnedBy: ['PAPIC_UNLOCK', 'PAPIC_SEATS', 'PAPIC_GUEST'],
    refusesPath: () => false,
    ...over,
  };
}

const OWNS_TWO = {
  active: new Set([sku('patiktok'), 'PAPIC_GUEST']),
  // Waiting for payment is a purchase in flight — the app never shows it.
  pending: new Set([sku('pakanta')]),
};

/* ══ (a) · owned services, listed, with nothing to buy ═══════════════════ */

test('(a) the app lists ONLY what the event owns — no price, trial, Free or "waiting for payment"', () => {
  const cards = buildOurServices(input({ owned: OWNS_TWO, ownedOnly: true }));
  assert.deepEqual(cards.map((c) => c.key), ['papic', 'patiktok']);
  for (const c of cards) {
    assert.equal(c.state, 'added', `${c.key}: a card in the app that is not owned`);
    assert.equal(c.pro, false, `${c.key}: wears the paid mark`);
    assert.ok(c.href, `${c.key}: no door`);
    assert.doesNotMatch(c.stateText, /₱|add for|price|buy|free|trial|payment/i, `${c.key}: "${c.stateText}"`);
    assert.deepEqual(c.parts, [], `${c.key}: a part is a door to a tool the event may not own`);
  }
  // The same input on the web still sells — the rule is the shell's alone.
  const web = buildOurServices(input({ owned: OWNS_TWO }));
  assert.ok(web.some((c) => c.state === 'price'), 'premise: the web input would have priced something');
});

test('(a) the More rows carry a name and a door — nothing a price or a buy button could hang on', () => {
  const rows = ourServicesMenuChildren(buildOurServices(input({ owned: OWNS_TWO, ownedOnly: true })));
  assert.equal(rows.length, 2);
  for (const r of rows) {
    assert.deepEqual(Object.keys(r).sort(), ['href', 'icon', 'key', 'label', 'sub']);
    assert.doesNotMatch(`${r.label} ${r.sub ?? ''}`, /₱|buy|price|activate|website|web/i);
  }
  // With owned services the app bar keeps More, and it holds exactly these.
  const bar = buildCustomerMenuTree(EVENT, { websiteEnabled: true, storeShell: true, services: rows });
  assert.equal(bar.length, 5);
  assert.ok(bar.some((m) => m.key === 'studio'), 'the app lost More although the event owns services');
  const studio = eventMenuRows(buildEventMenuSections(EVENT, { websiteEnabled: true, storeShell: true, services: rows }))
    .find((r) => r.key === 'studio');
  assert.deepEqual(studio?.children?.map((c) => c.key), ['papic', 'patiktok']);
});

test('(a) the sheet that draws them prints only a name and a sub-line — no price, buy or web wording', () => {
  const sheet = fs.readFileSync(path.join(EV, '_components', 'more-services-sheet.tsx'), 'utf8');
  // Strip comments: the file's prose may name things the JSX must not draw.
  const code = stripComments(sheet);
  assert.doesNotMatch(code, /₱|price|Buy|Activate|Add for|website|InlineCheckoutDrawer|\/orders|checkout/i);
  assert.match(code, /\{s\.label\}/, 'premise: the sheet no longer draws the row label');
});

/* ══ the door must open — what that means today ══════════════════════════ */

test('an owned service whose door the app refuses is NOT listed (today: every paid controller)', () => {
  const real = input({ owned: OWNS_TWO, ownedOnly: true, refusesPath: (p) => isStoreShellWebOnlyPath(p) });
  const listed = buildOurServices(real);
  for (const c of listed) {
    assert.equal(isStoreShellWebOnlyPath(c.href!.split('?')[0]!), false, `${c.key} opens "Not available in the app"`);
  }
  // ⚠ TODAY THIS IS EMPTY: middleware still sends /studio/papic and
  // /studio/patiktok to /web-only in the app (the 2026-09-05 3.1.3(b) gate).
  // When an owned controller is opened in the app, update this line.
  assert.deepEqual(listed.map((c) => c.key), []);
});

/* ══ (b) · nothing owned → no More tab, anywhere ══════════════════════════ */

test('(b) owning nothing, the app draws no More — not on the bar, the rail or the ☰ drawer', () => {
  const services = ourServicesMenuChildren(buildOurServices(input({ ownedOnly: true })));
  assert.deepEqual(services, [], 'premise: an event owning nothing still got rows');
  for (const phase of ['plan', 'dayof', 'after'] as const) {
    const ctx: CustomerMenuCtx = { phase, websiteEnabled: true, seatingEnabled: true, storeShell: true, services };
    assert.equal(buildCustomerMenuTree(EVENT, ctx).some((m) => m.key === 'studio'), false, `${phase}: bar`);
    assert.equal(eventMenuRows(buildEventMenuSections(EVENT, ctx)).some((r) => r.key === 'studio'), false, `${phase}: tree`);
    const railHrefs = buildCustomerNavGroups(EVENT, ctx).flatMap((g) => g.items.map((i) => i.href));
    assert.equal(railHrefs.some((h) => h.includes('more=services')), false, `${phase}: rail/☰`);
  }
});

/* ══ (c) · the web is unchanged ══════════════════════════════════════════ */

test('(c) the web keeps More and every card — even with nothing listed', () => {
  const web = buildOurServices(input({ owned: OWNS_TWO }));
  assert.deepEqual(web.map((c) => c.key), ['setnayan-ai', 'papic', 'live-studio', 'music-maker', 'patiktok']);
  assert.equal(web.find((c) => c.key === 'music-maker')?.state, 'pending');
  for (const services of [[], ourServicesMenuChildren(web)]) {
    const bar = buildCustomerMenuTree(EVENT, { websiteEnabled: true, services });
    assert.equal(bar.length, 5);
    assert.ok(bar.some((m) => m.key === 'studio'), 'the web lost More');
  }
});

/* ══ wiring ══════════════════════════════════════════════════════════════ */

test('wiring: the layout asks for owned-only in the app, and nowhere else', () => {
  const layout = fs.readFileSync(path.join(EV, 'layout.tsx'), 'utf8');
  assert.match(layout, /ownedOnly: storeShell,/);
  assert.match(layout, /refusesPath: \(p\) => storeShell && isStoreShellWebOnlyPath\(p\)/);
});
