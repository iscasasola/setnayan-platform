/**
 * user-live.ts — the ONE live connection a signed-in person holds, as a state machine with no Supabase in it
 * (owner 2026-10-29: "chat arrives instantly"; "in time we will have millions of people using our app at the same
 * time"). The Supabase half is lib/user-live-channel.ts; this half is what the node tests drive on a fake clock
 * (lib/chat-arrives-instantly.test.ts).
 *
 * What it promises, each one a pass-bar line:
 *
 *   · ZERO CONNECTIONS FOR AN IDLE PERSON. It joins only while the tab is IN VIEW. Hidden for `hiddenMs` (30 s, the
 *     repo's standard grace — lib/tab-return.ts HIDDEN_PAUSE_MS) it leaves; back in view it joins again. A tab that
 *     opens hidden joins nothing until it is looked at.
 *   · NEVER BLOCKS THE FIRST PAINT. The first join waits a random 0–`joinJitterMs` after it is asked for — and it is
 *     only ever asked for from an effect, after the page has painted.
 *   · NO RETRY STORM. A failed join (refused, timed out, closed under us) is torn down — NOT left to the client's own
 *     forever-rejoin — and tried again after an exponential backoff with full jitter (`retryDelayMs`), capped; after
 *     `maxFailures` in a row it stops for this tab ('off') and the caller's poll carries on alone.
 *   · ONE CHANNEL, MANY LISTENERS. The envelope and the inbox share it; the channel closes when the last one leaves.
 *
 * Statuses a listener sees:
 *   joining — asked for, not yet confirmed     live   — confirmed; pings arrive
 *   paused  — the tab is out of view           down   — failed; a retry is scheduled
 *   off     — gave up for this tab (the caller polls)
 */
import { browserTabEnv, HIDDEN_PAUSE_MS, type TabEnv } from './tab-return';

export type LiveStatus = 'joining' | 'live' | 'paused' | 'down' | 'off';

/** What the trigger sends (migration 20271296339552) — ids only, never content. */
export type ChatPing = { thread_id?: string; message_id?: string; at?: string };

/** The realtime-js subscribe statuses this machine reacts to. */
export type TransportStatus = 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';

/**
 * Opens the channel and returns its close (which may resolve later — `removeChannel` resolves once the channel has
 * left). The machine never opens a second one before the previous close has resolved.
 */
export type Transport = (h: {
  onPing: (p: ChatPing) => void;
  onStatus: (s: TransportStatus | string) => void;
}) => () => void | Promise<unknown>;

export type LiveListener = { onPing?: (p: ChatPing) => void; onStatus?: (s: LiveStatus) => void };

/** The first join waits a random 0–this long: a deploy or a Realtime restart must not see every tab rejoin at once. */
export const JOIN_JITTER_MS = 1_500;
/** Failures in a row before this tab stops trying (the poll carries on). With the delays below: ~2 s … ~2.4 min. */
export const MAX_LIVE_FAILURES = 6;
const RETRY_BASE_MS = 2_000;
const RETRY_CAP_MS = 5 * 60_000;

/** Exponential backoff with FULL jitter: a random point in [0.5, 1.5) × base·3^(n−1), capped. */
export function retryDelayMs(failures: number, random: () => number = Math.random): number {
  const step = Math.min(RETRY_CAP_MS, RETRY_BASE_MS * 3 ** Math.max(0, failures - 1));
  return Math.round(step * (0.5 + random()));
}

export function createUserLive({
  transport,
  env = browserTabEnv(),
  random = Math.random,
  hiddenMs = HIDDEN_PAUSE_MS,
  joinJitterMs = JOIN_JITTER_MS,
  maxFailures = MAX_LIVE_FAILURES,
}: {
  transport: Transport;
  env?: TabEnv;
  random?: () => number;
  hiddenMs?: number;
  joinJitterMs?: number;
  maxFailures?: number;
}) {
  const listeners = new Set<LiveListener>();
  let status: LiveStatus = 'paused';
  let close: (() => void | Promise<unknown>) | null = null;
  let closing: Promise<unknown> = Promise.resolve();
  let attempt = 0; // bumps on every open/close, so a late callback from an old channel is ignored
  let failures = 0;
  let joinTimer: unknown = null;
  let hideTimer: unknown = null;
  let unvis: (() => void) | null = null;

  const set = (s: LiveStatus) => {
    if (s === status) return;
    status = s;
    for (const l of [...listeners]) l.onStatus?.(s);
  };

  const clearJoin = () => {
    if (joinTimer !== null) env.clearTimeout(joinTimer);
    joinTimer = null;
  };
  const clearHide = () => {
    if (hideTimer !== null) env.clearTimeout(hideTimer);
    hideTimer = null;
  };

  const shut = () => {
    attempt += 1;
    if (!close) return;
    const c = close;
    close = null;
    closing = Promise.resolve()
      .then(c)
      .catch(() => {});
  };

  const open = () => {
    joinTimer = null;
    if (listeners.size === 0 || close || !env.isVisible() || status === 'off') return;
    const mine = ++attempt;
    set('joining');
    // Re-open only once the old channel has left — the client hands back a still-closing channel of the same topic.
    void closing.then(() => {
      if (mine !== attempt || listeners.size === 0 || !env.isVisible()) return;
      close = transport({
        onPing: (p) => {
          if (mine !== attempt) return;
          for (const l of [...listeners]) l.onPing?.(p);
        },
        onStatus: (s) => {
          if (mine !== attempt) return; // our own removeChannel answers CLOSED — not a failure
          if (s === 'SUBSCRIBED') {
            failures = 0;
            set('live');
            return;
          }
          if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT' || s === 'CLOSED') fail();
        },
      });
    });
  };

  const schedule = (ms: number) => {
    clearJoin();
    joinTimer = env.setTimeout(open, ms);
  };

  const fail = () => {
    shut(); // ours, not realtime-js's forever-rejoin
    failures += 1;
    if (failures >= maxFailures) {
      clearJoin();
      set('off');
      return;
    }
    set('down');
    schedule(retryDelayMs(failures, random));
  };

  const onVisibility = () => {
    if (listeners.size === 0) return;
    if (!env.isVisible()) {
      if (hideTimer === null && (close || joinTimer !== null)) {
        hideTimer = env.setTimeout(() => {
          hideTimer = null;
          if (env.isVisible()) return;
          clearJoin();
          shut();
          if (status !== 'off') set('paused');
        }, hiddenMs);
      }
      return;
    }
    clearHide();
    if (status === 'paused' && !close && joinTimer === null) schedule(Math.round(random() * joinJitterMs));
  };

  const start = () => {
    unvis = env.onVisibility(onVisibility);
    if (env.isVisible()) schedule(Math.round(random() * joinJitterMs));
    else set('paused');
  };

  const stop = () => {
    unvis?.();
    unvis = null;
    clearJoin();
    clearHide();
    shut();
    failures = 0;
    status = 'paused';
  };

  return {
    /** Listen; the first listener starts the machine, the last one to leave stops it. Returns `leave`. */
    subscribe(l: LiveListener): () => void {
      listeners.add(l);
      if (listeners.size === 1) start();
      l.onStatus?.(status);
      return () => {
        if (!listeners.delete(l)) return;
        if (listeners.size === 0) stop();
      };
    },
    status: () => status,
  };
}

/**
 * Run `fn` at once, and fold every further call that lands while it runs, or within `gapMs` of its start, into ONE
 * trailing run. A burst of pings is one read, never one read per ping.
 */
export function coalesce(fn: () => unknown, gapMs: number, env: Pick<TabEnv, 'now' | 'setTimeout'> = browserTabEnv()) {
  let last = -Infinity;
  let running = false;
  let pending = false;
  let timer = false;

  const run = () => {
    timer = false;
    pending = false;
    running = true;
    last = env.now();
    Promise.resolve()
      .then(fn)
      .catch(() => {})
      .finally(() => {
        running = false;
        if (pending) later();
      });
  };
  const later = () => {
    if (timer) return;
    timer = true;
    env.setTimeout(run, Math.max(0, last + gapMs - env.now()));
  };
  return () => {
    if (running || timer || env.now() - last < gapMs) {
      pending = true;
      if (!running) later();
      return;
    }
    run();
  };
}
