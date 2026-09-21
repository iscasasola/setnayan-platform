import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { ArrowLeft, Send } from 'lucide-react';
import { InvitePanel } from './_components/invite-panel';

export const metadata = { title: 'Invite guests' };

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ theme?: string }>;
};

/**
 * Invite — the "share one link" stage of the guest journey (2026-06-16). The
 * couple shares ONE join link/QR with everyone; a guest opens it, types their
 * name (no role — the couple's field, 2026-06-25 lock), and is auto-matched to the guest list (or routed to the couple as a
 * request to confirm — the next stage). Previously this stage only existed as a
 * "Share" dropdown on the list header with nowhere to land; this is its home.
 *
 * Join link shape matches the list page's fetchJoinUrl: `${APP_URL}/join/${eventId}
 * ?token=${event_join_tokens.token}`. Couple-only (RLS + the membership guard).
 */
export default async function GuestInvitePage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = await searchParams;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
      <Link
        href={`/dashboard/${eventId}/guests`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to guest list
      </Link>

      <header className="mt-3 space-y-1">
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Send className="h-6 w-6 text-terracotta" /> Invite your guests
        </h1>
        <p className="text-sm text-ink/60">
          One link for everyone. A guest opens it and gives their name — we find them on your
          list, or add them and ask you to confirm. They reply, and the email they give becomes
          how they sign in. Nobody sees your guest list.
        </p>
      </header>

      {/* The link, its QR, the pending-requests notice, the look picker and
          the crew Event QR — shared with the guest list's Share the link tab. */}
      <InvitePanel
        eventId={eventId}
        themeNotice={search.theme === 'saved' ? 'saved' : search.theme === 'error' ? 'error' : null}
        returnTo="invite"
      />
    </div>
  );
}
