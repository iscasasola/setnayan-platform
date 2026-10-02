/**
 * Problems · the ONE browser observer (owner 2026-10-02: "spot problems before
 * users report them"; addendum: "this will only be an error if we have an
 * assigned task to it but it failed to work" — so a tap that does NOTHING is a
 * problem too, and so is the moment a person gives up).
 *
 * Installed once, lazily, at idle by app/_components/deferred-observability.tsx
 * — it is its own async chunk, so it adds nothing to the first load (the same
 * rule that keeps Sentry out of it). Nothing here is per screen. It watches:
 *
 *   SERVER ACTIONS (every one — they all ride `fetch` with a `Next-Action` header)
 *     · no answer after 15 s                          → BUTTON_TIMEOUT
 *     · answered `{ ok:false, error }` / redirected
 *       with `?error=`                                → ACTION_RETURNED_ERROR
 *     · answered fine                                 → a SUCCESS COUNT (no row)
 *     (a 5xx is NOT recorded here: the server already recorded the throw via
 *      onRequestError — recording it twice would split one failure in two.)
 *   SAME-ORIGIN /api CALLS — no answer after 15 s, or a 5xx.
 *   TAPS (one document listener)
 *     · a tap on a button / link / [role=button] that within 2 s causes no
 *       navigation, no request, no dialog, no DOM change near it, no scroll,
 *       no focus move                                 → DEAD_TAP
 *     · the same element tapped 3+ times in 2 s       → RAGE_TAP
 *   DEAD ENDS — an in-app tap that lands on the not-found page, on a
 *     forwarding stub (the address you tapped is not where you ended up), or
 *     on a #section that is not on the page          → DEAD_END (+ where it came from)
 *   CRASHES — uncaught errors and unhandled rejections → PAGE_CRASH
 *     (error boundaries report through lib/telemetry/report-crash.ts)
 *   DROP-OFF — steps of the guided flows in lib/telemetry/flows.ts, as counts.
 *
 * Every label and path is scrubbed here AND again at the ingest. No personal
 * data, no per-person rows.
 */

import {
  normalizeLabel,
  normalizePath,
  readActionResult,
  redirectSaysFailed,
} from '@/lib/telemetry/fault-normalize';
import { FLOWS, reachStep, type FlowDef, type FlowRuns } from '@/lib/telemetry/flows';

export const ACTION_TIMEOUT_MS = 15_000;
export const DEAD_TAP_WINDOW_MS = 2_000;
export const RAGE_WINDOW_MS = 2_000;
export const RAGE_TAPS = 3;
const INGEST = '/api/telemetry/client-fault';

// ── pure pieces (exported for the tests) ─────────────────────────────────────

export type WireFault = {
  event_type: string;
  element_name: string | null;
  file_path: string | null;
  error_message: string | null;
  payload_snapshot: Record<string, unknown>;
};

/**
 * A rage counter: true exactly once per burst, on the RAGE_TAPS-th tap of the
 * same key within RAGE_WINDOW_MS.
 */
export function createRageCounter(windowMs = RAGE_WINDOW_MS, n = RAGE_TAPS) {
  const taps = new Map<unknown, number[]>();
  return (key: unknown, now: number): boolean => {
    const recent = (taps.get(key) ?? []).filter((t) => now - t < windowMs);
    recent.push(now);
    taps.set(key, recent);
    if (taps.size > 50) {
      for (const k of taps.keys()) {
        if (k !== key) taps.delete(k);
        if (taps.size <= 25) break;
      }
    }
    return recent.length === n;
  };
}

/** Everything a tap can cause. Any one of them is an answer. */
export type TapSignals = {
  navigated: boolean;
  requested: boolean;
  dialogOpened: boolean;
  mutatedNearby: boolean;
  scrolled: boolean;
  focusMoved: boolean;
  leftPage: boolean;
};

export function isDeadTap(s: TapSignals): boolean {
  return !(s.navigated || s.requested || s.dialogOpened || s.mutatedNearby || s.scrolled || s.focusMoved || s.leftPage);
}

/** A stepper or a carousel arrow is MEANT to be tapped fast. */
const REPEATABLE_LABEL = /^(?:\+|-|−|＋|plus|minus|increase|decrease|add one|remove one|next|previous|prev|more|less|›|‹|>|<)$/i;
export function isRepeatableLabel(label: string): boolean {
  return REPEATABLE_LABEL.test(label.trim());
}

/** Errors that are noise, not a person's failure. */
export function isIgnorableError(message: string): boolean {
  return /ResizeObserver loop|^Script error\.?$|NEXT_REDIRECT|NEXT_NOT_FOUND|AbortError|The user aborted|Load failed$|cancelled|canceled/i.test(
    message,
  );
}

/** Where an in-app tap ended up, judged once the navigation settled. */
export function judgeLanding(input: {
  tappedPath: string;
  tappedHash: string;
  fromPath: string;
  landedPath: string;
  notFoundShown: boolean;
  sectionFound: boolean | null; // null = not checked (no hash)
}): { reason: 'not_found' | 'forwarded' | 'missing_section'; to: string; landed?: string } | null {
  const to = input.tappedPath + (input.tappedHash || '');
  if (input.notFoundShown) return { reason: 'not_found', to };
  if (input.landedPath !== input.tappedPath) {
    // A sign-in wall is a gate, not a stub.
    if (/^\/(?:login|signup|auth|reset-password|forgot-password)(?:\/|$)/.test(input.landedPath)) return null;
    if (input.landedPath === input.fromPath) return null; // never left: a dead tap, judged elsewhere
    return { reason: 'forwarded', to, landed: input.landedPath };
  }
  if (input.tappedHash && input.sectionFound === false) return { reason: 'missing_section', to };
  return null;
}

/** Build the wire body the ingest accepts. Paths/labels normalised here (and again server-side). */
export function wire(
  kind: string,
  parts: {
    action?: string | null;
    actionId?: string | null;
    element?: string | null;
    message?: string | null;
    page: string;
    from?: string | null;
    to?: string | null;
    extra?: Record<string, unknown>;
  },
): WireFault {
  return {
    event_type: kind,
    element_name: parts.element ? normalizeLabel(parts.element) : null,
    file_path: null,
    error_message: parts.message ? parts.message.slice(0, 2000) : null,
    payload_snapshot: {
      page: normalizePath(parts.page, true),
      ...(parts.from ? { from: normalizePath(parts.from, true) } : {}),
      ...(parts.to ? { to: normalizePath(parts.to, true) } : {}),
      ...(parts.action ? { action: parts.action } : {}),
      ...(parts.actionId ? { action_id: parts.actionId } : {}),
      ...(parts.extra ?? {}),
    },
  };
}

/** The visible name of a tapped thing. */
export function labelOf(el: Element): string {
  const aria = el.getAttribute('aria-label') || el.getAttribute('title');
  if (aria) return aria;
  const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text) return text.slice(0, 60);
  const img = el.querySelector('img[alt]');
  if (img) return img.getAttribute('alt') ?? '';
  return el.tagName.toLowerCase();
}

// ── the installer ────────────────────────────────────────────────────────────

type Win = Window & typeof globalThis & { __snFaultObserver?: boolean };

const TAPPABLE = 'button, a[href], [role="button"], [role="link"], summary';
const DIALOGS = 'dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]';

export function installFaultObserver(win: Win = window as Win): void {
  if (win.__snFaultObserver) return;
  win.__snFaultObserver = true;
  const doc = win.document;
  const loc = win.location;
  const origFetch = win.fetch.bind(win);

  // ── reporting ──
  const sentAt = new Map<string, number>();
  let budget = 25; // per page lifetime — a loop must not become a flood
  function send(body: WireFault): void {
    const key = `${body.event_type}|${String(body.payload_snapshot.action ?? '')}|${body.element_name ?? ''}|${body.error_message ?? ''}`;
    const now = Date.now();
    if ((sentAt.get(key) ?? 0) > now - 30_000 || budget <= 0) return;
    sentAt.set(key, now);
    budget -= 1;
    try {
      void origFetch(INGEST, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* never surface */
    }
  }

  // ── success counts (and flow steps) — batched, flushed on hide ──
  const counts = new Map<string, number>();
  function count(key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  function flush(): void {
    if (counts.size === 0) return;
    const body = JSON.stringify({ counts: [...counts].map(([a, ok]) => ({ a, ok })) });
    counts.clear();
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (!(win.navigator.sendBeacon && win.navigator.sendBeacon(INGEST, blob))) {
        void origFetch(INGEST, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => {});
      }
    } catch {
      /* dropped counts are acceptable; a thrown flush is not */
    }
  }
  win.addEventListener('pagehide', flush);
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') flush();
  });
  win.setInterval(flush, 60_000);

  // ── what was tapped last (an action's failure names the button) ──
  let lastTap: { label: string; at: number } | null = null;
  let netCount = 0;

  // ── fetch: actions, /api calls ──
  win.fetch = function observedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    netCount += 1;
    let actionId: string | null = null;
    let url = '';
    try {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      actionId = headers.get('next-action');
      url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    } catch {
      /* unreadable request — observe nothing */
    }
    const p = origFetch(input as RequestInfo, init);
    let apiPath: string | null = null;
    if (!actionId && url) {
      try {
        const u = new URL(url, loc.href);
        if (u.origin === loc.origin && u.pathname.startsWith('/api/') && !u.pathname.startsWith('/api/telemetry/')) {
          apiPath = u.pathname;
        }
      } catch {
        /* not a URL */
      }
    }
    if (!actionId && !apiPath) return p;

    const page = loc.pathname;
    const element = lastTap && Date.now() - lastTap.at < 3_000 ? lastTap.label : null;
    const action = apiPath ? `route:${normalizePath(apiPath)}` : null;
    let answered = false;
    const timer = win.setTimeout(() => {
      if (answered) return;
      send(wire('BUTTON_TIMEOUT', { action, actionId, element, page, message: `no answer after ${ACTION_TIMEOUT_MS / 1000}s` }));
    }, ACTION_TIMEOUT_MS);

    p.then(
      (res) => {
        answered = true;
        win.clearTimeout(timer);
        if (res.status >= 500) {
          // An action's 5xx is a THROW the server already recorded; an /api 5xx
          // may be a returned one, so it is recorded.
          if (apiPath) send(wire('ACTION_RETURNED_ERROR', { action, element, page, message: `HTTP ${res.status}` }));
          return;
        }
        if (apiPath) {
          count(`route:${apiPath}`);
          return;
        }
        const redirectFailure = redirectSaysFailed(res.headers.get('x-action-redirect'));
        if (redirectFailure) {
          send(wire('ACTION_RETURNED_ERROR', { actionId, element, page, message: redirectFailure }));
          return;
        }
        res
          .clone()
          .text()
          .then((text) => {
            const r = readActionResult(text);
            if (r.failed) send(wire('ACTION_RETURNED_ERROR', { actionId, element, page, message: r.message }));
            else count(`id:${actionId}`);
          })
          .catch(() => {});
      },
      () => {
        answered = true;
        win.clearTimeout(timer);
      },
    );
    return p;
  } as typeof fetch;

  // ── navigation (soft nav patches + popstate + hashchange) ──
  let pending: { path: string; hash: string; from: string; at: number } | null = null;
  function afterNav(): void {
    win.setTimeout(scanFlows, 700);
    const nav = pending;
    if (!nav || Date.now() - nav.at > 10_000) return;
    win.setTimeout(() => {
      if (pending !== nav) return;
      pending = null;
      const hash = nav.hash.slice(1);
      let sectionFound: boolean | null = null;
      if (hash) {
        let id = hash;
        try {
          id = decodeURIComponent(hash);
        } catch {
          /* keep raw */
        }
        const esc = (s: string) => s.replace(/["\\]/g, '\\$&');
        sectionFound = Boolean(
          doc.getElementById(id) ||
            doc.getElementsByName(id)[0] ||
            doc.querySelector(
              `[href$="#${esc(id)}"][aria-current],[href$="#${esc(id)}"][aria-selected="true"],[href$="#${esc(id)}"][data-active],[href$="#${esc(id)}"][data-state="active"]`,
            ),
        );
      }
      const verdict = judgeLanding({
        tappedPath: nav.path,
        tappedHash: nav.hash,
        fromPath: nav.from,
        landedPath: loc.pathname,
        notFoundShown: Boolean(doc.querySelector('[data-dead-end]')),
        sectionFound,
      });
      if (verdict) {
        send(
          wire('DEAD_END', {
            // One issue per DOOR: the dead address AND the page whose link
            // led there — the page is what gets retargeted.
            action: `${verdict.reason} ${normalizePath(verdict.to, true)} ← ${normalizePath(nav.from)}`,
            page: loc.pathname + loc.hash,
            from: nav.from,
            to: verdict.to,
            message: verdict.reason,
            extra: verdict.landed ? { landed: normalizePath(verdict.landed) } : {},
          }),
        );
      }
    }, 1_800);
  }
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = win.history[m].bind(win.history);
    win.history[m] = function patched(...args: Parameters<History['pushState']>) {
      const r = orig(...args);
      afterNav();
      return r;
    } as History['pushState'];
  }
  win.addEventListener('popstate', afterNav);
  win.addEventListener('hashchange', afterNav);

  // ── a page reached from one of OUR pages (hard navigation) ──
  try {
    const ref = doc.referrer ? new URL(doc.referrer) : null;
    if (ref && ref.origin === loc.origin) {
      pending = { path: loc.pathname, hash: loc.hash, from: ref.pathname, at: Date.now() };
      afterNav();
    }
  } catch {
    /* no referrer */
  }

  // ── flows ──
  let runs: FlowRuns = {};
  try {
    runs = JSON.parse(win.sessionStorage.getItem('sn-flow-runs') ?? '{}') as FlowRuns;
  } catch {
    runs = {};
  }
  function reach(flow: FlowDef, step: string): void {
    const counted = reachStep(runs, flow, step, Date.now());
    if (!counted) return;
    count(`flow:${flow.flow}:${counted}`);
    try {
      win.sessionStorage.setItem('sn-flow-runs', JSON.stringify(runs));
    } catch {
      /* private mode — runs live for this page only */
    }
  }
  function scanFlows(): void {
    for (const flow of FLOWS) {
      for (const s of flow.steps) {
        if (s.on !== 'view') continue;
        if (s.path && !s.path.test(loc.pathname)) continue;
        if (s.query && !s.query.test(loc.search)) continue;
        if (s.selector && !doc.querySelector(s.selector)) continue;
        if (!s.path && !s.query && !s.selector) continue;
        reach(flow, s.step);
      }
    }
  }
  function eventSteps(on: 'change' | 'submit' | 'tap', target: Element): void {
    for (const flow of FLOWS) {
      for (const s of flow.steps) {
        if (s.on !== on || !s.selector) continue;
        const hit = on === 'submit' ? target.matches(s.selector) : Boolean(target.closest(s.selector));
        if (hit) reach(flow, s.step);
      }
    }
  }
  doc.addEventListener(
    'change',
    (e) => {
      if (e.target instanceof Element) eventSteps('change', e.target);
    },
    true,
  );
  doc.addEventListener(
    'submit',
    (e) => {
      if (e.target instanceof Element) eventSteps('submit', e.target);
      win.setTimeout(scanFlows, 900);
    },
    true,
  );
  scanFlows();

  // ── taps ──
  const isRage = createRageCounter();
  let watching: (() => void) | null = null;
  doc.addEventListener(
    'click',
    (e) => {
      const target = e.target instanceof Element ? e.target : null;
      if (!target) return;
      eventSteps('tap', target);
      win.setTimeout(scanFlows, 900);
      const el = target.closest(TAPPABLE);
      if (!el) return;
      const label = labelOf(el);
      lastTap = { label, at: Date.now() };
      const page = loc.pathname;

      // Excluded: disabled, decorative, opt-outs, things whose answer happens
      // outside this page (new tab, download, phone, mail, file picker), and a
      // submit the browser refused because a field is invalid.
      const a = el instanceof HTMLAnchorElement ? el : null;
      const fileInput =
        el.querySelector('input[type="file"]') ||
        (el.closest('label')?.querySelector('input[type="file"]') ?? null);
      const form = el instanceof HTMLButtonElement && el.type === 'submit' ? el.form : null;
      if (
        (el as HTMLButtonElement).disabled ||
        el.getAttribute('aria-disabled') === 'true' ||
        el.closest('[data-decorative], [aria-hidden="true"], [inert], [data-tap-ok]') ||
        (a && (a.target === '_blank' || a.hasAttribute('download') || /^(?:tel|mailto|sms|javascript|blob|data):/i.test(a.getAttribute('href') ?? ''))) ||
        fileInput ||
        (form && !form.checkValidity())
      ) {
        return;
      }

      if (isRage(el, Date.now()) && !el.closest('[data-repeat-ok], [role="spinbutton"]') && !isRepeatableLabel(label)) {
        send(wire('RAGE_TAP', { action: `${normalizePath(page)} · ${normalizeLabel(label)}`, element: label, page, message: `tapped ${RAGE_TAPS}+ times in ${RAGE_WINDOW_MS / 1000}s` }));
      }

      // Dead-end tracking for in-app links.
      if (a) {
        try {
          const u = new URL(a.href, loc.href);
          if (u.origin === loc.origin) pending = { path: u.pathname, hash: u.hash, from: page, at: Date.now() };
        } catch {
          /* unparsable href */
        }
      }

      // Dead tap: did ANYTHING answer within the window?
      watching?.();
      const before = { href: loc.href, net: netCount, dialogs: doc.querySelectorAll(DIALOGS).length, active: doc.activeElement };
      const s: TapSignals = { navigated: false, requested: false, dialogOpened: false, mutatedNearby: false, scrolled: false, focusMoved: false, leftPage: false };
      let near: Element = el;
      for (let i = 0; i < 3 && near.parentElement && near.parentElement !== doc.body; i++) near = near.parentElement;
      const mo = new MutationObserver(() => {
        s.mutatedNearby = true;
      });
      mo.observe(near, { subtree: true, childList: true, attributes: true, characterData: true });
      const bodyMo = new MutationObserver(() => {
        s.mutatedNearby = true; // a portal: sheet / toast appended to <body>
      });
      bodyMo.observe(doc.body, { childList: true });
      const onScroll = () => {
        s.scrolled = true;
      };
      const onLeave = () => {
        s.leftPage = true;
      };
      const onInput = () => {
        s.mutatedNearby = true;
      };
      win.addEventListener('scroll', onScroll, true);
      win.addEventListener('blur', onLeave);
      doc.addEventListener('visibilitychange', onLeave);
      doc.addEventListener('input', onInput, true);
      doc.addEventListener('change', onInput, true);
      const stop = () => {
        mo.disconnect();
        bodyMo.disconnect();
        win.removeEventListener('scroll', onScroll, true);
        win.removeEventListener('blur', onLeave);
        doc.removeEventListener('visibilitychange', onLeave);
        doc.removeEventListener('input', onInput, true);
        doc.removeEventListener('change', onInput, true);
        win.clearTimeout(timer);
        if (watching === stop) watching = null;
      };
      const timer = win.setTimeout(() => {
        s.navigated = loc.href !== before.href;
        s.requested = netCount !== before.net;
        s.dialogOpened = doc.querySelectorAll(DIALOGS).length !== before.dialogs;
        s.focusMoved = doc.activeElement !== before.active && doc.activeElement !== el;
        const connected = el.isConnected;
        stop();
        if (connected && isDeadTap(s)) {
          send(wire('DEAD_TAP', { action: `${normalizePath(page)} · ${normalizeLabel(label)}`, element: label, page, message: `nothing happened within ${DEAD_TAP_WINDOW_MS / 1000}s` }));
        }
      }, DEAD_TAP_WINDOW_MS);
      watching = stop;
    },
    true,
  );

  // ── crashes nobody caught ──
  const crash = (message: string, extra: Record<string, unknown>) => {
    if (!message || isIgnorableError(message)) return;
    send(wire('PAGE_CRASH', { action: `uncaught ${normalizePath(loc.pathname)}`, page: loc.pathname, message, extra }));
  };
  win.addEventListener('error', (e) => {
    // Resource load errors (an <img> 404) have no `error` and are not crashes.
    if (!(e instanceof ErrorEvent) || !e.error) return;
    crash(`${(e.error as Error).name ?? 'Error'}: ${e.message}`, { source: 'window.error' });
  });
  win.addEventListener('unhandledrejection', (e) => {
    const r = e.reason as unknown;
    crash(r instanceof Error ? `${r.name}: ${r.message}` : String(r ?? ''), { source: 'unhandledrejection' });
  });
}
