/**
 * the-app-names-no-paid-service.test.ts — in the iPhone app (the store shell),
 * no page the app can open names a paid web extra, prices one, or links to the
 * More menu that would list them.
 *
 * ── WHAT SHIPPED (TestFlight build 5, 2026-10-21) ───────────────────────────
 * Event Details › Services read "Event Hub Pro · Not added" and "Setnayan AI ·
 * Not added" inside the app, the day build 5 went to App Review with notes
 * that say the digital extras are "not offered, priced, or advertised in the
 * app" and that a web extra unlocks nothing there (build-sessions/
 * SUBMIT-NOW-2026-10-21.md; guideline 3.1.1 / 3.1.3(b)). The same sweep found
 * "Open Services", "More Services" and "Back to add-ons" links that, with the
 * More menu gone from the app (#6725), only re-opened Home; the day-of
 * services with "Add" on the coordinator's Event Hub page; a "Settle a
 * payment" ask for a digital order on Home; and help topics about Papic and
 * Live Watch.
 *
 * ── WHAT THIS HOLDS — PROPERTIES, NOT THE OLD SENTENCES ─────────────────────
 *   1. The paid names are DERIVED, never listed: the label of every catalogue
 *      entry in `STORE_SHELL_HIDDEN_ADDON_KEYS` (lib/store-shell.ts — the ONE
 *      filter the app already uses for its menus and Home).
 *   2. RENDERED: the finished-event summary names none in the app, and keeps
 *      its More Services card on the web.
 *   3. MODEL: every help topic, title and answer the app shows names none.
 *   4. NET: the link guard hides every link to the More menu's address in the
 *      app (`storeShellHidesHref`), and no other Home link.
 *   5. WALKED: every app-reachable route file (found by walking app/, minus the
 *      routes `isStoreShellWebOnlyPath` refuses) — each paid name it draws and
 *      each More-menu link it builds sits inside an expression that asks the
 *      store shell (`storeShell`, `data-web-only`), or is listed below with its
 *      reason. A new "Papic" line on an app page fails here until it is gated.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { EVERY_ADD_ON } from './add-ons-catalog';
import { HELP_TOPICS, helpTopicsFor } from './help';
import { STORE_SHELL_HIDDEN_ADDON_KEYS, isStoreShellWebOnlyPath, storeShellHidesHref } from './store-shell';
import { MORE_SERVICES_PARAM, MORE_SERVICES_VALUE, studioHubHref } from './studio-hub';
import { stripComments } from './strip-comments';

// The repo's render harness: classic JSX runtime, so React is global before the component loads.
(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const E = '00000000-0000-4000-8000-000000000000';

/** 1 · The paid names — the catalogue labels of the one filter. */
const PAID_NAMES: string[] = [
  ...new Set(
    EVERY_ADD_ON.filter((a) => STORE_SHELL_HIDDEN_ADDON_KEYS.has(a.key)).flatMap((a) =>
      // "Event Hub PRO" is written "Event Hub Pro" in sentences — both spellings, still from the label.
      [a.label, a.label.replace(/\bPRO\b/, 'Pro')],
    ),
  ),
];
// Case-sensitive on purpose: a product NAME is capitalised; `'papic'` is a key, not a word on screen.
const PAID = new RegExp(`\\b(?:${PAID_NAMES.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\b`);
const MORE_ADDRESS = `${MORE_SERVICES_PARAM}=${MORE_SERVICES_VALUE}`;

test('1 · the paid names come from the one filter (premise)', () => {
  for (const must of ['Papic', 'Setnayan AI', 'Live Watch', 'Event Hub Pro', 'Music Maker', 'Patiktok']) {
    assert.ok(PAID.test(must), `"${must}" is not among the derived paid names (${PAID_NAMES.join(', ')}) — the anchor moved`);
  }
  assert.ok(!PAID.test('Event Hub'), 'the free Event Hub must not count as a paid name');
});

test('2 · RENDERED — the finished-event summary names no paid service in the app, and keeps its services card on the web', async () => {
  const { FinishedEventSummary } = await import('@/app/dashboard/[eventId]/_components/after/finished-event-summary');
  const summary = { guests: 180, guestsAttending: 152, checkedIn: 140, suppliers: 6, services: 2, photos: 1240, editorial: 'none', editorialMeasured: true } as const;
  const draw = (storeShell: boolean) =>
    renderToStaticMarkup(
      React.createElement(FinishedEventSummary, { eventId: E, noun: 'wedding', dateLabel: 'March 13, 2027', slug: 'ana-and-miguel', summary, storeShell }),
    );
  // More left the bar (owner 22 Oct 2026, "Yes remove more"): the web card is "Your services" and scrolls to
  // that list on the same page; the app draws neither.
  const web = draw(false);
  assert.match(web, /Your services/, 'premise: the web draws the services card');
  assert.ok(web.includes('#your-services'), 'premise: the web card opens Your services');
  const app = draw(true);
  assert.doesNotMatch(app, /Your services|More Services/, 'the app draws the services card');
  assert.ok(!app.includes('#your-services') && !app.includes(MORE_ADDRESS), 'the app links to the services, which it does not sell');
  assert.doesNotMatch(app, PAID, 'the app names a paid service');
});

test('3 · MODEL — every help topic, question and answer the app shows names no paid service', () => {
  const offenders: string[] = [];
  let read = 0;
  for (const t of helpTopicsFor(HELP_TOPICS, true)) {
    if (PAID.test(t.label)) offenders.push(`topic ${t.key}: "${t.label}"`);
    for (const a of t.articles) {
      read++;
      const m = PAID.exec(`${a.title}\n${a.body}`);
      if (m) offenders.push(`${t.key}/${a.slug}: "${m[0]}"`);
    }
  }
  assert.ok(read >= 40, `the app's help read only ${read} answers — the anchor moved`);
  assert.deepEqual(offenders, [], 'The app\'s help names a paid service. Give the article `appBody: HELP_NOT_IN_THE_APP` (or app words without it):\n  ' + offenders.join('\n  '));
  // Premise: the web still has them (so this is a filter, not an empty corpus).
  const web = helpTopicsFor(HELP_TOPICS, false);
  assert.ok(web.some((t) => t.articles.some((a) => PAID.test(`${a.title}\n${a.body}`))), 'premise: the web help names a paid service');
});

test('4 · NET — the link guard hides every link to the More menu in the app, and no other Home link', () => {
  const here = `https://www.setnayan.com/dashboard/${E}/details`;
  assert.equal(storeShellHidesHref(studioHubHref(E), here), true, 'the More menu address');
  assert.equal(storeShellHidesHref(`https://www.setnayan.com${studioHubHref(E)}`, here), true, 'absolute');
  assert.equal(storeShellHidesHref(`${studioHubHref(E)}&tab=x`, here), true, 'with another param');
  for (const href of [`/dashboard/${E}`, `/dashboard/${E}?tab=build`, `/dashboard/${E}/guests`, `/dashboard/${E}?more=other`]) {
    assert.equal(storeShellHidesHref(href, here), false, href);
  }
  assert.equal(storeShellHidesHref(`https://elsewhere.example${studioHubHref(E)}`, here), false, 'another origin');
});

// ─── 5 · WALKED ────────────────────────────────────────────────────────────────

/** The trees an app user can open. Refused routes inside them are skipped by `isStoreShellWebOnlyPath`. */
const ROOTS = ['app/dashboard/[eventId]', 'app/help', 'app/(shell)/help', 'app/dashboard/(account)/profile'];
const EXTRA_FILES = ['app/_components/frontdoor/front-door-shell.tsx'];

/**
 * 🧭 THE MAKER HAS ITS OWN MECHANISM, held elsewhere: every Pro mark routes
 * through `makerProMark` / `makerProUsable` (lib/paid-mark.ts), which answer
 * null for a non-Pro couple in the store shell, and Apply never asks for Pro
 * there (`hub-draft-bar.tsx`). Its literal " ◆" suffixes are an OPEN item
 * (PR body) — a product call, not a wording fix.
 */
const OWN_MECHANISM = [
  'app/dashboard/[eventId]/launch/_components/',
  'app/dashboard/[eventId]/website/editor/_components/',
  'app/dashboard/[eventId]/website/_components/',
  'app/dashboard/[eventId]/story/_components/editorial-editor.tsx',
];

/** Hits that are not an app user being shown a paid service, each with its reason. A stale entry fails. */
const NOT_SHOWN = new Map<string, string>([
  ['app/dashboard/[eventId]/monogram/page.tsx', 'the page\'s <title> metadata (the free monogram design page shares the word), and the Logo & QR checkout name, built only under `!ownsAnimated && !storeShell` (2026-10-22)'],
  ['app/dashboard/[eventId]/monogram/animated-monogram-upgrade.tsx', 'the Logo & QR part\'s checkout names (2026-10-22); the component is mounted only by monogram/page.tsx as `!storeShell && ownsAnimated ? <AnimatedMonogramUpgrade …/> : null` — never in the app'],
  ['app/dashboard/[eventId]/vendors/_components/merkado-guard-banner.tsx', 'mounted only when `aiActive`, which is `storeShellAllowsPaidFeature`-gated (the owner\'s free-feature rule)'],
  ['app/dashboard/[eventId]/studio/save-the-date/_components/StdBuilderClient.tsx', 'the Pro refusal notes appear only after an Event Hub Pro effect is picked; the picker offers none in the app (`storeShell` reaches it as `sellsOpenings`/price null) — OPEN: walk on TestFlight'],
  ['app/dashboard/[eventId]/story/_components/make-it-yours.tsx', 'the Story editor\'s Papic empty line — OPEN (PR body), the editorial page is a post-event surface'],
  ['app/dashboard/[eventId]/website/hero-photo/page.tsx', '`description` of WebsiteProLock, which in the app renders only "not included in the app" (website-pro-lock.tsx)'],
  ['app/dashboard/[eventId]/website/living-hero/page.tsx', 'same — WebsiteProLock description'],
  ['app/dashboard/[eventId]/website/site-chrome/page.tsx', 'same — WebsiteProLock description'],
  ['app/dashboard/[eventId]/website/widgets/page.tsx', 'the Pro mark comes from `paidMarkState({ owns, storeShell })`, null for a non-Pro couple in the app'],
  ['app/dashboard/[eventId]/_components/papic-home-card.tsx', 'the Home Papic widget (owner 2026-10-23) is drawn only from `papicCard`, built only `&& !appleFacts && !storeShell` (app/dashboard/[eventId]/page.tsx) — the app keeps its own Papic row'],
  ['app/dashboard/[eventId]/_components/papic-ready-nudge.tsx', 'mounted only `&& !storeShell` (app/dashboard/[eventId]/page.tsx)'],
  ['app/dashboard/[eventId]/_components/setnayan-ai-comeback-offer.tsx', 'mounted only `aiOffer && aiOfferSettings && !storeShell` (app/dashboard/[eventId]/page.tsx)'],
  ['app/dashboard/[eventId]/_components/reveal-preview-card.tsx', 'used by Save the Date only, after an Event Hub Pro opening is picked — see StdBuilderClient'],
  ['app/dashboard/[eventId]/website/photo-moments/config.ts', 'the Papic-only hint is drawn only by photo-moments-editor.tsx, which shows app words under `data-app-only`'],
  ['app/dashboard/[eventId]/_components/event-dashboard.tsx', '"Setnayan AI · The Watch" is drawn only when `aiActive`, which is `storeShellAllowsPaidFeature`-gated (the owner\'s free-feature rule: off in the app while the paywall is on)'],
  ['app/dashboard/[eventId]/studio/save-the-date/page.tsx', 'the "part of Event Hub PRO" upsell is the last arm of `) : storeShell ? null : sellable ? (…) : (…)` — a chained ternary this scan does not follow'],
  ['app/dashboard/(account)/profile/concierge/page.tsx', '`notFound()` while CONCIERGE_ENABLED, which lib/concierge.ts holds permanently false'],
  ['app/dashboard/(account)/profile/page.tsx', 'the Setnayan AI rows sit under CONCIERGE_ENABLED (permanently false); the face-profile line under NEXT_PUBLIC_ACCOUNT_FACE_PROFILE_ENABLED (off) — OPEN if either flips'],
]);

/** More-menu links the link guard alone hides (no server gate), each with its reason. */
const MORE_NET_ONLY = new Map<string, string>([
  ['app/dashboard/[eventId]/documents/page.tsx', 'the empty creations CTA "Browse add-ons" — the link guard hides it'],
]);

function walk(dir: string, acc: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const n of names) {
    if (n === 'node_modules' || n === '.next') continue;
    const f = join(dir, n);
    if (statSync(f).isDirectory()) walk(f, acc);
    else if (/\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n)) acc.push(f);
  }
  return acc;
}

/** The URL a route file serves (private folders, groups and slots end it; `[eventId]` → a sample id). */
function routeOf(rel: string): string {
  const segs: string[] = [];
  for (const p of rel.replace(/^app\//, '').split('/').slice(0, -1)) {
    if (p.startsWith('_') || p.startsWith('@')) break;
    if (p.startsWith('(')) continue;
    segs.push(p === '[eventId]' ? E : p);
  }
  return '/' + segs.join('/');
}

/**
 * Does the expression that draws `at` ask the store shell? Walks out through the
 * innermost four enclosing `(` / `{` / `[`, and for each reads only ITS OWN condition —
 * the text back to the previous `{ } ; >` (so `{storeShell ? null : (`,
 * `if (x && !storeShell) {`, `open={storeShell ? null : {`) — plus, for the
 * innermost, the text from it to the hit (`storeShell ? a : studioHubHref(…)`).
 * A word wrapped in an element marked `data-web-only` counts too. Reading the
 * whole stretch to a far-out opener would find any `storeShell` in the file —
 * the sabotage runs (work/sabotage.sh) are what keep this narrow.
 */
const ASKS = /(?<![\w.])!?storeShell\b(?!\s*=(?!=))|\.storeShell\b|data-web-only/;
function conditionBefore(src: string, i: number): string {
  let j = i - 1;
  // `>` ends a tag (`">`, `}>`, `div>`), never a comparison (`a > 0`) or an arrow (`=>`).
  const ends = (k: number) => '{};'.includes(src[k]!) || (src[k] === '>' && k > 0 && !/[\s=]/.test(src[k - 1]!));
  while (j >= 0 && i - j < 300 && !ends(j)) j--;
  return src.slice(j + 1, i + 1);
}
function askedAround(src: string, at: number): boolean {
  const tagStart = src.lastIndexOf('<', at);
  if (tagStart >= 0 && /data-web-only/.test(src.slice(tagStart, at)) && !src.slice(tagStart, at).includes('</')) return true;
  const depth: Record<string, number> = { '(': 0, '{': 0, '[': 0 };
  const CLOSES: Record<string, string> = { ')': '(', '}': '{', ']': '[' };
  let openers = 0;
  for (let i = at - 1; i >= 0 && openers < 4; i--) {
    const c = src[i]!;
    if (c in CLOSES) depth[CLOSES[c]!]!++;
    else if (c in depth) {
      if (depth[c]! > 0) {
        depth[c]!--;
        continue;
      }
      openers++;
      if (ASKS.test(conditionBefore(src, i))) return true;
      if (openers === 1 && ASKS.test(src.slice(i, at))) return true;
    }
  }
  return false;
}

/** Visible words: JSX text and string literals (comments are stripped first). */
const WORDS = />([^<>{}]+)<|'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

function appFiles(): string[] {
  const all = ROOTS.flatMap((r) => walk(join(WEB, r))).concat(EXTRA_FILES.map((f) => join(WEB, f)));
  return all
    .map((f) => relative(WEB, f))
    .filter((rel) => !isStoreShellWebOnlyPath(routeOf(rel)))
    .filter((rel) => !/(?:^|\/)actions?\.ts$|-actions\.ts$|\/route\.ts$/.test(rel));
}

test('5 · WALKED — every paid name an app page draws is asked of the store shell (or listed with its reason)', () => {
  const files = appFiles();
  assert.ok(files.length >= 300, `walked only ${files.length} app-reachable files — the anchor moved`);
  const offenders: string[] = [];
  const used = new Set<string>();
  let hits = 0;
  for (const rel of files) {
    if (OWN_MECHANISM.some((p) => rel.startsWith(p))) continue;
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    for (const m of src.matchAll(WORDS)) {
      const text = m[1] ?? m[2] ?? m[3] ?? m[4] ?? '';
      const hit = PAID.exec(text);
      if (!hit) continue;
      // An import path, an href, a storage key or a stylesheet is not a word on screen.
      const t = text.trim();
      if ((/^[@./\w-]+$/.test(t) && !/\s/.test(t)) || /^(?:\/|\$\{)/.test(t) || /^[\w-]+:[\w-]+:/.test(t) || t.includes('var(--')) continue;
      hits++;
      if (askedAround(src, m.index!)) continue;
      if (NOT_SHOWN.has(rel)) {
        used.add(rel);
        continue;
      }
      const line = src.slice(0, m.index!).split('\n').length;
      offenders.push(`${rel}:${line} "${text.trim().slice(0, 80)}"`);
    }
  }
  console.log(`[app-names-no-paid] ${files.length} app files · ${hits} paid-name words · ${offenders.length} ungated`);
  assert.ok(hits >= 10, `found only ${hits} paid-name words — the scan is not reaching them`);
  assert.deepEqual(
    offenders,
    [],
    'An app page draws a paid service with nothing asking the store shell. Gate it (`storeShell ? null : …`, or `data-web-only`), or list it in NOT_SHOWN with a reason:\n  ' + offenders.join('\n  '),
  );
  for (const rel of NOT_SHOWN.keys()) assert.ok(used.has(rel), `NOT_SHOWN "${rel}" no longer needs its entry — drop it`);
});

test('5 · WALKED — every More-menu link an app page builds is asked of the store shell (or the net holds it, with a reason)', () => {
  const offenders: string[] = [];
  const used = new Set<string>();
  let calls = 0;
  for (const rel of appFiles()) {
    const src = stripComments(readFileSync(join(WEB, rel), 'utf8'));
    for (const m of src.matchAll(/\bstudioHubHref\(/g)) {
      calls++;
      if (askedAround(src, m.index!)) continue;
      if (MORE_NET_ONLY.has(rel)) {
        used.add(rel);
        continue;
      }
      offenders.push(`${rel}:${src.slice(0, m.index!).split('\n').length}`);
    }
  }
  assert.ok(calls >= 5, `found only ${calls} studioHubHref calls on app pages — the anchor moved`);
  assert.deepEqual(
    offenders,
    [],
    'An app page links to the More menu, which only re-opens Home in the app. Drop it in the store shell or point it at the page it came from:\n  ' + offenders.join('\n  '),
  );
  for (const rel of MORE_NET_ONLY.keys()) assert.ok(used.has(rel), `MORE_NET_ONLY "${rel}" no longer needs its entry — drop it`);
});
