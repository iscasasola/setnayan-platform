#!/usr/bin/env tsx
/**
 * THE 8 CHECKER AREAS — every page a person can open, in exactly one area, taken from the shipped maps (never typed):
 *   · apps/web/lib/ugat/screens.generated.json  — every screen outside /admin (the Ugat map);
 *   · apps/web/lib/admin-map/admin-routes.generated.ts — every /admin destination (the admin map).
 * A page is assigned by the FIRST rule below that matches it, and every map area has a fallback, so a page added
 * tomorrow still lands somewhere — no page is missed. Builder labs (/dev/*, /demo-capture) are listed apart: they
 * draw sample data for builders and are not a person's page.
 *
 * Held by apps/web/lib/staging-kit.test.ts: every route lands in exactly one bucket, every area has routes, every
 * rule still matches a real route (a renamed page cannot leave a dead rule behind), and labs hold only labs.
 *
 * CLI (repo root):
 *   pnpm exec tsx scripts/staging/areas.ts              # counts per area
 *   pnpm exec tsx scripts/staging/areas.ts --area 6     # area 6's routes, today
 *   pnpm exec tsx scripts/staging/areas.ts --markdown   # every area's list, as the kit doc prints it
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_ROUTES } from '../../apps/web/lib/admin-map/admin-routes.generated';
import type { StagingAccountKey } from './accounts';

export type AreaId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Bucket = AreaId | 'labs';

export const CHECK_AREAS: ReadonlyArray<{ id: AreaId; title: string; account: StagingAccountKey }> = [
  { id: 1, title: 'Front door & public pages (signed out)', account: 'front' },
  { id: 2, title: 'Couple — create an event and plan it', account: 'couple_plan' },
  { id: 3, title: 'Couple — Maker, Event Hub page, invitations, Papic, Memories', account: 'couple_maker' },
  { id: 4, title: 'Guest — the Event Hub, the pass, the camera', account: 'guest' },
  { id: 5, title: 'Supplier — shop, cards, Toolkit, plans', account: 'supplier_shop' },
  { id: 6, title: 'Supplier — bookings, chat, payments, calendar', account: 'supplier_bookings' },
  { id: 7, title: 'Coordinator, Spaces & venue, maps', account: 'coordinator' },
  { id: 8, title: 'Admin', account: 'admin' },
];

export type Screen = { route: string; area: string; redirectsTo: string | null };

/** The ordered rules. `area` narrows a rule to one map area; the first match wins. */
export const AREA_RULES: ReadonlyArray<{ to: Bucket; area?: string; re: RegExp; why: string }> = [
  { to: 'labs', area: 'internal', re: /^\/(dev|demo-capture)(\/|$)/, why: 'builder labs: sample data, not a person’s page' },
  { to: 7, re: /^\/vendor-dashboard\/spaces(\/|$)/, why: 'Spaces (halls, rooms, rentables)' },
  { to: 7, re: /^\/dashboard\/\[eventId\]\/plan3d(\/|$)/, why: 'the 3D plan' },
  { to: 7, re: /^\/\[slug\]\/venue(\/|$)/, why: 'the guest’s venue walk (map)' },
  { to: 7, re: /^\/(pa3d|3d_plan)(\/|$)/, why: 'the 3D plan’s public doors' },
  { to: 7, re: /^\/for-coordinators(\/|$)/, why: 'the coordinator front door' },
  { to: 7, re: /\/venue-check(\/|$)/, why: 'the venue check' },
  { to: 7, re: /^\/vendor-dashboard\/clients\/\[eventId\]\/seat-plan(\/|$)/, why: 'the supplier’s seat-plan view' },
  { to: 7, re: /^\/dashboard\/\[eventId\]\/vendors\/\[vendorId\]\/workspace(\/|$)/, why: 'the shared workspace with a booked supplier' },
  { to: 1, area: 'onboarding', re: /^\/(login|signup|forgot-password|reset-password)(\/|$)/, why: 'sign-in pages' },
  {
    to: 3,
    area: 'host',
    re: /^\/dashboard\/\[eventId\]\/(website|invitation|monogram|studio|memories|galleries|story|prints|launch|live|event-qr|alaala|pabuya|apple-pro|event-page|guests\/(invite|send))(\/|$)/,
    why: 'Maker, Event Hub page, invitations, Papic, Memories, E-Gifts',
  },
  { to: 3, area: 'host', re: /^\/(site-editor|panood)\//, why: 'the page editor and the live studio' },
  { to: 3, area: 'host', re: /^\/dashboard\/(library|life-flash|creator)(\/|$)/, why: 'the couple’s library and creator tools' },
  { to: 2, area: 'guest', re: /^\/(pay|receipts)\//, why: 'the couple paying Setnayan, and its receipts' },
  {
    to: 6,
    area: 'supplier',
    re: /^\/vendor-dashboard\/(bookings|clients|messages|calendar|contracts|booking-fees|earnings|payday|payment-options|proposals|customers|disputes|notifications|on-the-day|events|recaps|locked-qr|manpower|demand)(\/|$)/,
    why: 'bookings, chat, payments, calendar',
  },
  { to: 6, area: 'supplier', re: /^\/vendor\/lock\//, why: 'the booking lock link' },
  // ── fallbacks: every map area lands somewhere ────────────────────────────────────────────────────────────────
  { to: 1, area: 'public', re: /^\//, why: 'public pages' },
  { to: 2, area: 'onboarding', re: /^\//, why: 'create an event' },
  { to: 2, area: 'host', re: /^\//, why: 'the couple’s planning pages' },
  { to: 4, area: 'guest', re: /^\//, why: 'guest pages' },
  { to: 5, area: 'supplier', re: /^\//, why: 'the supplier’s shop pages' },
  { to: 8, area: 'internal', re: /^\//, why: 'internal pages' },
  { to: 8, area: 'admin', re: /^\//, why: 'the admin console' },
];

/** The bucket a screen belongs to — the first rule that matches. Throws for a map area no rule knows. */
export function bucketOf(s: Screen): Bucket {
  const rule = AREA_RULES.find((r) => (!r.area || r.area === s.area) && r.re.test(s.route));
  if (!rule) throw new Error(`areas: no rule for ${s.route} (map area "${s.area}") — add one`);
  return rule.to;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Every route from both shipped maps, with the map area it carries (admin routes: 'admin'). */
export function shippedScreens(): Screen[] {
  const map = JSON.parse(fs.readFileSync(path.resolve(HERE, '../../apps/web/lib/ugat/screens.generated.json'), 'utf8')) as {
    screens: Array<{ route: string; area: string; redirectsTo: string | null }>;
  };
  const screens: Screen[] = map.screens.map((s) => ({ route: s.route, area: s.area, redirectsTo: s.redirectsTo ?? null }));
  for (const a of ADMIN_ROUTES) screens.push({ route: a.path, area: 'admin', redirectsTo: a.redirectsTo ?? null });
  return screens;
}

export function areaLists(screens: readonly Screen[]): Map<Bucket, Screen[]> {
  const out = new Map<Bucket, Screen[]>();
  for (const s of screens) {
    const b = bucketOf(s);
    out.set(b, [...(out.get(b) ?? []), s]);
  }
  for (const list of out.values()) list.sort((a, b) => a.route.localeCompare(b.route));
  return out;
}

/** One area's list as the kit doc prints it: pages first, then the forwards (each must land where it says). */
export function renderArea(id: Bucket, list: readonly Screen[]): string {
  const pages = list.filter((s) => !s.redirectsTo).map((s) => `\`${s.route}\``);
  const forwards = list.filter((s) => s.redirectsTo).map((s) => `\`${s.route}\` → \`${s.redirectsTo}\``);
  const head = id === 'labs' ? 'Labs (not checked)' : `Area ${id}`;
  const n = (k: number, word: string) => `${k} ${word}${k === 1 ? '' : 's'}`;
  return [`**${head} — ${n(pages.length, 'page')}${forwards.length ? `, ${n(forwards.length, 'forward')}` : ''}.**`, pages.join(' · '), forwards.length ? `Forwards (check each lands): ${forwards.join(' · ')}` : '']
    .filter(Boolean)
    .join('\n\n');
}

function main(): void {
  const args = process.argv.slice(2);
  const lists = areaLists(shippedScreens());
  const pick = args.indexOf('--area');
  if (pick > -1) {
    const id = Number(args[pick + 1]) as AreaId;
    for (const s of lists.get(id) ?? []) console.log(s.redirectsTo ? `${s.route} → ${s.redirectsTo}` : s.route);
    return;
  }
  if (args.includes('--markdown')) {
    for (const a of CHECK_AREAS) console.log(`${renderArea(a.id, lists.get(a.id) ?? [])}\n`);
    console.log(renderArea('labs', lists.get('labs') ?? []));
    return;
  }
  for (const a of CHECK_AREAS) console.log(`area ${a.id}  ${String(lists.get(a.id)?.length ?? 0).padStart(4)}  ${a.title}  (sign in as ${a.account})`);
  console.log(`labs    ${String(lists.get('labs')?.length ?? 0).padStart(4)}  builder labs — not checked`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
