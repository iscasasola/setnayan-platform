import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowRight, Store } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getConfirmedVendorCount } from '@/lib/events';
import { titleCase } from '@/lib/personalized-menu';
import { DetailsForm } from './_components/details-form';
import { GovernedFields } from './_components/governed-fields';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Personalization · Setnayan' };

/**
 * Personalization · /dashboard/[eventId]/details
 *
 * The single place every piece of the couple's onboarding lives — documented
 * and, where it's safe to, editable. CLAUDE.md 2026-06-02 directive 2:
 * "all the information from the onboarding to be documented and editable on
 * the 'Personalization' Page ... this is where all the data will be preserved."
 *
 * Three bands:
 *   1. The basics — names · region · style/feel · budget. GOVERNANCE-FREE
 *      (bind no vendor) → edited inline via DetailsForm + updateEventMatchCriteria.
 *   2. Your wedding — wedding type · venue setting · guest count · date.
 *      GOVERNED (a booked vendor can lock these) → edited inline via
 *      <GovernedFields>, which runs the conflict preview first and warns which
 *      picked services would clash before the change commits (directive 4).
 *      All four lock to support once a vendor is confirmed.
 *   3. From your onboarding — budget band · monogram · music. Documented
 *      read-only (region + style/feel are in band 1; guest count + venue are
 *      band 2's governed editors).
 *
 * Route kept as /details (relabel-not-rename, per the Vendors→Services
 * precedent) so the Home "Personalize" link + the More-tab activeMatch stay
 * valid. Guard mirrors /for-you (getUser → redirect; maybeSingle → notFound).
 */
export default async function PersonalizationPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event, error: eventError } = await supabase
    .from('events')
    .select(
      'event_id, display_name, event_type, bride_name, groom_name, region, mood_feel_key, ' +
        'estimated_budget_centavos, budget_band, ceremony_type, secondary_ceremony_type, ' +
        'ceremony_type_locked_at, event_date, event_date_precision, date_mode, date_candidates, ' +
        'date_window_start, date_window_end, estimated_pax, venue_setting, ' +
        'monogram_text, monogram_frame_key, monogram_font_key, music_playlist_seed',
    )
    .eq('event_id', eventId)
    .maybeSingle();
  if (eventError) throw new Error(eventError.message);
  if (!event) notFound();

  const e = event as unknown as Record<string, unknown>;
  const base = `/dashboard/${eventId}`;
  const str = (k: string): string | null => {
    const v = e[k];
    return typeof v === 'string' && v.trim() !== '' ? v : null;
  };
  const num = (k: string): number | null => {
    const v = e[k];
    return typeof v === 'number' ? v : null;
  };

  const confirmedVendorCount = await getConfirmedVendorCount(supabase, eventId);

  const budgetCentavos = num('estimated_budget_centavos');
  const initialBudgetPesos =
    budgetCentavos != null && budgetCentavos > 0 ? String(Math.round(budgetCentavos / 100)) : '';

  // bride_name/groom_name are combined "First Last" strings (onboarding PR #796
  // stores [first, last].join(' ')); split them back for the First+Last inputs.
  // splitName is lossless round-trip (first token = first name, rest = last) and
  // handles pre-#796 events that stored a first-name-only value.
  const brideName = splitName(str('bride_name'));
  const groomName = splitName(str('groom_name'));

  // --- Documented values (band 3) -------------------------------------------
  const ceremonyType = str('ceremony_type');
  const secondaryCeremony = str('secondary_ceremony_type');
  const venueSetting = str('venue_setting');
  const pax = num('estimated_pax');
  const moodFeel = str('mood_feel_key');
  const budgetBand = str('budget_band');
  const monogramText = str('monogram_text');
  const monogramFrame = str('monogram_frame_key');
  const monogramFont = str('monogram_font_key');
  const playlist = Array.isArray(e.music_playlist_seed)
    ? (e.music_playlist_seed as unknown[]).filter((s) => typeof s === 'string')
    : [];

  const dateDoc = formatWeddingDate(e);
  // The date <input type="date"> prefills only from a committed day-precision
  // date; month/year-precision + window/candidate modes leave it blank so the
  // host picks deliberately (the governed editor stamps full precision).
  const eventDateRaw = str('event_date');
  const datePrecision = str('event_date_precision') ?? 'day';
  const dateValue = eventDateRaw && datePrecision === 'day' ? eventDateRaw : null;

  const monogramDoc =
    monogramText || monogramFrame || monogramFont
      ? [monogramText, monogramFrame ? `${titleCase(monogramFrame)} frame` : null, monogramFont ? titleCase(monogramFont) : null]
          .filter(Boolean)
          .join(' · ')
      : null;

  return (
    <section className="space-y-5">
      <header className="space-y-1.5">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.22em]"
          style={{ color: 'var(--m-orange-2)' }}
        >
          Your wedding
        </p>
        <h1
          className="m-display-tight text-2xl uppercase sm:text-3xl"
          style={{ letterSpacing: '-0.005em', color: 'var(--m-ink)' }}
        >
          Personalization
        </h1>
        <p className="text-sm text-ink/60">
          Everything from your onboarding lives here. Refine it anytime — it tunes the services we
          match and sort for you.
        </p>
      </header>

      {/* Band 1 — the basics (governance-free, editable inline) */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5">
        <h2 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">The basics</h2>
        <p className="mb-3 mt-0.5 text-sm text-ink/55">
          Your names, where you’re celebrating, the feel you’re after, and your working budget.
        </p>
        <DetailsForm
          eventId={eventId}
          initialBrideFirst={brideName.first}
          initialBrideLast={brideName.last}
          initialGroomFirst={groomName.first}
          initialGroomLast={groomName.last}
          initialRegion={str('region') ?? ''}
          initialFeel={moodFeel ?? ''}
          initialBudgetPesos={initialBudgetPesos}
        />
      </div>

      {/* Band 2 — your wedding (governed: ceremony · venue · guest count · date).
          Editable inline, but a change runs the conflict preview first and
          warns which picked services would clash before it commits (directive
          4). All four lock to support once a vendor is confirmed. */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5">
        <div className="mb-3">
          <h2 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">
            Your wedding
          </h2>
          <p className="mt-0.5 text-sm text-ink/55">
            These shape vendor availability and your paperwork. Change one and we’ll flag any
            services it would affect before you confirm.
          </p>
        </div>

        <GovernedFields
          eventId={eventId}
          confirmedVendorCount={confirmedVendorCount}
          ceremony={ceremonyType}
          secondaryCeremony={secondaryCeremony}
          venue={venueSetting}
          pax={pax}
          dateDisplay={dateDoc}
          dateValue={dateValue}
        />
      </div>

      {/* Band 3 — from your onboarding (documented, read-only). Guest count +
          venue moved up to band 2's governed editors; region + style/feel live
          in band 1. This keeps only what isn't editable elsewhere. */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-4 sm:p-5">
        <h2 className="m-display-tight text-base uppercase tracking-[0.02em] text-ink">
          From your onboarding
        </h2>
        <p className="mb-3 mt-0.5 text-sm text-ink/55">
          The rest of what you told us, on the record.
        </p>
        <dl className="divide-y divide-ink/5">
          <DocRow label="Budget band" value={budgetBand ? titleCase(budgetBand) : null} />
          <DocRow label="Monogram" value={monogramDoc} />
          <DocRow
            label="Music"
            value={playlist.length > 0 ? `${playlist.length} song${playlist.length === 1 ? '' : 's'} picked` : null}
          />
        </dl>
      </div>

      {/* The picks become real shortlisted services with their own tab. */}
      <Link
        href={`${base}/vendors`}
        className="flex items-center justify-between gap-3 rounded-2xl border border-ink/10 bg-paper px-4 py-3 transition-colors hover:bg-cream"
      >
        <span className="flex items-center gap-2.5">
          <Store aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          <span className="text-sm text-ink/80">The services you picked</span>
        </span>
        <ArrowRight aria-hidden className="h-4 w-4 text-ink/40" strokeWidth={1.75} />
      </Link>
    </section>
  );
}

// ---------------------------------------------------------------------------

/**
 * Splits a stored combined name into first + last for the edit form. First
 * token is the first name, the rest is the last name — lossless round-trip
 * with onboarding's [first, last].join(' '), and safe for pre-#796 events that
 * stored a first-name-only value (→ { first, last: '' }).
 */
function splitName(full: string | null): { first: string; last: string } {
  const t = (full ?? '').trim();
  if (!t) return { first: '', last: '' };
  const parts = t.split(/\s+/);
  return { first: parts[0] ?? '', last: parts.slice(1).join(' ') };
}

function DocRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-ink/60">{label}</dt>
      <dd className="text-right text-sm font-medium text-ink/85">
        {value ?? <span className="font-normal text-ink/40">Not set</span>}
      </dd>
    </div>
  );
}

/**
 * Documents the couple's date the way onboarding captured it: a committed date
 * (formatted to its precision), a flexible window, a candidate-date set, or
 * not-set-yet. The governed editor at /date-selection is where it changes.
 */
function formatWeddingDate(e: Record<string, unknown>): string | null {
  const eventDate = typeof e.event_date === 'string' ? e.event_date : null;
  const precision = typeof e.event_date_precision === 'string' ? e.event_date_precision : 'day';
  if (eventDate) {
    const d = new Date(`${eventDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    if (precision === 'year') return String(d.getFullYear());
    if (precision === 'month')
      return d.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' });
    return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  const mode = typeof e.date_mode === 'string' ? e.date_mode : null;
  if (mode === 'window') {
    const start = typeof e.date_window_start === 'string' ? e.date_window_start : null;
    const end = typeof e.date_window_end === 'string' ? e.date_window_end : null;
    if (start && end) return `Flexible · ${fmtShort(start)}–${fmtShort(end)}`;
  }
  if (mode === 'specific' && Array.isArray(e.date_candidates)) {
    const n = (e.date_candidates as unknown[]).filter((c) => typeof c === 'string').length;
    if (n > 0) return `${n} candidate date${n === 1 ? '' : 's'}`;
  }
  return null;
}

function fmtShort(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
}
