/**
 * Problems (Connection Logs) · the PURE half of failure recording — what a
 * failure is called, how it is scrubbed, and how identical failures are made
 * to look identical so they group into ONE issue.
 *
 * Pure module: no imports, safe from the server, the browser observer and the
 * tests. The database derives the fingerprint as
 * `md5(kind | action | normalisedMessage)` (record_app_fault, migration
 * 20271260713505), so everything that decides "same problem or not" is here.
 *
 * 🔒 NO PERSONAL DATA. `lib/telemetry/redact.ts` scrubs payload KEYS; it never
 * looked inside a message, and an error message is exactly where a guest's
 * email or a couple's names end up ("Maria Santos is already on the list").
 * `scrubText` is that missing half and every write path runs it.
 */

/** Every kind of failure the Problems list knows. Mirrors the DB CHECK. */
export const FAULT_KINDS = [
  'BUTTON_FAIL',
  'SUPABASE_SAVE_ERROR',
  'BLANK_FALLBACK',
  'OTHER',
  'SERVER_THROWN',
  'ACTION_RETURNED_ERROR',
  'DB_WRITE_REFUSED',
  'DB_READ_REFUSED',
  'DB_ZERO_ROW',
  'DB_UNREACHABLE',
  'BUTTON_TIMEOUT',
  'UPLOAD_STALLED',
  'PAGE_CRASH',
  'DEAD_END',
  'DEAD_TAP',
  'RAGE_TAP',
  'DROP_OFF',
] as const;
export type FaultKind = (typeof FAULT_KINDS)[number];

/**
 * Kinds a BROWSER may report through the public ingest. The server-only kinds
 * (a thrown server error, a refused database call) are coerced to OTHER if a
 * browser claims them — the public door cannot forge a server finding.
 */
export const BROWSER_KINDS: ReadonlySet<string> = new Set([
  'BUTTON_FAIL',
  'SUPABASE_SAVE_ERROR',
  'BLANK_FALLBACK',
  'OTHER',
  'ACTION_RETURNED_ERROR',
  'BUTTON_TIMEOUT',
  'UPLOAD_STALLED',
  'PAGE_CRASH',
  'DEAD_END',
  'DEAD_TAP',
  'RAGE_TAP',
]);

export function coerceBrowserKind(value: unknown): FaultKind {
  return typeof value === 'string' && BROWSER_KINDS.has(value) ? (value as FaultKind) : 'OTHER';
}

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
// 7+ digits with optional + and separators — a PH mobile (0917 123 4567,
// +63 917-123-4567) or a landline. Runs AFTER ids so a uuid is not eaten.
const PHONE_RE = /\+?\d[\d\s().-]{5,}\d/g;
const UUID_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
// Canonical entity ids: S89<TYPE>-<10 Crockford>.
const PUBLIC_ID_RE = /\bS89[A-Z]{1,4}-[0-9A-Z]{6,}\b/g;
const LONG_TOKEN_RE = /\b[A-Za-z0-9_-]{32,}\b/g;
// Anything quoted is a VALUE someone typed or a row held — never the shape of
// the failure. 'x', "x", “x”, ‘x’, «x».
const QUOTED_RE = /'[^'\n]{1,200}'|"[^"\n]{1,200}"|“[^”\n]{1,200}”|‘[^’\n]{1,200}’|«[^»\n]{1,200}»/g;
// Two or more Capitalised words in a row — "Maria Santos", "Juan dela Cruz".
// Error class names (TypeError, PostgrestError) are single words, so they
// survive; the price is that a Title Case UI phrase is also blanked, which is
// the safe direction for a log that must hold no names.
const NAME_PAIR_RE =
  /\b[A-ZÑ][a-zñ'’]+(?:\s+(?:(?:de|del|dela|de la|delos|y|van|von|da|dos|di)\s+)?[A-ZÑ][a-zñ'’]+)+\b/g;
// A single Capitalised word right after a word that introduces a person.
const NAME_AFTER_RE =
  /\b(for|to|from|by|guest|couple|vendor|supplier|named|name|dear|hi|hello)\s+[A-ZÑ][a-zñ'’]+/gi;

/**
 * Remove personal data from free text. Order matters: emails before phones
 * (an email's digits), ids before phones (a uuid's digits), names last.
 */
export function scrubText(
  input: string | null | undefined,
  max = 1000,
  opts: { keepIds?: boolean } = {},
): string {
  if (!input) return '';
  let s = String(input);
  // Ids are not personal data and are the most useful thing in a payload, so a
  // payload keeps them — but parked first, because a uuid's digit run would
  // otherwise read as a phone number.
  const parked: string[] = [];
  const park = (m: string) => `\u0000${parked.push(m) - 1}\u0000`;
  s = s.replace(EMAIL_RE, '[email]');
  s = s.replace(UUID_RE, opts.keepIds ? park : '[id]');
  s = s.replace(PUBLIC_ID_RE, opts.keepIds ? park : '[id]');
  s = s.replace(LONG_TOKEN_RE, '[token]');
  s = s.replace(QUOTED_RE, '"[value]"');
  s = s.replace(PHONE_RE, '[phone]');
  s = s.replace(NAME_PAIR_RE, '[name]');
  s = s.replace(NAME_AFTER_RE, (_m, lead: string) => `${lead} [name]`);
  if (parked.length) s = s.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => parked[Number(i)] ?? '[id]');
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/**
 * The fingerprint form of a message: scrubbed, then every remaining number
 * collapsed, whitespace squeezed, stack frames dropped — so "timed out after
 * 15012ms" and "timed out after 15007ms" are ONE issue.
 */
export function normalizeMessage(input: string | null | undefined): string {
  const firstLine = String(input ?? '').split('\n')[0] ?? '';
  return scrubText(firstLine, 400)
    .replace(/\d+(?:[.,]\d+)*/g, 'N')
    .replace(/\s+/g, ' ')
    .trim();
}

// Segments that are ids, not route names.
function isIdSegment(seg: string): boolean {
  return (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) ||
    /^S89[A-Z]{1,4}-[0-9A-Z]{6,}$/i.test(seg) ||
    /\d{4,}/.test(seg) ||
    /^\d+$/.test(seg) ||
    seg.length >= 24
  );
}

/**
 * Top-level route segments that are real pages. Anything else at the top level
 * is the public `[slug]` route (an event's own address — often the couple's
 * names), so it is blanked to `[slug]`. Kept honest by
 * `lib/telemetry/every-failure-is-recorded.test.ts`, which compares it with the
 * directories under `app/` (route groups flattened, `_private` and `[dynamic]`
 * skipped) — add a top-level page and that test names this list.
 */
export const TOP_LEVEL_SEGMENTS: ReadonlySet<string> = new Set([
  '3d_plan', 'about', 'acceptable-use', 'admin', 'alaala', 'api', 'auth', 'blog',
  'budget', 'claim', 'cookies', 'creators', 'dashboard', 'demo-capture', 'dev',
  'download', 'explore', 'favicon.ico', 'features', 'for-suppliers',
  'forgot-password', 'guest-list', 'health', 'help', 'host', 'join', 'live',
  'llms.txt', 'login', 'marketplace', 'monogram', 'mood-board', 'onboarding',
  'open-shop', 'our-story', 'pa3d', 'pakanta', 'palogo', 'panood', 'papic',
  'patiktok', 'pawebsite', 'pay', 'pricing', 'privacy', 'proposals',
  'realstories', 'receipts', 'refunds', 'reset-password', 'samahan', 'schedule',
  'seat-plan', 'setnayan-ai', 'signup', 'site-editor', 'sitemap-blog.xml',
  'sitemap-features.xml', 'sitemap-help.xml', 'sitemap-static.xml',
  'sitemap-suppliers.xml', 'sitemap-vendors.xml', 'sitemap-weddings.xml',
  'sitemap.xml', 'suppliers', 'terms', 'tl', 'tour', 'u', 'v', 'vendor',
  'vendor-dashboard', 'vendor-invite', 'waitlist', 'wall', 'web-only',
]);

/**
 * A path a person was on, with no personal data and no query string: id-like
 * segments → `[id]`, an unknown top-level segment → `[slug]`, an email →
 * `[email]`. The hash (a #section) is kept when asked, scrubbed the same way.
 */
export function normalizePath(raw: string | null | undefined, keepHash = false): string {
  if (!raw) return '';
  let path = String(raw);
  let hash = '';
  try {
    if (/^https?:\/\//i.test(path)) {
      const u = new URL(path);
      path = u.pathname;
      hash = u.hash;
    } else {
      const h = path.indexOf('#');
      if (h >= 0) {
        hash = path.slice(h);
        path = path.slice(0, h);
      }
      const q = path.indexOf('?');
      if (q >= 0) path = path.slice(0, q);
    }
  } catch {
    path = path.split(/[?#]/)[0] ?? '';
  }
  const segs = path.split('/').filter(Boolean).map((seg) => {
    let s = seg;
    try {
      s = decodeURIComponent(seg);
    } catch {
      /* keep raw */
    }
    if (/@/.test(s)) return '[email]';
    if (isIdSegment(s)) return '[id]';
    return s.slice(0, 60);
  });
  if (segs.length > 0 && !TOP_LEVEL_SEGMENTS.has(segs[0]!)) segs[0] = '[slug]';
  let out = `/${segs.join('/')}`;
  if (keepHash && hash.length > 1) {
    const h = hash.slice(1);
    out += `#${isIdSegment(h) || /@/.test(h) ? '[id]' : scrubText(h, 60)}`;
  }
  return out;
}

/** A tapped element's label — scrubbed, squeezed, numbers collapsed, short. */
export function normalizeLabel(raw: string | null | undefined): string {
  return scrubText(String(raw ?? '').replace(/\s+/g, ' ').trim(), 120)
    .replace(/\d+(?:[.,]\d+)*/g, 'N')
    .slice(0, 80);
}

// ── PostgREST responses (server fetch layer) ─────────────────────────────────

export type PostgrestVerdict =
  | { kind: 'DB_WRITE_REFUSED' | 'DB_READ_REFUSED'; action: string; message: string }
  | { kind: 'DB_ZERO_ROW'; action: string; message: string }
  | null;

/** Tables / RPCs whose own failures must never be recorded (it would recurse). */
const SELF = /\/(app_telemetry_logs|app_fault_issues|app_action_daily_counts|rpc\/(record_app_fault|bump_app_action_counts|close_quiet_fault_issues|check_rate_limit))\b/;

function restTarget(url: string): string | null {
  const m = /\/rest\/v1\/([^?#]+)/.exec(url);
  return m ? m[1]!.slice(0, 120) : null;
}

/**
 * Is every filter on this PATCH/DELETE an `eq.` and at least one of them on an
 * id column? That is a TARGETED write — "change THIS row" — and matching
 * nothing is the shape `lib/a-write-that-matched-nothing.ts` documents
 * ("saved" with nothing written). A sweep (`status=eq.active`, `in.(…)`,
 * `lt.`) legitimately matches nothing and is not recorded.
 */
export function isTargetedWrite(url: string): boolean {
  const q = url.indexOf('?');
  if (q < 0) return false;
  const params = new URLSearchParams(url.slice(q + 1));
  let targeted = false;
  for (const [key, value] of params) {
    if (key === 'select' || key === 'columns' || key === 'on_conflict') continue;
    if (!value.startsWith('eq.')) return false;
    if (/(^|_)id$/.test(key)) targeted = true;
  }
  return targeted;
}

/**
 * Classify one PostgREST response. `contentRange` is PostgREST's header — on a
 * PATCH/DELETE it reads `*\/*` when no row matched and `0-0/*` for one row.
 * `errorCode`/`errorMessage` come from the error body when there is one.
 */
export function classifyPostgrest(input: {
  method: string;
  url: string;
  status: number;
  contentRange?: string | null;
  bodyText?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
}): PostgrestVerdict {
  const target = restTarget(input.url);
  if (!target || SELF.test(input.url)) return null;
  const method = input.method.toUpperCase();
  const isWrite = method !== 'GET' && method !== 'HEAD';
  const action = `${method} ${target}`;

  if (input.status >= 400) {
    const code = input.errorCode ?? '';
    // `.single()` on an optional row — a read that found nothing, not a fault.
    if (!isWrite && code === 'PGRST116') return null;
    const message = normalizeMessage([code, input.errorMessage].filter(Boolean).join(': ') || `HTTP ${input.status}`);
    return {
      kind: isWrite ? 'DB_WRITE_REFUSED' : 'DB_READ_REFUSED',
      action,
      message,
    };
  }

  if ((method === 'PATCH' || method === 'DELETE') && isTargetedWrite(input.url)) {
    const range = (input.contentRange ?? '').trim();
    const body = (input.bodyText ?? '').trim();
    if (range.startsWith('*/') || body === '[]') {
      return { kind: 'DB_ZERO_ROW', action, message: 'the write matched no row — nothing changed' };
    }
  }
  return null;
}

// ── Server Action responses (browser observer) ───────────────────────────────

/**
 * Read a Server Action's reply (an RSC stream) for a RETURNED failure. Row 0
 * names the chunk holding the action's return value (`"a":"$@N"`); only that
 * row is inspected, so a revalidated page tree that happens to contain
 * `ok:false` somewhere cannot be mistaken for the action's answer.
 */
export function readActionResult(text: string): { failed: boolean; message: string } {
  const lines = text.split('\n');
  const row0 = lines.find((l) => l.startsWith('0:')) ?? '';
  const ref = /"a":"\$@([0-9a-f]+)"/.exec(row0);
  let value: string | undefined;
  if (ref) {
    const prefix = `${ref[1]}:`;
    value = lines.find((l) => l.startsWith(prefix))?.slice(prefix.length);
  } else {
    // Older shape: the value is inline in row 0 under "a".
    const inline = /"a":(\{.*\})\s*[,}]/.exec(row0);
    value = inline?.[1];
  }
  if (!value) return { failed: false, message: '' };
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return { failed: false, message: '' };
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return { failed: false, message: '' };
  const o = parsed as Record<string, unknown>;
  const failed = o.ok === false || (o.ok === undefined && typeof o.error === 'string' && o.error.length > 0);
  if (!failed) return { failed: false, message: '' };
  const raw = typeof o.error === 'string' ? o.error : typeof o.message === 'string' ? o.message : 'returned ok:false';
  return { failed: true, message: raw };
}

/** A Server Action that redirected with `?error=` / `?notice=…failed` is a returned failure too. */
export function redirectSaysFailed(location: string | null | undefined): string | null {
  if (!location) return null;
  const q = location.indexOf('?');
  if (q < 0) return null;
  const params = new URLSearchParams(location.slice(q + 1).split(';')[0]);
  const err = params.get('error');
  if (err) return `redirected with error=${err}`;
  for (const [k, v] of params) {
    if (/(^|_)(failed|error|refused)$/.test(v) && (k === 'notice' || k === 'rsvp' || k === 'status')) {
      return `redirected with ${k}=${v}`;
    }
  }
  return null;
}
