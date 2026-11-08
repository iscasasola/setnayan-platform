/**
 * a-client-open-draws-the-thread-once.test.ts — ONE CLIENT OPEN, ONE THREAD DRAW (Build 2 · lane D, 8 Nov 2026).
 *
 * ⚠ THE BUILD-1 BUG THIS HOLDS. A picked client's page builds EVERY body on each request (`pickedPageBodies`), and
 * BOTH the Chat body and the Quotation body render the shipped thread page (`SupplierThreadBody`). So every open of a
 * client ran the whole thread page TWICE — two full batched reads — whichever page was on screen. Row #42 then asked
 * Details to show the Decisions too, which done naively is a THIRD draw.
 *
 * Measured here against the REAL code — the real `pickedPageBodies`, the real Chat · Quotation · Details bodies, the
 * real 2,100-line thread page — in a DUMMY env: `NEXT_PUBLIC_SUPABASE_URL=http://db.test`, `fetch` answered and
 * COUNTED, `next/headers` stubbed. Nothing leaves the process; no `.env.local` is read.
 *
 * One "open" = what React does for the client page: every body that is a server component is rendered, inside ONE
 * render scope (`withRenderScopeForTest`, the stand-in `lib/request-once.ts` provides for a request).
 *
 *   1 · one open reads the thread row ONCE (one draw), whichever page is shown;
 *   2 · one open writes the read marker (`markThreadRead`) at most ONCE;
 *   3 · Details' Decisions add ZERO requests — the open costs exactly what Chat + Quotation alone cost;
 *   4 · two opens are two draws (the memory is per render, never across requests);
 *   5 · the Details decisions body holds no read of its own (no client, no fetcher) — it only mounts the embed.
 *
 * Sabotages seen red (each restored, numbers in build-notes/supplier-build2-d.md): the embed draw un-shared (1, 3
 * red) · Details' list fed by its own `vendor_proposals` read (3, 5 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import * as React from 'react';
import { isValidElement, Suspense, Fragment, type ReactElement, type ReactNode } from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage = AsyncLocalStorage;
// The repo's TSX compiles to `React.createElement` under tsx (classic runtime).
(globalThis as { React?: unknown }).React = React;
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://db.test';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key-0123456789abcdef';

const USER = '00000000-0000-4000-8000-0000000000b1';
const VENDOR = '00000000-0000-4000-8000-0000000000c1';
const EVENT = '00000000-0000-4000-8000-0000000000e1';
const THREAD = '00000000-0000-4000-8000-0000000000d1';

// ── the cookie jar `next/headers` hands every reader: one signed-in supplier ──────────────────────────────────────
const now = Math.floor(Date.now() / 1000);
const jar = new Map<string, string>([
  [
    'sb-db-auth-token',
    JSON.stringify({
      access_token: 'header.payload.signature',
      token_type: 'bearer',
      expires_in: 3600,
      expires_at: now + 3600,
      refresh_token: 'refresh-token',
      user: { id: USER, aud: 'authenticated', role: 'authenticated' },
    }),
  ],
]);
/** The request's one session client (see the `lib/supabase/server` stand-in below); reset per open. */
let perOpenClient: Promise<unknown> | undefined;
const store = {
  get: (name: string) => (jar.has(name) ? { name, value: jar.get(name)! } : undefined),
  getAll: () => [...jar].map(([name, value]) => ({ name, value })),
  has: (name: string) => jar.has(name),
  set: () => undefined,
  delete: () => undefined,
};
{
  const Module = require('node:module') as { _load: (request: string, ...rest: unknown[]) => unknown };
  const real = Module._load;
  Module._load = function (request: string, ...rest: unknown[]) {
    if (request === 'next/headers') return { cookies: async () => store, headers: async () => new Headers(), draftMode: async () => ({ isEnabled: false }) };
    if (request === 'server-only') return {};
    // A CSS module is a class-name map to the code that reads it; node cannot parse the file.
    if (request.endsWith('.css')) return new Proxy({}, { get: (_t, k) => (k === '__esModule' ? false : String(k)) });
    if (/(^|\/)lib\/supabase\/server(\.ts)?$/.test(request)) {
      // `createClient` is React-`cache()`d: ONE session client per request (lib/supabase/server.ts). Plain node's
      // `cache()` never memoizes, so the stand-in keeps that contract — one client per open, a new one per open.
      const mod = real.call(this, request, ...rest) as { createClient: () => Promise<unknown> };
      return {
        ...mod,
        createClient: () => (perOpenClient ??= mod.createClient()),
      };
    }
    if (request === 'next/server') {
      const mod = real.call(this, request, ...rest) as Record<string, unknown>;
      // `after()` needs a request; the open's work is what is measured, so a scheduled after-task is dropped.
      return { ...mod, after: () => undefined };
    }
    return real.call(this, request, ...rest);
  };
}

// ── the dummy database: every request answered and counted ─────────────────────────────────────────────────────────
const ROWS: Record<string, unknown[]> = {
  vendor_profiles: [
    {
      vendor_profile_id: VENDOR,
      user_id: USER,
      business_name: 'Lab Studio',
      services: ['photography'],
      verification_tier: 'verified',
    },
  ],
  get vendor_profiles_self() {
    return ROWS.vendor_profiles;
  },
  chat_threads: [
    {
      thread_id: THREAD,
      event_id: EVENT,
      vendor_profile_id: VENDOR,
      inquiry_status: 'accepted',
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-11-01T00:00:00Z',
      created_by_user_id: USER,
      pax_at_inquiry: 120,
    },
  ],
  vendor_org_members: [{ vendor_profile_id: VENDOR, user_id: USER, role: 'owner' }],
};
/** A table the dummy database refuses (RLS-style 401), to prove a refused read is SAID. */
let refuse = new Set<string>();
let requests: Array<{ method: string; path: string; search: string }> = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input instanceof Request ? input.url : input));
  if (url.host !== 'db.test') return realFetch(input as RequestInfo, init);
  const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
  requests.push({ method, path: url.pathname, search: decodeURIComponent(url.search) });
  if (process.env.B2D_DEBUG) console.log('REQ', method, url.pathname + url.search, JSON.stringify(Object.fromEntries(new Headers(init?.headers ?? {}))).slice(0,200));
  const json = (body: unknown, status = 200) => {
    const n = Array.isArray(body) ? body.length : 1;
    // PostgREST's count travels in Content-Range; a paged reader stops when it has the server's count.
    const range = n === 0 ? '*/0' : `0-${n - 1}/${n}`;
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'content-range': range } });
  };
  if (url.pathname === '/auth/v1/user') return json({ id: USER, aud: 'authenticated', role: 'authenticated', email: 'lab@example.test' });
  if (url.pathname.startsWith('/rest/v1/rpc/')) return json(null);
  const table = url.pathname.replace('/rest/v1/', '');
  if (method !== 'GET' && method !== 'HEAD') return json([]);
  if (refuse.has(table)) return json({ code: '42501', message: `permission denied for table ${table}` }, 401);
  const rows = ROWS[table] ?? [];
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if ((headers.get('accept') ?? '').includes('vnd.pgrst.object')) {
    return rows[0] ? json(rows[0]) : json({ code: 'PGRST116', message: 'no rows' }, 406);
  }
  return json(rows);
}) as typeof fetch;

const { withRenderScopeForTest } = require('@/lib/request-once') as typeof import('@/lib/request-once');
const { pickedPageBodies } = require('./_pages/switch') as typeof import('./_pages/switch');
const details = require('./_components/details-decisions') as Record<string, unknown>;
const { SupplierThreadBody } = require('@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body') as typeof import('@/app/vendor-dashboard/messages/[threadId]/_components/supplier-thread-body');
const VendorThreadPage = (require('@/app/vendor-dashboard/messages/[threadId]/page') as { default: unknown }).default;
const { ChatPage } = require('./_pages/chat') as typeof import('./_pages/chat');
const { QuotationPage } = require('./_pages/quotation') as typeof import('./_pages/quotation');
const { DetailsPage } = require('./_pages/details') as typeof import('./_pages/details');

/** Details' Decisions slot, as the client page mounts it (Build 2 #42) — absent before #42 (the door made no read). */
const DetailsDecisions = details.DetailsDecisions as ((p: { threadId: string | null; eventId: string }) => ReactNode) | undefined;

/**
 * React's server render, reduced to what it does for these bodies: every SERVER component on the way to the thread
 * page is called (and awaited); the thread page's own output is the end of the walk. Client components are not
 * server work and are not called.
 */
/** What the thread page handed back for each embed, in render order (Details · Chat · Quotation). */
let drawnOut: ReactNode[] = [];
const SERVER = new Set<unknown>([ChatPage, QuotationPage, DetailsPage, SupplierThreadBody, VendorThreadPage, ...(DetailsDecisions ? [DetailsDecisions] : [])]);
async function render(node: ReactNode): Promise<void> {
  if (Array.isArray(node)) {
    for (const n of node) await render(n);
    return;
  }
  if (!isValidElement(node)) return;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (el.type === Suspense || el.type === Fragment) return render(el.props.children);
  if (typeof el.type === 'function' && SERVER.has(el.type)) {
    const out = await (el.type as (p: unknown) => unknown)(el.props);
    if (el.type === VendorThreadPage) {
      drawnOut.push(out as ReactNode);
      return; // the drawn thread — its reads are what is counted
    }
    return render(out as ReactNode);
  }
}

const ctx = {
  eventId: EVENT,
  vendorProfileId: VENDOR,
  viewerUserId: USER,
  threadId: THREAD,
  eventName: 'Reyes & Santos wedding',
  stage: 'booked' as const,
  isBooked: true,
  feeUnlocked: true,
  eventVendorId: null,
  eventDate: '2026-12-12',
};

/** One open of the picked client: every body built, as `clients/[eventId]/page.tsx` builds them. */
async function openClient(opts: { withDetailsDecisions: boolean }) {
  requests = [];
  drawnOut = [];
  perOpenClient = undefined;
  const bodies = pickedPageBodies({
    ctx,
    shipped: {
      details: opts.withDetailsDecisions && DetailsDecisions ? DetailsDecisions({ threadId: THREAD, eventId: EVENT }) : null,
    },
    files: { files: [], chatFilesMeasured: true },
    payment: { reservationAcknowledgedAt: null },
  });
  await withRenderScopeForTest(async () => {
    for (const page of ['details', 'chat', 'quote'] as const) await render(bodies[page]);
  });
  // The thread page's first read is ITS thread row (`fetchThreadById`) — one per draw.
  const threadReads = requests.filter(
    (r) => r.method === 'GET' && r.path === '/rest/v1/chat_threads' && r.search.includes(`thread_id=eq.${THREAD}`),
  ).length;
  const markRead = requests.filter((r) => r.method === 'POST' && r.path === '/rest/v1/chat_thread_reads').length;
  return { total: requests.length, threadReads, markRead, requests: [...requests], drawn: [...drawnOut] };
}

function tally(rs: Array<{ method: string; path: string; search: string }>): string {
  const m = new Map<string, number>();
  for (const r of rs) m.set(`${r.method} ${r.path}`, (m.get(`${r.method} ${r.path}`) ?? 0) + 1);
  return [...m].map(([k, v]) => `${v}× ${k}`).join('\n');
}

test('1 · 2 · one client open draws the thread once and marks it read at most once', async () => {
  const open = await openClient({ withDetailsDecisions: true });
  if (process.env.B2D_PRINT) console.log(`[open] total=${open.total} threadReads=${open.threadReads} markRead=${open.markRead}\n${tally(open.requests)}`);
  assert.equal(open.threadReads, 1, `the thread page was drawn ${open.threadReads}× for one open:\n${tally(open.requests)}`);
  assert.ok(open.markRead <= 1, `markThreadRead ran ${open.markRead}× for one open`);
});

test('3 · Details’ Decisions cost zero requests — the open costs what Chat + Quotation alone cost', async () => {
  assert.ok(DetailsDecisions, 'Details has a Decisions body (`DetailsDecisions`, row #42)');
  const without = await openClient({ withDetailsDecisions: false });
  const withDecisions = await openClient({ withDetailsDecisions: true });
  if (process.env.B2D_PRINT) console.log(`[open] without Details decisions=${without.total} · with=${withDecisions.total}`);
  assert.equal(
    withDecisions.total,
    without.total,
    `Details’ Decisions added ${withDecisions.total - without.total} request(s):\n${tally(withDecisions.requests)}`,
  );
});

test('4 · two opens are two draws — nothing outlives one render', async () => {
  const a = await openClient({ withDetailsDecisions: true });
  const b = await openClient({ withDetailsDecisions: true });
  assert.equal(a.threadReads + b.threadReads, 2);
});

test('5 · the Details decisions body has no read of its own — it mounts the shared embed', () => {
  const src = stripComments(readFileSync(join(__dirname, '_components', 'details-decisions.tsx'), 'utf8'));
  assert.doesNotMatch(src, /createClient|createAdminClient|\.from\(|\.rpc\(|fetch[A-Z]\w*\(|supabase/, 'no client, no fetcher');
  assert.match(src, /<SupplierThreadBody[^>]*view="decisions"/, 'the list is drawn by the thread page, from its one load');
});

test('6 · Details\u2019 Decisions are the thread\u2019s own messages and quote rows; a refused read is said, not shortened', async () => {
  const QUOTE = '00000000-0000-4000-8000-0000000000f1';
  ROWS.chat_messages = [
    { message_id: 'm1', thread_id: THREAD, event_id: EVENT, vendor_profile_id: VENDOR, sender_user_id: USER, sender_role: 'vendor', body: 'Here is our quote', created_at: '2026-10-05T02:00:00Z', proposal_id: QUOTE },
  ];
  ROWS.vendor_proposals = [
    { proposal_id: QUOTE, public_id: 'S89Q-ABCDEFGHJK', event_id: EVENT, vendor_profile_id: VENDOR, status: 'accepted', sent_at: '2026-10-05T02:00:00Z', created_at: '2026-10-05T02:00:00Z', total_centavos: 4_000_050, line_items: [], payment_schedule: null, title: 'Wedding coverage', resolved_at: '2026-10-10T02:00:00Z' },
  ];
  try {
    const decisionsOf = (drawn: ReactNode[]) => {
      // The Details embed is the first drawn (Details renders before Chat and Quotation).
      const el = drawn[0] as ReactElement<{ facts: { quotes: Array<{ title: string; totalPhp: number | null; status: string }> }; partial: boolean }>;
      assert.ok(isValidElement(el), 'Details got no Decisions node from the draw');
      return el.props;
    };
    const ok = decisionsOf((await openClient({ withDetailsDecisions: true })).drawn);
    assert.equal(ok.partial, false);
    assert.deepEqual(
      ok.facts.quotes.map((q) => [q.title, q.totalPhp, q.status]),
      [['Wedding coverage', 40000.5, 'accepted']],
      'the quote decision is not the thread\u2019s own quote row (centavo-exact)',
    );

    refuse = new Set(['vendor_proposals']);
    const refused = decisionsOf((await openClient({ withDetailsDecisions: true })).drawn);
    assert.equal(refused.partial, true, 'a refused quote read drew a shorter list as if it were whole');
  } finally {
    refuse = new Set();
    delete ROWS.chat_messages;
    delete ROWS.vendor_proposals;
  }
});
