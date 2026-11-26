/**
 * signup-intent.ts — WHO IS SIGNING UP IS DECIDED BY THE LINK, NOT BY A QUESTION.
 *
 * Owner, 2026-09-20, after tapping an NFC vendor card on his own phone: the card
 * lands on `/vendor-invite/<slug>`, whose button reads "Sign up free & add this
 * vendor" — and the signup screen behind it then asked *"I'm a couple / I'm a
 * vendor"*. Verbatim: **"you shouldn't ask if they are a vendor since it should
 * be directly as a user."**
 *
 * 🔑 THE LINK HAD ALREADY SAID SO, AND NOTHING READ IT. Five call sites have
 * been sending `?as=couple` for months — `/vendor-invite/[slug]` (page +
 * action), `/vendor/lock/[token]` (page + action) and `/vendor/fit/[ref]` — and
 * `/signup` only ever tested `params.as === 'vendor'`. `as=couple` therefore did
 * exactly one thing: it failed to pre-tick the vendor radio. A parameter that is
 * written, carried and ignored reads, from the outside, precisely like a screen
 * that was designed to ask. It wasn't; it was a dead branch.
 *
 * THE RULE, owner-locked 2026-09-20: signing up is signing up as a person.
 * `?as=vendor` — set only by the deliberate "Register your business" doors
 * (`/for-suppliers`, `/open-shop`, `/vendor/claim/[token]`, the front door) — is the
 * ONE way to arrive as a vendor. Everything else, including a bare `/signup`
 * typed into the address bar, is a customer. The chooser is gone from the
 * screen entirely, because with this rule there is nothing left for it to ask.
 *
 * ⚠ THE VENDOR DOOR IS NOT CLOSED, IT MOVED INSIDE. Owner, same conversation:
 * *"we should also have the direct to vendor application app as well, but not
 * there."* Two paths survive and neither is touched by this file:
 *   • `/signup?as=vendor` — the direct application, unchanged.
 *   • `/open-shop` — reachable by any signed-in customer via the account
 *     switcher's "Create your shop", and `becomeVendor` self-heals
 *     `users.account_type` from 'customer' to 'vendor' on the way through. So a
 *     couple who later turns out to be a supplier loses nothing by having been
 *     signed up as a couple.
 *
 * WHY THIS IS A PURE MODULE AND NOT AN INLINE TERNARY IN page.tsx. `/signup` is
 * a server component: a guard cannot render it, so a guard written against the
 * page can only grep its source, and a grep cannot tell 'customer' from 'vendor'
 * in a branch it never takes. The decision lives here so the guard next door can
 * EXECUTE it — see signup-intent.test.ts.
 */

/** The two values `public.users.account_type` accepts at sign-up. */
export type SignupAccountType = 'customer' | 'vendor';

/**
 * The account type a sign-up should post, given the `?as=` search param.
 *
 * Exactly one input produces a vendor: the literal string `vendor`. `undefined`,
 * `couple`, an array (Next.js hands back `string[]` for a repeated param), and
 * anything else a stranger can type into the address bar all produce a customer.
 * Fail towards the safer of the two: a customer who meant to be a vendor walks
 * through `/open-shop` in a minute, while a couple filed as a vendor lands in
 * the wrong dashboard with the wrong RLS.
 */
export function accountTypeForSignup(as: string | string[] | undefined): SignupAccountType {
  return as === 'vendor' ? 'vendor' : 'customer';
}

/**
 * Whether the couples-only Public Event Summary consent block belongs on screen.
 *
 * It used to hide itself with a CSS `:has(input[value='vendor']:checked)` rule
 * pointed at the radio. With the radio gone that selector can never match, so
 * the block would have rendered for vendors — a consent question about a
 * *wedding showcase*, asked of a photography studio. The answer is now decided
 * on the server, where the account type already is.
 */
export function showsCoupleConsent(as: string | string[] | undefined): boolean {
  return accountTypeForSignup(as) === 'customer';
}

/**
 * 🔁 THE SIGN-IN ADDRESS THAT KEEPS THE SHOP INTENT (final check A1-059 · owner ruling Add 33, 25 Nov 2026: "a supplier
 * is a user with a shop").
 *
 * A supplier who went /signup?as=vendor → "Have an account? Sign in" → "New here? Create account" lost `as=vendor` on
 * the first hop (the sign-up card's sign-in link carried only `next`), and a Google / Apple start error from the
 * supplier sign-up landed on /login without it too — so the account was made as a couple and sign-in opened a couple's
 * Home. Every hop between the two cards now carries the intent, and a supplier's bare `/` becomes `/open-shop` (the same
 * rule `signUp` applies), so the round trip lands where they continue their shop. Being filed as a couple never blocks
 * a shop: `/open-shop` takes any signed-in user and self-heals `account_type`.
 */
export function signInHrefKeepingIntent(next: string, accountType: SignupAccountType, error?: string): string {
  const params = new URLSearchParams();
  if (error) params.set('error', error);
  const landsAt = accountType === 'vendor' && next === '/' ? '/open-shop' : next;
  if (landsAt !== '/') params.set('next', landsAt);
  if (accountType === 'vendor') params.set('as', 'vendor');
  const q = params.toString();
  return `/login${q ? `?${q}` : ''}`;
}
