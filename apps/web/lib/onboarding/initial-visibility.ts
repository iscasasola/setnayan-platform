/**
 * What a brand-new event's website is visible to, at the moment it is created.
 *
 * ── THE RULING ──────────────────────────────────────────────────────────────
 * Owner, 2026-08-03: *"so the event websites should be visible upon creation."*
 * Together with the earlier ruling that the slug stays private until launch
 * (2026-06-20), and with *"we want them to navigate around right away"*.
 *
 * Those look contradictory and are not, because there are THREE states, not
 * two. A new event ships **unlisted**:
 *
 *   private   the old default — a lock screen, nothing reachable
 *   unlisted  ← NEW DEFAULT. Anyone the couple sends the link to walks the
 *             whole site. Not indexed, not listed anywhere public.
 *   public    what LAUNCH still means — indexed, listed, and the moment the
 *             guest announcement emails go out.
 *
 * So Launch keeps its full meaning and the paid Save-the-Date reveal is still
 * a reveal; what changes is that the link works before it, instead of showing
 * a locked door to someone the couple deliberately sent it to.
 *
 * ── WHY `unlisted` AND NOT `public` ─────────────────────────────────────────
 * Verified before choosing it: `app/[slug]/page.tsx` returns
 * `robots: { index: false, follow: false }` with name-free metadata for any
 * non-public visibility, `lib/public-profile.ts` gates the aggregate surfaces
 * on `=== 'public'`, and `lib/save-the-date-emails.ts` refuses to fan out
 * unless `public`. Defaulting to `public` would silently convert a paid reveal
 * into a mailing button.
 *
 * ── 🔴 THE ANONYMOUS-DRAFT CARVE-OUT — the reason this file exists ──────────
 * The onboarding INSERT runs through the SERVICE-ROLE admin client, which
 * bypasses RLS. So `20270823141500_events_anon_cannot_publish.sql` — the
 * RESTRICTIVE policy that stops an anonymous JWT ever writing a non-private
 * visibility — **does not fire on this path**. It would stay green while doing
 * nothing.
 *
 * An anonymous draft is somebody who typed two real people's names into a
 * signup flow and has not yet made an account. Publishing that by link is not
 * what the owner asked for and nobody consented to it. So the rule is
 * re-asserted HERE, in application code, exactly as the design review demanded:
 * **anonymous ⇒ private.** They get `unlisted` when they secure the account.
 */
export type InitialLandingVisibility = 'private' | 'unlisted';

export function initialLandingVisibility(opts: {
  /** True while the creator has no real account (the anon-draft onboarding path). */
  isAnonymous: boolean;
}): InitialLandingVisibility {
  // Fail closed. Anything other than a definite `false` stays private.
  return opts.isAnonymous === false ? 'unlisted' : 'private';
}
