import { CalendarPlus, Check, Clock, Mic } from 'lucide-react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  offeredCatalogue,
  totalMinutes,
  type ActivityPick,
  type VendorActivity,
} from '@/lib/vendor-activities';
import { applyActivityPicks, toggleActivityPick } from '../activity-picks-actions';

/**
 * EMCEE PICKS — the couple's menu of their host's segments, on the schedule page.
 *
 * WHY IT LIVES HERE. The whole value is that picking is one step from the
 * timeline it feeds: tick the segments, press the button, the day drafts
 * itself. A separate page would put a navigation between the choice and the
 * result, which is the friction this feature exists to remove.
 *
 * RENDERS NOTHING WITHOUT A BOOKED HOST. A couple with no emcee, or an emcee
 * who has not written his segments down, sees no section at all — not an empty
 * panel and not an advert for a supplier they do not have.
 *
 * ITS OWN DATA BOUNDARY. Both reads run under the CALLER's client. The
 * catalogue is public-to-signed-in by policy; the picks are host-scoped by
 * `event_activity_picks_host_select`. This component is handed a client rather
 * than making one, so the page's own auth context is the only one in play.
 */

/** The host/MC canonical tile — the same key the specialization gate uses. */
const HOST_TILE = 'host_mc';

/** Said once, in both places a refused read used to remove the block silently. */
function EmceePicksUnread() {
  return (
    <p
      role="alert"
      className="rounded-2xl border-t-[3px] border-mulberry/70 bg-mulberry/5 p-4 text-sm text-ink/70"
    >
      <strong className="text-ink">
        We couldn&rsquo;t check what your host has planned.
      </strong>{' '}
      If they have suggested anything, it hasn&rsquo;t gone away. Reload in a
      moment.
    </p>
  );
}

export async function EmceePicks({
  supabase,
  eventId,
}: {
  supabase: SupabaseClient;
  eventId: string;
}) {
  // Which booked vendor on this event is the host/MC? `event_vendors` links a
  // booking to a marketplace profile; the tile lives on the profile.
  // ⚠ BOTH READS BELOW END IN `return null`, so a refusal and "you have no
  // ⚠ host/MC" are the same silence. Supabase RESOLVES with { error } rather
  // ⚠ than throwing, so neither was ever noticed. A refused read now says so
  // ⚠ instead of quietly removing the block from the couple's schedule.
  const { data: booked, error: bookedError } = await supabase
    .from('event_vendors')
    .select('marketplace_vendor_id')
    .eq('event_id', eventId)
    .not('marketplace_vendor_id', 'is', null);
  if (bookedError) {
    logQueryError('EmceePicks.booked', bookedError, { event_id: eventId }, 'graceful_degrade');
    return <EmceePicksUnread />;
  }

  const vendorIds = ((booked ?? []) as { marketplace_vendor_id: string | null }[])
    .map((r) => r.marketplace_vendor_id)
    .filter((v): v is string => Boolean(v));
  if (vendorIds.length === 0) return null;

  const { data: profiles, error: profilesError } = await supabase
    .from('vendor_profiles')
    .select('vendor_profile_id, business_name, services')
    .in('vendor_profile_id', vendorIds);
  if (profilesError) {
    logQueryError('EmceePicks.profiles', profilesError, { event_id: eventId }, 'graceful_degrade');
    return <EmceePicksUnread />;
  }

  const host = ((profiles ?? []) as {
    vendor_profile_id: string;
    business_name: string | null;
    services: string[] | null;
  }[]).find((p) => (p.services ?? []).includes(HOST_TILE));
  if (!host) return null;

  const [catRes, pickRes] = await Promise.all([
    supabase
      .from('vendor_activities')
      .select(
        'activity_id, vendor_profile_id, label, blurb, duration_minutes, block_type, is_offered, display_order',
      )
      .eq('vendor_profile_id', host.vendor_profile_id)
      .order('display_order', { ascending: true }),
    supabase
      .from('event_activity_picks')
      .select('event_id, activity_id, scheduled_block_id')
      .eq('event_id', eventId),
  ]);

  const catalogue = offeredCatalogue((catRes.data ?? []) as VendorActivity[]);
  const picks = (pickRes.data ?? []) as ActivityPick[];
  // Their host has not written anything down yet — say nothing rather than
  // showing an empty menu that looks broken.
  if (catalogue.length === 0) return null;

  const pickedIds = new Set(picks.map((p) => p.activity_id));
  const placedIds = new Set(picks.filter((p) => p.scheduled_block_id).map((p) => p.activity_id));
  const chosen = catalogue.filter((a) => pickedIds.has(a.activity_id));
  const unplacedCount = chosen.filter((a) => !placedIds.has(a.activity_id)).length;

  return (
    <section id="emcee-picks" className="sn-row scroll-mt-4 space-y-3 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/70">
          <Mic aria-hidden className="h-3.5 w-3.5 text-gild" strokeWidth={1.9} />
          From {host.business_name ?? 'your host'}
        </h2>
        {chosen.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.66rem] uppercase tracking-[0.16em] text-ink/55">
            <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.9} />
            {totalMinutes(chosen)} min chosen
          </span>
        ) : null}
      </div>

      <p className="max-w-prose text-sm leading-relaxed text-ink/70">
        These are the segments your host actually runs. Tick what you want on the night
        and add them to your timeline — each one already knows how long it takes, so you
        can move them around instead of typing them out.
      </p>

      <ul className="grid gap-2 sm:grid-cols-2">
        {catalogue.map((a) => {
          const isPicked = pickedIds.has(a.activity_id);
          const isPlaced = placedIds.has(a.activity_id);
          return (
            <li key={a.activity_id}>
              <form action={toggleActivityPick} className="h-full">
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="activity_id" value={a.activity_id} />
                <input type="hidden" name="picked" value={isPicked ? 'false' : 'true'} />
                <button
                  type="submit"
                  disabled={isPlaced}
                  aria-pressed={isPicked}
                  className={`flex h-full w-full flex-col items-start gap-1 border p-3 text-left transition-colors ${
                    isPicked
                      ? 'border-gild bg-gild/10'
                      : 'border-ink/12 bg-white hover:border-gild/50'
                  } ${isPlaced ? 'cursor-default opacity-70' : ''}`}
                >
                  <span className="flex w-full items-start justify-between gap-2">
                    <span className="text-sm font-medium text-ink">{a.label}</span>
                    {isPicked ? (
                      <Check aria-hidden className="h-4 w-4 shrink-0 text-gild" strokeWidth={2.2} />
                    ) : null}
                  </span>
                  {a.blurb ? (
                    <span className="text-xs leading-relaxed text-ink/65">{a.blurb}</span>
                  ) : null}
                  <span className="mt-auto pt-1 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-ink/50">
                    {a.duration_minutes} min
                    {isPlaced ? ' · on your timeline' : ''}
                  </span>
                </button>
              </form>
            </li>
          );
        })}
      </ul>

      {unplacedCount > 0 ? (
        <form action={applyActivityPicks}>
          <input type="hidden" name="event_id" value={eventId} />
          <button
            type="submit"
            className="inline-flex items-center gap-2 bg-ink px-4 py-2.5 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-paper transition-opacity hover:opacity-90"
          >
            <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.9} />
            Add {unplacedCount} to my timeline
          </button>
          <span className="mt-2 block text-xs leading-relaxed text-ink/60">
            They go in after everything you already have, back to back — nothing you have
            planned moves. Drag them where they belong afterwards.
          </span>
        </form>
      ) : chosen.length > 0 ? (
        <p className="text-xs leading-relaxed text-ink/60">
          All {chosen.length} added to your timeline. Untick isn&rsquo;t available once a
          segment is on the day — delete the block itself if you change your mind.
        </p>
      ) : null}
    </section>
  );
}
