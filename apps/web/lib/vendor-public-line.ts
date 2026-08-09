/**
 * vendor-public-line.ts — the parse rules behind a shop's two public free-text
 * facts: `vendor_profiles.tagline` and `vendor_profiles.website`.
 *
 * ── WHY THIS FILE EXISTS ────────────────────────────────────────────────────
 * Both columns have readers and, for a real vendor, no writer. `tagline` is
 * rendered on the public shop page (`/v/[slug]`), on Explore cards, and is
 * returned by three v1 API routes; `website` is returned by two of those routes
 * and feeds `vendor-deep-search-run.ts`. The only form that ever posted either
 * one was `/vendor-dashboard/profile`, retired 2026-07-05 — its action
 * (`saveVendorProfile`) has had no caller since. `tagline` kept a partial
 * writer in `saveUnclaimedVendorProfile`, but that is gated `.is('user_id',
 * null)`: it writes SEEDED rows only, so a vendor who claimed their shop can
 * never change the line that introduces them.
 *
 * That is the fifth instance of the reader-with-no-writer shape this codebase
 * tracks — see the header of `vendor-compatibility.ts` for the prior four.
 *
 * ── WHY `website` IS VALIDATED AND `tagline` IS NOT ─────────────────────────
 * The retired form stored `website` with `nullIfBlank` and no parse at all, so
 * `javascript:…` was a storable value. Nothing in the app renders it as an
 * anchor today, but both public API routes hand it to callers who will, and a
 * stored-then-linkified scheme is the whole exploit. So the parse mirrors
 * `creator-chapters.ts#normalizeEmbed`'s scheme discipline: a bare `host/path`
 * gets `https://` prepended, an EXPLICIT non-http(s) scheme is rejected rather
 * than coerced. We store the normalized absolute URL, so the reader never has
 * to guess whether it has a scheme.
 *
 * A tagline is prose. It is escaped by React wherever it renders, so it needs a
 * length cap and nothing else.
 */

/**
 * One line, not a paragraph. The public shop page and the Explore card both
 * render the tagline on a single row beside the business name — past ~120
 * characters it wraps and pushes the layout around, and the API consumers show
 * it as a subtitle. Enforced by truncation, not rejection: a vendor who pastes
 * something long gets a saved, shortened line rather than a refused save.
 */
export const TAGLINE_MAX = 120;

/**
 * Generous but bounded. Real vendor URLs carry campaign paths; nothing
 * legitimate approaches this, and the cap keeps a pathological paste out of a
 * column two public API routes echo.
 */
export const WEBSITE_MAX = 500;

/** Trim, collapse inner whitespace, cap. Blank (or non-string) → NULL. */
export function parseTagline(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string') return null;
  // Collapse newlines too — a textarea paste must not store a multi-line value
  // in a field every reader renders on one row.
  const cleaned = raw.replace(/\s+/g, ' ').trim();
  if (cleaned.length === 0) return null;
  return cleaned.slice(0, TAGLINE_MAX);
}

export type WebsiteParse =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/**
 * Normalize a vendor-entered website to an absolute http(s) URL, or refuse.
 *
 * Blank is a legitimate value (the field is optional), so it resolves to
 * `{ ok: true, value: null }` — clearing is a save, not an error.
 */
export function parseWebsiteUrl(raw: FormDataEntryValue | null): WebsiteParse {
  if (typeof raw !== 'string') return { ok: true, value: null };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { ok: true, value: null };
  if (trimmed.length > WEBSITE_MAX) {
    return { ok: false, error: 'That web address is too long.' };
  }
  // Whitespace inside a URL is always a typo (usually a pasted sentence).
  if (/\s/.test(trimmed)) {
    return { ok: false, error: 'Enter one web address, with no spaces.' };
  }

  let parsed: URL;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) {
      // An explicit scheme is honored only if it is http(s). Never coerce
      // `javascript:` / `data:` / `file:` into https by prefixing.
      if (!/^https?:\/\//i.test(trimmed)) {
        return { ok: false, error: 'Enter a web address starting with https://' };
      }
      parsed = new URL(trimmed);
    } else {
      parsed = new URL(`https://${trimmed}`);
    }
  } catch {
    return { ok: false, error: 'That doesn’t look like a web address.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'Enter a web address starting with https://' };
  }
  // `new URL('https://mysite')` parses happily with hostname `mysite`. A real
  // site has a dot; without this a typo saves as a dead link the vendor will
  // never notice, because nothing in the dashboard fetches it.
  if (!parsed.hostname.includes('.') || parsed.hostname.endsWith('.')) {
    return { ok: false, error: 'That doesn’t look like a web address.' };
  }

  return { ok: true, value: parsed.href };
}
