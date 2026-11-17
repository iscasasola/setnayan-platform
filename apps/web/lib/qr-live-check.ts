/**
 * qr-live-check.ts — OPENING THE REGISTRY PAGE A PAPER'S QR POINTS AT, safely.
 *
 * Adopted spec item 3 (controller, 2026-11-14): when a DTI / SEC / BIR paper's
 * QR decodes to the registry's own https page, the server may open that page
 * and read the business name, number, status and validity off it — a stronger
 * proof than "the number is in the link". It is NEVER a pass on its own and it
 * NEVER refuses anybody: a page that is JavaScript-only, unreachable, or says
 * nothing we can parse simply leaves check 4 on the number-in-link rule.
 *
 * ── WHY THIS IS SAFE TO DO FROM OUR SERVER (SSRF) ───────────────────────────
 * The URL is printed by a stranger. So, all at once and every hop:
 *   · https only, GET only, no cookies, no auth header, nothing of ours sent;
 *   · the host must be ON THE ALLOWLIST below — a whole-label match, never a
 *     substring (`dti.gov.ph.evil.com` and `xbir.gov.ph` fail);
 *   · the name is resolved FIRST and every address must be public — loopback,
 *     private, link-local, CGNAT, multicast, metadata and v6 equivalents are
 *     refused — and the connection is pinned to the address that was checked,
 *     so a second, different DNS answer cannot slip in between check and use;
 *   · a redirect is followed only to another allowlisted https host, at most 3;
 *   · 10 s for the whole thing, 1 MB of body, then we stop reading.
 *
 * This file is PURE (the rules and the HTML reading). The socket half, with its
 * injectable resolver and requester, is `qr-live-check.server.ts`.
 */

/** Exact hosts, and roots whose subdomains also count. LGU portals: not yet (owner). */
export const LIVE_CHECK_EXACT_HOSTS: ReadonlySet<string> = new Set([
  'bnrs.dti.gov.ph',
  'dti.gov.ph',
  'www.dti.gov.ph',
]);
export const LIVE_CHECK_ROOT_HOSTS: readonly string[] = ['sec.gov.ph', 'bir.gov.ph'];

export const LIVE_CHECK_TIMEOUT_MS = 10_000;
export const LIVE_CHECK_MAX_BYTES = 1_000_000;
export const LIVE_CHECK_MAX_REDIRECTS = 3;

function normHost(h: string): string {
  return h.toLowerCase().replace(/\.$/, '');
}

/** Is this URL one the server may open? https, no credentials, default port, allowlisted host. */
export function liveCheckAllowed(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '443') return null;
  const h = normHost(url.hostname);
  // A literal IP is never an allowlisted host.
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h) || h.includes(':') || h.startsWith('[')) return null;
  const ok =
    LIVE_CHECK_EXACT_HOSTS.has(h) || LIVE_CHECK_ROOT_HOSTS.some((r) => h === r || h.endsWith(`.${r}`));
  return ok ? url : null;
}

function v4ToInt(ip: string): number | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip);
  if (!m) return null;
  const parts = m.slice(1).map(Number);
  if (parts.some((p) => p > 255)) return null;
  return ((parts[0]! << 24) >>> 0) + (parts[1]! << 16) + (parts[2]! << 8) + parts[3]!;
}

const V4_BLOCKED: ReadonlyArray<[string, number]> = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8],
  ['169.254.0.0', 16], // link-local + cloud metadata
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved + broadcast
];

/** True only for a routable, public address. Anything we cannot parse is NOT public. */
export function ipIsPublic(ip: string): boolean {
  const v4 = v4ToInt(ip);
  if (v4 !== null) {
    return !V4_BLOCKED.some(([base, bits]) => {
      const b = v4ToInt(base)!;
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return ((v4 & mask) >>> 0) === ((b & mask) >>> 0);
    });
  }
  const v6 = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (!v6.includes(':')) return false;
  if (v6 === '::' || v6 === '::1') return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped) return ipIsPublic(mapped[1]!);
  if (/^::ffff:/.test(v6)) return false;
  const first = parseInt(v6.split(':')[0] || '0', 16);
  if (Number.isNaN(first)) return false;
  if ((first & 0xfe00) === 0xfc00) return false; // fc00::/7 unique local
  if ((first & 0xffc0) === 0xfe80) return false; // fe80::/10 link-local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  if (first === 0x2001 && v6.startsWith('2001:db8')) return false; // documentation
  if (first === 0x64 && v6.startsWith('64:ff9b')) return false; // NAT64 → could reach v4 private
  return (first & 0xe000) === 0x2000; // 2000::/3 — global unicast only
}

/** What the page said, in plain fields. Nothing here is a verdict. */
export type LivePageResult = {
  url: string;
  /** reached = we got a 2xx HTML page; then `text` was searched. */
  outcome: 'reached' | 'not_allowed' | 'blocked_address' | 'redirect_off_list' | 'timeout' | 'unreachable' | 'not_html' | 'http_error';
  httpStatus: number | null;
  /** Did the page's text contain the paper's registration number? */
  numberOnPage: boolean | null;
  /** Did the page's text contain the paper's registered name (folded)? */
  nameOnPage: boolean | null;
  status: string | null;
  validity: string | null;
  /** True when the page looks like a script-only shell (nothing to read). */
  scriptOnly: boolean;
  note: string;
};

function foldText(s: string): string {
  return s
    .normalize('NFKD')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Strip tags/scripts/styles; decode the handful of entities registries use. */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Read the page for the paper's own name and number. A page we cannot read
 * returns nulls — "we do not know" — never false.
 */
export function readRegistryPage(
  html: string,
  paper: { name: string | null; number: string | null },
): Pick<LivePageResult, 'numberOnPage' | 'nameOnPage' | 'status' | 'validity' | 'scriptOnly'> {
  const text = htmlToText(html);
  const scriptOnly = text.length < 80 && /<script/i.test(html);
  if (scriptOnly || text.length === 0) {
    return { numberOnPage: null, nameOnPage: null, status: null, validity: null, scriptOnly: true };
  }
  const page = ` ${foldText(text)} `;
  const pageDigits = text.replace(/[^0-9a-z]/gi, '').toLowerCase();
  const num = paper.number ? paper.number.replace(/[^0-9a-z]/gi, '').toLowerCase() : '';
  const name = paper.name ? foldText(paper.name) : '';
  // One or two words after "Status:" — "Registered", "Active", "Not Registered".
  const status = /\bstatus\s*[:\-]\s*((?:not\s+)?[A-Za-z]{3,20})\b/i.exec(text)?.[1]?.trim() ?? null;
  const validity =
    /\b(?:valid(?:ity)?(?:\s+until|\s+to)?|expir(?:y|ation|es)(?:\s+date)?)\s*[:\-]?\s*([A-Za-z0-9 ,\/-]{6,30})/i
      .exec(text)?.[1]
      ?.trim() ?? null;
  return {
    numberOnPage: num.length >= 5 ? pageDigits.includes(num) : null,
    nameOnPage: name.length >= 3 ? page.includes(` ${name} `) : null,
    status,
    validity,
    scriptOnly: false,
  };
}
