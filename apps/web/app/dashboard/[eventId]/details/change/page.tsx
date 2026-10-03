import { notFound, redirect } from 'next/navigation';
import { PageMasthead } from '@/app/_components/page-masthead';
import { createClient } from '@/lib/supabase/server';
import { loadEventSettings } from '@/app/dashboard/[eventId]/launch/_components/details-settings-load';
import { EventSettingsEditor } from '../_components/event-settings-editor';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Event settings' };

/**
 * /dashboard/[eventId]/details/change — EVENT SETTINGS, its own page again
 * (2026-10-02, simplicity fix 8).
 *
 * #6280 folded this page into the Maker's Your info › Event settings. Its three
 * editors save LIVE through their own actions, and nothing in the Maker may take
 * effect before Apply; none of them can ride the Event Hub draft as it stands
 * (see `event-settings-editor.tsx` for why, editor by editor). So they live here,
 * outside the Maker, opened from Event Details › The basics — the information
 * sheet that links to the page that handles each part (owner 2026-10-01,
 * "EVENT DETAILS IS INFORMATION ONLY").
 *
 * The names and the date are NOT here: they are Your info › Names and › Date in
 * the Maker, drafted until Apply. The reads are `loadEventSettings`, the one
 * reader (events_host, behind the budget gate).
 */
export default async function EventSettingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const settings = await loadEventSettings({ supabase, eventId, userId: user.id });
  if (!settings) notFound();

  return (
    <section className="sn-col space-y-4" data-event-settings="">
      <PageMasthead title="Event settings" />
      <EventSettingsEditor
        eventId={eventId}
        form={settings.form}
        governed={settings.governed}
        pax={settings.pax}
      />
    </section>
  );
}
