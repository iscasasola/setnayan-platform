import { ExternalLink, LineChart } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/admin';

export const metadata = { title: 'Funnels · Admin' };

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
  steps: Step[];
};

type Props = {
  searchParams: Promise<{ range?: string }>;
};

// PostHog dashboard URL — surfaces the 4 funnels we keep on PostHog rather
// than recomputing from Supabase. The slug is derived from the configured
// project + host; when neither is set we fall back to the marketing host.
function buildPostHogDashboardUrl(): string {
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!host) return 'https://us.posthog.com';
  return `${host.replace(/\/+$/, '')}/insights`;
}

export default async function AdminFunnelsPage({ searchParams }: Props) {
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

  const distinctVendorBookings = new Set(
    ((vendorFirstBookingRes.data ?? []) as { vendor_profile_id: string }[]).map(
      (r) => r.vendor_profile_id,
    ),
  ).size;

  const funnels: Funnel[] = [
    {
      key: 'customer',
      title: 'Couple onboarding',
      blurb: 'Signup → first event created → first paid order.',
      steps: [
        { label: 'Couple signups', count: signupsRes.count ?? 0 },
        { label: 'Events created', count: eventsRes.count ?? 0 },
        { label: 'Orders paid', count: paidOrdersRes.count ?? 0 },
      ],
    },
    {
      key: 'vendor',
      title: 'Vendor onboarding',
      blurb: 'Signup → profile complete → first booking thread.',
      steps: [
        { label: 'Vendor signups', count: vendorSignupsRes.count ?? 0 },
        { label: 'Profile filled', count: vendorProfileCompleteRes.count ?? 0 },
        { label: 'First booking thread', count: distinctVendorBookings },
      ],
    },
    {
      key: 'orders_overall',
      title: 'Order pipeline (whole-platform)',
      blurb:
        'Volume across the buying funnel, regardless of persona. Useful as a sanity check against the couple funnel.',
      steps: await orderPipelineSteps(admin, sinceIso),
    },
  ];

  const errors = [
    signupsRes.error,
    eventsRes.error,
    paidOrdersRes.error,
    vendorSignupsRes.error,
    vendorProfileCompleteRes.error,
    vendorFirstBookingRes.error,
  ]
    .filter(Boolean)
    .map((e) => e!.message);

  const postHogUrl = buildPostHogDashboardUrl();

  return (
    <div className="mx-auto w-full max-w-6xl xl:max-w-7xl 2xl:max-w-screen-2xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-6 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-terracotta/10 text-terracotta">
            <LineChart aria-hidden className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Funnels</h1>
        </div>
        <p className="max-w-prose text-sm text-ink/60">
          Three Supabase-side funnels computed live from the platform&apos;s
          own tables. The remaining four V1 funnels (Save-the-Date, Papic,
          Pro upgrade, Guided Planner) live in PostHog and link out below.
        </p>
      </header>

      <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
        <label
          htmlFor="range"
          className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55"
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
        <p
          role="alert"
          className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
        >
          {errors.join(' · ')}
        </p>
      ) : null}

      <div className="space-y-6">
        {funnels.map((f) => (
          <FunnelTable key={f.key} funnel={f} />
        ))}
      </div>

      <section className="mt-8 rounded-xl border border-dashed border-ink/15 bg-cream p-5">
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
          className="inline-flex items-center gap-1.5 rounded-md bg-ink/5 px-3 py-1.5 text-xs font-medium text-ink/80 hover:bg-ink/10"
        >
          Open in PostHog
          <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </a>
      </section>
    </div>
  );
}

// Helper: compute the order pipeline steps. Split out so it doesn't blow
// up the top-level await chain when the date range shifts.
async function orderPipelineSteps(
  admin: ReturnType<typeof createAdminClient>,
  sinceIso: string,
): Promise<Step[]> {
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
  return [
    { label: 'Orders submitted', count: submittedRes.count ?? 0 },
    { label: 'Awaiting payment', count: awaitingRes.count ?? 0 },
    { label: 'Paid', count: paidRes.count ?? 0 },
    { label: 'Fulfilled', count: fulfilledRes.count ?? 0 },
  ];
}

function FunnelTable({ funnel }: { funnel: Funnel }) {
  const maxCount = Math.max(1, ...funnel.steps.map((s) => s.count));
  return (
    <section className="rounded-xl border border-ink/10 bg-cream p-5">
      <header className="mb-3 space-y-0.5">
        <h2 className="text-base font-semibold text-ink">{funnel.title}</h2>
        <p className="text-xs text-ink/55">{funnel.blurb}</p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-[11px] uppercase tracking-[0.12em] text-ink/55">
            <tr>
              <th className="py-2 font-medium">Step</th>
              <th className="py-2 font-medium">Count</th>
              <th className="py-2 font-medium">vs previous</th>
              <th className="py-2 font-medium">Bar</th>
            </tr>
          </thead>
          <tbody>
            {funnel.steps.map((s, idx) => {
              const prev = idx > 0 ? funnel.steps[idx - 1] : null;
              const conv =
                prev && prev.count > 0 ? (s.count / prev.count) * 100 : null;
              const widthPct = Math.max(1, Math.round((s.count / maxCount) * 100));
              return (
                <tr key={s.label} className="border-t border-ink/5">
                  <td className="py-2 text-ink/85">{s.label}</td>
                  <td className="py-2 font-mono text-sm font-semibold text-ink">
                    {s.count}
                  </td>
                  <td className="py-2 text-xs text-ink/65">
                    {conv === null ? '—' : `${conv.toFixed(1)}%`}
                  </td>
                  <td className="py-2">
                    <span
                      aria-hidden
                      className="block h-2 rounded-full bg-terracotta/70"
                      style={{ width: `${widthPct}%` }}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
