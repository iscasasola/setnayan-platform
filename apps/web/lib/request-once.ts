import { cache } from 'react';

/**
 * apps/web/lib/request-once.ts — ONE QUESTION, ONCE PER RENDER.
 *
 * ── WHY THIS EXISTS (production incident, 2026-10-08) ──────────────────────
 * One person in the Event Hub Maker took Supabase from ~200 requests per five
 * minutes to 3,000–11,000, all from Vercel's own functions: PostgREST ran out
 * of pooled connections ("Timed out acquiring connection", PGRST003) and plain
 * reads came back 504 while Postgres itself sat idle at 5–8 ms a query. The
 * load was the SAME FEW QUESTIONS asked again and again inside one render —
 * "does this event own X?" walked orders → bundles → basket → comp → internal
 * once per product, per component, per page, and the Maker draws several pages.
 *
 * React's `cache()` already answers this for a function whose ARGUMENTS are
 * the whole identity of the question (`getCurrentUser`, `createClient`,
 * `websiteProActiveFor`). It cannot answer it for the entitlement readers,
 * because their first argument is a Supabase client and
 * `createAdminClient()` builds a NEW one on every call — two askers of the
 * same question hold two different objects and miss each other.
 *
 * So the identity of a question here is spelled out, never inferred:
 *
 *     WHO is asking  ·  WHAT is asked  ·  ABOUT WHAT
 *     (authority)       (question)        (event id, SKU, …)
 *
 * ── 🔒 THE PRIVACY RULE: AN ANSWER IS NEVER SHARED ACROSS AUTHORITIES ──────
 *   · Every service-role client (`createAdminClient`) is ONE authority: they
 *     all bypass RLS, so the same question gets the same rows whichever
 *     object asked. They are told apart from session clients by a mark set
 *     where they are built (`markServiceRoleClient`), never by a guess.
 *   · Any OTHER client is its own authority, by object identity. A signed-in
 *     viewer's client is built once per request (`lib/supabase/server.ts`),
 *     so its askers still meet; a client for a different person is a
 *     different object and can never be handed this one's answer.
 *   · Every argument that changes the answer is part of the key. Two events
 *     never share a slot; two SKUs never share a slot.
 *   Held by `lib/request-once.test.ts` and
 *   `lib/entitlements-ask-once.test.ts`.
 *
 * ── ⏱ THE SCOPE IS ONE RENDER, AND NOTHING OUTLIVES IT ────────────────────
 * The slots live in a Map that React hands out once per server render
 * (`cache(() => new Map())`). Outside a render — a server action, a route
 * handler, a job, a test in plain node — React's `cache()` does not memoize,
 * so every call gets a NEW, empty Map and nothing is remembered at all. That
 * is deliberate: an action's gate re-reads every time, exactly as before
 * (there an absence DENIES, and a stale "yes" would be a hole), and the render
 * that follows a write starts from an empty Map, so it can never show the
 * answer from before the write.
 *
 * ⛔ NEVER a module-level Map. That would be shared by every request on the
 * instance — one couple's answer served to the next, and a paid order unseen
 * until the function recycled.
 *
 * A REJECTED read is remembered for the render too: every asker of that
 * question gets the same failure, instead of each one retrying into a
 * database that is already refusing connections.
 */

type Slots = Map<string, Promise<unknown>>;

/** One Map per server render. A fresh one on every call outside a render. */
const renderSlots = cache((): Slots => new Map());

/** Set only by `withRenderScopeForTest` — a test's stand-in for one render. */
let testSlots: Slots | null = null;

function slots(): Slots {
  return testSlots ?? renderSlots();
}

/**
 * Is there a render to remember answers for? True inside a server render (the
 * same Map comes back twice) and inside `withRenderScopeForTest`; false in an
 * action, a route handler, a job.
 */
export function insideRender(): boolean {
  if (testSlots) return true;
  return renderSlots() === renderSlots();
}

const serviceRoleClients = new WeakSet<object>();

/** Called where a service-role client is BUILT (`createAdminClient`) — nowhere else. */
export function markServiceRoleClient<T extends object>(client: T): T {
  serviceRoleClients.add(client);
  return client;
}

/** Was this client built by `createAdminClient` (it bypasses RLS)? */
export function isServiceRoleClient(client: object): boolean {
  return serviceRoleClients.has(client);
}

let nextClientId = 0;
const clientIds = new WeakMap<object, number>();

/**
 * WHO is asking. `service` for every service-role client; otherwise a label
 * that belongs to this one client object and to no other.
 */
export function authorityOf(client: object): string {
  if (serviceRoleClients.has(client)) return 'service';
  let id = clientIds.get(client);
  if (id === undefined) {
    id = ++nextClientId;
    clientIds.set(client, id);
  }
  return `client#${id}`;
}

/**
 * Ask `run` at most once per render for this (authority, question, about).
 *
 * `about` must name EVERYTHING that changes the answer besides who is asking —
 * the event id, the SKU. Leaving one out hands one event another's answer.
 */
export function askedOnce<T>(
  client: object,
  question: string,
  about: readonly string[],
  run: () => Promise<T>,
): Promise<T> {
  const store = slots();
  const key = JSON.stringify([authorityOf(client), question, ...about]);
  const hit = store.get(key);
  if (hit) return hit as Promise<T>;
  const asked = run();
  store.set(key, asked);
  return asked;
}

/**
 * TEST ONLY — run `fn` as if it were one server render: answers are remembered
 * for its duration and forgotten after. Two calls are two renders. (Plain node
 * resolves `react` to the build whose `cache()` never memoizes, so a test has
 * no render of its own to stand in.)
 */
export async function withRenderScopeForTest<T>(fn: () => Promise<T>): Promise<T> {
  const before = testSlots;
  testSlots = new Map();
  try {
    return await fn();
  } finally {
    testSlots = before;
  }
}
