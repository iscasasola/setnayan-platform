import Link from 'next/link';
import { PageMasthead } from '@/app/_components/page-masthead';
import { redirect } from 'next/navigation';
import { ArrowLeft, Check, DoorOpen, Map as MapIcon, Route } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import { fetchAssignments, fetchTables } from '@/lib/seating';
import { fetchEntrance } from '@/lib/indoor-blueprint';
import { BlueprintStudio } from './_components/blueprint-studio';
import { saveEntrance } from './actions';

export const metadata = { title: 'Indoor Blueprint · Setnayan' };

/**
 * /dashboard/[eventId]/studio/indoor-blueprint — the couple-facing Indoor
 * Blueprint studio: place the venue entrance + preview each guest's
 * "find your table" wayfinding map.
 *
 * FREE (owner 2026-07-23: "indoor blueprint is free and uses the 2D Plan for
 * free"). The entrance→table wayfinding rides on the already-free 2D seat plan
 * (iteration 0008 · tables placed on the floor plan, guests assigned), so there
 * is NO paywall here — every couple opens the studio directly. This supersedes
 * the retired paid ₱1,499 INDOOR_BLUEPRINT SKU: the owns/active gate, the
 * InlineCheckoutDrawer buy CTA and the marketing "Unowned" surface are removed,
 * and checkout/actions.ts hard-rejects any INDOOR_BLUEPRINT order so the retired
 * SKU can never charge. The guest half (/[slug]/find-my-table + the inline seat
 * map on the landing page) is ungated to match.
 */

type Props = { params: Promise<{ eventId: string }> };

export default async function IndoorBlueprintPage({ params }: Props) {
  const { eventId } = await params;

  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const supabase = await createClient();

  const { data: event } = await supabase
    .from('events')
    .select('event_id, display_name, slug')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) redirect(`/dashboard/${eventId}`);

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <PageMasthead title="Map your venue" />
      <BlueprintStudioView eventId={eventId} slug={event.slug} supabase={supabase} />
    </section>
  );
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

// ─────────────────────────────────────────────────────────────────────────
// The studio: place the entrance + preview each guest's "find your table" map.
// Free for every couple; reads straight from the 2D seat plan.
// ─────────────────────────────────────────────────────────────────────────

async function BlueprintStudioView({
  eventId,
  slug,
  supabase,
}: {
  eventId: string;
  slug: string | null;
  supabase: SupabaseLike;
}) {
  const [tables, assignments, guests, entrance] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchAssignments(supabase, eventId),
    fetchGuestsByEvent(supabase, eventId),
    fetchEntrance(supabase, eventId),
  ]);

  const guestById = new Map(guests.map((g) => [g.guest_id, g]));
  // One preview option per seated guest, ordered by table then guest name.
  const tableLabelById = new Map(tables.map((t) => [t.table_id, t.table_label]));
  const guestOptions = assignments
    .map((a) => {
      const guest = guestById.get(a.guest_id);
      if (!guest) return null;
      return {
        tableId: a.table_id,
        guestName: guestDisplayName(guest),
        tableLabel: tableLabelById.get(a.table_id) ?? 'Table',
      };
    })
    .filter((o): o is NonNullable<typeof o> => o !== null)
    .sort((a, b) => a.guestName.localeCompare(b.guestName));

  if (tables.length === 0) {
    return (
      <div className="rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink/70">
        <p className="inline-flex items-center gap-2 font-medium text-ink">
          <Route aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          Build your seating chart first
        </p>
        <p className="mt-2">
          Add tables and seat your guests on the{' '}
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="font-semibold text-terracotta underline-offset-4 hover:underline"
          >
            seat plan
          </Link>{' '}
          — then come back to place your entrance and preview each guest&rsquo;s
          map.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-success-300/60 bg-success-50 px-4 py-3 text-sm font-medium text-success-800">
        <p className="inline-flex items-center gap-2">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Mark your entrance below — your guests can then find their table.
        </p>
      </div>

      <BlueprintStudio
        eventId={eventId}
        tables={tables}
        initialEntrance={entrance}
        guestOptions={guestOptions}
        saveAction={saveEntrance}
      />

      <section className="sn-tile p-5">
        <header className="space-y-1">
          <p className="sn-eye">
            On the day
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Every guest gets their own map
          </h2>
        </header>
        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <DoorOpen aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            From their invitation page, each guest taps{' '}
            <span className="font-medium text-ink">Find my table</span> and sees
            this exact map — marked with their table and the way from the entrance.
          </li>
          <li className="flex items-start gap-2">
            <Route aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            It always reflects your latest seating chart — reseat anyone and their
            map updates.
          </li>
          <li className="flex items-start gap-2">
            <MapIcon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Preview the link yourself:{' '}
            {slug ? (
              <Link
                href={`/${slug}/find-my-table`}
                className="font-medium text-terracotta underline-offset-4 hover:underline"
              >
                open the guest view
              </Link>
            ) : (
              <span className="text-ink/55">
                publish your wedding website to share the guest link
              </span>
            )}
            .
          </li>
        </ul>
      </section>
    </>
  );
}
