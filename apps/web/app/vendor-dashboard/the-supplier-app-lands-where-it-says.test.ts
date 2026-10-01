/**
 * THE SUPPLIER PHONE APP LANDS WHERE IT SAYS — audit of #6229, 2026-10-02.
 *
 * Four defects on the live supplier app, each guarded here by a check that can
 * fail (every one was sabotaged once — see the PR body).
 *
 *  1 · WRONG LANDINGS. More's Messages / Earnings & payday rows, Today's
 *      "owed to you" tile and the Payday / Send-quote / Send-contract Next
 *      buttons linked the old redirect stubs, which reloaded My Customers at the
 *      TOP (the roster). They now name their own fold through the anchors module
 *      (`customers/anchors.ts`) — and so do the stubs, for every old link, email
 *      and notification that still hits them.
 *  2 · "RUN THE DAY" WAS MISSING BEFORE 8 AM MANILA. `todayManila()` was the
 *      SERVER's midnight (UTC). Between 00:00 and 08:00 in Manila an event that
 *      very morning read as tomorrow.
 *  3 · WORDING. A booking ask is "Agree to this booking" / "Agree" (approved
 *      prototype), not "Answer" / "wants to book you".
 *  4 · "VENDOR" IN VISIBLE COPY. The supplier's words are "supplier"; and the
 *      Today page still said "Accept to see who they are" and headed every
 *      inquiry "New customer", though anonymisation was retired 2026-09-08.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  CUSTOMER_LANDINGS,
  customerLandingHref,
  type CustomerLanding,
} from './customers/anchors';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const LANDINGS = Object.keys(CUSTOMER_LANDINGS) as CustomerLanding[];
const STUBS = ['messages', 'payday', 'proposals', 'contracts'] as const;
/** The bare stub paths — a link that is exactly one of these drops you on the roster. */
const BARE_STUB = /^\/vendor-dashboard\/(messages|payday|proposals|contracts)$/;

// ── 1 · LANDINGS ───────────────────────────────────────────────────────────

test('1a · each landing resolves to an open fold + a fragment the hub really renders', () => {
  const hub = read('app/vendor-dashboard/customers/page.tsx');
  assert.ok(hub.length > 5000, 'read the real hub (an empty read is a green lie)');
  const folds = new Set([...hub.matchAll(/\bkey: '(\w+)',\s*\n\s*label:/g)].map((m) => m[1]));
  assert.ok(folds.has('messages') && folds.has('proposals') && folds.has('contracts'), `hub folds not found: ${[...folds]}`);
  for (const key of LANDINGS) {
    const { fold, anchor } = CUSTOMER_LANDINGS[key];
    const href = customerLandingHref(key);
    assert.match(href, /^\/vendor-dashboard\/customers[?#]/, `${key}: not the hub — ${href}`);
    assert.ok(href.endsWith(anchor), `${key}: ${href} has no fragment ${anchor}`);
    const n = [...hub.matchAll(new RegExp(`\\bid="${anchor.slice(1)}"`, 'g'))].length;
    assert.equal(n, 1, `${key}: the hub must render id="${anchor.slice(1)}" once — found ${n}`);
    if (fold) {
      assert.ok(folds.has(fold), `${key}: "${fold}" is not a fold on the hub`);
      assert.ok(href.includes(`?open=${fold}`), `${key}: ${href} does not open the fold`);
    } else {
      assert.equal(href.includes('open='), false, `${key}: payday is always on the page, not a fold`);
    }
  }
  // The exact targets the owner named.
  assert.equal(customerLandingHref('messages'), '/vendor-dashboard/customers?open=messages#customer-tools');
  assert.equal(customerLandingHref('proposals'), '/vendor-dashboard/customers?open=proposals#customer-tools');
  assert.equal(customerLandingHref('contracts'), '/vendor-dashboard/customers?open=contracts#customer-tools');
  assert.equal(customerLandingHref('payday'), '/vendor-dashboard/customers#payday');
});

test('1b · every More row lands on its section — none is a bare stub', async () => {
  const { VENDOR_MORE_ROWS } = await import('@/lib/vendor-more-rows');
  const by = Object.fromEntries(VENDOR_MORE_ROWS.map((r) => [r.key, r.href]));
  assert.equal(by.messages, customerLandingHref('messages'));
  assert.equal(by.payday, customerLandingHref('payday'));
  for (const r of VENDOR_MORE_ROWS) {
    assert.doesNotMatch(r.href, BARE_STUB, `More row "${r.label}" links a bare stub (${r.href}) and lands on the roster`);
  }
});

async function renderToday(target: unknown, action = 'Go'): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayFirstScreen } = await import('./_components/supplier-today-first-screen');
  return renderToStaticMarkup(
    React.createElement(SupplierTodayFirstScreen, {
      cover: { eyebrow: 'Photo & video · Live', name: 'Shop' },
      next: { kind: 'answer', title: 'T', body: 'B', action, target } as never,
      numbers: { inquiries: '1', thisWeek: '2', owed: '3' },
      comingUp: [],
    }),
  );
}
const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));

test('1c · the Next card’s Send quote / Send contract / Payday buttons land on their fold', async () => {
  for (const [to, key] of [['proposals', 'proposals'], ['contracts', 'contracts'], ['payday', 'payday']] as const) {
    const html = await renderToday({ to });
    const next = html.slice(html.indexOf('data-today-next'));
    const first = hrefs(next)[0];
    assert.equal(first, customerLandingHref(key), `Next → ${to} lands at ${first}`);
    assert.doesNotMatch(first!, BARE_STUB);
  }
});

test('1d · the "owed to you" tile lands on payday, in view', async () => {
  const html = await renderToday({ to: 'today' });
  const tiles = html.slice(html.indexOf('data-today-numbers'), html.indexOf('data-today-coming-up'));
  const owed = tiles.match(/<a [^>]*href="([^"]+)"[^>]*>(?:(?!<\/a>).)*owed to you/s);
  assert.ok(owed, 'the owed-to-you tile did not render as a link');
  assert.equal(owed[1], customerLandingHref('payday'));
});

test('1e · the redirect stubs name their fold too (old links, emails, notifications)', async () => {
  for (const key of STUBS) {
    const mod = await import(`./${key}/page`);
    let url = '';
    try {
      await mod.default({ searchParams: Promise.resolve({}) });
    } catch (e) {
      // next/navigation's redirect throws; the digest carries the target.
      url = String((e as { digest?: string }).digest ?? '').split(';')[2] ?? '';
    }
    assert.match(url, /^\/vendor-dashboard\/customers\?tab=/, `${key} stub did not redirect to the hub: ${url}`);
    assert.ok(url.endsWith(CUSTOMER_LANDINGS[key].anchor), `${key} stub drops the user at the top of the roster: ${url}`);
  }
});

test('1f · every redirect stub is still linked or reachable, so none is dead code', () => {
  // A stub may be deleted only when nothing links it AND no email/QR/old link can
  // hit it. These four are written into notifications, emails (`build-requote-nudge`)
  // and the route registry, so they stay — this pins the reason.
  const reg = read('lib/routes.ts') + read('lib/nav-registry-defaults.ts');
  for (const key of STUBS) {
    assert.ok(reg.includes(`/vendor-dashboard/${key}`), `${key} is no longer in the route/nav registry — re-check before keeping its stub`);
  }
});

// ── 2 · MANILA'S DAY ───────────────────────────────────────────────────────

test('2 · todayManila is the Manila calendar day, whatever the server clock says', async () => {
  const { todayManila } = await import('@/lib/vendor-overview');
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // 23:30Z on Oct 3 is 07:30 on Oct 4 in Manila — the case the server's own midnight got wrong.
  assert.equal(ymd(todayManila(new Date('2026-10-03T23:30:00Z'))), '2026-10-04');
  // 15:59Z is still the 3rd in Manila; 16:00Z is the 4th — the boundary is Manila midnight.
  assert.equal(ymd(todayManila(new Date('2026-10-03T15:59:00Z'))), '2026-10-03');
  assert.equal(ymd(todayManila(new Date('2026-10-03T16:00:00Z'))), '2026-10-04');
  // And it is a midnight, so an event dated that day is 0 days away, not -1 / 1.
  const t = todayManila(new Date('2026-10-03T23:30:00Z'));
  assert.equal(Math.round((new Date('2026-10-04T00:00:00').getTime() - t.getTime()) / 86_400_000), 0);
});

test('2b · the old server-clock midnight is gone from vendor-overview', () => {
  assert.doesNotMatch(read('lib/vendor-overview.ts'), /setHours\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/);
});

// ── 3 · WORDING ────────────────────────────────────────────────────────────

test('3 · a booking ask says "Agree to this booking" with the button "Agree"', async () => {
  const { answerNext } = await import('@/lib/supplier-today');
  const card = { kind: 'lock_request', coupleName: 'Mendoza', eventId: 'e1', eventDate: '2026-11-21' } as never;
  const n = answerNext(card, null, Date.now());
  assert.equal(n.title, 'Agree to this booking');
  assert.equal(n.action, 'Agree');
  assert.match(n.body, /Mendoza/, 'the card must still say whose booking');
  assert.deepEqual(n.target, { to: 'card', eventId: 'e1', tab: 'details' }, 'where it leads is unchanged');
  const roster = read('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  assert.match(roster, /booking_ask'\) return 'Agree'/, 'the roster row button is not "Agree"');
  assert.doesNotMatch(roster, /Wants to book you/);
});

// ── 4 · "VENDOR" IN VISIBLE COPY ───────────────────────────────────────────

/** Prose a person can read: quoted strings with a space + JSX text nodes. Identifiers, routes, keys excluded. */
function visibleProse(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\\n])*)\1|>([^<>{}\n][^<>{}]*)</g)) {
    const t = (m[2] ?? m[3] ?? '').trim();
    if (/\s/.test(t) && !/[/_]|=/.test(t)) out.push(t);
  }
  return out;
}
const VISIBLE_FILES = [
  'app/vendor-dashboard/page.tsx',
  'app/vendor-dashboard/more/page.tsx',
  'app/vendor-dashboard/customers/page.tsx',
  'app/vendor-dashboard/shop/page.tsx',
  'lib/vendor-more-rows.ts',
  'lib/supplier-today.ts',
  'app/vendor-dashboard/_components/supplier-today-first-screen.tsx',
  'app/vendor-dashboard/customers/_components/customers-roster.tsx',
];

test('4a · no visible copy on the supplier app’s pages says "vendor"', () => {
  for (const f of VISIBLE_FILES) {
    const src = read(f);
    assert.ok(src.length > 500, `${f}: empty read`);
    const bad = visibleProse(src).filter((t) => /\bvendors?\b/i.test(t));
    assert.deepEqual(bad, [], `${f} says "vendor" to a supplier: ${JSON.stringify(bad)}`);
  }
});

test('4b · the tab titles are the bar’s words · Setnayan', () => {
  const want: Record<string, string> = {
    'app/vendor-dashboard/page.tsx': 'Today · Setnayan',
    'app/vendor-dashboard/customers/page.tsx': 'Customers · Setnayan',
    'app/vendor-dashboard/shop/page.tsx': 'Shop · Setnayan',
    'app/vendor-dashboard/more/page.tsx': 'More · Setnayan',
  };
  for (const [f, title] of Object.entries(want)) {
    assert.match(read(f), new RegExp(`metadata = \\{ title: '${title}'`), `${f} title is not "${title}"`);
  }
});

test('4c · Today no longer says "Accept to see who they are"', async () => {
  // The page note is a literal in the (very large, async) Today page, so it is
  // read from its stripped source; the card it sat above is RENDERED below.
  assert.doesNotMatch(read('app/vendor-dashboard/page.tsx'), /Accept to see who they are/);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { WhatsNewFeed } = await import('./_components/overview-sections');
  const noop = () => {};
  const html = renderToStaticMarkup(
    React.createElement(WhatsNewFeed, {
      cards: [
        {
          kind: 'inquiry',
          id: 'inq-t1',
          threadId: 't1',
          title: 'New inquiry — New customer',
          descriptor: 'Cale & Ice',
          eventDate: '2026-12-20',
          place: null,
          category: 'Photography',
          paxAtInquiry: 120,
          messageExcerpt: null,
          createdAt: '2026-10-01T00:00:00Z',
        },
      ],
      acceptInquiry: noop,
      declineInquiry: noop,
      confirmLock: noop,
      rejectLock: noop,
      agreeLock: noop,
      declineLock: noop,
      agreeDeletion: noop,
      declineDeletion: noop,
      postReviewReply: noop,
      respondMeeting: noop,
      markServiceComplete: noop,
      payoutReadiness: 'unreadable',
      feeForecasts: {},
    } as never),
  );
  assert.match(html, /Cale &amp; Ice/, `the inquiry card did not render the name: ${html.slice(0, 400)}`);
  assert.doesNotMatch(html, /New customer/, 'the inquiry card is headed "New customer" over the real name');
  assert.doesNotMatch(html, /Accept to see who they are/);
});
