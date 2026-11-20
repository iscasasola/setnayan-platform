/**
 * 🔗 THE LINKS IN AN ARTICLE — text and links only (owner 2026-11-17, DECISION_LOG "DISCOVER ARTICLES ARE OUR
 * REDDIT"): *"Outside link will only be a link while setnayan link will have a thumbnail."*
 *
 * This module only CLASSIFIES; it fetches nothing. A setnayan.com link becomes a card read from our OWN data
 * (`lib/articles.server.ts` resolves it); any other domain stays plain text — no preview, no outside image,
 * nothing fetched from somebody else's site.
 *
 * Pure, so the composer's "Your links" preview and the article page agree by construction.
 */

/** Our own hosts. A link to any of them may carry a card; nothing else ever does. */
const OWN_HOSTS = new Set(['setnayan.com', 'www.setnayan.com']);

export type PostLink =
  | { kind: 'setnayan'; text: string; path: string }
  | { kind: 'outside'; text: string };

/** A link as a writer types it: `https://…`, `http://…` or a bare `host.tld/…`. Trailing punctuation is not part of it. */
const LINK_RE = /\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"')\]]*)?)/gi;

/** Strip the sentence punctuation a link usually sits before. */
function trimTrailing(raw: string): string {
  return raw.replace(/[.,;:!?)]+$/, '');
}

/** One link, classified. `null` when the text is not a link at all. */
export function classifyLink(raw: string): PostLink | null {
  const text = trimTrailing(raw.trim());
  if (!text) return null;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  if (!url.hostname.includes('.')) return null;
  if (OWN_HOSTS.has(url.hostname.toLowerCase())) {
    const path = (url.pathname.replace(/\/+$/, '') || '/') + url.search;
    return { kind: 'setnayan', text, path };
  }
  return { kind: 'outside', text };
}

/** Every link in a body, in order, each once. */
export function findPostLinks(body: string | null | undefined): PostLink[] {
  if (typeof body !== 'string') return [];
  const seen = new Set<string>();
  const out: PostLink[] = [];
  for (const m of body.matchAll(LINK_RE)) {
    const link = classifyLink(m[1]!);
    if (!link || seen.has(link.text)) continue;
    seen.add(link.text);
    out.push(link);
  }
  return out;
}

/** A paragraph split into plain text and links, so the page can render links without parsing markup. */
export type Segment = { kind: 'text'; text: string } | PostLink;

export function segmentParagraph(paragraph: string): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of paragraph.matchAll(LINK_RE)) {
    const raw = m[1]!;
    const link = classifyLink(raw);
    if (!link) continue;
    const start = m.index!;
    if (start > last) out.push({ kind: 'text', text: paragraph.slice(last, start) });
    out.push(link);
    last = start + link.text.length;
  }
  if (last < paragraph.length) out.push({ kind: 'text', text: paragraph.slice(last) });
  return out;
}

/**
 * What a setnayan.com path points at, so the resolver knows which of our own rows to read.
 *   /articles/{slug}         → an article
 *   /v/{shop} · /{shop}      → a shop (the bare address is also an Event Hub's; the resolver tries a shop
 *                              first, then a public Event Hub, then gives up and leaves a plain link)
 * Anything else (/signup, /features, /?browse=1, a file) → null: a link to our page, shown as a link, no card.
 */
export type CardTarget = { kind: 'article'; slug: string } | { kind: 'page'; word: string };

const WORD = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/i;

export function cardTarget(path: string): CardTarget | null {
  const clean = path.split(/[?#]/)[0]!.replace(/\/+$/, '');
  const parts = clean.split('/').filter(Boolean);
  if (parts[0] === 'articles' && parts.length === 2 && WORD.test(parts[1]!)) {
    return { kind: 'article', slug: parts[1]!.toLowerCase() };
  }
  if (parts[0] === 'v' && parts.length === 2 && WORD.test(parts[1]!)) return { kind: 'page', word: parts[1]!.toLowerCase() };
  if (parts.length === 1 && WORD.test(parts[0]!) && !parts[0]!.includes('.')) return { kind: 'page', word: parts[0]!.toLowerCase() };
  return null;
}

/** The writer's tags, as stored: trimmed, lower-case, unique, ≤ 3, ≤ 30 characters each (the DB re-applies it). */
export function normalizeTags(raw: unknown): string[] {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const out: string[] = [];
  for (const t of list) {
    if (typeof t !== 'string') continue;
    const tag = t.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!tag || tag.length > 30 || out.includes(tag)) continue;
    out.push(tag);
    if (out.length === 3) break;
  }
  return out;
}

/** A posting name as stored: 3–30 of a-z 0-9 . _ , starting with a letter or digit (mirrors users_posting_name_shape). */
export function normalizePostingName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.trim().toLowerCase();
  return /^[a-z0-9][a-z0-9._]{2,29}$/.test(name) ? name : null;
}
