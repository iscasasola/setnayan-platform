/**
 * Phase 0 Date Selection — entry route.
 *
 * Per CLAUDE.md 2026-05-22 owner directive — the emotional entry point to
 * wedding planning. Three paths:
 *
 *   1. "I have a date in mind"        → DatePicker component (?path=direct)
 *   2. "Help me pick a meaningful one" → FourQuestionFlow component (?path=guided)
 *   3. "I'm not ready yet"            → markDateUndecided action,
 *                                       redirects back to event home
 *
 * Smart candidate path (no ?path param, event_date IS NULL, date_candidates
 * has entries from onboarding): shows the top 3 candidate dates compared
 * on differentiating signals — shortlist vendor availability, budget,
 * meaningful/auspicious resonance, long-weekend guest-travel, marketplace
 * services coverage, and prep-time status. The client component adds a
 * synthesized "Our pick" recommendation, per-dimension winner pills, and a
 * "pin a must-have vendor" re-rank. Falls back to the 3-path chooser when no
 * candidates exist.
 *
 * Per orphan-prevention rule [[feedback_setnayan_orphan_prevention]]:
 * entry points are (a) auspicious chip on /dashboard/[eventId] event home
 * (added in this PR — links here when date_status='locked'), and (b) the
 * "Pick your date →" prompt on event home (added in this PR — links here
 * when date_status != 'locked'). No new orphan routes.
 */

import { notFound, redirect } from 'next/navigation';
import { ArrowLeft, Calendar, Heart, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCurrentUser } from '@/lib/auth';
import {
  computeAuspiciousReasonsDetailed,
  type CeremonyType,
  type MeaningfulDate,
  type MeaningfulDateKind,
} from '@/lib/auspicious-date';
import { fetchEventVendors } from '@/lib/vendors';
import { getBatchVendorAvailableDays } from '@/lib/vendor-availability';
import { displayServiceLabel } from '@/lib/vendors';
import { DatePicker } from './_components/date-picker';
import { FourQuestionFlow } from './_components/four-question-flow';
import { CandidateDatePicker, type CandidateInsight } from './_components/candidate-date-picker';
import { markDateUndecided } from './actions';

export const metadata = { title: 'Pick your date · Setnayan' };

const CEREMONY_TYPES: CeremonyType[] = [
  'catholic',
  'civil',
  'inc',
  'christian',
  'muslim',
  'cultural',
  'mixed',
];

function isCeremonyType(value: unknown): value is CeremonyType {
  return typeof value === 'string' && (CEREMONY_TYPES as readonly string[]).includes(value);
}

type Props = {
  params: Promise<{ eventId: string }>;
  searchParams?: Promise<{ path?: string }>;
};

// ─── Season + month framing (pure, no DB) ─────────────────────────────────────

const SEASON_NOTES: Record<number, string> = {
  12: 'Cool dry season · perfect for outdoor receptions',
  1: 'Cool dry season · perfect for outdoor receptions',
  2: 'Cool dry season · Valentine energy in the air',
  3: 'Hot dry season · sunset ceremonies look stunning',
  4: 'Hot dry season · beach and garden venues shine',
  5: 'Transition season · indoor venues recommended',
  6: 'Wet season · lush greenery · covered venues advised',
  7: 'Wet season · lush backdrops · covered venues advised',
  8: 'Wet season · dramatic skies · covered venues advised',
  9: 'Wet season · temperatures cooling down',
  10: 'Transition season · weather clearing',
  11: 'Cool season starting · peak season approaching',
};

const PEAK_MONTHS = new Set([12, 2, 11, 1]);
const SHOULDER_MONTHS = new Set([10, 3]);

function monthNote(m: number): string {
  if (PEAK_MONTHS.has(m)) return 'Peak season · book vendors early';
  if (SHOULDER_MONTHS.has(m)) return 'Shoulder season · good availability and weather';
  return 'Off-peak month · more vendor availability';
}

// ─── PH holiday / long-weekend detection ──────────────────────────────────────
// Fixed-date PH regular + special holidays. Movable holidays (Easter, Eid,
// National Heroes Day) are intentionally excluded — they can't be computed from
// month/day alone, and an honest "near a holiday" claim is better than a wrong
// one. Keyed "MM-DD".

const PH_HOLIDAYS: Record<string, string> = {
  '01-01': "New Year's Day",
  '04-09': 'Araw ng Kagitingan',
  '05-01': 'Labor Day',
  '06-12': 'Independence Day',
  '08-21': 'Ninoy Aquino Day',
  '11-01': "All Saints' Day",
  '11-02': "All Souls' Day",
  '11-30': 'Bonifacio Day',
  '12-08': 'Immaculate Conception',
  '12-25': 'Christmas Day',
  '12-30': 'Rizal Day',
  '12-31': "New Year's Eve",
};

function mmdd(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Guest-travel signal. Returns a note when the candidate date IS a holiday, or
 * sits adjacent to one such that a long weekend forms (Sat/Sun next to a
 * Fri/Mon holiday, or a holiday within 1 day either side). Null when nothing
 * notable — the card then omits the row.
 */
function holidayNote(dateKey: string): string | null {
  const [y = 2027, m = 1, d = 1] = dateKey.split('-').map(Number);
  const base = new Date(y, m - 1, d);

  // Exact-day holiday.
  const exact = PH_HOLIDAYS[mmdd(base)];
  if (exact) {
    return `Falls on ${exact} — guests are already off work and gathered`;
  }

  // Adjacent (±1, ±2) holiday that forms a long weekend.
  for (let delta = -2; delta <= 2; delta++) {
    if (delta === 0) continue;
    const probe = new Date(y, m - 1, d + delta);
    const name = PH_HOLIDAYS[mmdd(probe)];
    if (!name) continue;
    // Only call it a long weekend when the gap touches an actual weekend:
    // candidate is Sat/Sun, OR the holiday is Sat/Sun, OR they bridge one.
    const candDow = base.getDay();
    const holDow = probe.getDay();
    const touchesWeekend =
      candDow === 0 || candDow === 6 || holDow === 0 || holDow === 6 || Math.abs(delta) <= 2;
    if (touchesWeekend) {
      return `${name} is ${Math.abs(delta)} day${Math.abs(delta) === 1 ? '' : 's'} away — a long weekend gives guests time to travel`;
    }
  }
  return null;
}

function labelFor(dateKey: string) {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return {
    label: dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    dow: dt.toLocaleDateString('en-US', { weekday: 'long' }),
    fullLabel: dt.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }),
  };
}

function prepStatus(dateKey: string): CandidateInsight['prep'] {
  const now = new Date();
  const [dy = 2027, dm = 1, dd = 1] = dateKey.split('-').map(Number);
  const rawMonths =
    (dy - now.getFullYear()) * 12 + (dm - (now.getMonth() + 1)) + (dd >= now.getDate() ? 0 : -1);
  const months = Math.max(0, rawMonths);

  let status: CandidateInsight['prep']['status'];
  let label: string;
  if (months >= 18) {
    status = 'very_generous';
    label = `Plenty of time · ${months} months to plan`;
  } else if (months >= 12) {
    status = 'generous';
    label = `Great timeline · ${months} months to plan`;
  } else if (months >= 6) {
    status = 'comfortable';
    label = `Good timeline · ${months} months to plan`;
  } else if (months >= 3) {
    status = 'tight';
    label = 'Tight timeline · book key vendors now';
  } else {
    status = 'very_tight';
    label =
      months > 0
        ? `Short notice · ${months} month${months === 1 ? '' : 's'} — act fast`
        : 'This month · act immediately';
  }
  return { monthsFromNow: months, status, label };
}

// ─── Auspicious / meaningful reasons via the shared engine ─────────────────────

function reasonsFor(
  dateKey: string,
  ceremonyType: CeremonyType | null,
  meaningfulDates: MeaningfulDate[],
): { meaningful: string[]; why: string[] } {
  const [y = 1970, m = 1, d = 1] = dateKey.split('-').map(Number);
  const groups = computeAuspiciousReasonsDetailed(new Date(y, m - 1, d), ceremonyType, meaningfulDates);

  const meaningful: string[] = [];
  const why: string[] = [];
  // Surface order preference for "why this date" — cultural first (most
  // relatable), then numerology, then astrology, then ceremony notes.
  const whyOrder = ['cultural', 'numerology', 'astrology', 'ceremony', 'special_pattern'];
  for (const g of groups) {
    if (g.category === 'personal') {
      meaningful.push(...g.reasons);
    }
  }
  for (const cat of whyOrder) {
    const g = groups.find((x) => x.category === cat);
    if (g) why.push(...g.reasons);
  }
  return { meaningful: meaningful.slice(0, 3), why: why.slice(0, 2) };
}

// ─── Budget range from shortlist ─────────────────────────────────────────────

type ShortVendor = { category: string | null; total_cost_php: number | null };

function shortlistBudgetRange(vendors: ShortVendor[]): { lo: number; hi: number } {
  const byCategory = new Map<string, number[]>();
  for (const v of vendors) {
    const cost = Number(v.total_cost_php ?? 0);
    if (cost <= 0) continue;
    const cat = v.category ?? 'other';
    const arr = byCategory.get(cat);
    if (arr) arr.push(cost);
    else byCategory.set(cat, [cost]);
  }
  let lo = 0;
  let hi = 0;
  for (const costs of byCategory.values()) {
    lo += Math.min(...costs) * 100; // PHP → centavos
    hi += Math.max(...costs) * 100;
  }
  return { lo, hi };
}

// ─── Marketplace coverage per candidate date ──────────────────────────────────

type VpRow = { id: string; services: string[] | null };
type BlockRow = { vendor_profile_id: string; blocked_at: string; blocked_until: string };

function marketplaceCoverage(
  vpRows: VpRow[],
  blockRows: BlockRow[],
  dateKey: string,
): { available: number; total: number } {
  const blockedOnDate = new Set(
    blockRows
      .filter((b) => b.blocked_at.slice(0, 10) <= dateKey && b.blocked_until.slice(0, 10) >= dateKey)
      .map((b) => b.vendor_profile_id),
  );
  const allCategories = new Set<string>();
  const availableCategories = new Set<string>();
  for (const vp of vpRows) {
    for (const svc of vp.services ?? []) {
      allCategories.add(svc);
      if (!blockedOnDate.has(vp.id)) availableCategories.add(svc);
    }
  }
  return { available: availableCategories.size, total: allCategories.size };
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default async function DateSelectionPage({ params, searchParams }: Props) {
  const { eventId } = await params;
  const search = searchParams ? await searchParams : {};
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=/dashboard/${eventId}/date-selection`);

  const supabase = await createClient();

  // Defense-in-depth: the parent EventLayout already gates couple membership,
  // but this route can be deep-linked so confirm again.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    notFound();
  }

  // Pull event + meaningful dates in one round trip.
  const [eventRes, meaningfulRes] = await Promise.all([
    supabase
      .from('events')
      .select(
        'event_id, display_name, event_date, ceremony_type, date_status, event_date_precision, date_candidates, estimated_budget_centavos',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('event_meaningful_dates')
      .select('meaningful_date, kind, note')
      .eq('event_id', eventId)
      .order('meaningful_date', { ascending: true }),
  ]);

  const event = eventRes.data;
  if (!event) notFound();

  const ceremonyType = isCeremonyType(event.ceremony_type)
    ? (event.ceremony_type as CeremonyType)
    : null;

  const meaningfulDates: MeaningfulDate[] = (meaningfulRes.data ?? []).map((r) => ({
    date: r.meaningful_date as string,
    kind: r.kind as MeaningfulDateKind,
    note: (r.note as string | null) ?? null,
  }));

  const path = typeof search.path === 'string' ? search.path : null;
  const backToHomeHref = `/dashboard/${eventId}`;
  const backToChooserHref = `/dashboard/${eventId}/date-selection`;

  // Path: direct calendar pick
  if (path === 'direct') {
    return (
      <section className="mx-auto max-w-2xl">
        <DatePicker
          eventId={eventId}
          ceremonyType={ceremonyType}
          meaningfulDates={meaningfulDates}
          initialDate={event.event_date ?? null}
          backLabel="Pick another path"
          backHref={backToChooserHref}
        />
      </section>
    );
  }

  // Path: 4-question guided flow
  if (path === 'guided') {
    return (
      <section className="mx-auto max-w-2xl">
        <FourQuestionFlow
          eventId={eventId}
          initialCeremonyType={ceremonyType}
          initialMeaningfulDates={meaningfulDates}
          backHref={backToChooserHref}
        />
      </section>
    );
  }

  // Smart candidate path: no explicit path, no event_date yet, candidates exist from onboarding.
  const rawCandidates = Array.isArray((event as { date_candidates?: unknown }).date_candidates)
    ? ((event as { date_candidates: unknown[] }).date_candidates as string[]).filter(
        (s): s is string => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s),
      )
    : [];

  const hasCandidates = rawCandidates.length > 0;
  const hasDate = Boolean(event.event_date);

  if (!path && hasCandidates && !hasDate) {
    const admin = createAdminClient();
    const topCandidates = rawCandidates.slice(0, 3);
    const sorted = [...topCandidates].sort();

    const [vendors, vpRes, blockRes] = await Promise.all([
      fetchEventVendors(supabase, eventId),
      admin
        .from('vendor_profiles')
        .select('id, services')
        .eq('public_visibility', 'verified')
        .or('is_demo.is.null,is_demo.eq.false')
        .or('is_setnayan_service.is.null,is_setnayan_service.eq.false')
        .not('services', 'is', null),
      admin
        .from('vendor_calendar_blocks')
        .select('vendor_profile_id, blocked_at, blocked_until')
        .lte('blocked_at', `${sorted[sorted.length - 1] ?? sorted[0]}T23:30:00+08:00`)
        .gte('blocked_until', `${sorted[0]}T00:00:00+08:00`),
    ]);

    const vpRows: VpRow[] = (vpRes.data ?? []) as VpRow[];
    const blockRows: BlockRow[] = (blockRes.data ?? []) as BlockRow[];

    // Availability of shortlisted marketplace vendors across the candidate span.
    const marketplacePicks = vendors.filter((v) => v.marketplace_vendor_id);
    const profileIds = [...new Set(marketplacePicks.map((v) => v.marketplace_vendor_id as string))];
    let availByProfile = new Map<string, Set<string>>();
    if (profileIds.length > 0) {
      const [ys = 2027, ms = 1, ds = 1] = (sorted[0] ?? '2027-01-01').split('-').map(Number);
      const [ye = 2027, me = 1, de = 1] = ((sorted[sorted.length - 1] ?? sorted[0]) ?? '2027-01-01')
        .split('-')
        .map(Number);
      availByProfile = await getBatchVendorAvailableDays(
        admin,
        profileIds,
        new Date(ys, ms - 1, ds),
        new Date(ye, me - 1, de),
      );
    }

    // Budget range from shortlist (date-independent shared context).
    const { lo: shortlistLo, hi: shortlistHi } = shortlistBudgetRange(
      vendors.map((v) => ({ category: v.category, total_cost_php: v.total_cost_php })),
    );
    const eventBudgetCentavos =
      typeof (event as { estimated_budget_centavos?: unknown }).estimated_budget_centavos ===
      'number'
        ? ((event as { estimated_budget_centavos: number }).estimated_budget_centavos as number)
        : null;

    const insights: CandidateInsight[] = topCandidates.map((dateKey) => {
      // Per-vendor states (drives both the count + the client-side pin re-rank).
      const vendorStates: CandidateInsight['vendors'] = vendors.map((v) => {
        let state: 'open' | 'booked' | 'unknown';
        if (!v.marketplace_vendor_id) {
          state = 'unknown';
        } else {
          const avail = availByProfile.get(v.marketplace_vendor_id);
          state = avail ? (avail.has(dateKey) ? 'open' : 'booked') : 'open';
        }
        return {
          key: v.vendor_id,
          name: v.vendor_name,
          category: v.category,
          categoryLabel: v.category ? displayServiceLabel(v.category) : 'Vendor',
          state,
        };
      });
      const available = vendorStates.filter((v) => v.state === 'open').length;
      const confirmNeeded = vendorStates.filter((v) => v.state === 'unknown').length;
      const booked = vendorStates.filter((v) => v.state === 'booked').length;

      const mkt = marketplaceCoverage(vpRows, blockRows, dateKey);
      const { meaningful, why } = reasonsFor(dateKey, ceremonyType, meaningfulDates);
      const [, m = 1] = dateKey.split('-').map(Number);
      const { label, dow, fullLabel } = labelFor(dateKey);

      return {
        dateKey,
        label,
        dow,
        fullLabel,
        shortlist: { total: vendors.length, available, confirmNeeded, booked },
        vendors: vendorStates,
        budget: {
          eventBudgetCentavos,
          shortlistLoCentavos: shortlistLo,
          shortlistHiCentavos: shortlistHi,
        },
        meaningful,
        why,
        seasonNote: SEASON_NOTES[m] ?? 'A lovely time of year',
        monthNote: monthNote(m),
        holiday: holidayNote(dateKey),
        marketplace: { availableCategories: mkt.available, totalCategories: mkt.total },
        prep: prepStatus(dateKey),
      };
    });

    return (
      <section className="mx-auto max-w-5xl space-y-6">
        <a
          href={backToHomeHref}
          className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Back to {(event as { display_name: string }).display_name}
        </a>
        <CandidateDatePicker
          eventId={eventId}
          candidates={insights}
          displayName={(event as { display_name: string }).display_name}
        />
      </section>
    );
  }

  // Default: 3-path chooser (no candidates, or explicit path that isn't direct/guided).
  return (
    <section className="mx-auto max-w-2xl space-y-8">
      <a
        href={backToHomeHref}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Back to {(event as { display_name: string }).display_name}
      </a>

      <header className="space-y-2 text-center sm:text-left">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
          Setnayan · Phase 0
        </p>
        <h1 className="font-display text-3xl italic leading-tight text-ink sm:text-4xl">
          Congratulations. Let&apos;s start with your date.
        </h1>
        <p className="text-base text-ink/70">
          Every great wedding has one moment that everything else circles around. We&apos;ll help
          you find yours — and show you what makes the day you pick special.
        </p>
      </header>

      <div className="grid gap-3">
        <PathCard
          href={`${backToChooserHref}?path=direct`}
          icon={Calendar}
          title="I have a date in mind"
          description="Pick from the calendar and see what makes your date beautiful."
          accent="terracotta"
        />
        <PathCard
          href={`${backToChooserHref}?path=guided`}
          icon={Heart}
          title="Help me pick a meaningful one"
          description="Four soft questions about what matters to you, then five date suggestions that resonate."
          accent="terracotta"
        />
        <NotReadyForm eventId={eventId} />
      </div>

      <p className="text-center text-xs text-ink/50 sm:text-left">
        You can come back to this any time from your event home.
      </p>
    </section>
  );
}

function PathCard({
  href,
  icon: Icon,
  title,
  description,
  accent,
}: {
  href: string;
  icon: typeof Calendar;
  title: string;
  description: string;
  accent: 'terracotta' | 'muted';
}) {
  const accentClasses =
    accent === 'terracotta'
      ? 'border-ink/10 bg-cream hover:border-terracotta/45 hover:bg-terracotta/[0.04]'
      : 'border-ink/10 bg-cream hover:border-ink/25 hover:bg-ink/[0.02]';
  const iconClasses = accent === 'terracotta' ? 'text-terracotta' : 'text-ink/55';
  return (
    <a
      href={href}
      className={`flex items-start gap-4 rounded-2xl border p-5 transition-colors sm:p-6 ${accentClasses}`}
    >
      <span
        className={`mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream ring-1 ring-ink/10 ${iconClasses}`}
      >
        <Icon aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <span className="space-y-1">
        <span className="block font-display text-xl italic text-ink">{title}</span>
        <span className="block text-sm text-ink/65">{description}</span>
      </span>
    </a>
  );
}

function NotReadyForm({ eventId }: { eventId: string }) {
  return (
    <form action={markDateUndecided}>
      <input type="hidden" name="event_id" value={eventId} />
      <button
        type="submit"
        className="flex w-full items-start gap-4 rounded-2xl border border-ink/10 bg-cream p-5 text-left transition-colors hover:border-ink/25 hover:bg-ink/[0.02] sm:p-6"
      >
        <span className="mt-0.5 inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-cream text-ink/55 ring-1 ring-ink/10">
          <Clock aria-hidden className="h-5 w-5" strokeWidth={1.75} />
        </span>
        <span className="space-y-1">
          <span className="block font-display text-xl italic text-ink">
            I&apos;m not ready yet
          </span>
          <span className="block text-sm text-ink/65">
            That&apos;s okay. Start exploring the rest of your event and come back when you are.
          </span>
        </span>
      </button>
    </form>
  );
}
