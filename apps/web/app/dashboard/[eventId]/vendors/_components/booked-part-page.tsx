/**
 * A BOOKED PART'S OWN PAGE — Suppliers › Booked › Budget (`?part=budget`) and › Schedule (`?part=schedule`).
 *
 * Owner 2026-10-29, *"so booked has budget and schedule."*; the approved final Suppliers design (2026-10-30): the
 * Budget and the Schedule sit UNDER Booked, beside the Team, in the same shell — the same Find · Build · Booked row
 * pinned under the app's top bar, the same ⚙, the same folded row on scroll. Each is the SHIPPED page rendered whole
 * (`budget/page.tsx`, `schedule/page.tsx` — never a second editor); the page itself draws Booked's first row
 * ("Budget ▾ · ₱297,500 agreed · ₱120,000 paid"), because it is the one that holds the numbers.
 *
 * A server component: it only places. The ⚙ sheet's reads run beside the hosted page's (`PartSettings` is its own
 * async component), so neither waits on the other.
 */
import { Suspense, type ReactNode } from 'react';
import { createClient } from '@/lib/supabase/server';
import { fetchEventViewer } from '@/lib/event-viewer.server';
import { loadSuppliersSettings } from '@/lib/suppliers-settings.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { BookedPartKey, PillarPart } from '@/lib/pillar-parts';
import { ServicesTakeover } from './services-takeover';
import { SuppliersSettingsRows } from './suppliers-settings-rows';

/** Nothing of Build is on this page; its numbers are the Suppliers page's own. */
const NO_TALLY = { filled: 0, total: 0, knownPhp: 0, unpriced: 0 } as const;

async function PartSettings({ eventId, userId }: { eventId: string; userId: string }) {
  const supabase = await createClient();
  const [viewer, ev] = await Promise.all([
    fetchEventViewer(supabase, eventId, userId),
    supabase.from('events_host').select('event_date, ceremony_type').eq('event_id', eventId).maybeSingle(),
  ]);
  if (ev.error) logQueryError('booked-part-page events_host', ev.error, { event_id: eventId }, 'graceful_degrade');
  const row = (ev.data as { event_date: string | null; ceremony_type: string | null } | null) ?? null;
  const view = await loadSuppliersSettings(supabase, eventId, {
    isCouple: viewer.isCouple,
    eventDate: row?.event_date ?? null,
    ceremonyType: row?.ceremony_type ?? null,
  });
  return <SuppliersSettingsRows eventId={eventId} view={view} />;
}

export function BookedPartPage({
  eventId,
  userId,
  part,
  parts,
  children,
}: {
  eventId: string;
  userId: string;
  part: Exclude<BookedPartKey, 'team'>;
  parts: readonly PillarPart[];
  /** The shipped page, rendered whole. */
  children: ReactNode;
}) {
  return (
    <div data-booked-part-page={part}>
      <ServicesTakeover
        eventId={eventId}
        initialTab="budget"
        partPage
        bookedPart={part}
        bookedParts={parts}
        tally={NO_TALLY}
        bookedCount={0}
        settingsSlot={
          <Suspense fallback={null}>
            <PartSettings eventId={eventId} userId={userId} />
          </Suspense>
        }
        bookedSlot={children}
      />
    </div>
  );
}
