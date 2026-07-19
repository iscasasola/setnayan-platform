import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, loginRedirectPath } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';

export const metadata = { title: 'Your event page' };

/**
 * /dashboard/[eventId]/event-page — the host's first-class doorway to the SAME
 * public event page their guests see.
 *
 * Owner ask 2026-06-26: *"Host should get on their menu to see the same event
 * page that we created."* Until now the couple could only reach `/[slug]`
 * indirectly (the "View your page" link buried in the Save-the-Date launcher).
 * This route is the menu-reachable entry — it resolves the event's slug and
 * REDIRECTS to the live `/[slug]` so the host lands on the real page, not a mock.
 *
 * WHY a redirect (not an in-dashboard preview): the per-guest guest hub
 * (GuestHubBar — personal QR · "photos of you" · the guest's own camera bridge)
 * is keyed to a GUEST IDENTITY (a `guests` row + guest-session cookie). The
 * couple is an `event_members` row (member_type='couple'), never a guest, so the
 * guest hub cannot meaningfully render for them. But `/[slug]` already knows how
 * to render the full event page for a signed-in HOST: the slug page's private
 * gate admits an authed host (`isAuthedHost`) and renders the real page (hero ·
 * monogram · Save-the-Date film · story · schedule · widgets) — i.e. exactly
 * "the same event page we created". So we send the host to their own live page.
 *
 * The GuestHubBar bottom bar is NOT shown to the host (it needs a guest QR token
 * the host doesn't have); the host sees the page content itself. See the report
 * note in the PR for that intentional limitation.
 *
 * Couple-gated: the parent `[eventId]/layout.tsx` already 404s non-couples /
 * non-moderators, but this route replicates the membership check (same pattern
 * as `website/page.tsx`) so a direct hit can never resolve another couple's slug.
 */
export default async function HostEventPageRedirect({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect(loginRedirectPath(`/dashboard/${eventId}/event-page`));

  const supabase = await createClient();

  // Membership gate + slug fetch fire concurrently (mirrors website/page.tsx).
  // RLS already scopes every row to the caller; the explicit couple check is the
  // belt-and-braces guard so a non-couple can't reach the redirect.
  const [membershipRes, eventRes] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select('event_id, slug')
      .eq('event_id', eventId)
      .maybeSingle(),
  ]);

  const { data: membership, error: membershipError } = membershipRes;
  if (membershipError) {
    logQueryError(
      'HostEventPageRedirect (event_members)',
      membershipError,
      { event_id: eventId, user_id: user.id },
      'graceful_degrade',
    );
  }
  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  const event = eventRes.data;
  if (!event) notFound();

  // No slug yet → the couple hasn't set up their public URL. Send them to the
  // Website hub where they pick a slug + style the page, rather than 404.
  if (!event.slug) {
    redirect(`/dashboard/${eventId}/website`);
  }

  // Same-origin RELATIVE redirect so the host's auth session carries through.
  // The signed-in host passes the slug page's private gate (isAuthedHost) and
  // sees the full live event page — the same one their guests see. Opens in the
  // same tab; the dashboard back-stack returns them here.
  redirect(`/${event.slug}`);
}
