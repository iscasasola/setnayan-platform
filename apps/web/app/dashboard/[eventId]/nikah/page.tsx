import { notFound, redirect } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { getCurrentUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { fetchGuestsByEventMeasured } from '@/lib/guests';
import { fetchEventViewer, isDelegateWithoutArea } from '@/lib/event-viewer.server';
import { isMuslimWedding } from '@/lib/chinese-wedding';
import { NikahEssentialsCard } from '../_components/nikah-essentials-card';
import { readNikahImam } from '../_components/nikah-imam';
import { NotSharedWithYou } from '../_components/not-shared-with-you';
import { NIKAH_NAME } from '@/lib/home-first-screen';

export const dynamic = 'force-dynamic';

export const metadata = { title: NIKAH_NAME };

/**
 * /dashboard/[eventId]/nikah — the five essentials of the Nikah.
 *
 * 🕌 THE CARD MOVED HERE, UNCHANGED, WHEN THE HOME BECAME THE FIRST SCREEN ONLY
 * (owner 2026-10-02, DECISION_LOG "HOME IS THE FIRST SCREEN ONLY"). It used to
 * sit in Home's second section, and it is the ONLY place the mahr and the
 * walima seating posture are written (`updateNikahDetails`) — deleting the
 * section would have deleted those two fields' only editor. The Home keeps one
 * line of it, on its "Your services" row: "Nikah essentials · N of 4 in place".
 *
 * Muslim weddings only: any other event is a 404, like the card was absent.
 */
export default async function NikahEssentialsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event, error } = await supabase
    .from('events')
    .select('event_id, event_date, ceremony_type, secondary_ceremony_type, mahr_description, gender_separation')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    logQueryError('NikahEssentialsPage.event', error, { event_id: eventId, user_id: user.id }, 'graceful_degrade');
    throw new Error(error.message);
  }
  if (!event) notFound();
  const row = event as {
    event_date?: string | null;
    ceremony_type?: string | null;
    secondary_ceremony_type?: string | null;
    mahr_description?: string | null;
    gender_separation?: string | null;
  };
  if (!isMuslimWedding({ ceremony_type: row.ceremony_type ?? null, secondary_ceremony_type: row.secondary_ceremony_type ?? null })) {
    notFound();
  }

  // The essentials are counted from the guest list (wali · witnesses · imam), so a
  // helper the couple has not given the guest list to is told so — never "none yet".
  const viewer = await fetchEventViewer(supabase, eventId, user.id);
  if (isDelegateWithoutArea(viewer, 'guest_list')) {
    return <NotSharedWithYou title={NIKAH_NAME} thing="guest list" />;
  }

  const [{ rows: guests, measured }, { nikahImamBooked, nikahImamNote }] = await Promise.all([
    fetchGuestsByEventMeasured(supabase, eventId),
    readNikahImam(supabase, eventId, user.id),
  ]);

  return (
    <section className="mx-auto w-full max-w-xl space-y-4">
      <PageMasthead title={NIKAH_NAME} />
      {/* A refused guest read is not "no wali and no witnesses yet" — the card
          would tick nothing and tell the couple to add people already there. */}
      {measured ? (
        <NikahEssentialsCard
          eventId={eventId}
          eventDateSet={!!row.event_date}
          mahrDescription={row.mahr_description ?? null}
          genderSeparation={row.gender_separation ?? null}
          guests={guests}
          imamBooked={nikahImamBooked}
          imamNote={nikahImamNote}
        />
      ) : (
        <p role="status" className="sn-tile text-sm text-ink/70">
          We couldn&rsquo;t load your guest list just now, so we can&rsquo;t say which essentials are in place. Reload to try again.
        </p>
      )}
    </section>
  );
}
