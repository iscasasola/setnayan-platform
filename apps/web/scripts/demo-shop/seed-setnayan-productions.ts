/**
 * Seed (or re-plan) SETNAYAN PRODUCTIONS into a NON-PROD database — `setnayan-productions.fixture.ts` made rows.
 *
 * Idempotent: every row has a fixed id, so running it again with another `--plan` moves the SAME shop to that plan
 * (tier, verification, which cards are live) and the QR codes keep pointing at the same address.
 *
 * Writes, all through the service-role client:
 *   · Juan dela Cruz's account (auth admin API) → his `users` row (the signup trigger) → his shop
 *   · the shop at the plan: `tier_state`, `verification_state`, the cards live at that plan, own web address (Supplier Plus and up),
 *     pinned review (Pro+), reach
 *   · five service cards with a cover, a price and what's included (the publish gate's three)
 *   · three reviews
 *   · a HOST's wedding he is booked on (his part of that event: the schedule) and a debut he runs with Full access
 *
 * 🛑 Never production: the CLI calls `assertNotProd` first (seed-demo-vendors.ts), and this module refuses a URL that
 * `isNonProdUrl` rejects as well.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isNonProdUrl, priceProfileFor } from '../seed-demo-vendors';
import { tierCaps } from '../../lib/vendor-tier-caps';
import { TOUR_KEYS } from '../../lib/tours';
import {
  SP_NAME,
  SP_OWNER,
  SP_OWNER_EMAIL,
  SP_OWNER_USER_ID,
  SP_PLANS,
  SP_PORTFOLIO,
  SP_PROFILE,
  SP_SERVICES,
  SP_SLUG,
  SP_VENDOR_PROFILE_ID,
  liveServiceTitles,
  spImageUrl,
  type SpPlan,
} from './setnayan-productions.fixture';

/** Fixed ids for the rows hung off the shop — `5e7a0000-…-<kind><n>`. */
const id = (kind: string, n: number) => `5e7a0000-0000-4000-8000-${kind}${String(n).padStart(12 - kind.length, '0')}`;
export const SP_HOST_EVENT_ID = id('e', 1);
export const SP_COORD_EVENT_ID = id('e', 2);
const HOST_USER_ID = id('a', 2);
const COORD_HOST_USER_ID = id('a', 3);
const SP_DOMAIN = 'setnayanproductions.com';

type Ok<T> = { data: T | null; error: { message: string } | null };
async function must<T>(what: string, p: PromiseLike<Ok<T>>): Promise<T | null> {
  const { data, error } = await p;
  if (error) throw new Error(`${what}: ${error.message}`);
  return data;
}

async function ensureUser(admin: SupabaseClient, userId: string, email: string, first: string, last: string): Promise<void> {
  const { data } = await admin.auth.admin.getUserById(userId);
  if (!data?.user) {
    const { error } = await admin.auth.admin.createUser({
      id: userId,
      email,
      email_confirm: true,
      user_metadata: { full_name: `${first} ${last}`, first_name: first, last_name: last },
    } as Parameters<typeof admin.auth.admin.createUser>[0]);
    if (error) throw new Error(`create user ${email}: ${error.message}`);
  }
  await must(
    `users row ${email}`,
    admin
      .from('users')
      .update({
        display_name: `${first} ${last}`,
        first_name: first,
        last_name: last,
        terms_version: '2026-10-23',
        terms_accepted_at: new Date().toISOString(),
        // Every first-run tour already seen — the pictures show the screen, not a walkthrough over it.
        tour_seen_keys: [...TOUR_KEYS],
      })
      .eq('user_id', userId),
  );
}

export type SeedShowcaseResult = { plan: SpPlan; slug: string; live: string[]; hostEventId: string; coordEventId: string };

export async function seedSetnayanProductions(
  admin: SupabaseClient,
  opts: { supabaseUrl: string; plan: SpPlan; imageBase: string },
): Promise<SeedShowcaseResult> {
  if (!isNonProdUrl(opts.supabaseUrl)) throw new Error('seedSetnayanProductions: refusing a production Supabase URL.');
  const planRow = SP_PLANS.find((p) => p.plan === opts.plan);
  if (!planRow) throw new Error(`unknown plan "${opts.plan}" — one of ${SP_PLANS.map((p) => p.plan).join(', ')}`);
  const img = (k: Parameters<typeof spImageUrl>[1]) => spImageUrl(opts.imageBase, k);
  const caps = tierCaps(planRow.tier);
  const live = liveServiceTitles(opts.plan, caps);

  // ── the owner and the two hosts ────────────────────────────────────────
  await ensureUser(admin, SP_OWNER_USER_ID, SP_OWNER_EMAIL, SP_OWNER.first, SP_OWNER.last);
  await ensureUser(admin, HOST_USER_ID, 'bea.reyes@demo.setnayan.local', 'Bea', 'Reyes');
  await ensureUser(admin, COORD_HOST_USER_ID, 'carmen.santos@demo.setnayan.local', 'Carmen', 'Santos');

  // ── the shop ───────────────────────────────────────────────────────────
  const now = new Date().toISOString();
  // Moving the shop DOWN a plan: the database refuses a silent downgrade (`vendor_tier_no_silent_downgrade`) unless the
  // current plan has lapsed — so let it lapse first, as a plan does, rather than reaching for the override switch.
  await must(
    'lapse the current plan',
    admin
      .from('vendor_profiles')
      .update({ tier_expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq('vendor_profile_id', SP_VENDOR_PROFILE_ID),
  );
  await must(
    'vendor_profiles',
    admin.from('vendor_profiles').upsert(
      {
        vendor_profile_id: SP_VENDOR_PROFILE_ID,
        user_id: SP_OWNER_USER_ID,
        business_name: SP_NAME,
        business_slug: SP_SLUG,
        business_owner_name: SP_OWNER.full,
        business_owner_position: SP_OWNER.position,
        tagline: SP_PROFILE.tagline,
        logo_url: img('sp-logo-mark'),
        services: [...new Set(SP_SERVICES.map((s) => s.category))],
        location_city: SP_PROFILE.location_city,
        hq_region: SP_PROFILE.hq_region,
        hq_address: SP_PROFILE.hq_address,
        hq_latitude: SP_PROFILE.hq_latitude,
        hq_longitude: SP_PROFILE.hq_longitude,
        contact_email: SP_OWNER_EMAIL,
        contact_phone: SP_PROFILE.contact_phone,
        event_types: [...SP_PROFILE.event_types],
        in_business_since_year: SP_PROFILE.in_business_since_year,
        weddings_done_approx: SP_PROFILE.weddings_done_approx,
        portfolio_r2_keys: SP_PORTFOLIO.map(img),
        microsite_about: SP_PROFILE.microsite_about,
        microsite_hero_photo_key: img('sp-hero'),
        // A LOCAL showcase, not a seeded marketplace filler: it must render as a real shop does (no demo banner).
        // It is never written to production — see the header.
        is_demo: false,
        public_visibility: 'verified',
        verification_state: planRow.verified ? 'verified' : 'unverified',
        last_verified_at: planRow.verified ? now : null,
        tier_state: planRow.tier,
        tier_expires_at: null,
        tier_source: 'admin_comp',
        // Free is public the way a new Free shop is: self-published, before it is verified.
        self_published_at: now,
        // "As far as my plan lets me" (no declared limit → the plan's own reach, `effectiveOuterRadiusKm`), so each
        // plan's picture shows that plan's reach: Verified 20 km · Supplier Plus 30 · Pro 100 · Ultra nationwide. Metro
        // Manila, Cavite and Laguna (the brief) sit inside it from Pro up; the About text says so on every plan.
        outer_radius_km: null,
      },
      { onConflict: 'vendor_profile_id' },
    ),
  );

  // ── the five cards: cover · price · what's included ───────────────────
  for (let i = 0; i < SP_SERVICES.length; i++) {
    const s = SP_SERVICES[i]!;
    const profile = priceProfileFor(s.profileKey);
    const pkg = profile.packages[0]!;
    const serviceId = id('c', i + 1);
    await must(
      `vendor_services ${s.title}`,
      admin.from('vendor_services').upsert(
        {
          vendor_service_id: serviceId,
          vendor_profile_id: SP_VENDOR_PROFILE_ID,
          category: s.category,
          title: s.title,
          starting_price_php: Math.floor(pkg.minCentavos / 100),
          starts_at_centavos: pkg.minCentavos,
          primary_photo_r2_key: img(s.photo),
          crew_size: profile.crewSize()[0],
          crew_meal_required: profile.crewMealRequired,
          is_linked_only: false,
          // Inclusions first, then live — the publish gate checks the card as it goes live.
          is_active: false,
        },
        { onConflict: 'vendor_service_id' },
      ),
    );
    await must('vendor_service_inclusions (clear)', admin.from('vendor_service_inclusions').delete().eq('vendor_service_id', serviceId));
    await must(
      `vendor_service_inclusions ${s.title}`,
      admin.from('vendor_service_inclusions').insert(
        pkg.inclusions.map((label, n) => ({ vendor_service_id: serviceId, vendor_profile_id: SP_VENDOR_PROFILE_ID, label, sort_order: n })),
      ),
    );
    await must(
      `vendor_services live ${s.title}`,
      admin.from('vendor_services').update({ is_active: live.includes(s.title) }).eq('vendor_service_id', serviceId),
    );
  }

  // ── where couples pay him (else every booked screen asks him to add one) ─
  await must('vendor_payment_methods (clear)', admin.from('vendor_payment_methods').delete().eq('vendor_profile_id', SP_VENDOR_PROFILE_ID));
  await must(
    'vendor_payment_methods',
    admin.from('vendor_payment_methods').insert({
      vendor_profile_id: SP_VENDOR_PROFILE_ID,
      method_type: 'bank',
      label: 'BDO savings',
      provider: 'BDO',
      account_name: SP_NAME,
      account_number: '0000 0000 0000',
      is_primary: true,
      is_shown: true,
      moderation_status: 'approved',
    }),
  );

  // ── reviews (the pinned one shows on Pro and up) ───────────────────────
  const reviews = [
    { body: 'The same-day edit played at dinner and nobody could believe it was shot that morning. Juan’s team was calm the whole day.', overall: 5 },
    { body: 'Our lolo in Toronto watched the whole ceremony live, clear and on time. Lights and sound in the hall were perfect.', overall: 5 },
    { body: 'Easy to talk to, arrived early, delivered the photos in three weeks.', overall: 4 },
  ];
  for (let i = 0; i < reviews.length; i++) {
    const r = reviews[i]!;
    await must(
      'vendor_reviews',
      admin.from('vendor_reviews').upsert(
        {
          review_id: id('d', i + 1),
          vendor_profile_id: SP_VENDOR_PROFILE_ID,
          rating_overall: r.overall,
          rating_communication: 5,
          rating_quality: r.overall,
          rating_value: 5,
          rating_on_time: 5,
          body: r.body,
          booked_through_setnayan: true,
        },
        { onConflict: 'review_id' },
      ),
    );
  }
  await must(
    'pinned review',
    admin
      .from('vendor_profiles')
      .update({ microsite_pinned_review_id: caps.premiumPage ? id('d', 1) : null })
      .eq('vendor_profile_id', SP_VENDOR_PROFILE_ID),
  );

  // ── own web address (Supplier Plus and up) ──────────────────────────────────────
  await must('custom_domains (clear)', admin.from('custom_domains').delete().eq('owner_type', 'vendor').eq('owner_id', SP_VENDOR_PROFILE_ID));
  if (caps.customWebsiteName) {
    await must(
      'custom_domains',
      admin.from('custom_domains').insert({ domain: SP_DOMAIN, owner_type: 'vendor', owner_id: SP_VENDOR_PROFILE_ID, verified_at: now }),
    );
  }

  // ── a host's wedding he is booked on, and a debut he runs ──────────────
  // Only a verified shop can be booked (`vendor_not_verified`), so the Free picture keeps whatever events are there.
  if (planRow.verified) await seedEvents(admin);

  return { plan: opts.plan, slug: SP_SLUG, live, hostEventId: SP_HOST_EVENT_ID, coordEventId: SP_COORD_EVENT_ID };
}

type SeedEvent = Record<string, unknown> & { event_id: string; display_name: string; host: string };

async function seedEvents(admin: SupabaseClient): Promise<void> {
  const events: SeedEvent[] = [
    {
      event_id: SP_HOST_EVENT_ID,
      display_name: 'Bea & Migs',
      event_type: 'wedding',
      event_date: '2027-02-13',
      event_date_precision: 'day',
      region: 'CALABARZON',
      venue_name: 'Hillcrest Garden, Tagaytay',
      bride_name: 'Bea',
      groom_name: 'Migs',
      ceremony_type: 'catholic',
      venue_setting: 'garden',
      host: HOST_USER_ID,
    },
    {
      event_id: SP_COORD_EVENT_ID,
      display_name: 'Sofia turns 18',
      event_type: 'debut',
      event_date: '2027-03-06',
      event_date_precision: 'day',
      region: 'NCR',
      venue_name: 'The Glass Hall, Pasig',
      host: COORD_HOST_USER_ID,
    },
  ];
  for (const { host, ...e } of events) {
    await must(`events ${e.display_name}`, admin.from('events').upsert(e, { onConflict: 'event_id' }));
    await must(
      `event_members ${e.display_name}`,
      admin.from('event_members').upsert(
        { event_id: e.event_id, user_id: host, member_type: 'couple', joined_via: 'created_event' },
        { onConflict: 'event_id,user_id', ignoreDuplicates: true },
      ),
    );
  }

  // Bookings are closed on Setnayan until launch, and the database refuses a booking while they are (the
  // `bookings_closed` guard). This is a LOCAL database: open them for the two bookings, then put the setting back as
  // it was — the Free picture depends on it (a Free shop is public through self-publish only while bookings are closed).
  const ps = await must('platform_settings', admin.from('platform_settings').select('bookings_open').eq('id', 1).maybeSingle());
  const wasOpen = (ps as { bookings_open: boolean | null } | null)?.bookings_open ?? null;
  await must('open bookings', admin.from('platform_settings').update({ bookings_open: true }).eq('id', 1));
  try {
    await seedBookings(admin);
  } finally {
    await must('restore bookings', admin.from('platform_settings').update({ bookings_open: wasOpen }).eq('id', 1));
  }
  await seedSchedule(admin);
}

async function seedBookings(admin: SupabaseClient): Promise<void> {
  // Re-seed from clean: a booking's package role cannot be changed in place (`package_role_is_immutable`).
  await must(
    'event_vendors (clear)',
    admin.from('event_vendors').delete().in('event_id', [SP_HOST_EVENT_ID, SP_COORD_EVENT_ID]).eq('marketplace_vendor_id', SP_VENDOR_PROFILE_ID),
  );
  // Booked on the wedding: photo + video, same-day edit, live stream.
  // ONE live booking per shop per event (`event_vendors_unique_marketplace_pick_per_event`): the same-day edit is the
  // anchor, the photos and the live stream ride on it as `covered` rows — how a bundled booking is stored.
  const booked = [
    { n: 1, category: 'videographer', key: 'photo_video', role: 'anchor', service: 1 },
    { n: 2, category: 'photographer', key: 'photo_video', role: 'covered', service: 2 },
    { n: 3, category: 'av_production', key: 'av_production', role: 'covered', service: 3 },
  ] as const;
  for (const b of booked) {
    await must(
      'event_vendors',
      admin.from('event_vendors').upsert(
        {
          vendor_id: id('f', b.n),
          event_id: SP_HOST_EVENT_ID,
          marketplace_vendor_id: SP_VENDOR_PROFILE_ID,
          vendor_name: SP_NAME,
          category: b.category,
          category_key: b.key,
          package_role: b.role,
          service_id: id('c', b.service),
          status: 'contracted',
        },
        { onConflict: 'vendor_id' },
      ),
    );
  }
  // Runs the debut: booked as its coordinator, seated with Full access (the co-host seat — lib/coordinator-access-level.ts).
  await must(
    'event_vendors (coordinator)',
    admin.from('event_vendors').upsert(
      {
        vendor_id: id('f', 9),
        event_id: SP_COORD_EVENT_ID,
        marketplace_vendor_id: SP_VENDOR_PROFILE_ID,
        vendor_name: SP_NAME,
        category: 'planner_coordinator',
        status: 'contracted',
      },
      { onConflict: 'vendor_id' },
    ),
  );
  await must('event_moderators (clear)', admin.from('event_moderators').delete().eq('event_id', SP_COORD_EVENT_ID).eq('user_id', SP_OWNER_USER_ID));
  await must(
    'event_moderators',
    admin.from('event_moderators').insert({
      event_id: SP_COORD_EVENT_ID,
      user_id: SP_OWNER_USER_ID,
      invited_by_user_id: COORD_HOST_USER_ID,
      role_subtype: 'co_host',
      display_label: SP_OWNER.full,
      permissions_json: { edit_all: true, checkout: true, invite_hosts: true, remove_hosts: false, access_level: 'full' },
      accepted_at: new Date().toISOString(),
    }),
  );

}

async function seedSchedule(admin: SupabaseClient): Promise<void> {
  // The wedding's day — the part the supplier sees and fills in.
  const day = '2027-02-13';
  // [start, end, label, his part?] — "his part" names his bookings on the block (`responsible_vendor_ids`).
  const blocks = [
    ['08:00', '09:00', 'Crew call · gear check', true],
    ['10:00', '13:00', 'Bride and groom preparations', true],
    ['14:00', '15:00', 'Ceremony', true],
    ['15:30', '16:30', 'Photos with family', true],
    ['18:00', '19:00', 'Reception doors open', false],
    ['20:30', '20:45', 'Same-day edit premiere', true],
  ] as const;
  const his = [id('f', 1), id('f', 2), id('f', 3)];
  await must('event_schedule_blocks (clear)', admin.from('event_schedule_blocks').delete().eq('event_id', SP_HOST_EVENT_ID));
  await must(
    'event_schedule_blocks',
    admin.from('event_schedule_blocks').insert(
      blocks.map(([t, e, label, mine], n) => ({
        event_id: SP_HOST_EVENT_ID,
        label,
        // Schedule times are stored as the event's wall clock (the app reads them in UTC), as the hosts typed them.
        start_at: `${day}T${t}:00Z`,
        end_at: `${day}T${e}:00Z`,
        location: 'Hillcrest Garden, Tagaytay',
        sort_order: n,
        responsible_vendor_ids: mine ? his : [],
        released_at: new Date().toISOString(),
      })),
    ),
  );
}
