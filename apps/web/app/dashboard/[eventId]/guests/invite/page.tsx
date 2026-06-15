import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, ArrowRight, Send } from 'lucide-react';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { logQueryError } from '@/lib/supabase/error-detect';
import { InviteLink } from './_components/invite-link';

export const metadata = { title: 'Invite guests' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Invite — the "share one link" stage of the guest journey (2026-06-16). The
 * couple shares ONE join link/QR with everyone; a guest opens it, signs in, picks
 * their role, and is auto-matched to the guest list (or routed to the couple as a
 * request to confirm — the next stage). Previously this stage only existed as a
 * "Share" dropdown on the list header with nowhere to land; this is its home.
 *
 * Join link shape matches the list page's fetchJoinUrl: `${APP_URL}/join/${eventId}
 * ?token=${event_join_tokens.token}`. Couple-only (RLS + the membership guard).
 */
export default async function GuestInvitePage({ params }: Props) {
  const { eventId } = await params;

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

  const [tokenRes, pendingRes] = await Promise.all([
    supabase.from('event_join_tokens').select('token').eq('event_id', eventId).maybeSingle(),
    // Requests already waiting (the Confirm stage) — surfaced as a forward nudge.
    supabase
      .from('guest_claims')
      .select('claim_id', { count: 'exact', head: true })
      .eq('event_id', eventId)
      .in('status', ['pending_review', 'otp_sent']),
  ]);

  if (tokenRes.error) {
    logQueryError(
      'GuestInvitePage (event_join_tokens)',
      tokenRes.error,
      { event_id: eventId },
      'graceful_degrade',
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://setnayan-platform-web.vercel.app';
  const joinUrl = tokenRes.data?.token
    ? `${appUrl}/join/${eventId}?token=${tokenRes.data.token}`
    : null;
  const pendingClaims = pendingRes.count ?? 0;

  // SVG QR of the join link — crisp at any size, ~3KB inline, no client JS.
  const qrSvg = joinUrl
    ? await QRCode.toString(joinUrl, {
        type: 'svg',
        errorCorrectionLevel: 'M',
        margin: 2,
        width: 320,
        color: { dark: '#1E2229', light: '#FBFBFA' },
      })
    : null;

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
          One link for everyone. A guest opens it, signs in, and picks their role — we match
          them to your list automatically, or send you a request to confirm. Nobody sees your
          guest list.
        </p>
      </header>

      {joinUrl ? (
        <div className="mt-6 rounded-xl border border-ink/10 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-8">
            {qrSvg ? (
              <div
                className="shrink-0 rounded-xl bg-cream p-3 shadow-inner [&>svg]:h-40 [&>svg]:w-40"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : null}
            <div className="w-full flex-1 space-y-3">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.16em] text-ink/50">
                  Your invite link
                </p>
                <InviteLink url={joinUrl} />
              </div>
              <p className="text-xs leading-relaxed text-ink/55">
                Send it by text, email, or your group chat — or let guests scan the QR on a
                printed invite. The same link works for everyone.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-ink/10 bg-ink/[0.02] p-8 text-center">
          <p className="text-sm text-ink/60">
            Your invite link isn&rsquo;t ready yet. Try again in a moment — if it keeps not
            showing, your event may still be setting up.
          </p>
        </div>
      )}

      {pendingClaims > 0 ? (
        <Link
          href={`/dashboard/${eventId}/guests/claims`}
          className="group mt-4 flex items-center justify-between gap-3 rounded-xl border border-terracotta/30 bg-terracotta/5 px-4 py-3 transition-colors hover:border-terracotta/50 hover:bg-terracotta/10"
        >
          <span className="text-sm text-ink">
            <span className="font-semibold text-terracotta-700">
              {pendingClaims} {pendingClaims === 1 ? 'request' : 'requests'}
            </span>{' '}
            waiting for you to confirm
          </span>
          <ArrowRight
            aria-hidden
            className="h-4 w-4 shrink-0 text-terracotta/60 transition-transform group-hover:translate-x-0.5"
            strokeWidth={1.75}
          />
        </Link>
      ) : null}
    </div>
  );
}
