/**
 * THE CONTROL SWEEP'S RULES — what it opens, what it will not press, and what
 * it does not count as a failure. Pure (no browser), so a unit guard holds them:
 * `lib/the-control-sweep-skips-what-it-must.test.ts`.
 *
 * The sweep itself is `sweep.spec.ts`. It signs in as the rehearsal couple and
 * the rehearsal supplier and presses every control on every dashboard screen,
 * in the throw-away rehearsal stack only (`local-only.ts`).
 */

// ── 1 · THE ROUTES, FROM THE APP'S OWN MAP ─────────────────────────────────

/** One row of `lib/ugat/screens.generated.json` (the fields the sweep reads). */
export type ScreenRow = {
  route: string;
  file: string;
  area: string;
  status: string;
  redirectsTo: string | null;
};

export type Persona = 'couple' | 'supplier';

export type RoutePlan = {
  /** Screens to open, in order: every one without a [param] first, then the rest. */
  sweep: ScreenRow[];
  /** Screens left out on purpose, each with its reason (printed in the report). */
  left: Array<{ route: string; reason: string }>;
};

const ROOT: Record<Persona, string> = {
  couple: '/dashboard/[eventId]',
  supplier: '/vendor-dashboard',
};

/**
 * Every screen under the persona's dashboard root, from the generated route
 * map — never a hand-typed list, so a new page is swept the day it ships.
 * A screen that only redirects is left out with its target named (its target
 * is swept on its own). A print-only sheet is still opened.
 */
export function planRoutes(screens: readonly ScreenRow[], persona: Persona): RoutePlan {
  const root = ROOT[persona];
  const mine = screens.filter((s) => s.route === root || s.route.startsWith(`${root}/`));
  const left: RoutePlan['left'] = [];
  const sweep: ScreenRow[] = [];
  for (const s of mine) {
    if (s.redirectsTo) {
      left.push({ route: s.route, reason: `only redirects (to ${s.redirectsTo}); its target is swept on its own` });
      continue;
    }
    sweep.push(s);
  }
  // [eventId] is always the fixture's own event, so it does not make a screen wait for a found address.
  const params = (r: string) => (r.slice(root.length).match(/\[(?!eventId\])[^\]]+\]/g) ?? []).length;
  sweep.sort((a, b) => params(a.route) - params(b.route) || a.route.localeCompare(b.route));
  return { sweep, left };
}

/** `[eventId]`, `[guestId]`… in order of appearance. */
export function routeParams(route: string): string[] {
  return (route.match(/\[([^\]]+)\]/g) ?? []).map((p) => p.slice(1, -1));
}

/** A regex that matches a concrete pathname of this route, one group per param. */
export function routePattern(route: string): RegExp {
  const body = route
    .split(/(\[[^\]]+\])/)
    .map((part) => (/^\[[^\]]+\]$/.test(part) ? '([^/?#]+)' : part.replace(/[.*+?^${}()|\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
}

/** Fill a route's params from a map; null when one has no value. */
export function fillRoute(route: string, values: Readonly<Record<string, string>>): string | null {
  let missing = false;
  const out = route.replace(/\[([^\]]+)\]/g, (_, name: string) => {
    const v = values[name];
    if (!v) {
      missing = true;
      return '';
    }
    return encodeURIComponent(v);
  });
  return missing ? null : out;
}

// ── 2 · WHAT IS NEVER PRESSED ──────────────────────────────────────────────

export type SkipRule = { rule: RegExp; reason: string };

/**
 * Matched against the control's ACCESSIBLE NAME (aria-label, else its text,
 * else its title; an unnamed icon button is named "(icon: trash-2)" from its
 * lucide icon, so a bare bin icon is still caught). Destructive, money and
 * outward-facing controls only. A plain "Cancel" / "Close" / "Done" is NOT
 * here: those close the sheets the sweep opens.
 */
export const SKIP_CONTROLS: readonly SkipRule[] = [
  { rule: /\b(delete|remove|trash|erase|discard|wipe|destroy|clear all|reset|revoke|archive|deactivate|unpublish|disconnect|unlink|leave|transfer|release|unassign|forget)\b|\bicon: (trash|trash-2|eraser|log-out|user-minus|user-x)\b/i, reason: 'destructive' },
  { rule: /\b(pay|payment|checkout|check out|buy|purchase|upgrade|subscribe|renew|top[- ]?up|refund|withdraw|cash ?out|get (event )?(plus|pro|ultra)|mark (as )?paid|record (a )?payment)\b|\bicon: (credit-card|wallet|banknote)\b/i, reason: 'money' },
  { rule: /\b(send|resend|re-send|email|e-mail|notify|remind|nudge|share|post|publish|go live|launch|broadcast|announce|invite (all|everyone)|submit|apply|request|book|accept|approve|confirm|sign|lock|report|flag|block|ban|dispute|escalate)\b|\bicon: (send|send-horizontal|share|share-2|megaphone|flag)\b/i, reason: 'outward-facing (it tells, sends to or binds someone else)' },
  { rule: /\b(sign out|log ?out|switch account|switch to|delete account)\b/i, reason: 'signs the account out' },
  { rule: /\b(finali[sz]e|close (the )?(rsvps?|replies|shop|account|event)|end (the )?(event|day|live|stream)|start (the )?(day|live|stream|broadcast))\b/i, reason: 'changes the event\'s stage for everyone' },
  { rule: /^cancel\s+(the\s+)?(booking|order|event|subscription|plan|request|invite|invitation|reservation|payment)/i, reason: 'destructive' },
];

/**
 * Options inside a dropdown are picked even when their words would match the
 * button list (a reply dropdown's "Declines" is exactly what must be picked).
 * Only these are never picked.
 */
export const SKIP_OPTIONS: readonly SkipRule[] = [
  { rule: /\b(delete|remove|trash|archive|revoke|discard|erase)\b/i, reason: 'destructive' },
  { rule: /\b(pay|checkout|buy|purchase|upgrade|subscribe|refund)\b/i, reason: 'money' },
  { rule: /\b(send|resend|email|share|publish|post)\b/i, reason: 'outward-facing' },
  { rule: /\b(sign out|log ?out)\b/i, reason: 'signs the account out' },
];

export function skipReason(name: string, list: readonly SkipRule[] = SKIP_CONTROLS): string | null {
  const n = name.replace(/\s+/g, ' ').trim();
  for (const r of list) if (r.rule.test(n)) return r.reason;
  return null;
}

// ── 3 · WHAT FAILS THE SWEEP, AND THE ENVIRONMENT NOISE THAT DOES NOT ──────

/**
 * The words every error boundary in the app puts in its heading. The root
 * boundary and `global-error.tsx` say the first; the supplier console, the seat
 * plan and Next's own fallback say the others.
 */
export const ERROR_SCREEN_TEXT =
  /Something on our end didn.t work|Your shop console is temporarily unavailable|This seat plan hit a snag|Application error: a client-side exception has occurred/i;

/**
 * The rehearsal stubs storage and refuses every address that is not this
 * machine (`release-rehearsal.yml`). These console lines and responses are what
 * those stubs make — they are counted and printed, never counted as a failure.
 * Anything not matched here IS a failure.
 */
export type Noise = { id: string; why: string; console?: RegExp; url?: RegExp };

export const NOISE: readonly Noise[] = [
  {
    id: 'refused-outside-address',
    why: 'the browser refuses every address that is not this runner (the rehearsal seal)',
    console: /net::ERR_BLOCKED_BY_CLIENT/,
  },
  {
    id: 'storage-stub',
    why: 'file storage points at a port nothing listens on (R2_PUBLIC_URL = 127.0.0.1:54330), so no picture loads',
    console: /127\.0\.0\.1:54330|net::ERR_CONNECTION_REFUSED/,
    url: /^https?:\/\/127\.0\.0\.1:54330\/|\/_next\/image\?url=(https?%3A%2F%2F127\.0\.0\.1%3A54330|https?%3A%2F%2F(?!localhost|127\.0\.0\.1))/i,
  },
  {
    id: 'navigation-cut',
    why: 'a request the sweep cut short by moving on (the page was left mid-load)',
    console: /net::ERR_ABORTED|The operation was aborted|AbortError/,
  },
];

export function consoleNoise(text: string, sourceUrl: string): Noise | null {
  for (const n of NOISE) {
    if (n.console && n.console.test(text)) return n;
    if (n.url && sourceUrl && /Failed to load resource/.test(text) && n.url.test(sourceUrl)) return n;
  }
  return null;
}

export function responseNoise(url: string): Noise | null {
  for (const n of NOISE) if (n.url && n.url.test(url)) return n;
  return null;
}

/** One failure text, without the run-specific parts, so the same bug on 30 routes is one line. */
export function failureKey(kind: string, text: string): string {
  return `${kind}|${text
    // An address's query (?phase=rsvp&style=…) is the screen's state, not the bug.
    .replace(/(https?:\/\/[^\s'"?]+)\?[^\s'")]*/g, '$1?…')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<id>')
    .replace(/\b\d{2,}\b/g, '<n>')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)}`;
}
