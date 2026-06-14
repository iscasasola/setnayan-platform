import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, LayoutGrid } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

export const metadata = { title: 'Seat Plan · Vendor' };

/**
 * Read-only vendor seat-plan viewer — feature-access program Phase 4
 * (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md § 6).
 *
 * The PUBLISHED floor plan for booked floor-touching vendors: stage, dance
 * floor, entrances (incl. service entrance), every table's position with
 * seated COUNTS — and per-table meal counts for food-relevant categories
 * (the caterer's covers sheet). Counts only: guest names never cross
 * (RA 10173, § 8). The gate lives in the get_vendor_seat_plan RPC.
 */

type PlanTable = {
  table_id: string;
  label: string;
  table_type: string;
  capacity: number;
  x: number | null;
  y: number | null;
  rotation_deg: number;
  sort_order: number;
  seated: number;
  meal_counts: Record<string, number> | null;
};

type PlanObject = {
  object_id: string;
  zone: 'reception' | 'cocktail';
  object_type: string;
  label: string;
  x: number;
  y: number;
  is_mine: boolean;
  vendor_name: string | null;
};

type PlanCocktail = {
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  venue: { width_m: number | null; length_m: number | null };
  window: { label: string; start_at: string | null; end_at: string | null } | null;
};

type Plan = {
  published_at: string;
  venue: { width_m: number | null; length_m: number | null };
  stage: { x: number; y: number; w: number; h: number };
  dance: { x: number; y: number; w: number; h: number } | null;
  entrance: { x: number; y: number } | null;
  service_entrance: { x: number; y: number } | null;
  cocktail: PlanCocktail | null;
  dietary_included: boolean;
  tables: PlanTable[];
  objects: PlanObject[];
};

const MEAL_LABELS: Record<string, string> = {
  beef: 'Beef',
  chicken: 'Chicken',
  fish: 'Fish',
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  kids: 'Kids',
  no_preference: 'No pref.',
};

function fmtWindowTime(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' });
}

function PinMarker({ o }: { o: PlanObject }) {
  return (
    <div
      className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center ${o.is_mine ? 'z-10' : ''}`}
      style={{ left: `${o.x}%`, top: `${o.y}%` }}
      title={o.vendor_name ? `${o.label} · ${o.vendor_name}` : o.label}
    >
      <span
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-[10px] font-semibold shadow-sm ${
          o.is_mine
            ? 'border-terracotta bg-terracotta text-cream ring-2 ring-terracotta/30'
            : 'border-ink/25 bg-white text-ink/70'
        }`}
      >
        {o.is_mine ? 'YOU' : '•'}
      </span>
      <span className="mt-0.5 max-w-24 truncate rounded bg-white/85 px-1 text-[9px] font-medium leading-tight text-ink/75">
        {o.label}
      </span>
    </div>
  );
}

function isRound(tableType: string): boolean {
  return tableType.startsWith('round') || tableType.startsWith('crescent');
}

type Props = { params: Promise<{ eventId: string }> };

export default async function VendorSeatPlanPage({ params }: Props) {
  const { eventId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const { data, error } = await supabase.rpc('get_vendor_seat_plan', {
    p_event_id: eventId,
  });
  // not_booked / category_not_floor / not_published all land here — the
  // Brief page is the right fallback (it shows the publication status).
  if (error || !data) redirect(`/vendor-dashboard/clients/${eventId}`);
  const plan = data as Plan;

  const placed = plan.tables.filter((t) => t.x !== null && t.y !== null);
  const unplaced = plan.tables.filter((t) => t.x === null || t.y === null);
  const totalSeated = plan.tables.reduce((n, t) => n + t.seated, 0);
  // Canvas aspect from real venue dimensions when set; editor default 4:3.
  const aspect =
    plan.venue.width_m && plan.venue.length_m
      ? plan.venue.width_m / plan.venue.length_m
      : 4 / 3;
  const objects = plan.objects ?? [];
  const myPins = objects.filter((o) => o.is_mine);
  const cocktail = plan.cocktail;
  const cocktailWindow = cocktail?.window
    ? `${cocktail.window.label}${fmtWindowTime(cocktail.window.start_at) ? ` · ${fmtWindowTime(cocktail.window.start_at)}${fmtWindowTime(cocktail.window.end_at) ? `–${fmtWindowTime(cocktail.window.end_at)}` : ''}` : ''}`
    : null;
  const showMap = placed.length > 0 || cocktail !== null || objects.length > 0;

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/vendor-dashboard/clients/${eventId}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" /> Event brief
      </Link>

      <header className="space-y-2">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
          <LayoutGrid aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Seat plan</h1>
        <p className="max-w-prose text-base text-ink/65">
          The couple&rsquo;s published floor plan — {plan.tables.length} tables,{' '}
          {totalSeated} guests seated. Counts only; guest names stay private.
        </p>
      </header>

      {myPins.length > 0 ? (
        <p className="rounded-xl border border-terracotta/25 bg-terracotta/[0.06] px-4 py-3 text-sm">
          <span className="font-semibold text-terracotta">Your spot:</span>{' '}
          {myPins
            .map(
              (p) =>
                `${p.label} — ${p.zone === 'cocktail' ? (cocktail?.label ?? 'cocktail area') : 'reception room'}`,
            )
            .join(' · ')}
        </p>
      ) : null}

      {/* Floor map — one blueprint: reception room + the cocktail/waiting area */}
      {showMap ? (
        <div
          className="relative w-full overflow-hidden rounded-2xl border border-ink/15 bg-cream"
          style={{ aspectRatio: `${aspect}` }}
        >
          {/* Stage */}
          <div
            className="absolute flex items-center justify-center rounded-md bg-terracotta/15 text-[10px] font-semibold uppercase tracking-wider text-terracotta"
            style={{
              left: `${plan.stage.x - plan.stage.w / 2}%`,
              top: `${plan.stage.y - plan.stage.h / 2}%`,
              width: `${plan.stage.w}%`,
              height: `${plan.stage.h}%`,
            }}
          >
            Stage
          </div>
          {plan.dance ? (
            <div
              className="absolute flex items-center justify-center rounded-md border border-dashed border-ink/25 text-[10px] uppercase tracking-wider text-ink/45"
              style={{
                left: `${plan.dance.x - plan.dance.w / 2}%`,
                top: `${plan.dance.y - plan.dance.h / 2}%`,
                width: `${plan.dance.w}%`,
                height: `${plan.dance.h}%`,
              }}
            >
              Dance floor
            </div>
          ) : null}
          {plan.entrance ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink px-1.5 py-0.5 text-[9px] font-medium text-cream"
              style={{ left: `${plan.entrance.x}%`, top: `${plan.entrance.y}%` }}
            >
              Entrance
            </span>
          ) : null}
          {plan.service_entrance ? (
            <span
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-emerald-700 px-1.5 py-0.5 text-[9px] font-medium text-cream"
              style={{
                left: `${plan.service_entrance.x}%`,
                top: `${plan.service_entrance.y}%`,
              }}
            >
              Service
            </span>
          ) : null}
          {cocktail ? (
            <div
              className="absolute flex items-start justify-start rounded-lg border border-dashed border-terracotta/40 bg-terracotta/[0.04] p-1.5 text-[10px] font-semibold uppercase tracking-wider text-terracotta/80"
              style={{
                left: `${cocktail.x - cocktail.w / 2}%`,
                top: `${cocktail.y - cocktail.h / 2}%`,
                width: `${cocktail.w}%`,
                height: `${cocktail.h}%`,
              }}
            >
              {cocktail.label}
            </div>
          ) : null}
          {objects.map((o) => (
            <PinMarker key={o.object_id} o={o} />
          ))}
          {placed.map((t) => (
            <div
              key={t.table_id}
              className={`absolute flex h-[9%] min-h-9 w-[9%] min-w-9 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center border border-ink/25 bg-white text-center shadow-sm ${
                isRound(t.table_type) ? 'rounded-full' : 'rounded-md'
              }`}
              style={{
                left: `${t.x}%`,
                top: `${t.y}%`,
                transform: `translate(-50%, -50%) rotate(${t.rotation_deg}deg)`,
              }}
              title={`${t.label} · ${t.seated}/${t.capacity} seated`}
            >
              <span className="px-0.5 text-[9px] font-semibold leading-tight text-ink/80">
                {t.label}
              </span>
              <span className="text-[9px] tabular-nums text-ink/50">
                {t.seated}/{t.capacity}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {cocktailWindow ? (
        <p className="text-sm text-ink/55">
          <span className="font-medium text-ink/75">{cocktail?.label}</span> · live during{' '}
          {cocktailWindow}
        </p>
      ) : null}

      {/* Table sheet */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-6">
        <h2 className="text-lg font-semibold">
          {plan.dietary_included ? 'Covers per table' : 'Tables'}
        </h2>
        <ul className="mt-3 divide-y divide-ink/10">
          {[...placed, ...unplaced].map((t) => (
            <li key={t.table_id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <div>
                <p className="text-sm font-medium">{t.label}</p>
                <p className="text-xs text-ink/55">
                  {t.seated} of {t.capacity} seated
                  {t.x === null ? ' · not placed on the map yet' : ''}
                </p>
              </div>
              {plan.dietary_included && t.meal_counts ? (
                <p className="flex flex-wrap gap-1">
                  {Object.entries(t.meal_counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([pref, n]) => (
                      <span
                        key={pref}
                        className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-medium text-ink/65"
                      >
                        {MEAL_LABELS[pref] ?? pref} · {n}
                      </span>
                    ))}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
