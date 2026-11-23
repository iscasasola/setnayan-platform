/**
 * 🏷 WHICH PIECE BROUGHT THE COUPLE — the material tag `?via=<piece>` (owner 2026-11-16, DECISION_LOG
 * "EVERY MATERIAL A SHOP HANDS OUT CARRIES ITS OWN TAG", verbatim: *"Each material should have a tag of where they
 * found the website"*).
 *
 * One value per thing a shop hands out, written into the address its QR or link opens, so a later QR-stats screen can
 * say Print-outs · Website · Find (prototype `qr_code_stats_2026-11-16_fable`, still awaiting the owner — nothing here
 * draws it). The tag is RECORDED and CARRIED, never shown:
 *
 *   view     → `vendor_profile_views.via` (+ the `utm` it already kept)
 *   inquiry  → `chat_threads.inquiry_via` / `inquiry_utm`
 *   booking  → `event_vendors.source_via` / `source_utm` (filled from the thread, the way `source` is)
 *   sign-up  → `signup_attributions` (a NEW account whose first tagged shop view came from a piece)
 *
 * 💳 THE FEE RULE IS NOT THIS TAG. `?src=own` still marks the shop's own code; `via` only names the piece. Whether an
 * own arrival is the shop's own client is decided at the inquiry by the shop's VERIFICATION, on any plan and for any
 * piece (owner 2026-11-16, DECISION_LOG "EVERY VERIFIED ACCOUNT GETS THE QR FEATURES, ON ANY PLAN", which superseded
 * "only Supplier Ultra's prints are the shop's own"; amended the same day: an unverified shop keeps its QR, but every
 * booking from it is Setnayan-sourced). That check is `ownLinkArrival` (`lib/own-clients.server.ts`), never this file.
 *
 * Pure. 🔒 lib/material-tags.test.ts
 */

/**
 * Every value `via` may take. The seven print pieces are `lib/supplier-prints.ts` PRINT_PIECES' own ids (the test pins
 * the two lists equal), then the door sticker (`/api/vendor/door-sticker`), the shop's shared link and on-screen codes,
 * and the photo mark's QR (owner 2026-11-16: untagged by `src`, so Setnayan-sourced, but still named).
 */
export const PRINT_VIAS = ['card', 'standee', 'door', 'backdrop', 'tarp', 'rollup', 'table'] as const;
export const MATERIAL_VIAS = [...PRINT_VIAS, 'sticker', 'link', 'photo'] as const;
export type PrintVia = (typeof PRINT_VIAS)[number];
export type MaterialVia = (typeof MATERIAL_VIAS)[number];

/** The query key. */
export const VIA_PARAM = 'via';

/** A `?via=` value as one of the vocabulary, or null. Never echoes anything else — an unknown value is no tag. */
export function materialViaOf(raw: unknown): MaterialVia | null {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return (MATERIAL_VIAS as readonly string[]).includes(v) ? (v as MaterialVia) : null;
}

/** `url` with `?via=` (or `&via=`) appended before any `#hash`. */
export function withVia(url: string, via: MaterialVia): string {
  const hashAt = url.indexOf('#');
  const base = hashAt >= 0 ? url.slice(0, hashAt) : url;
  const hash = hashAt >= 0 ? url.slice(hashAt) : '';
  return `${base}${base.includes('?') ? '&' : '?'}${VIA_PARAM}=${via}${hash}`;
}

/** The longest campaign string kept — the tags are carried, never trusted for anything but a count. */
export const UTM_MAX = 300;

/**
 * The campaign tags on an arrival as ONE string, the shape `vendor_profile_views.utm` has always stored: a bare `utm`
 * wins, else `utm_source=…&utm_medium=…&utm_campaign=…` from whichever are present. Capped at UTM_MAX; empty → null.
 */
export function arrivalUtmOf(search: {
  utm?: unknown;
  utm_source?: unknown;
  utm_medium?: unknown;
  utm_campaign?: unknown;
}): string | null {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
  const bare = s(search.utm);
  const built = bare
    ? bare
    : [
        s(search.utm_source) ? `utm_source=${s(search.utm_source)}` : null,
        s(search.utm_medium) ? `utm_medium=${s(search.utm_medium)}` : null,
        s(search.utm_campaign) ? `utm_campaign=${s(search.utm_campaign)}` : null,
      ]
        .filter(Boolean)
        .join('&');
  return built ? built.slice(0, UTM_MAX) : null;
}

/** A utm string handed in by a client, kept only as a bounded string. */
export function utmOf(raw: unknown): string | null {
  return typeof raw === 'string' && raw.trim() ? raw.trim().slice(0, UTM_MAX) : null;
}

/**
 * 📝 DOES THIS TAGGED VIEW COUNT AS THE PIECE THAT BROUGHT A SIGN-UP? Only for an account created within
 * SIGNUP_WINDOW_MS before the tagged view — the sign-in sheet over the shop (owner 2026-11-07) and the Google return
 * both land back on the same tagged address, so the first tagged view after sign-up is that piece. An account older
 * than the window had already signed up before this scan, so it is not this piece's sign-up. The table keeps the
 * FIRST one only (primary key on the user).
 */
export const SIGNUP_WINDOW_MS = 60 * 60 * 1000;
export function viewCountsAsSignup(
  o: { accountCreatedAt: string | null | undefined; via: MaterialVia | null; utm: string | null },
  nowMs: number,
): boolean {
  if (!o.via && !o.utm) return false;
  const born = o.accountCreatedAt ? Date.parse(o.accountCreatedAt) : NaN;
  if (!Number.isFinite(born)) return false;
  return nowMs - born >= 0 && nowMs - born <= SIGNUP_WINDOW_MS;
}
