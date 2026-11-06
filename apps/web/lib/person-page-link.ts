/**
 * person-page-link.ts — where a person's name goes when you press it on People.
 *
 * Owner, 2026-10-25, looking at his own Following list: *"so why don't i see their user account page?"* — and
 * then *"i cannot click their names i should be able to see it because they have account already"*. Every
 * People row that is an ACCOUNT now opens that account's page at `/u/…`.
 *
 * ONE ANSWER, TWO HANDLES, IN THIS ORDER:
 *   1. their `users.slug` → `/u/<slug>` (the address the account already shows the world);
 *   2. no slug (18 of 27 accounts on 2026-10-25 — slugs were backfilled once and are only set later by the
 *      sign-up "you" step, so most newer accounts have none) → `/u/<S89U-…>`, the account's PUBLIC handle
 *      (`users.public_id`). `/u/[userSlug]` resolves that handle too (`lib/public-profile.ts`) and forwards
 *      to the slug the moment one exists.
 *   3. anything else — a person node nobody has claimed (`S89P-…`), an alaga, an unread handle → NULL, and
 *      the row stays plain text. There is no account page to open, so there is no door.
 *
 * 🔒 Never a `user_id`: both handles are already public. Client-safe on purpose (rows are client components).
 * Held by `lib/person-page-link.test.ts` and `people/every-person-row-opens-their-page.test.ts`.
 */

const SLUG = /^[a-z0-9-]{3,32}$/i;
/** `S89U-` + a 10-character Crockford body — an ACCOUNT's public handle. `S89P-` (a person node) is not one. */
export const ACCOUNT_PUBLIC_ID = /^S89U-[0-9A-Z]{10}$/i;

export function personPageHref(handle: { slug?: string | null; publicId?: string | null } | null | undefined): string | null {
  if (!handle) return null;
  const slug = handle.slug?.trim();
  if (slug && SLUG.test(slug)) return `/u/${slug.toLowerCase()}`;
  const publicId = handle.publicId?.trim();
  if (publicId && ACCOUNT_PUBLIC_ID.test(publicId)) return `/u/${publicId.toUpperCase()}`;
  return null;
}
