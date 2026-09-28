/**
 * apps/web/lib/view-as-free.ts
 *
 * 👁 VIEW AS A FREE COUPLE — the pure half (client-safe: no `next/headers`).
 *
 * Why it exists (DECISION_LOG 2026-09-28, "EVENT HUB QUEUE RUNS SMALLEST →
 * BIGGEST": *"view as a free couple" switch (after Free vs Pro — lets the owner
 * verify it)*). An internal (§10a, `users.is_internal = TRUE`) host's event owns
 * every SKU (`eventHostIsInternal`, ORed into `eventSkuActive`), so the owner's
 * own Maker is always Pro and he can never see what a free couple sees — the
 * padlocks, the Pro offers, the Setnayan-mark QR. This switch lets him look.
 *
 * ── 🔒 A VIEW, NEVER A WRITE ───────────────────────────────────────────────
 * It only ever turns a Pro READ that feeds a RENDER from `true` to `false`
 * (`proAsViewed` can never turn `false` into `true`). The write gates —
 * `eventCoupleWebsiteProActive` itself, `lookProAllows` (Apply), and every
 * server action — never read the switch, so with it on the owner's Apply, his
 * draft and his live page are exactly what they were. Held by
 * `lib/view-as-free-never-changes-a-save.test.ts`.
 *
 * ── WHY A COOKIE ──────────────────────────────────────────────────────────
 * The Maker's canvas is an iframe of the public page, its print pieces come
 * from `/api/hub-print`, and its QR from `/api/website/qr` — three separate
 * requests. A cookie reaches all three with no new route, no server action and
 * no column; a `?param` would reach only the first. It is honoured only for an
 * internal viewer (`viewAsFreeHonoured`), so a cookie left on a shared browser
 * can never downgrade a real couple's page.
 */

/** The cookie. `1` = on; anything else, or absent, = off. */
export const VIEW_AS_FREE_COOKIE = 'sn_view_as_free';

/** A working day — the same shape as the admin demo-mode switch (24 h), so a
 *  forgotten switch lapses on its own. The strip says it is on meanwhile. */
export const VIEW_AS_FREE_MAX_AGE_S = 60 * 60 * 24;

/** The words, in one place (the menu row and the strip say the same thing). */
export const VIEW_AS_FREE_LABEL = 'View as a free couple';
export const VIEW_AS_FREE_ON_LABEL = 'Viewing as a free couple';
export const VIEW_AS_FREE_HELP =
  'Only you see this. Padlocks and Pro offers show as a couple without Event Hub Pro sees them. Nothing you saved changes.';

/** Does the cookie's raw value say "on"? */
export function viewAsFreeCookieOn(value: string | null | undefined): boolean {
  return value === '1';
}

/**
 * Is the switch in force for THIS viewer? Only an internal account may use it —
 * the switch is drawn for no one else, and a cookie a non-internal viewer
 * carries (typed by hand, or left behind on a shared browser) is ignored.
 */
export function viewAsFreeHonoured(input: { cookie: string | null | undefined; isInternal: boolean }): boolean {
  return input.isInternal === true && viewAsFreeCookieOn(input.cookie);
}

/**
 * The one rule: a real Pro read, as this viewer is shown it. It can only ever
 * TAKE Pro away — never grant it.
 */
export function proAsViewed(realPro: boolean, viewingAsFree: boolean): boolean {
  return realPro === true && !viewingAsFree;
}

/** The `document.cookie` string that turns the switch on or off (client only). */
export function viewAsFreeCookieString(on: boolean, secure: boolean): string {
  const tail = `; Path=/; SameSite=Lax${secure ? '; Secure' : ''}`;
  return on
    ? `${VIEW_AS_FREE_COOKIE}=1; Max-Age=${VIEW_AS_FREE_MAX_AGE_S}${tail}`
    : `${VIEW_AS_FREE_COOKIE}=; Max-Age=0${tail}`;
}
