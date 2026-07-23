import { Images } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { papicPoolGalleryActive } from '@/lib/papic-pool-gate';
import { eventPapicActive } from '@/lib/papic-seats';
import { PoolGalleryToggle } from './pool-gallery-toggle';

/**
 * Shared Pool Gallery — the couple's control card on the Papic studio page
 * (OnTheDay build ⑥), rendered beside the LiveWallCard. Server component:
 * renders ONLY when the env flag + the 'papic_pool_gallery' DPO control are
 * on AND Papic is active for this event
 * (there is no pool without captures). Reads the current toggle state, then
 * hands the flip to the client toggle → the COUPLE-ONLY server action.
 *
 * The copy is the honest-privacy contract (owner rule): opening exposes the
 * WHOLE pool — every clean-screened photo and clip, as web copies — to every
 * session guest, who may also tag themselves into photos. Closing is
 * retroactive on the next read.
 */
export async function PoolGalleryCard({ eventId }: { eventId: string }) {
  if (!(await papicPoolGalleryActive())) return null;

  const supabase = await createClient();
  const papicActive = await eventPapicActive(supabase, eventId);
  if (!papicActive) return null;

  // Toggle state via the admin client: pre-migration (column absent) this read
  // errors → treat as "not available yet" and render nothing (no dead door on
  // the host side either).
  const admin = createAdminClient();
  const { data: ev, error } = await admin
    .from('events')
    .select('pool_gallery_open')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !ev) return null;

  const open = ev.pool_gallery_open === true;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink">
        <Images aria-hidden className="h-4.5 w-4.5 text-terracotta" strokeWidth={2} />
        Shared pool gallery
      </h2>
      <p className="mt-1 text-sm text-ink/60">
        Let your guests browse <span className="font-medium text-ink/75">every</span>{' '}
        clean-screened photo and clip in your Papic pool (web copies only) and tag
        themselves into photos they&rsquo;re in — tagged photos join their personal
        gallery and download. Off by default; turning it off later closes the
        gallery for everyone immediately.
      </p>
      <div className="mt-4">
        <PoolGalleryToggle eventId={eventId} initialOpen={open} />
      </div>
    </section>
  );
}
