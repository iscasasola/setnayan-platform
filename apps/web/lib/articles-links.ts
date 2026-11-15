/**
 * articles-links — THE ONE LINK RULE FOR ARTICLES.
 *
 * Owner, 16 Nov 2026 (DECISION_LOG, specs repo): *"its limitations is that it
 * only allows links from setnayan.com"*. The Articles prototype
 * (prototypes/articles_2026-11-16/, screen 4) refuses any other link "as they
 * type, and again on the server before it posts".
 *
 * 🔑 ONE FUNCTION, TWO CALLERS. The composer (`articles-composer.tsx`) calls
 * `refusedLinks` on every keystroke to show the line and lock Send; the write
 * route (`app/api/articles/route.ts`) calls the SAME function before any row
 * is written. A browser that skips the first check (or a script that never
 * loaded it) still meets the second. Two copies of the rule would be two places
 * for it to disagree. Held by `lib/articles-only-setnayan-links.test.ts`.
 *
 * What counts as a link — anything a reader could follow or paste:
 *   · a scheme link            https://… · http://…
 *   · a www. host              www.tala.studio
 *   · a bare host + known TLD  instagram.com/tala.studio · bit.ly/x · shop.ph
 *   · an email-shaped address  tala@gmail.com (it carries a host)
 * A link is allowed only when its host is exactly `setnayan.com` or
 * `www.setnayan.com`. `setnayan.com.evil.io` and `notsetnayan.com` are other
 * hosts and are refused.
 *
 * ⚠ NOT SOLVED HERE, ON PURPOSE: a link spelled out to dodge a checker
 * ("instagram dot com"). That is a moderation call (Report → Admin › User
 * reports), not a regex.
 *
 * Pure — no imports, safe in the client bundle.
 */

export const ARTICLES_ALLOWED_HOSTS: readonly string[] = ['setnayan.com', 'www.setnayan.com'];

/** The line the prototype shows under a refused link (screen 4). */
export const ARTICLES_LINK_REFUSED_LINE =
  'Links can only point to setnayan.com. Share their Setnayan page instead — every shop has one.';

// Top-level domains a bare host must end in to count as a link. A bare
// `word.word` without a scheme is ordinary prose far more often than a link
// ("hi.there", "e.g."), so a bare host needs a TLD people actually share.
const BARE_TLDS = [
  'com', 'net', 'org', 'ph', 'io', 'co', 'me', 'app', 'ly', 'gl', 'gg', 'tv', 'info', 'biz',
  'xyz', 'link', 'site', 'shop', 'store', 'page', 'dev', 'ai', 'to', 'us', 'uk', 'au', 'sg',
  'ca', 'de', 'fm', 'be', 'online', 'club', 'live', 'studio', 'art', 'photo', 'photography',
  'events', 'wedding', 'gov', 'edu', 'asia', 'ws', 'cc', 'id', 'my', 'jp', 'kr', 'cn', 'in',
] as const;

const SCHEME_LINK = /\b[a-z][a-z0-9+.-]*:\/\/[^\s<>"']+/gi;
const WWW_LINK = /\bwww\.[^\s<>"']+/gi;
const BARE_HOST = new RegExp(
  String.raw`(?<![\w@./-])(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:${BARE_TLDS.join('|')})(?![a-z0-9-])(?:[/?#][^\s<>"']*)?`,
  'gi',
);
const EMAIL = /\b[a-z0-9._%+-]+@((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi;

export type FoundLink = {
  /** The text as typed. */
  raw: string;
  /** The host it points at, lower-cased, no port. */
  host: string;
  /** True when the host is setnayan.com (or www.). */
  allowed: boolean;
  /** Where the match starts in the text. */
  index: number;
};

function trimTrailingPunctuation(raw: string): string {
  return raw.replace(/[).,;:!?'"\]]+$/, '');
}

function hostOf(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '');
  // strip user-info ("a@b.com/...") so the HOST is judged, not the user part
  const at = s.indexOf('@');
  const slash = s.search(/[/?#]/);
  if (at !== -1 && (slash === -1 || at < slash)) s = s.slice(at + 1);
  s = s.split(/[/?#]/)[0] ?? '';
  s = s.replace(/:\d+$/, '');
  return s.toLowerCase().replace(/\.$/, '');
}

export function isAllowedArticleHost(host: string): boolean {
  return ARTICLES_ALLOWED_HOSTS.includes(host.toLowerCase());
}

/** Every link in the text, in order, each marked allowed or not. */
export function findArticleLinks(text: string): FoundLink[] {
  const found: FoundLink[] = [];
  const taken: Array<[number, number]> = [];
  const overlaps = (s: number, e: number) => taken.some(([a, b]) => s < b && e > a);
  const take = (raw0: string, index: number, host0?: string) => {
    const raw = trimTrailingPunctuation(raw0);
    if (!raw) return;
    const end = index + raw.length;
    if (overlaps(index, end)) return;
    const host = host0 ?? hostOf(raw);
    if (!host) return;
    taken.push([index, end]);
    found.push({ raw, host, allowed: isAllowedArticleHost(host), index });
  };
  for (const m of text.matchAll(SCHEME_LINK)) take(m[0], m.index ?? 0);
  for (const m of text.matchAll(WWW_LINK)) take(m[0], m.index ?? 0);
  for (const m of text.matchAll(EMAIL)) take(m[0], m.index ?? 0, (m[1] ?? '').toLowerCase());
  for (const m of text.matchAll(BARE_HOST)) take(m[0], m.index ?? 0);
  return found.sort((a, b) => a.index - b.index);
}

/** The links the rule refuses — empty means the text may be posted. */
export function refusedLinks(text: string): string[] {
  return findArticleLinks(text)
    .filter((l) => !l.allowed)
    .map((l) => l.raw);
}

export type ArticleSegment =
  | { kind: 'text'; text: string }
  | { kind: 'link'; text: string; href: string; path: string };

/**
 * Splits a STORED post into text and setnayan.com links, so a page can draw a
 * setnayan.com link as a card ("A setnayan.com link becomes a card"). A refused
 * link never reaches storage; if one somehow did, it stays plain text here —
 * nothing outside setnayan.com is ever rendered as an anchor.
 */
export function splitArticleText(text: string): ArticleSegment[] {
  const out: ArticleSegment[] = [];
  let at = 0;
  for (const l of findArticleLinks(text)) {
    if (!l.allowed || l.raw.includes('@')) continue;
    if (l.index > at) out.push({ kind: 'text', text: text.slice(at, l.index) });
    const rest = l.raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^[^/?#]*/, '');
    const path = rest && rest !== '/' ? rest : '/';
    out.push({ kind: 'link', text: l.raw, href: `https://www.setnayan.com${path}`, path });
    at = l.index + l.raw.length;
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) });
  return out;
}
