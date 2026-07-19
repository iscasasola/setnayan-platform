import Link from 'next/link';
import { Images, ExternalLink, Globe } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { SubmitButton } from '@/app/_components/submit-button';
import { adminTakedownRecap } from '@/app/admin/recaps/actions';

/**
 * RecapsSurface — the Auto-Recap oversight body, re-homed byte-identical from
 * app/admin/recaps/page.tsx into the tabbed /admin/studio studio (Studio
 * Studio slice 1). Behaviour is unchanged: lists every PUBLISHED recap and
 * gives HQ the RA 10173 take-down lever (adminTakedownRecap, imported from its
 * unchanged @/app/admin/recaps/actions location). Two mechanical changes:
 *   1. It accepts the surface's own searchParams (ok, error) as props from the
 *      /admin/studio shell instead of awaiting them itself.
 *   2. The outer max-w-4xl container is dropped (the studio shell provides
 *      layout), matching the surface convention.
 *
 * The take-down form has no filter GET — adminTakedownRecap is a server action
 * whose own revalidatePath('/admin/recaps') still fires (against the redirect
 * stub) so no action="/admin/studio" rewrite is needed here.
 */
export async function RecapsSurface({
  ok,
  error,
}: {
  ok: string | null;
  error: string | null;
}) {
  const admin = createAdminClient();

  const { data: recapRows } = await admin
    .from('event_recaps')
    .select('event_id, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(500);
  const recaps = recapRows ?? [];

  const eventIds = recaps.map((r) => r.event_id as string);
  const { data: evRows } = eventIds.length
    ? await admin
        .from('events')
        .select('event_id, slug, display_name, event_date, venue_name')
        .in('event_id', eventIds)
    : { data: [] as Array<Record<string, unknown>> };
  const evById = new Map((evRows ?? []).map((e) => [e.event_id as string, e]));

  const rows = recaps
    .map((r) => ({ recap: r, ev: evById.get(r.event_id as string) }))
    .filter((x) => x.ev);

  return (
    <section className="space-y-6">
      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-mulberry/10 text-mulberry">
          <Images aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-2xl font-semibold tracking-tight">Recaps</h1>
        <p className="max-w-prose text-sm text-ink/65">
          Every couple-published Auto-Recap that&rsquo;s live right now. These are public pages with
          guest photos and messages — take one down if you need to (the couple can re-publish).
        </p>
      </header>

      {ok ? (
        <p className="rounded-md border border-success-300 bg-success-50 px-4 py-3 text-sm text-success-900">
          {ok}
        </p>
      ) : null}
      {error ? (
        <p className="rounded-md border border-danger-300 bg-danger-50 px-4 py-3 text-sm text-danger-900">
          {error}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink/15 bg-white/50 p-10 text-center">
          <Globe aria-hidden className="mx-auto h-6 w-6 text-ink/40" strokeWidth={1.5} />
          <p className="mt-3 text-sm font-medium text-ink">No published recaps yet.</p>
          <p className="mt-1 text-sm text-ink/55">
            Couples publish their recap from the Papic add-on. Live ones show up here.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map(({ recap, ev }) => {
            const slug = ev?.slug as string | null;
            const name = (ev?.display_name as string) ?? 'A Setnayan wedding';
            const publishedAt = recap.published_at
              ? new Date(recap.published_at as string).toLocaleDateString('en-PH', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                })
              : '—';
            const anchor = (recap.event_id as string).toLowerCase().replace(/[^a-z0-9-]/g, '');
            return (
              <li
                key={recap.event_id as string}
                id={`rc-${anchor}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-surface p-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{name}</p>
                  <p className="mt-0.5 text-xs text-ink/55">
                    {[ev?.venue_name as string, `Published ${publishedAt}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {slug ? (
                    <Link
                      href={`/${slug}/recap`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-sm font-medium text-terracotta underline-offset-4 hover:underline"
                    >
                      View
                      <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </Link>
                  ) : null}
                  <form action={adminTakedownRecap}>
                    <input type="hidden" name="event_id" value={recap.event_id as string} />
                    <SubmitButton
                      pendingLabel="Taking down…"
                      className="rounded-md border border-danger-300 bg-danger-50 px-3 py-1.5 text-xs font-medium text-danger-800 hover:bg-danger-100"
                    >
                      Take down
                    </SubmitButton>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
