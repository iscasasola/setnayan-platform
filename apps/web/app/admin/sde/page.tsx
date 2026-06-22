import { Film } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { SdeUploader } from './sde-uploader';

export const metadata = { title: 'Same-Day Edit · Setnayan HQ' };
export const dynamic = 'force-dynamic';

/**
 * Setnayan HQ · Same-Day Edit delivery. The /admin layout gates non-admins.
 *
 * Lists every event that holds the SDE deliverable — either a direct SDE order
 * or the Media Pack bundle that includes it — and gives each a per-event upload
 * widget. Uploading the finished film auto-publishes it (saveSdeFilm stamps
 * sde_published_at=now()), so it appears on the couple's day-of page + recap the
 * moment it lands — no separate couple-publish step (owner rule). Gating on the
 * public surfaces uses eventSkuActive('SDE'), which is admin-approval +
 * bundle-aware; this listing mirrors that by including SDE and MEDIA_PACK
 * orders in any non-relinquished status so the crew can stage the film as soon
 * as a couple has applied.
 */
export default async function AdminSdePage() {
  const admin = createAdminClient();

  // Candidate events: a non-cancelled/refunded/lapsed order for SDE itself OR
  // the Media Pack bundle that grants it (BUNDLE_CHILD_SKUS.MEDIA_PACK ⊇ SDE).
  const { data: orderRows } = await admin
    .from('orders')
    .select('event_id, service_key, status, created_at')
    .in('service_key', ['SDE', 'MEDIA_PACK'])
    .not('status', 'in', '("draft","cancelled","refunded","lapsed")')
    .order('created_at', { ascending: false })
    .limit(1000);

  const orders = orderRows ?? [];
  // Dedupe to one row per event (an event may hold both SDE + Media Pack).
  const eventIds = [...new Set(orders.map((o) => o.event_id as string))];

  const { data: evRows } = eventIds.length
    ? await admin
        .from('events')
        .select(
          'event_id, slug, display_name, event_date, venue_name, sde_video_r2_key, sde_published_at',
        )
        .in('event_id', eventIds)
    : { data: [] as Array<Record<string, unknown>> };
  const events = evRows ?? [];

  // Resolve the current film's display URL per event (presigned) so the admin
  // sees what's live. Parallel — one signing round trip each.
  const filmUrlByEvent = new Map<string, string | null>(
    await Promise.all(
      events.map(async (e) => {
        const url = await displayUrlForStoredAsset(
          (e as { sde_video_r2_key?: string | null }).sde_video_r2_key ?? null,
        ).catch(() => null);
        return [e.event_id as string, url] as const;
      }),
    ),
  );

  // Stable order: most-recent application first (orders already sorted desc).
  const orderedEventIds = eventIds.filter((id) =>
    events.some((e) => e.event_id === id),
  );
  const evById = new Map(events.map((e) => [e.event_id as string, e]));

  return (
    <section className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
          <Film aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Same-Day Edit</h1>
        <p className="max-w-prose text-sm text-ink/65">
          Upload the finished Same-Day Edit film for each couple who&rsquo;s bought it (on its own or
          inside the Media Pack). The moment you upload, it goes live on their day-of page and their
          recap — there&rsquo;s no separate publish step.
        </p>
      </header>

      {orderedEventIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/20 bg-cream p-10 text-center">
          <Film aria-hidden className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-ink">No SDE orders yet.</p>
          <p className="mt-1 text-sm text-ink/55">
            Events that buy the Same-Day Edit (or the Media Pack) show up here, ready for the film.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {orderedEventIds.map((id) => {
            const ev = evById.get(id)!;
            const name = (ev.display_name as string) ?? 'A Setnayan wedding';
            const slug = (ev.slug as string | null) ?? null;
            const publishedAt = ev.sde_published_at
              ? new Date(ev.sde_published_at as string).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : null;
            const filmUrl = filmUrlByEvent.get(id) ?? null;
            return (
              <li
                key={id}
                className="space-y-4 rounded-2xl border border-ink/10 bg-surface p-4 sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">{name}</p>
                    <p className="mt-0.5 text-xs text-ink/55">
                      {[
                        ev.venue_name as string,
                        slug ? `/${slug}` : null,
                        publishedAt ? `Delivered ${publishedAt}` : 'Not delivered yet',
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <span
                    className="text-[11px] uppercase tracking-wider px-2.5 py-1 rounded-full"
                    style={{
                      background: publishedAt ? 'rgba(60,140,90,.12)' : 'rgba(0,0,0,.05)',
                      color: publishedAt ? '#2f7d4f' : '#6a6e76',
                    }}
                  >
                    {publishedAt ? '● Live' : 'Pending'}
                  </span>
                </div>
                <SdeUploader eventId={id} initialFilmUrl={filmUrl} />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
