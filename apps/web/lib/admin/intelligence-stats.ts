import { unstable_cache } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Admin Intelligence (/admin/intelligence) — churn radar · market pulse ·
 * lead scoring. Everything is a local Postgres aggregation (three RPCs from
 * migration 20261202000000); no external AI/API spend.
 *
 * CACHING: each (staleDays) variant is wrapped in `unstable_cache` with a
 * 10-minute revalidate + the `admin-intelligence` tag. The three RPCs fire in
 * parallel on a cache miss, so the DB sees at most ~6 aggregation rounds per
 * hour per variant no matter how many admins keep the surface open. The RPCs
 * themselves are STABLE and ride existing (event_id) indexes plus the new
 * partial events(event_date) WHERE archived = FALSE index.
 *
 * AUTH: fetched via the service-role client (mirrors lib/admin/growth-stats).
 * The /admin layout already 404s non-admins before this module runs, and the
 * RPCs re-guard with is_admin() OR service_role at the SQL layer.
 */

export const INTELLIGENCE_CACHE_TAG = 'admin-intelligence';
const REVALIDATE_S = 600; // 10 minutes

export const STALE_WINDOW_OPTIONS: { value: StaleWindowKey; label: string; days: number }[] = [
  { value: '7', label: 'Quiet for 7+ days', days: 7 },
  { value: '14', label: 'Quiet for 14+ days', days: 14 },
  { value: '30', label: 'Quiet for 30+ days', days: 30 },
];

export type StaleWindowKey = '7' | '14' | '30';

export type ChurnRiskRow = {
  eventId: string;
  publicId: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  daysToEvent: number;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  lastSignInAt: string | null;
  lastGuestChangeAt: string | null;
  lastBudgetChangeAt: string | null;
  lastActivityAt: string;
  daysInactive: number;
};

export type RegionCount = { region: string; events: number };
export type EventTypeCount = { eventType: string; events: number };

export type MarketAnalytics = {
  budget: {
    eventsTotal: number;
    eventsWithBudget: number;
    avgCentavos: number | null;
    medianCentavos: number | null;
    minCentavos: number | null;
    maxCentavos: number | null;
  };
  topRegions: RegionCount[];
  unlocatedEvents: number;
  eventTypes: EventTypeCount[];
};

export type LeadTier = 'high_value' | 'engaged' | 'early';

export type LeadScoreRow = {
  eventId: string;
  publicId: string;
  eventName: string;
  eventType: string;
  eventDate: string | null;
  ownerEmail: string | null;
  ownerDisplayName: string | null;
  guestCount: number;
  vendorCount: number;
  tableCount: number;
  seatedCount: number;
  lineItemCount: number;
  paymentCount: number;
  budgetSet: boolean;
  autoArrangeUsed: boolean;
  websiteConfigured: boolean;
  monogramConfigured: boolean;
  signedInLast7d: boolean;
  profileCompletionPct: number;
  score: number;
  tier: LeadTier;
};

export type IntelligenceStats = {
  demo: boolean;
  staleDays: number;
  churn: ChurnRiskRow[];
  market: MarketAnalytics | null;
  leads: LeadScoreRow[];
  errors: string[];
  generatedAt: string;
};

/* ── Raw RPC row shapes (snake_case, as returned by PostgREST) ─────────── */

type RawChurnRow = {
  event_id: string;
  public_id: string;
  event_name: string;
  event_type: string;
  event_date: string;
  days_to_event: number;
  owner_email: string | null;
  owner_display_name: string | null;
  last_sign_in_at: string | null;
  last_guest_change_at: string | null;
  last_budget_change_at: string | null;
  last_activity_at: string;
  days_inactive: number;
};

type RawLeadRow = {
  event_id: string;
  public_id: string;
  event_name: string;
  event_type: string;
  event_date: string | null;
  owner_email: string | null;
  owner_display_name: string | null;
  guest_count: number;
  vendor_count: number;
  table_count: number;
  seated_count: number;
  line_item_count: number;
  payment_count: number;
  budget_set: boolean;
  auto_arrange_used: boolean;
  website_configured: boolean;
  monogram_configured: boolean;
  signed_in_last_7d: boolean;
  profile_completion_pct: number;
  score: number;
  tier: LeadTier;
};

type RawMarket = {
  budget: {
    events_total: number;
    events_with_budget: number;
    avg_centavos: number | null;
    median_centavos: number | null;
    min_centavos: number | null;
    max_centavos: number | null;
  };
  top_regions: { region: string; events: number }[] | null;
  unlocated_events: number;
  event_types: { event_type: string; events: number }[] | null;
  generated_at: string;
};

async function fetchIntelligenceUncached(staleDays: number): Promise<IntelligenceStats> {
  const supabase = createAdminClient();
  const errors: string[] = [];

  const [churnRes, marketRes, leadsRes] = await Promise.all([
    supabase.rpc('admin_churn_risk_events', { p_stale_days: staleDays, p_limit: 100 }),
    supabase.rpc('admin_market_analytics'),
    supabase.rpc('admin_lead_scores', { p_limit: 50 }),
  ]);

  let churn: ChurnRiskRow[] = [];
  if (churnRes.error) {
    errors.push(`churn radar (${churnRes.error.message})`);
  } else {
    churn = ((churnRes.data ?? []) as RawChurnRow[]).map((r) => ({
      eventId: r.event_id,
      publicId: r.public_id,
      eventName: r.event_name,
      eventType: r.event_type,
      eventDate: r.event_date,
      daysToEvent: r.days_to_event,
      ownerEmail: r.owner_email,
      ownerDisplayName: r.owner_display_name,
      lastSignInAt: r.last_sign_in_at,
      lastGuestChangeAt: r.last_guest_change_at,
      lastBudgetChangeAt: r.last_budget_change_at,
      lastActivityAt: r.last_activity_at,
      daysInactive: r.days_inactive,
    }));
  }

  let market: MarketAnalytics | null = null;
  if (marketRes.error) {
    errors.push(`market pulse (${marketRes.error.message})`);
  } else if (marketRes.data) {
    const raw = marketRes.data as RawMarket;
    market = {
      budget: {
        eventsTotal: raw.budget.events_total,
        eventsWithBudget: raw.budget.events_with_budget,
        avgCentavos: raw.budget.avg_centavos,
        medianCentavos: raw.budget.median_centavos,
        minCentavos: raw.budget.min_centavos,
        maxCentavos: raw.budget.max_centavos,
      },
      topRegions: (raw.top_regions ?? []).map((t) => ({ region: t.region, events: t.events })),
      unlocatedEvents: raw.unlocated_events,
      eventTypes: (raw.event_types ?? []).map((t) => ({
        eventType: t.event_type,
        events: t.events,
      })),
    };
  }

  let leads: LeadScoreRow[] = [];
  if (leadsRes.error) {
    errors.push(`lead scores (${leadsRes.error.message})`);
  } else {
    leads = ((leadsRes.data ?? []) as RawLeadRow[]).map((r) => ({
      eventId: r.event_id,
      publicId: r.public_id,
      eventName: r.event_name,
      eventType: r.event_type,
      eventDate: r.event_date,
      ownerEmail: r.owner_email,
      ownerDisplayName: r.owner_display_name,
      guestCount: r.guest_count,
      vendorCount: r.vendor_count,
      tableCount: r.table_count,
      seatedCount: r.seated_count,
      lineItemCount: r.line_item_count,
      paymentCount: r.payment_count,
      budgetSet: r.budget_set,
      autoArrangeUsed: r.auto_arrange_used,
      websiteConfigured: r.website_configured,
      monogramConfigured: r.monogram_configured,
      signedInLast7d: r.signed_in_last_7d,
      profileCompletionPct: r.profile_completion_pct,
      score: r.score,
      tier: r.tier,
    }));
  }

  return {
    demo: false,
    staleDays,
    churn,
    market,
    leads,
    errors,
    generatedAt: new Date().toISOString(),
  };
}

/** Cached fetch — one cache entry per stale-window variant. */
export function fetchIntelligenceStats(staleDays: number): Promise<IntelligenceStats> {
  return unstable_cache(
    () => fetchIntelligenceUncached(staleDays),
    ['admin-intelligence', String(staleDays)],
    { revalidate: REVALIDATE_S, tags: [INTELLIGENCE_CACHE_TAG] },
  )();
}

/* ── Display helpers ───────────────────────────────────────────────────── */

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Weddings',
  birthday: 'Birthdays',
  debut: 'Debuts',
  christening: 'Christenings',
  gender_reveal: 'Gender reveals',
  celebration: 'Celebrations',
  travel: 'Travel',
  corporate: 'Corporate',
  tournament: 'Tournaments',
  anniversary: 'Anniversaries',
  graduation: 'Graduations',
  reunion: 'Reunions',
};

export function eventTypeLabel(slug: string): string {
  return EVENT_TYPE_LABELS[slug] ?? slug.replace(/_/g, ' ');
}

/** Display label for an events.region slug — mirrors growth-stats. */
export function regionLabel(slug: string): string {
  return slug.toUpperCase().replace(/_/g, ' ');
}

export const LEAD_TIER_LABELS: Record<LeadTier, string> = {
  high_value: 'High-Value Premium Prospect',
  engaged: 'Engaged',
  early: 'Early',
};

/* ── Demo data (mirrors growth's buildDemoGrowthStats pattern) ─────────── */

export function buildDemoIntelligenceStats(staleDays: number): IntelligenceStats {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const iso = (msAgo: number) => new Date(now - msAgo).toISOString();
  const dateIn = (days: number) => new Date(now + days * day).toISOString().slice(0, 10);

  const churn: ChurnRiskRow[] = [
    {
      eventId: 'demo-1',
      publicId: 'S89E-DEMO000001',
      eventName: 'Bea & Marco',
      eventType: 'wedding',
      eventDate: dateIn(92),
      daysToEvent: 92,
      ownerEmail: 'bea.demo@example.com',
      ownerDisplayName: 'Bea Santos',
      lastSignInAt: iso(21 * day),
      lastGuestChangeAt: iso(24 * day),
      lastBudgetChangeAt: null,
      lastActivityAt: iso(21 * day),
      daysInactive: 21,
    },
    {
      eventId: 'demo-2',
      publicId: 'S89E-DEMO000002',
      eventName: "Althea's 18th",
      eventType: 'debut',
      eventDate: dateIn(45),
      daysToEvent: 45,
      ownerEmail: 'rivera.fam@example.com',
      ownerDisplayName: 'Tin Rivera',
      lastSignInAt: iso(17 * day),
      lastGuestChangeAt: iso(17 * day),
      lastBudgetChangeAt: iso(30 * day),
      lastActivityAt: iso(17 * day),
      daysInactive: 17,
    },
  ];

  const market: MarketAnalytics = {
    budget: {
      eventsTotal: 128,
      eventsWithBudget: 74,
      avgCentavos: 48_500_000,
      medianCentavos: 35_000_000,
      minCentavos: 5_000_000,
      maxCentavos: 250_000_000,
    },
    topRegions: [
      { region: 'ncr', events: 41 },
      { region: 'iv-a', events: 22 },
      { region: 'vii', events: 15 },
      { region: 'iii', events: 9 },
      { region: 'xi', events: 6 },
    ],
    unlocatedEvents: 35,
    eventTypes: [
      { eventType: 'wedding', events: 96 },
      { eventType: 'debut', events: 14 },
      { eventType: 'birthday', events: 10 },
      { eventType: 'corporate', events: 5 },
      { eventType: 'celebration', events: 3 },
    ],
  };

  const leads: LeadScoreRow[] = [
    {
      eventId: 'demo-3',
      publicId: 'S89E-DEMO000003',
      eventName: 'Cams & Migs',
      eventType: 'wedding',
      eventDate: dateIn(150),
      ownerEmail: 'cams.demo@example.com',
      ownerDisplayName: 'Cams dela Cruz',
      guestCount: 184,
      vendorCount: 6,
      tableCount: 19,
      seatedCount: 171,
      lineItemCount: 14,
      paymentCount: 5,
      budgetSet: true,
      autoArrangeUsed: true,
      websiteConfigured: true,
      monogramConfigured: true,
      signedInLast7d: true,
      profileCompletionPct: 100,
      score: 95,
      tier: 'high_value',
    },
    {
      eventId: 'demo-4',
      publicId: 'S89E-DEMO000004',
      eventName: 'JM & Pau',
      eventType: 'wedding',
      eventDate: dateIn(210),
      ownerEmail: 'jm.demo@example.com',
      ownerDisplayName: 'JM Ocampo',
      guestCount: 62,
      vendorCount: 2,
      tableCount: 8,
      seatedCount: 0,
      lineItemCount: 3,
      paymentCount: 0,
      budgetSet: true,
      autoArrangeUsed: false,
      websiteConfigured: true,
      monogramConfigured: false,
      signedInLast7d: true,
      profileCompletionPct: 67,
      score: 60,
      tier: 'engaged',
    },
    {
      eventId: 'demo-5',
      publicId: 'S89E-DEMO000005',
      eventName: "Lia's Christening",
      eventType: 'christening',
      eventDate: null,
      ownerEmail: 'lia.mama@example.com',
      ownerDisplayName: 'Mara Uy',
      guestCount: 4,
      vendorCount: 0,
      tableCount: 0,
      seatedCount: 0,
      lineItemCount: 0,
      paymentCount: 0,
      budgetSet: false,
      autoArrangeUsed: false,
      websiteConfigured: false,
      monogramConfigured: false,
      signedInLast7d: false,
      profileCompletionPct: 11,
      score: 0,
      tier: 'early',
    },
  ];

  return {
    demo: true,
    staleDays,
    churn,
    market,
    leads,
    errors: [],
    generatedAt: new Date(now).toISOString(),
  };
}
