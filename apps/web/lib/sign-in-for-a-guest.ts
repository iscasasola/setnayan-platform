import { isReservedSlug } from '@/lib/reserved-slugs';
import { isSafeNext } from '@/lib/safe-next';

/**
 * WHICH EVENT A SIGN-IN IS FOR — the slug a `next` path opens, or null.
 *
 * Guest text audit 2026-09-30: a guest who tapped "Sign in" on an invitation
 * landed on "WELCOME BACK · One account for couples and vendors" — a door
 * written for the people who PLAN, shown to the person who was invited. The
 * card can only speak to a guest if it knows the sign-in leads back to an
 * event, and the one thing it has is `next`.
 *
 * Pure: this names the CANDIDATE slug (`/{slug}…` or `/u/{owner}/{slug}…`);
 * whether an event by that name exists is the caller's read (a supplier's shop
 * also lives at the bare root). A reserved word is never a candidate.
 */
export function eventSlugFromNext(next: string | null | undefined): string | null {
  if (!isSafeNext(next)) return null;
  const path = next.split(/[?#]/)[0] ?? '';
  const parts = path.split('/').filter(Boolean);
  const slug = parts[0] === 'u' ? parts[2] : parts[0];
  if (!slug || !/^[a-z0-9-]{3,64}$/i.test(slug)) return null;
  if (parts[0] !== 'u' && isReservedSlug(slug)) return null;
  return slug.toLowerCase();
}

/** The guest's words on the sign-in card — no "Welcome back", no "couples and vendors". */
export const GUEST_SIGN_IN_WORDS = {
  eyebrow: 'Your invitation',
  title: 'Sign in to open it.',
  sub: 'Use the email on your Setnayan account.',
} as const;
