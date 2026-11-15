/**
 * lib/quote-card-return.ts — ＋ "MAKE A NEW CARD" FROM THE QUOTE, AND BACK (owner 11 Nov 2026; approved prototype
 * `controller-2026-11-11/client-supplier-page.html` frame 6: "＋ Make a new card" last in the cards picker — "opens the
 * Card Maker · returns here with it picked").
 *
 * The quote's door opens the SHIPPED Card Maker (`/vendor-dashboard/services/new`, `CanvasMaker` → `commitVendorService`)
 * with `?quote=<where the quote is>`. The maker carries that address in a hidden field; on a successful CREATE the save
 * returns there with `quote_card=<the new card's id>`, and the quote puts the card in as lines.
 *
 * 🔒 NEVER AN OPEN REDIRECT: only the two pages that draw the quote are accepted — the picked client's page and the
 * supplier's thread — as a same-site PATH (no scheme, no host, no `//`), and the query is rebuilt, never passed through.
 * PURE. 🔒 lib/quote-card-return.test.ts
 */

/** The query key the save returns the new card under. */
export const QUOTE_CARD_PARAM = 'quote_card';
/** The query key the Card Maker is opened with. */
export const QUOTE_RETURN_PARAM = 'quote';
/** The hidden field the Card Maker posts it in. */
export const QUOTE_RETURN_FIELD = 'quote_return';

const QUOTE_PAGES = /^\/vendor-dashboard\/(clients|messages)\/[A-Za-z0-9_-]{1,80}$/;
const SAFE_KEY = /^[a-z_]{1,24}$/;
const SAFE_VALUE = /^[A-Za-z0-9_.-]{0,80}$/;

/** The quote's address, if it is one of the pages that draw the quote — else null. */
export function quoteReturnPath(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 400) return null;
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  let url: URL;
  try {
    url = new URL(raw, 'https://setnayan.invalid');
  } catch {
    return null;
  }
  if (url.origin !== 'https://setnayan.invalid' || !QUOTE_PAGES.test(url.pathname)) return null;
  // Keep only plain keys and values (the page's tab, view) — and never an older quote_card.
  const q = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (k === QUOTE_CARD_PARAM || !SAFE_KEY.test(k) || !SAFE_VALUE.test(v)) continue;
    q.append(k, v);
  }
  // On the picked client the quote lives on the Quotation page — land there, whatever tab the address last named.
  if (url.pathname.startsWith('/vendor-dashboard/clients/')) q.set('tab', 'quote');
  const qs = q.toString();
  return qs ? `${url.pathname}?${qs}` : url.pathname;
}

/** Where the save sends the supplier after a new card: back to the quote, carrying the card. */
export function quoteReturnWithCard(path: string, cardId: string): string | null {
  const safe = quoteReturnPath(path);
  if (!safe || !/^[A-Za-z0-9_-]{1,80}$/.test(cardId)) return null;
  return `${safe}${safe.includes('?') ? '&' : '?'}${QUOTE_CARD_PARAM}=${encodeURIComponent(cardId)}`;
}

/** The Card Maker's address, opened from the quote at `here`. */
export function cardMakerFromQuote(here: string): string {
  const safe = quoteReturnPath(here);
  return safe ? `/vendor-dashboard/services/new?${QUOTE_RETURN_PARAM}=${encodeURIComponent(safe)}` : '/vendor-dashboard/services/new';
}

/** The quote draft kept on this device while the supplier is in the Card Maker — one per conversation. */
export const quoteDraftKey = (threadId: string) => `sn-quote-draft:${threadId}`;
/**
 * 🧾 RW-24 (walk 13 Nov 2026): the quote as it was when Send was pressed, kept on this device until the send is known to
 * have landed. A refused send (an inquiry not yet accepted, a missing validity date, …) redirects with a notice, and
 * the redirect used to drop everything the supplier had built.
 */
export const quoteSentKey = (threadId: string) => `sn-quote-sent:${threadId}`;
/** The notices that mean the quote DID go — the kept copy is then forgotten. */
export const QUOTE_SENT_NOTICES: ReadonlySet<string> = new Set(['proposal_sent', 'proposal_sent_no_card']);
