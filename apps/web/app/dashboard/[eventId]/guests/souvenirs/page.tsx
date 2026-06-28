import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Gift } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { guestDisplayName, type GuestRole, type GuestSide } from '@/lib/guests';
import { SouvenirDesk, type DeskGuest, type DeskClaim } from './_components/souvenir-desk';
import { LiveRefresher } from '@/app/_components/live-refresher';

export const metadata = { title: 'Souvenir table' };

type Props = { params: Promise<{ eventId: string }> };

type GuestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  side: GuestSide;
  role: GuestRole;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  photo_url: string | null;
  plus_one_name: string | null;
  qr_token: string;
};

export default async function SouvenirTablePage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  // Station crew = couple OR coordinator (matches guest_souvenir_claims RLS).
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .in('member_type', ['couple', 'coordinator'])
    .maybeSingle();
  if (!membership) redirect(`/dashboard/${eventId}`);

  const [
    { data: guestsRaw },
    { data: assignmentsRaw },
    { data: tablesRaw },
    { data: claimsRaw },
    { data: eventRow },
  ] = await Promise.all([
    supabase
      .from('guests')
      .select(
        'guest_id, first_name, last_name, display_name, side, role, rsvp_status, photo_url, plus_one_name, qr_token',
      )
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('last_name'),
    supabase
      .from('event_seat_assignments')
      .select('guest_id, table_id')
      .eq('event_id', eventId),
    supabase
      .from('event_tables')
      .select('table_id, table_label, link_group_label')
      .eq('event_id', eventId),
    supabase
      .from('guest_souvenir_claims')
      .select('guest_id, claimed_at')
      .eq('event_id', eventId),
    supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
  ]);

  const tableLabelById = new Map<string, string>();
  for (const t of tablesRaw ?? []) {
    tableLabelById.set(t.table_id, (t.link_group_label?.trim() || t.table_label || '').trim());
  }
  const tableByGuestId = new Map<string, string>();
  for (const a of assignmentsRaw ?? []) {
    const label = tableLabelById.get(a.table_id);
    if (label) tableByGuestId.set(a.guest_id, label);
  }

  const guests: DeskGuest[] = ((guestsRaw ?? []) as GuestRow[]).map((g) => ({
    guestId: g.guest_id,
    name: guestDisplayName(g),
    photoUrl: g.photo_url,
    plusOneName: g.plus_one_name,
    qrToken: g.qr_token,
    tableLabel: tableByGuestId.get(g.guest_id) ?? null,
  }));

  const claims: DeskClaim[] = (claimsRaw ?? []).map((c) => ({
    guestId: c.guest_id,
    claimedAt: c.claimed_at,
  }));

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
          <Gift className="h-6 w-6 text-terracotta" /> Souvenir table
        </h1>
        <p className="text-sm text-ink/60">
          Scan a guest&rsquo;s QR (or search their name) as you hand out the giveaway —
          the count keeps itself, so no one gets missed or double-served.
        </p>
      </header>

      <div className="mt-5">
        <SouvenirDesk eventId={eventId} guests={guests} initialClaims={claims} />
      </div>

      {/* Day-of: silently re-pull so a guest added at the door appears here. */}
      <LiveRefresher eventDate={(eventRow?.event_date as string | null) ?? null} />
    </div>
  );
}
