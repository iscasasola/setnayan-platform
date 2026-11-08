/**
 * ⚡ CHAT ARRIVES INSTANTLY — the client half, executed on a fake clock (owner 2026-10-29: "making chat show faster
 * should not cause error or problems in our requests"; "in time we will have millions of people using our app at the
 * same time"). The database half is tests/db/chat-pings-reach-only-their-people.db.test.ts.
 *
 * Each block is a pass bar from the PR body:
 *
 *   A · THE MACHINE (lib/user-live.ts). The first join is jittered and never at once; a hidden tab lets go at 30 s and
 *       an idle tab holds ZERO channels; back in view it rejoins; a failure backs off with full jitter and gives up
 *       after 6; its own close answering CLOSED is not a failure; a retry that comes due while hidden waits for the
 *       tab; one channel however many callers; a channel opened by a failing attempt is always closed.
 *   B · THE ENVELOPE (lib/unread-follow.ts). Live: ZERO poll reads over five minutes, a ping re-asks, a burst of
 *       pings is two reads; down/off: today's 60 s poll; a refused read is never drawn.
 *   C · THE INBOX. A burst of pings is at most one leading + one trailing `router.refresh()` per 5 s; a return to live
 *       after a gap re-renders once.
 *   D · THE KILL SWITCH. Off by default; off means the envelope is `pollEnvelope` itself and the inbox effect returns
 *       before fetching anything; the production stamp writes only when it differs.
 *   E · THE MAP. Exactly one file opens a `user:` topic and it is private; nothing under app/[slug] (the guest hub)
 *       can reach it; the inbox refresh is mounted on the two inbox pages only — never a layout, never a thread.
 *
 * Run: (cd apps/web && npx tsx --test lib/chat-arrives-instantly.test.ts)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { SupabaseClient } from '@supabase/supabase-js';

import type { TabEnv } from './tab-return';
import { createUserLive, retryDelayMs, MAX_LIVE_FAILURES, JOIN_JITTER_MS, LIVE_STABLE_MS, type LiveListener, type LiveStatus, type Transport } from './user-live';
import { followEnvelopeLive, followInboxLive, INBOX_REFRESH_GAP_MS } from './unread-follow';
import { isChatLiveEnabled } from './chat-live-flag';
import { stampChatLive, worseOutcome } from './chat-live-stamp';
import { resolveImport, WEB_ROOT } from './rsc-function-props';
import { stripComments } from './strip-comments';

// ── a tab on a fake clock ────────────────────────────────────────────────────
const flush = async () => {
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
};

function fakeTab(visible = true) {
  let t = 1_000_000;
  let id = 0;
  let isVis = visible;
  const timers = new Map<number, { at: number; cb: () => void; every?: number }>();
  const vis = new Set<() => void>();
  const wakes = new Set<() => void>();
  const env: TabEnv = {
    isVisible: () => isVis,
    onWake: (cb) => {
      wakes.add(cb);
      return () => wakes.delete(cb);
    },
    onVisibility: (cb) => {
      vis.add(cb);
      return () => vis.delete(cb);
    },
    now: () => t,
    setInterval: (cb, ms) => {
      timers.set(++id, { at: t + ms, cb, every: ms });
      return id;
    },
    clearInterval: (h) => void timers.delete(h as number),
    setTimeout: (cb, ms) => {
      timers.set(++id, { at: t + ms, cb });
      return id;
    },
    clearTimeout: (h) => void timers.delete(h as number),
  };
  return {
    env,
    now: () => t,
    async advance(ms: number) {
      const end = t + ms;
      for (;;) {
        const next = [...timers.entries()].filter(([, x]) => x.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        const [h, x] = next;
        t = x.at;
        if (x.every) x.at += x.every;
        else timers.delete(h);
        x.cb();
        await flush();
      }
      t = end;
      await flush();
    },
    async setVisible(v: boolean) {
      isVis = v;
      for (const cb of [...vis]) cb();
      if (v) for (const cb of [...wakes]) cb();
      await flush();
    },
  };
}

/** A transport that records every channel it opens, and lets the test answer for the server. */
function fakeTransport(auto?: 'SUBSCRIBED' | 'CHANNEL_ERROR') {
  const channels: Array<{
    openedAt: number;
    closed: boolean;
    onStatus: (s: string) => void;
    onPing: Parameters<Transport>[0]['onPing'];
  }> = [];
  let clock: () => number = () => 0;
  const transport: Transport = (h) => {
    const ch = { openedAt: clock(), closed: false, onStatus: h.onStatus, onPing: h.onPing };
    channels.push(ch);
    if (auto) queueMicrotask(() => ch.onStatus(auto));
    return () => {
      ch.closed = true;
      // realtime-js answers our own removeChannel with CLOSED — the machine must not read that as a failure.
      queueMicrotask(() => ch.onStatus('CLOSED'));
    };
  };
  return {
    transport,
    channels,
    open: () => channels.filter((c) => !c.closed),
    useClock: (c: () => number) => {
      clock = c;
    },
  };
}

function watch(live: ReturnType<typeof createUserLive>) {
  const seen: LiveStatus[] = [];
  const leave = live.subscribe({ onStatus: (s) => seen.push(s) });
  return { seen, leave };
}

// ── A · the machine ──────────────────────────────────────────────────────────
test('A1 · the first join waits a jittered 0–1.5 s after it is asked for — never at once, never later', async () => {
  for (const r of [0.999, 0.5, 0]) {
    const tab = fakeTab();
    const tr = fakeTransport();
    tr.useClock(tab.now);
    const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => r });
    const t0 = tab.now();
    const w = watch(live);
    assert.equal(tr.channels.length, 0, 'nothing may join synchronously — the join is asked for from an effect, after paint');
    assert.equal(live.status(), 'joining');
    await tab.advance(JOIN_JITTER_MS);
    assert.equal(tr.channels.length, 1, `random=${r}: one join within ${JOIN_JITTER_MS} ms`);
    assert.equal(tr.channels[0]!.openedAt - t0, Math.round(r * JOIN_JITTER_MS));
    w.leave();
  }
});

test('A2 · hidden for 30 s it lets go (idle = 0 channels); back in view it joins again', async () => {
  const tab = fakeTab();
  const tr = fakeTransport('SUBSCRIBED');
  tr.useClock(tab.now);
  const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => 0.5 });
  const w = watch(live);
  await tab.advance(2_000);
  assert.equal(live.status(), 'live');
  await tab.setVisible(false);
  await tab.advance(29_000);
  assert.equal(tr.open().length, 1, 'a short look away keeps the channel (no churn on a quick tab switch)');
  await tab.advance(1_001);
  assert.equal(tr.open().length, 0, 'hidden 30 s: ZERO channels for an idle person');
  assert.equal(live.status(), 'paused');
  await tab.advance(10 * 60_000);
  assert.equal(tr.channels.length, 1, 'a hidden tab never rejoins on its own');
  await tab.setVisible(true);
  await tab.advance(JOIN_JITTER_MS);
  assert.equal(tr.open().length, 1, 'back in view: joined again');
  assert.equal(live.status(), 'live');
  w.leave();
  await flush();
  assert.equal(tr.open().length, 0, 'the last caller leaving closes the channel');
});

test('A3 · a tab that opens hidden joins nothing until it is looked at', async () => {
  const tab = fakeTab(false);
  const tr = fakeTransport('SUBSCRIBED');
  const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => 0.5 });
  const w = watch(live);
  await tab.advance(60 * 60_000);
  assert.equal(tr.channels.length, 0);
  assert.equal(live.status(), 'paused');
  await tab.setVisible(true);
  await tab.advance(JOIN_JITTER_MS);
  assert.equal(tr.channels.length, 1);
  w.leave();
});

test(`A4 · a failing join backs off with full jitter (5 s × 3ⁿ) and gives up after ${MAX_LIVE_FAILURES} — no retry storm`, async () => {
  for (const r of [0, 0.999]) {
    const tab = fakeTab();
    const tr = fakeTransport('CHANNEL_ERROR');
    tr.useClock(tab.now);
    const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => r });
    const w = watch(live);
    await tab.advance(24 * 60 * 60_000);
    assert.equal(tr.channels.length, MAX_LIVE_FAILURES, `random=${r}: exactly ${MAX_LIVE_FAILURES} joins in a day, then nothing`);
    assert.equal(live.status(), 'off');
    assert.equal(tr.open().length, 0, 'every refused channel is closed (ours, not realtime-js forever-rejoin)');
    for (let n = 1; n < tr.channels.length; n += 1) {
      const gap = tr.channels[n]!.openedAt - tr.channels[n - 1]!.openedAt;
      assert.equal(gap, retryDelayMs(n, () => r), `gap before join ${n + 1}`);
      const base = Math.min(5 * 60_000, 5_000 * 3 ** (n - 1));
      assert.ok(gap >= base * 0.5 && gap < base * 1.5, `gap ${gap} outside the jitter band of ${base}`);
    }
    assert.ok(w.seen.includes('down') && w.seen.at(-1) === 'off');
    w.leave();
  }
  assert.equal(retryDelayMs(50, () => 0.999), Math.round(5 * 60_000 * 1.499), 'the step is capped at 5 min');
});

test('A4b · a server that accepts and drops at once (a flap) still runs out of retries; a long live stretch is forgiven', async () => {
  const tab = fakeTab();
  const channels: Array<(s: string) => void> = [];
  const transport: Transport = (h) => {
    channels.push(h.onStatus);
    queueMicrotask(() => h.onStatus('SUBSCRIBED'));
    tab.env.setTimeout(() => h.onStatus('CHANNEL_ERROR'), 1_000); // dropped a second after every join
    return () => {};
  };
  const live = createUserLive({ transport, env: tab.env, random: () => 0.5 });
  const w = watch(live);
  await tab.advance(24 * 60 * 60_000);
  assert.equal(channels.length, MAX_LIVE_FAILURES, 'a flapping server must not earn endless rejoins');
  assert.equal(live.status(), 'off');
  w.leave();

  // …but a channel that held for LIVE_STABLE_MS starts its count again on the next drop.
  const tab2 = fakeTab();
  let n = 0;
  const t2: Transport = (h) => {
    n += 1;
    queueMicrotask(() => h.onStatus('SUBSCRIBED'));
    tab2.env.setTimeout(() => h.onStatus('CHANNEL_ERROR'), LIVE_STABLE_MS + 1_000);
    return () => {};
  };
  const live2 = createUserLive({ transport: t2, env: tab2.env, random: () => 0.5 });
  const w2 = watch(live2);
  await tab2.advance(60 * 60_000);
  assert.ok(n > MAX_LIVE_FAILURES, `a stable channel that drops now and then keeps rejoining (${n} joins in an hour)`);
  assert.notEqual(live2.status(), 'off');
  w2.leave();
});

test('A5 · its own close answering CLOSED is not a failure', async () => {
  const tab = fakeTab();
  const tr = fakeTransport('SUBSCRIBED');
  const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => 0 });
  const w = watch(live);
  await tab.advance(10);
  await tab.setVisible(false);
  await tab.advance(31_000); // closes → the fake answers CLOSED
  assert.equal(live.status(), 'paused');
  assert.ok(!w.seen.includes('down'), 'our own removeChannel was read as a failure');
  await tab.advance(60 * 60_000);
  assert.equal(tr.channels.length, 1, 'nothing retried while hidden');
  w.leave();
});

test('A6 · a retry that comes due while hidden waits for the tab — it is never stuck "down"', async () => {
  const tab = fakeTab();
  let answer: 'CHANNEL_ERROR' | 'SUBSCRIBED' = 'CHANNEL_ERROR';
  const tr = fakeTransport();
  const transport: Transport = (h) => {
    const close = tr.transport(h);
    const a = answer;
    queueMicrotask(() => h.onStatus(a));
    return close;
  };
  const live = createUserLive({ transport, env: tab.env, random: () => 0 });
  const w = watch(live);
  await tab.advance(10);
  assert.equal(live.status(), 'down');
  await tab.setVisible(false);
  await tab.advance(5_000); // the 1 s retry comes due hidden
  assert.equal(tr.channels.length, 1, 'no join while hidden');
  assert.equal(live.status(), 'paused');
  answer = 'SUBSCRIBED';
  await tab.setVisible(true);
  await tab.advance(JOIN_JITTER_MS);
  assert.equal(live.status(), 'live', 'back in view it must join again');
  w.leave();
});

test('A7 · one channel however many callers; the last one out closes it', async () => {
  const tab = fakeTab();
  const tr = fakeTransport('SUBSCRIBED');
  const live = createUserLive({ transport: tr.transport, env: tab.env, random: () => 0 });
  const a = live.subscribe({});
  const b = live.subscribe({});
  await tab.advance(10);
  assert.equal(tr.channels.length, 1);
  a();
  await flush();
  assert.equal(tr.open().length, 1);
  b();
  await flush();
  assert.equal(tr.open().length, 0);
});

test('A8 · a failure reported before the transport even returns never leaks its channel', async () => {
  const tab = fakeTab();
  let closes = 0;
  const transport: Transport = (h) => {
    h.onStatus('CHANNEL_ERROR');
    return () => {
      closes += 1;
    };
  };
  const live = createUserLive({ transport, env: tab.env, random: () => 0, maxFailures: 2 });
  const w = watch(live);
  await tab.advance(60_000);
  assert.equal(closes, 2, 'each synchronously-failed channel must be closed');
  w.leave();
});

// ── B · the envelope ─────────────────────────────────────────────────────────
function fakeChannel() {
  let l: LiveListener | null = null;
  let left = 0;
  return {
    subscribe: (_s: SupabaseClient, _u: string, listener: LiveListener) => {
      l = listener;
      return () => {
        left += 1;
      };
    },
    status: (s: LiveStatus) => l!.onStatus?.(s),
    ping: (event = 'chat_message') => l!.onPing?.({ event, payload: { thread_id: 't', message_id: 'm', at: 'now' } }),
    left: () => left,
  };
}

const sb = {} as SupabaseClient;

test('B1 · live: ZERO poll reads over five minutes; becoming live catches up once; a ping re-asks', async () => {
  const tab = fakeTab();
  const ch = fakeChannel();
  let reads = 0;
  const drawn: number[] = [];
  const stop = followEnvelopeLive({
    supabase: sb,
    userId: 'u',
    onValue: (n) => drawn.push(n),
    subscribe: ch.subscribe,
    read: async () => (reads += 1),
    env: tab.env,
  });
  ch.status('joining');
  ch.status('live');
  await flush();
  assert.equal(reads, 1, 'becoming live re-asks once (the catch-up)');
  await tab.advance(5 * 60_000);
  assert.equal(reads, 1, 'live: no poll at all — main asked 5 times in these five minutes');
  ch.ping();
  await flush();
  assert.equal(reads, 2, 'a ping re-asks at once');
  ch.ping('chat_message_heart');
  await tab.advance(5_000);
  assert.equal(reads, 2, 'another event on the same channel is not mistaken for a message');
  assert.deepEqual(drawn, [1, 2]);
  stop();
  assert.equal(ch.left(), 1);
});

test('B2 · a burst of 20 pings in 200 ms is two reads, not twenty', async () => {
  const tab = fakeTab();
  const ch = fakeChannel();
  let reads = 0;
  followEnvelopeLive({ supabase: sb, userId: 'u', onValue: () => {}, subscribe: ch.subscribe, read: async () => (reads += 1), env: tab.env });
  ch.status('live');
  await tab.advance(5_000);
  const before = reads;
  for (let i = 0; i < 20; i += 1) {
    ch.ping();
    await tab.advance(10);
  }
  await tab.advance(5_000);
  assert.equal(reads - before, 2, 'one leading + one trailing read per burst');
});

test('B3 · down or given up: today’s 60 s poll, exactly as on main', async () => {
  for (const s of ['down', 'off'] as const) {
    const tab = fakeTab();
    const ch = fakeChannel();
    let reads = 0;
    followEnvelopeLive({ supabase: sb, userId: 'u', onValue: () => {}, subscribe: ch.subscribe, read: async () => (reads += 1), env: tab.env });
    ch.status('joining');
    ch.status('live');
    await tab.advance(1_000);
    const beforeDown = reads;
    ch.status(s);
    await tab.advance(1_000);
    assert.equal(reads, beforeDown, `${s}: no re-ask on the drop itself — after an outage every tab drops at once`);
    const at = reads;
    await tab.advance(3 * 60_000);
    assert.equal(reads - at, 3, `${s}: one read a minute`);
  }
});

test('B4 · a refused read is never drawn — no false 0', async () => {
  const tab = fakeTab();
  const ch = fakeChannel();
  const drawn: number[] = [];
  followEnvelopeLive({ supabase: sb, userId: 'u', onValue: (n) => drawn.push(n), subscribe: ch.subscribe, read: async () => null, env: tab.env });
  ch.status('live');
  ch.ping();
  await tab.advance(2 * 60_000);
  ch.status('down');
  await tab.advance(3 * 60_000);
  assert.deepEqual(drawn, []);
});

// ── C · the inbox ────────────────────────────────────────────────────────────
test('C1 · the inbox re-renders at most once per 5 s per burst, and once on a return to live', async () => {
  const tab = fakeTab();
  const ch = fakeChannel();
  let refreshes = 0;
  const stop = followInboxLive({ supabase: sb, userId: 'u', refresh: () => (refreshes += 1), subscribe: ch.subscribe, env: tab.env });
  ch.status('joining');
  ch.status('live');
  await flush();
  assert.equal(refreshes, 0, 'the first join does not re-render — the server render is fresh');
  for (let i = 0; i < 30; i += 1) {
    ch.ping();
    await tab.advance(100);
  }
  await tab.advance(INBOX_REFRESH_GAP_MS * 2);
  assert.equal(refreshes, 2, 'thirty pings in 3 s: one leading + one trailing refresh');
  ch.status('paused');
  ch.status('joining');
  ch.status('live');
  await tab.advance(INBOX_REFRESH_GAP_MS);
  assert.equal(refreshes, 3, 'back from a gap: one catch-up refresh');
  stop();
  ch.ping();
  await tab.advance(INBOX_REFRESH_GAP_MS);
  assert.equal(refreshes, 3, 'nothing after unmount');
});

// ── D · the kill switch ──────────────────────────────────────────────────────
test('D1 · OFF by default; only the house ON values turn it on', () => {
  const prev = process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED;
  try {
    delete process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED;
    assert.equal(isChatLiveEnabled(), false, 'unset must be OFF');
    for (const v of ['', 'false', '0', 'off', 'nope']) {
      process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED = v;
      assert.equal(isChatLiveEnabled(), false, `"${v}" must be OFF`);
    }
    for (const v of ['true', '1', 'on', ' YES ']) {
      process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED = v;
      assert.equal(isChatLiveEnabled(), true, `"${v}" must be ON`);
    }
  } finally {
    if (prev === undefined) delete process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED;
    else process.env.NEXT_PUBLIC_CHAT_LIVE_ENABLED = prev;
  }
});

const src = (rel: string) => stripComments(fs.readFileSync(path.join(WEB_ROOT, rel), 'utf8'));

test('D2 · OFF, the envelope IS pollEnvelope and the inbox effect returns before fetching anything', () => {
  const polls = src('lib/unread-polls.ts');
  const follow = polls.slice(polls.indexOf('export function followEnvelope('));
  assert.match(follow, /live = isChatLiveEnabled\(\)/, 'the default is the kill switch');
  assert.match(follow, /\): \(\) => void \{\s*if \(!live\) return pollEnvelope\(\{ supabase, onValue \}\);/, 'the first line, before any import()');
  assert.doesNotMatch(polls.slice(0, polls.indexOf('export function followEnvelope(')), /user-live|unread-follow/, 'nothing live is imported outside followEnvelope');
  assert.doesNotMatch(polls, /^import[^\n]*(user-live|unread-follow)/m, 'the live half is never a static import of the chrome');
  const inbox = src('app/_components/live-inbox-refresh.tsx');
  assert.match(inbox, /useEffect\(\(\) => \{\s*if \(!isChatLiveEnabled\(\)\) return;/, 'the inbox effect returns on its first line with the switch off');
  assert.doesNotMatch(inbox, /^import[^\n]*(user-live|unread-follow|supabase\/client)/m, 'the inbox refresh loads its live half by import() only');
});

function fakeAdmin(rows: number, error: { message: string } | null = null) {
  const calls: Array<{ update?: unknown; or?: string; eq?: [string, unknown] }> = [];
  const builder = {
    update(v: unknown) {
      calls.push({ update: v });
      return builder;
    },
    eq(k: string, v: unknown) {
      calls.at(-1)!.eq = [k, v];
      return builder;
    },
    or(f: string) {
      calls.at(-1)!.or = f;
      return builder;
    },
    select() {
      return builder;
    },
    abortSignal() {
      return Promise.resolve({ data: error ? null : Array.from({ length: rows }, () => ({ id: 1 })), error });
    },
  };
  return { admin: { from: (t: string) => (assert.equal(t, 'platform_settings'), builder) } as unknown as SupabaseClient, calls };
}

test('D3 · the production stamp tells the database the switch — one write, only when it differs', async () => {
  for (const live of [true, false]) {
    const { admin, calls } = fakeAdmin(1);
    assert.equal(await stampChatLive(admin, 1_000, live), 'stamped');
    assert.deepEqual(calls[0]!.update, { chat_live_pings_live: live }, 'it writes the one column and nothing else');
    assert.deepEqual(calls[0]!.eq, ['id', 1]);
    assert.equal(calls[0]!.or, `chat_live_pings_live.is.null,chat_live_pings_live.neq.${live}`, 'only when it differs');
  }
  assert.equal(await stampChatLive(fakeAdmin(0).admin, 1_000, true), 'already_right');
  const orig = console.error;
  console.error = () => {};
  try {
    assert.equal(await stampChatLive(fakeAdmin(0, { message: 'refused' }).admin, 1_000, true), 'failed');
  } finally {
    console.error = orig;
  }
  assert.equal(worseOutcome('stamped', 'failed'), 'failed', 'either stamp not landing → the scheduler retries');
  assert.equal(worseOutcome('already_right', 'stamped'), 'stamped');
  assert.equal(worseOutcome('already_right', 'already_right'), 'already_right');
  const server = src('lib/booking-fee-minting-stamp.server.ts');
  assert.match(server, /Promise\.all\(\[stampBookingFeeMinting\(admin\), stampChatLive\(admin\)\]\)/, 'the chat stamp rides the production-only scheduler');
});

// ── E · the map ──────────────────────────────────────────────────────────────
function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|mjs)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}
const rel = (abs: string) => path.relative(WEB_ROOT, abs).split(path.sep).join('/');
const FILES = ['app', 'lib', 'components'].flatMap((r) => walk(path.join(WEB_ROOT, r)));

function importsOf(abs: string): string[] {
  const sf = ts.createSourceFile(abs, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, false, ts.ScriptKind.TSX);
  const specs: string[] = [];
  const visit = (n: ts.Node) => {
    if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier && ts.isStringLiteral(n.moduleSpecifier)) {
      if (!(ts.isImportDeclaration(n) && n.importClause?.isTypeOnly)) specs.push(n.moduleSpecifier.text);
    } else if (ts.isCallExpression(n) && n.expression.kind === ts.SyntaxKind.ImportKeyword && n.arguments[0] && ts.isStringLiteral(n.arguments[0])) {
      specs.push(n.arguments[0].text);
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return specs.map((s) => resolveImport(abs, s)).filter((x): x is string => !!x);
}

test('E1 · exactly one file opens a user: topic, and it opens it PRIVATE', () => {
  assert.ok(FILES.length > 1000, `only ${FILES.length} files — the walk is broken`);
  const openers = FILES.filter((f) => /\.channel\(\s*`user:/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel);
  assert.deepEqual(openers, ['lib/user-live-channel.ts']);
  const ch = src('lib/user-live-channel.ts');
  assert.match(ch, /\.channel\(`user:\$\{userId\}`, \{ config: \{ private: true \} \}\)/);
  assert.match(ch, /supabase\.realtime\.setAuth\(token\)/, 'the socket carries the person’s token, or the policy sees no one');
  assert.doesNotMatch(ch, /postgres_changes/, 'broadcast only — never postgres_changes');
});

test('E2 · nothing under app/[slug] — the guest hub — can reach the live channel', () => {
  const guestFiles = FILES.filter((f) => rel(f).startsWith('app/[slug]/'));
  assert.ok(guestFiles.length > 20, `only ${guestFiles.length} guest files — the walk is broken`);
  const LIVE_HALF = new Set(['lib/user-live-channel.ts', 'lib/unread-follow.ts', 'app/_components/live-inbox-refresh.tsx']);
  const seen = new Set<string>();
  const bad: string[] = [];
  for (const start of guestFiles) {
    const stack: Array<[string, string]> = [[start, rel(start)]];
    while (stack.length) {
      const [f, trail] = stack.pop()!;
      if (seen.has(f)) continue;
      seen.add(f);
      if (!['app', 'lib', 'components'].some((r) => f.startsWith(path.join(WEB_ROOT, r) + path.sep))) continue;
      if (LIVE_HALF.has(rel(f))) bad.push(trail);
      for (const n of importsOf(f)) stack.push([n, `${trail} → ${rel(n)}`]);
    }
  }
  assert.ok(seen.size > 100, `the walk reached only ${seen.size} files`);
  assert.deepEqual(bad, [], 'a guest page reaches the per-user live channel — guests hold no live connection (owner 2026-10-28)');
});

test('E3 · the inbox refresh is mounted on the two inbox pages only — never a layout, never a thread', () => {
  const mounts = FILES.filter((f) => /<LiveInboxRefresh\b/.test(stripComments(fs.readFileSync(f, 'utf8')))).map(rel).sort();
  assert.deepEqual(mounts, ['app/dashboard/[eventId]/messages/page.tsx', 'app/vendor-dashboard/messages/page.tsx']);
});
