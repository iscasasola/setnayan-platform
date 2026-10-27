import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readAllPages } from '@/lib/read-all-pages';
import { shopPageGate } from '@/lib/own-shop-preview';
import { resolveVendorDisplayName, displayServiceLabel } from '@/lib/vendors';
import { isTrueNameTier } from '@/lib/vendor-tier-caps';
import { fetchVendorServiceAttributes, payloadHidesPricesPublicly } from '@/lib/vendor-service-attributes';
import { formatPhpRounded } from '@/lib/php';
import { NOT_AVAILABLE_COLUMNS, notAvailableShapeOf, notAvailableWindowFilter } from '@/lib/not-available';
import { checkDateAnswer, checkDateWindow, type CheckDateService } from '@/lib/check-a-date';

/**
 * check-a-date.server — THE ONE READ BEHIND `/v/[slug]/dates` (owner 2026-10-28 ✅ "index.html approve").
 *
 * The page is PUBLIC and the facts are not: a stranger has no SELECT on a shop's blocks, holds or bookings (RLS:
 * the shop's own team only). So the reads run on the service role, NARROW, and the only thing that leaves this file
 * is the answer — a list of Not-bookable days (and, for a shop with separate schedules, the same per service). No
 * block label, no client name, no event, no booking id, no count ever crosses into the page.
 *
 * SIX NARROW READS, the same tables the supplier's own Dates screen and conversation answer read
 * (`lib/thread-day-answer.server.ts`), bounded to the window:
 *   1. the shop's live schedules and their "How many a day" (`vendor_schedule_pools`, with the halls a card uses);
 *   2. which category / card sits on which schedule (`vendor_schedule_pool_categories` · `vendor_schedule_calendar_services`);
 *   3. live Setnayan bookings in the window — a schedule and a date (`vendor_schedule_pool_bookings`);
 *   4. every block that can touch the window, repeats included (`vendor_calendar_blocks`, `notAvailableWindowFilter`);
 *   5. the shop's own day states in the window (`vendor_calendar_day_states`);
 *   6. the shop's active services (`vendor_services`) — their names and starting prices, as the shop page shows them.
 *
 * 🔒 NOTHING ABOUT A CONVERSATION IS READ. No table of conversations, messages, asks or their interests is named in
 * this file, and `app/v/[slug]/dates/no-inquiry-reads.test.ts` walks every module the route reaches to keep it so.
 *
 * ⚖ A READ THAT FAILED NEVER READS AS "AVAILABLE". Any refused or incomplete read → `{ kind: 'unreadable' }`, and the
 * page says it could not load the dates. A falsely-empty block list would paint a closed day open.
 */

export type CheckDateShop = {
  vendorProfileId: string;
  slug: string;
  name: string;
  initials: string;
  verified: boolean;
};

export type CheckDateServiceOption = {
  serviceId: string;
  label: string;
  /** "from ₱85,000" · "" when the shop hides its prices or has none set. */
  price: string;
  category: string | null;
};

export type CheckDateRead =
  | { kind: 'missing' }
  | { kind: 'unreadable' }
  | {
      kind: 'ok';
      shop: CheckDateShop;
      services: CheckDateServiceOption[];
      today: string;
      from: string;
      to: string;
      notBookable: string[];
      perService: Record<string, string[]> | null;
    };

type ShopRow = {
  vendor_profile_id: string;
  business_name: string | null;
  business_slug: string | null;
  services: string[] | null;
  location_city: string | null;
  public_visibility: unknown;
  verification_state: string | null;
  is_demo: boolean | null;
  name_revealed_at: string | null;
  screen_name: string | null;
  tier_state: string | null;
};

const SHOP_COLS =
  'vendor_profile_id, business_name, business_slug, services, location_city, public_visibility, verification_state, is_demo, name_revealed_at, screen_name, tier_state';

function initialsOf(name: string): string {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((words[0]?.[0] ?? 'S') + (words[1]?.[0] ?? '')).toUpperCase();
}

/** Today in the Philippines (no DST — exact). */
export function checkDateToday(now: Date = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
}

export async function readCheckADate(slug: string, now: Date = new Date()): Promise<CheckDateRead> {
  const admin = createAdminClient();
  const shopRead = await admin.from('vendor_profiles').select(SHOP_COLS).ilike('business_slug', slug).maybeSingle();
  if (shopRead.error) {
    logQueryError('readCheckADate.shop', shopRead.error, { slug }, 'graceful_degrade');
    return { kind: 'unreadable' };
  }
  const row = shopRead.data as ShopRow | null;
  // The shop page's own door (`shopPageGate`): a stranger opens a live, listed, non-demo shop — anything else is
  // the not-found page, which never says whether a shop exists.
  if (!row || shopPageGate(row, { isTeam: false, adminDemoMode: false }).open !== 'public') return { kind: 'missing' };

  const id = row.vendor_profile_id;
  const today = checkDateToday(now);
  const window = checkDateWindow(today);
  const fromTs = `${window.from}T00:00:00+08:00`;
  const toTs = `${window.to}T23:59:59.999+08:00`;

  const [poolsRes, catsRes, membersRes, servicesRes, statesRes, bookingsRead, blocksRead, attrs] = await Promise.all([
    admin
      .from('vendor_schedule_pools')
      .select('pool_id, daily_booking_capacity, vendor_service_halls(vendor_service_id)')
      .eq('vendor_profile_id', id)
      .eq('is_active', true),
    admin.from('vendor_schedule_pool_categories').select('category_key, pool_id').eq('vendor_profile_id', id),
    admin
      .from('vendor_schedule_calendar_services')
      .select('vendor_service_id, pool_id')
      .eq('vendor_profile_id', id)
      // The membership table is optional (Named Calendars) — absent, every card falls back to its category.
      .then((r) => (r.error ? { data: [] as { vendor_service_id: string; pool_id: string }[], error: null } : r)),
    admin
      .from('vendor_services')
      .select('vendor_service_id, title, category, starting_price_php, created_at')
      .eq('vendor_profile_id', id)
      .eq('is_active', true)
      .order('created_at', { ascending: true }),
    admin
      .from('vendor_calendar_day_states')
      .select('pool_id, state_date, day_state')
      .eq('vendor_profile_id', id)
      .gte('state_date', window.from)
      .lte('state_date', window.to)
      .limit(5000),
    readAllPages(
      async (from, to) => {
        const { data, error, count } = await admin
          .from('vendor_schedule_pool_bookings')
          .select('pool_id, booked_date', { count: 'exact' })
          .eq('vendor_profile_id', id)
          .is('released_at', null)
          .gte('booked_date', today)
          .lte('booked_date', window.to)
          .order('booked_date', { ascending: true })
          .order('pool_booking_id', { ascending: true })
          .range(from, to);
        return { rows: data ?? null, error: error ? error.message : null, total: count };
      },
      { pageSize: 1000 },
    ),
    readAllPages(
      async (from, to) => {
        const { data, error, count } = await admin
          .from('vendor_calendar_blocks')
          .select(`block_id, pool_id, block_source, blocked_at, blocked_until, ${NOT_AVAILABLE_COLUMNS}`, { count: 'exact' })
          .eq('vendor_profile_id', id)
          .lte('blocked_at', toTs)
          // A repeat began before the window yet covers days in it — keep it (`lib/not-available.ts`).
          .or(notAvailableWindowFilter(fromTs))
          .order('blocked_at', { ascending: true })
          .order('block_id', { ascending: true })
          .range(from, to);
        return { rows: data ?? null, error: error ? error.message : null, total: count };
      },
      { pageSize: 1000 },
    ),
    fetchVendorServiceAttributes(admin, id).catch(() => null),
  ]);

  for (const [what, res] of [
    ['pools', poolsRes],
    ['categories', catsRes],
    ['services', servicesRes],
    ['day states', statesRes],
  ] as const) {
    if (res.error) {
      logQueryError(`readCheckADate.${what}`, res.error, { vendor_profile_id: id }, 'graceful_degrade');
      return { kind: 'unreadable' };
    }
  }
  for (const [what, read] of [
    ['bookings', bookingsRead],
    ['blocks', blocksRead],
  ] as const) {
    if (!read.complete) {
      logQueryError(`readCheckADate.${what}`, { message: read.error ?? 'incomplete read' }, { vendor_profile_id: id }, 'graceful_degrade');
      return { kind: 'unreadable' };
    }
  }

  const poolRows = (poolsRes.data ?? []) as unknown as {
    pool_id: string;
    daily_booking_capacity: number | null;
    vendor_service_halls?: { vendor_service_id: string }[] | null;
  }[];
  const pools = poolRows.map((p) => ({ poolId: p.pool_id, capacity: Number(p.daily_booking_capacity) || 0 }));
  const serviceRows = (servicesRes.data ?? []) as {
    vendor_service_id: string;
    title: string | null;
    category: string | null;
    starting_price_php: number | null;
  }[];

  // Which schedules each card sits on: its explicit calendar(s) and halls, else its category's schedule.
  const explicit = new Map<string, Set<string>>();
  const put = (serviceId: string, poolId: string) => {
    const set = explicit.get(serviceId) ?? new Set<string>();
    set.add(poolId);
    explicit.set(serviceId, set);
  };
  for (const m of (membersRes.data ?? []) as { vendor_service_id: string; pool_id: string }[]) put(m.vendor_service_id, m.pool_id);
  for (const p of poolRows) for (const h of p.vendor_service_halls ?? []) put(h.vendor_service_id, p.pool_id);
  const poolByCategory = new Map(((catsRes.data ?? []) as { category_key: string; pool_id: string }[]).map((c) => [c.category_key, c.pool_id]));
  const services: CheckDateService[] = serviceRows.map((s) => {
    const own = explicit.get(s.vendor_service_id);
    const byCat = s.category ? poolByCategory.get(s.category) : undefined;
    return { serviceId: s.vendor_service_id, poolIds: own && own.size > 0 ? [...own] : byCat ? [byCat] : [] };
  });

  const blocks = (
    blocksRead.rows as {
      pool_id: string | null;
      block_source: 'manual' | 'setnayan_booking' | 'synced_calendar' | 'external_client';
      blocked_at: string;
      blocked_until: string;
      repeat_rule?: unknown;
      repeat_until?: unknown;
      day_part?: unknown;
    }[]
  )
    .filter((b) => b.blocked_at && b.blocked_until)
    .map((b) => ({ poolId: b.pool_id, source: b.block_source, ...notAvailableShapeOf(b) }));
  const bookings = (bookingsRead.rows as { pool_id: string; booked_date: string }[]).map((b) => ({ poolId: b.pool_id, bookedDate: b.booked_date }));
  const dayStates = ((statesRes.data ?? []) as { pool_id: string | null; state_date: string; day_state: string }[])
    .filter((s): s is { pool_id: string | null; state_date: string; day_state: 'locked' | 'whitelist' } => s.day_state === 'locked' || s.day_state === 'whitelist')
    .map((s) => ({ poolId: s.pool_id, stateDate: s.state_date, dayState: s.day_state }));

  const answer = checkDateAnswer({ pools, bookings, blocks, dayStates, services, months: window.months, today });

  // Prices as the shop page shows them: hidden when the shop chose to hide them (a failed read shows — it never hides).
  const hidePrices = Array.isArray(attrs) && attrs.some((a) => payloadHidesPricesPublicly(a.attribute_payload));
  const name = resolveVendorDisplayName({
    business_name: row.business_name,
    name_revealed_at: row.name_revealed_at,
    primary_canonical_service: row.services?.[0] ?? null,
    location_city: row.location_city,
    services: row.services ?? null,
    screen_name: row.screen_name ?? null,
    isPaidTier: isTrueNameTier(row.tier_state ?? null),
    is_verified: row.verification_state === 'verified',
  });

  return {
    kind: 'ok',
    shop: {
      vendorProfileId: id,
      slug: row.business_slug ?? slug,
      name,
      initials: initialsOf(name),
      verified: row.verification_state === 'verified',
    },
    services: serviceRows.map((s) => ({
      serviceId: s.vendor_service_id,
      label: s.title?.trim() || displayServiceLabel(s.category ?? 'Service'),
      price: !hidePrices && s.starting_price_php !== null && s.starting_price_php > 0 ? `from ${formatPhpRounded(s.starting_price_php)}` : '',
      category: s.category,
    })),
    today,
    from: window.from,
    to: window.to,
    notBookable: answer.notBookable,
    perService: answer.perService,
  };
}
