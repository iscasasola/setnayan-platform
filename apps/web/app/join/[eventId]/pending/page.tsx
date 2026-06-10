import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { JoinShell, InvalidTokenScreen } from '../_components/join-shell';

export const metadata = { title: 'Pending confirmation' };

const REASON: Record<string, string> = {
  otp_expired: 'Your code expired, so we’ve passed your request to the couple instead.',
  conflict: 'Someone else just confirmed that spot, so the couple will sort this out with you.',
  requested: 'No problem — the couple will confirm you directly.',
};

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ token?: string; reason?: string }>;
};

export default async function PendingPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const { token = '', reason } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${eventId}/pending?token=${token}`)}`);
  }

  const admin = createAdminClient();
  const { data: event } = await admin
    .from('events')
    .select('display_name, event_date, venue_name')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) return <InvalidTokenScreen />;

  // If they've since been confirmed, send them to success.
  const { data: claim } = await admin
    .from('guest_claims')
    .select('status')
    .eq('event_id', eventId)
    .eq('claimer_user_id', user!.id)
    .maybeSingle();
  if (claim?.status === 'confirmed') redirect(`/join/${eventId}/success?token=${token}`);

  const reasonMessage = reason ? REASON[reason] ?? null : null;

  return (
    <JoinShell event={event}>
      <h2 className="text-xl font-semibold text-ink">You&rsquo;re in the queue</h2>
      <p className="mt-2 text-sm text-ink/70">
        Thanks! We&rsquo;ve sent your request to the couple to confirm you on their guest
        list. You&rsquo;ll get an email at{' '}
        <span className="font-medium text-ink">{user!.email}</span> the moment they do.
      </p>
      {reasonMessage ? (
        <p className="mt-4 rounded-md border border-ink/10 bg-ink/5 px-4 py-3 text-sm text-ink/70">
          {reasonMessage}
        </p>
      ) : null}
      <p className="mt-4 text-xs text-ink/50">
        This keeps the guest list private — only people the couple recognizes get added.
      </p>
      <div className="mt-6">
        <Link className="button-secondary" href="/">
          Back home
        </Link>
      </div>
    </JoinShell>
  );
}
