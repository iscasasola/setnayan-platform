/**
 * Insights Studio surface — the body of the former /admin/funnels page,
 * re-homed here (2026-07-10) so the App Performance menu is ONE tabbed studio.
 * Its actions/_components stay under /admin/funnels; the legacy route is now a
 * redirect into /admin/app-performance?tab={tab}.
 *
 * ── Converted to <ConsoleTable> 2026-08-17 · ELEVEN READS, TWO CHECKED ─────
 * A funnel is a picture made entirely of counts, and `count ?? 0` turns every
 * refused count into a real-looking step. Six of the reads did at least push
 * their message into a banner; the four order-pipeline reads were not checked
 * at all, so the whole "Order pipeline" funnel could render 0 → 0 → 0 → 0 with
 * nothing anywhere on the page saying a query had been rejected. Zero orders
 * submitted is a sentence about the business. It should never be produced by
 * an error nobody bound.
 *
 * A funnel now carries its OWN outcome: `steps` is null when any read behind
 * it was refused, and the error travels with it, so the funnel that failed is
 * the funnel that says so — and the ones beside it still show their real
 * numbers instead of being hidden behind one page-level banner.
 *
 * The capped read on this surface — the drill-down's vendor list — moved to
 * `_components/funnel-vendor-picker.tsx`, where its cap, its query and the
 * sentence disclosing it sit together. It was also the surface's one wholly
 * unchecked read.
 */
import { ExternalLink, LineChart, Filter, BarChart3 } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';
import { FormFlash } from '@/app/_components/forms/form-flash';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { PageMasthead } from '@/app/_components/page-masthead';
import {
  fetchVendorFunnelTotalsResult,
  buildFunnelSteps,
} from '@/lib/vendor-funnel';

import {
  VendorPicker,
  fetchVendorPickerOptions,
} from '../_components/funnel-vendor-picker';
import { requireAdmin } from '@/lib/admin/require-admin';

type RangeKey = 'week' | 'month' | 'quarter';

const RANGE_OPTIONS: { value: RangeKey; label: string; days: number }[] = [
  { value: 'week', label: 'This week', days: 7 },
  { value: 'month', label: 'Past 4 weeks', days: 28 },
  { value: 'quarter', label: 'Past 12 weeks', days: 84 },
];

type Step = {
  label: string;
  count: number;
};

type Funnel = {
  key: string;
  title: string;
  blurb: string;
  /** NULL when a read behind this funnel was refused — never a list of zeroes. */
  steps: Step[] | null;
  /** The first refusal behind this funnel, if there was one. */
  error: { message: string } | null;
};

type Props = {
  searchParams: Promise<{ range?: string; vendor?: string }>;
};

/** A Supabase count read, reduced to the only two outcomes a step can have. */
type CountRes = { count: number | null; error: { message: string } | null };

/**
 * Fold several count reads into one funnel. If ANY of them was refused the
 * funnel is not measured: a step showing 0 next to a step showing 40 is read
 * as a collapse in conversion, which is the single most expensive wrong
 * conclusion this screen can produce.
 */
function funnelFrom(
  base: Omit<Funnel, 'steps' | 'error'>,
  parts: { label: string; res: CountRes }[],
): Funnel {
  const failed = parts.find((p) => p.res.error)?.res.error ?? null;
  const unmeasured = parts.some((p) => p.res.count === null);
  if (failed || unmeasured) {
    return {
      ...base,
      steps: null,
      error: failed ?? { message: 'A step in this funnel returned no count.' },
    };
  }
  return {
    ...base,
    steps: parts.map((p) => ({ label: p.label, count: p.res.count as number })),
    error: null,
  };
}

// PostHog dashboard URL — surfaces the 4 funnels we keep on PostHog rather
// than recomputing from Supabase. The slug is derived from the configured
// project + host; when neither is set we fall back to the marketing host.
function buildPostHogDashboardUrl(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!host) return 'https://us.posthog.com';
  return `${host.replace(/\/+$/, '')}/insights`;
}

export async function FunnelsSurface({ searchParams }: Props) {
  await requireAdmin();
  const search = await searchParams;
  const range: RangeKey =
    search.range === 'month' || search.range === 'quarter' || search.range === 'week'
      ? (search.range as RangeKey)
      : 'month';
  const days = (RANGE_OPTIONS.find((r) => r.value === range)?.days ?? 28);

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);
  const sinceIso = since.toISOString();

  const admin = createAdminClient();

  // Three Supabase-side funnels.
  // ----------------------------------------------------------------------
  // Each "count" uses `head:true + count:'exact'` so the server returns just
  // the integer — cheap, indexed-only queries that won't break the page if
  // the underlying table is hot.

  // Funnel 1 — couple onboarding: signed up → created an event → paid an order.
  const [
    signupsRes,
    eventsRes,
    paidOrdersRes,
    vendorSignupsRes,
    vendorProfileCompleteRes,
    vendorFirstBookingRes,
  ] = await Promise.all([
    admin
      .from('users')
      .select('user_id', { count: 'exact', head: true })
      .eq('account_type', 'customer')
      .gte('created_at', sinceIso),
    admin
      .from('events')
      .select('event_id', { count: 'exact', head: true })
      .gte('created_at', sinceIso),
    admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'paid')
      .gte('created_at', sinceIso),
    // Funnel 2 — vendor onboarding.
    admin
      .from('users')
      .select('user_id', { count: 'exact', head: true })
      .eq('account_type', 'vendor')
      .gte('created_at', sinceIso),
    admin
      .from('vendor_profiles')
      .select('vendor_profile_id', { count: 'exact', head: true })
      .neq('business_name', '')
      .gte('created_at', sinceIso),
    // First chat thread = "first booking received" proxy. We're after the
    // count of distinct vendor_profile_ids that received at least one thread
    // in the window — close enough for V1.
    admin
      .from('chat_threads')
      .select('vendor_profile_id')
      .gte('created_at', sinceIso),
  ]);

  // The distinct-vendor count is a LIST read, not a count read — so it is
  // "measured" only when its data actually arrived.
  const bookingRows = vendorFirstBookingRes.data as
    | { vendor_profile_id: string }[]
    | null;
  const distinctVendorBookings: CountRes = {
    count: bookingRows ? new Set(bookingRows.map((r) => r.vendor_profile_id)).size : null,
    error: vendorFirstBookingRes.error,
  };

  const funnels: Funnel[] = [
    funnelFrom(
      {
        key: 'customer',
        title: 'Couple onboarding',
        blurb: 'Signup → first event created → first paid order.',
      },
      [
        { label: 'Couple signups', res: signupsRes },
        { label: 'Events created', res: eventsRes },
        { label: 'Orders paid', res: paidOrdersRes },
      ],
    ),
    funnelFrom(
      {
        key: 'vendor',
        title: 'Vendor onboarding',
        blurb: 'Signup → profile complete → first booking thread.',
      },
      [
        { label: 'Vendor signups', res: vendorSignupsRes },
        { label: 'Profile filled', res: vendorProfileCompleteRes },
        { label: 'First booking thread', res: distinctVendorBookings },
      ],
    ),
    await orderPipelineFunnel(admin, sinceIso),
  ];

  // The page-level banner still names every failure at once; each funnel below
  // now also reports its own, because a banner does not stop a table of zeroes
  // from being read as a table of zeroes.
  const errors = funnels
    .map((f) => f.error?.message)
    .filter((m): m is string => Boolean(m));

  const postHogUrl = buildPostHogDashboardUrl();

  // ── Per-vendor Quote-to-Booking Funnel drill-down (Wave 6) ────────────────
  // A vendor picker + the views→inquiries→quotes→booked funnel for the selected
  // vendor, computed on the admin client (is_admin RLS read). Views come from
  // the net-new vendor_profile_views table; the other three stages reuse the
  // shipped chat_threads / vendor_proposals / event_vendors data.
  const vendorPicker = await fetchVendorPickerOptions();
  const selectedVendorId =
    typeof search.vendor === 'string' && search.vendor.length > 0
      ? search.vendor
      : null;
  const selectedVendor =
    selectedVendorId != null
      ? vendorPicker.options?.find((v) => v.vendor_profile_id === selectedVendorId) ?? null
      : null;
  const vendorTotals = selectedVendor
    ? await fetchVendorFunnelTotalsResult(
        admin,
        selectedVendor.vendor_profile_id,
        sinceIso,
      )
    : null;
  const vendorFunnel: Funnel | null =
    selectedVendor && vendorTotals
      ? {
          key: `vendor_${selectedVendor.vendor_profile_id}`,
          title: `${selectedVendor.business_name} — Quote-to-Booking`,
          blurb: 'Profile views → inquiries → quotes sent → booked, for this vendor.',
          steps: vendorTotals.totals ? buildFunnelSteps(vendorTotals.totals) : null,
          error: vendorTotals.error,
        }
      : null;

  return (
    <div>
      <PageMasthead
        title="Funnels"
        titleNode={
          <span>
            {/* Gold on an ICON clears the 3:1 non-text bar; gold on a WORD does
                not. The class sits on the glyph, never on a text container. */}
            <LineChart aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
            Funnels
          </span>
        }
        className="mb-6"
      />

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <input type="hidden" name="tab" value="funnels" />
        {/* Preserve the selected vendor drill-down when changing the range. */}
        {typeof search.vendor === 'string' && search.vendor.length > 0 ? (
          <input type="hidden" name="vendor" value={search.vendor} />
        ) : null}
        <label
          htmlFor="range"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/70"
        >
          Range
        </label>
        <select
          id="range"
          name="range"
          defaultValue={range}
          className="input-field h-9 max-w-[14rem] py-0 text-sm"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button type="submit" className="button-secondary h-9 px-3 text-xs">
          Apply
        </button>
        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
          Since {sinceIso.slice(0, 10)}
        </span>
      </form>

      {errors.length > 0 ? (
        <FormFlash tone="error">
          {errors.join(' · ')}
        </FormFlash>
      ) : null}

      <div className="space-y-6">
        {funnels.map((f) => (
          <FunnelTable key={f.key} funnel={f} />
        ))}
      </div>

      {/* ── Per-vendor Quote-to-Booking drill-down (Wave 6) ─────────────── */}
      <section className="mt-8 sn-tile p-5">
        <header className="mb-3 flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-terracotta/10">
            <Filter aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
          </span>
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold text-ink">Vendor drill-down</h2>
            <p className="text-xs text-ink/70">
              Pick a vendor to see their views → inquiries → quotes → booked
              funnel for the selected range.
            </p>
          </div>
        </header>
        <VendorPicker
          result={vendorPicker}
          range={range}
          selectedVendorId={selectedVendorId}
        />
        {vendorFunnel ? (
          <FunnelTable funnel={vendorFunnel} />
        ) : (
          <p className="text-sm text-ink/70">
            No vendor selected. Pick one above to load their funnel.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-xl border border-dashed border-ink/15 bg-white/50 p-5">
        <h2 className="mb-1 text-sm font-semibold text-ink">
          PostHog-side funnels
        </h2>
        <p className="mb-3 text-sm text-ink/65">
          These funnels depend on browser-emitted events we don&apos;t mirror
          to Supabase. Open the PostHog Insights dashboard to see the live
          numbers.
        </p>
        <ul className="mb-3 list-disc space-y-1 pl-5 text-sm text-ink/70">
          <li>Save-the-Date browse → paid render</li>
          <li>Papic browse → paid seat</li>
          <li>Pro Widget upgrade → paid bundle</li>
          <li>Guided Planner adoption → completion</li>
        </ul>
        <a
          href={postHogUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/10"
        >
          Open in PostHog
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </section>
    </div>
  );
}

// Helper: compute the order pipeline funnel. Split out so it doesn't blow
// up the top-level await chain when the date range shifts.
//
// ⚠ ALL FOUR of these reads were previously unchecked — not even collected
// into the page banner — so this funnel was the one most able to print a
// straight line of zeros with nothing anywhere saying why.
async function orderPipelineFunnel(
  admin: ReturnType<typeof createAdminClient>,
  sinceIso: string,
): Promise<Funnel> {
  const [submittedRes, awaitingRes, paidRes, fulfilledRes] = await Promise.all([
    admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .gte('created_at', sinceIso),
    admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'awaiting_payment')
      .gte('created_at', sinceIso),
    admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'paid')
      .gte('created_at', sinceIso),
    admin
      .from('orders')
      .select('order_id', { count: 'exact', head: true })
      .eq('status', 'fulfilled')
      .gte('created_at', sinceIso),
  ]);
  return funnelFrom(
    {
      key: 'orders_overall',
      title: 'Order pipeline (whole-platform)',
      blurb:
        'Volume across the buying funnel, regardless of persona. Useful as a sanity check against the couple funnel.',
    },
    [
      { label: 'Orders submitted', res: submittedRes },
      { label: 'Awaiting payment', res: awaitingRes },
      { label: 'Paid', res: paidRes },
      { label: 'Fulfilled', res: fulfilledRes },
    ],
  );
}

function FunnelTable({ funnel }: { funnel: Funnel }) {
  const steps = funnel.steps;
  const maxCount = Math.max(1, ...(steps ?? []).map((s) => s.count));
  return (
    <section className="sn-tile p-5">
      <header className="mb-3 space-y-0.5">
        <h2 className="text-base font-semibold text-ink">{funnel.title}</h2>
        <p className="text-xs text-ink/70">{funnel.blurb}</p>
      </header>
      <ConsoleTable
        rows={steps}
        readPermitted
        readError={funnel.error}
        reads={`the ${funnel.title.toLowerCase()} counts`}
        label={funnel.title}
        minWidth="32rem"
        rowKey={(s) => s.label}
        empty={{
          Icon: BarChart3,
          title: 'This funnel has no steps',
          blurb:
            'A funnel with no stages is a definition problem, not a data one — the stages are fixed in code, so this should not be reachable.',
        }}
        columns={[
          {
            header: 'Step',
            cell: (s) => <span className="text-ink/85">{s.label}</span>,
          },
          {
            header: 'Count',
            align: 'right',
            mono: true,
            cell: (s) => <span className="font-semibold text-ink">{s.count}</span>,
          },
          {
            header: 'vs previous',
            align: 'right',
            mono: true,
            hideBelow: 'md',
            cell: (s) => {
              const list = steps ?? [];
              const idx = list.indexOf(s);
              const prev = idx > 0 ? list[idx - 1] : null;
              const conv = prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
              return (
                <span className="text-xs text-ink/70">
                  {conv === null ? '—' : `${conv.toFixed(1)}%`}
                </span>
              );
            },
          },
          {
            header: 'Bar',
            hideBelow: 'lg',
            cell: (s) => (
              <span
                aria-hidden
                className="block h-2 rounded-full bg-terracotta/70"
                style={{ width: `${Math.max(1, Math.round((s.count / maxCount) * 100))}%` }}
              />
            ),
          },
        ]}
      />
    </section>
  );
}
