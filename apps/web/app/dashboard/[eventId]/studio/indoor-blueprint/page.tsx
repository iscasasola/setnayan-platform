import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  ArrowLeft,
  Check,
  DoorOpen,
  LayoutGrid,
  Map as MapIcon,
  Route,
  Sparkles,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { fetchGuestsByEvent, guestDisplayName } from '@/lib/guests';
import {
  fetchAssignments,
  fetchTables,
  type EventTableRow,
} from '@/lib/seating';
import {
  DEFAULT_ENTRANCE,
  INDOOR_BLUEPRINT_PRICE_PHP,
  INDOOR_BLUEPRINT_SERVICE_KEY,
  eventOwnsIndoorBlueprint,
  fetchEntrance,
} from '@/lib/indoor-blueprint';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { fetchPlatformSettings } from '@/lib/platform-settings';
import { InlineCheckoutDrawer } from '@/app/dashboard/[eventId]/_components/inline-checkout-drawer';
import { WayfindingMap } from '@/app/_components/wayfinding-map';
import { BlueprintStudio } from './_components/blueprint-studio';
import { saveEntrance } from './actions';

export const metadata = { title: 'Indoor Blueprint · Setnayan' };

/**
 * /dashboard/[eventId]/studio/indoor-blueprint — closes the partial
 * INDOOR_BLUEPRINT SKU (₱1,499 · "Your whole venue, mapped and seated").
 *
 * The seating-chart editor (iteration 0008) is already live; this paid upgrade
 * adds the missing "entrance → table" wayfinding (v2-catalog.ts: "entrance-to-
 * table nav not built"): a guest-facing "find your table" view that highlights
 * each guest's assigned table on the published floor plan and draws a path from
 * the venue entrance, plus this couple-facing studio to place the entrance +
 * preview every guest's view.
 *
 * Gating (mirrors the custom-qr-guest page + eventOwnsProWebsite):
 *   • Owned (paid INDOOR_BLUEPRINT order, not cancelled/refunded/lapsed) →
 *     the studio (entrance editor + guest-view preview) + a note about the
 *     guest "find your table" link.
 *   • Unowned → marketing surface with a sample wayfinding preview + the
 *     InlineCheckoutDrawer buy CTA. The seating chart keeps working regardless;
 *     only the wayfinding overlay is gated.
 *
 * The orchestrator flips lib/v2-catalog.ts INDOOR_BLUEPRINT → 'live' after
 * verifying; until then the SKU shows "Coming soon" on /pricing, and this page
 * still works (the buy CTA is the InlineCheckoutDrawer, independent of the
 * /pricing build-status badge).
 */

const SKU_CODE = INDOOR_BLUEPRINT_SERVICE_KEY;
const FALLBACK_PRICE_PHP = INDOOR_BLUEPRINT_PRICE_PHP;

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

  const owns = await eventOwnsIndoorBlueprint(supabase, eventId);

  const skuRecord = await formatV2Sku(SKU_CODE).catch(() => null);
  const pricePhp = skuRecord?.price_php ?? FALLBACK_PRICE_PHP;

  return (
    <section className="space-y-6">
      <Link
        href={`/dashboard/${eventId}/studio`}
        className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/70 hover:bg-ink/10 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Back to add-ons
      </Link>

      <header className="space-y-2">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
          Indoor Blueprint
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Your whole venue, mapped and seated
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          You&rsquo;ve already built your seating chart. Indoor Blueprint turns it
          into wayfinding: each guest gets a &ldquo;find your table&rdquo; map that
          marks the entrance, highlights their table, and draws the way there — so
          nobody wanders the hall looking for their seat.
        </p>
      </header>

      {owns ? (
        <OwnedView eventId={eventId} slug={event.slug} supabase={supabase} />
      ) : (
        <UnownedView
          eventId={eventId}
          supabase={supabase}
          pricePhp={pricePhp}
          displayName={event.display_name}
        />
      )}
    </section>
  );
}

type SupabaseLike = Awaited<ReturnType<typeof createClient>>;

// ─────────────────────────────────────────────────────────────────────────
// Owned — the couple has paid. Show the studio: place the entrance + preview
// each guest's "find your table" map.
// ─────────────────────────────────────────────────────────────────────────

async function OwnedView({
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
      <div className="rounded-xl border border-success-300/60 bg-success-50 px-4 py-3 text-sm text-success-800">
        <p className="inline-flex items-center gap-2 font-medium">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Indoor Blueprint is unlocked.
        </p>
        <p className="mt-2 text-success-900/80">
          Add tables and seat your guests on the{' '}
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="font-semibold underline-offset-4 hover:underline"
          >
            seating chart
          </Link>{' '}
          first — then come back to place your entrance and preview each
          guest&rsquo;s map.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border border-success-300/60 bg-success-50 px-4 py-3 text-sm font-medium text-success-800">
        <p className="inline-flex items-center gap-2">
          <Check aria-hidden className="h-4 w-4" strokeWidth={2} />
          Indoor Blueprint is unlocked — your guests can now find their table.
        </p>
      </div>

      <BlueprintStudio
        eventId={eventId}
        tables={tables}
        initialEntrance={entrance}
        guestOptions={guestOptions}
        saveAction={saveEntrance}
      />

      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
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

// ─────────────────────────────────────────────────────────────────────────
// Unowned — the marketing surface. A sample wayfinding preview (the couple's
// real tables if they have any, else a representative sample) + the buy CTA.
// ─────────────────────────────────────────────────────────────────────────

async function UnownedView({
  eventId,
  supabase,
  pricePhp,
  displayName,
}: {
  eventId: string;
  supabase: SupabaseLike;
  pricePhp: number;
  displayName: string | null;
}) {
  const [tables, settings] = await Promise.all([
    fetchTables(supabase, eventId),
    fetchPlatformSettings(supabase),
  ]);

  // Preview tables — the couple's real ones if they've built a chart, else a
  // small representative sample so the wayfinding still demonstrates.
  const previewTables: EventTableRow[] =
    tables.length > 0 ? tables.slice(0, 7) : SAMPLE_TABLES(eventId);
  const previewTarget = previewTables[Math.min(2, previewTables.length - 1)]?.table_id ?? null;

  return (
    <>
      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              What guests see
            </p>
            <h2 className="text-xl font-semibold tracking-tight">
              &ldquo;Find your table&rdquo;
            </h2>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/15 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-terracotta">
            <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
            Upgrade
          </span>
        </header>
        <p className="mt-2 max-w-prose text-sm text-ink/60">
          The entrance is marked, the guest&rsquo;s table glows, and a dotted path
          shows the way from the door.
          {tables.length === 0 ? ' This is a sample layout — yours uses your real seating chart.' : ''}
        </p>
        <div className="mt-5">
          <WayfindingMap
            tables={previewTables}
            entrance={DEFAULT_ENTRANCE}
            targetTableId={previewTarget}
          />
        </div>
      </section>

      <section className="rounded-2xl border border-ink/10 bg-cream p-5">
        <header className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            What you get
          </p>
          <h2 className="text-xl font-semibold tracking-tight">
            Wayfinding for every guest
          </h2>
        </header>

        <ul className="mt-4 space-y-2 text-sm text-ink/70">
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            A &ldquo;find your table&rdquo; map on every guest&rsquo;s invitation page.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Mark your venue entrance once — the path draws itself from there.
          </li>
          <li className="flex items-start gap-2">
            <Check aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={2} />
            Built straight from your seating chart — no extra layout work.
          </li>
          <li className="flex items-start gap-2">
            <LayoutGrid aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
            Reseat anyone and every guest&rsquo;s map updates automatically.
          </li>
        </ul>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink/65">
            One price for your whole venue ·{' '}
            <span className="font-mono text-base text-ink">{formatPhp(pricePhp)}</span>
          </p>
          <div className="sm:w-auto">
            <InlineCheckoutDrawer
              eventId={eventId}
              serviceKey={SKU_CODE}
              displayName={`Indoor Blueprint${displayName ? ` · ${displayName}` : ''}`}
              originalPriceCentavos={String(Math.round(pricePhp * 100))}
              settings={settings}
              triggerLabel="Map my venue"
              triggerClassName="inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2 text-sm font-medium text-cream hover:bg-mulberry-600 disabled:opacity-70 sm:w-auto"
            />
          </div>
        </div>
        <p className="mt-3 text-xs text-ink/50">
          Haven&rsquo;t built your seating chart yet? Start on the{' '}
          <Link
            href={`/dashboard/${eventId}/seating`}
            className="font-medium text-terracotta underline-offset-4 hover:underline"
          >
            seating page
          </Link>{' '}
          — Indoor Blueprint maps whatever you arrange.
        </p>
      </section>
    </>
  );
}

/**
 * Representative sample tables for the unowned preview when the couple hasn't
 * built a chart yet. Non-persisted — render-only EventTableRow shapes with
 * placed positions so the wayfinding demonstrates the entrance + path. The
 * `event_id` is stamped only to satisfy the type; these rows never touch the DB.
 */
function SAMPLE_TABLES(eventId: string): EventTableRow[] {
  const mk = (
    n: number,
    label: string,
    x: number,
    y: number,
  ): EventTableRow => ({
    table_id: `sample-${n}`,
    public_id: `sample-${n}`,
    event_id: eventId,
    table_label: label,
    table_type: 'round_10',
    capacity: 10,
    sort_order: n,
    x_pos: x,
    y_pos: y,
  });
  return [
    mk(1, 'Family', 30, 36),
    mk(2, 'Sponsors', 70, 36),
    mk(3, 'Table 3', 30, 60),
    mk(4, 'Table 4', 70, 60),
    mk(5, 'Friends', 50, 78),
  ];
}
