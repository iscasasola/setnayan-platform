import {
  ADD_ONS,
  appStoreDetailHref,
  addOnHref,
  type AddOnEntry,
  type StudioGroup,
} from '@/lib/add-ons-catalog';
import { addOnDetail } from '@/lib/add-ons-detail';
import { formatPhp } from '@/lib/orders';
import { eventActiveSkus } from '@/lib/entitlements';
import { StudioAppRow, type RowPill } from './_components/studio-app-row';
import { StudioFeaturedCard } from './_components/studio-featured-card';
import { StudioSectionTabs } from './_components/studio-section-tabs';
import {
  dismissRecommendation,
  dismissVendorRecommendation,
  recommendFeature,
} from './recommend-actions';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { SubmitButton } from '@/app/_components/submit-button';
import { RevealList } from '@/app/_components/reveal-list';
import Link from 'next/link';

// The cinema-poster card (service-poster.tsx) still owns the `PosterStyle`
// type that the catalog + Services tab consume, so it is intentionally kept.
export type { PosterStyle } from './_components/service-poster';

export const metadata = { title: 'Studio' };

type Props = { params: Promise<{ eventId: string }> };

/**
 * Studio hub — an iOS App Store-style browse surface for every Setnayan in-app
 * service (owner 2026-06-19: "Studio should look like the App Store so we can
 * see info on each feature"). Four sections (the locked Studio sub-nav): each
 * leads with a featured hero, then lists the rest as App Store rows. Tapping a
 * feature opens its App Store detail page (catalog-driven, app-store/layout.tsx).
 *
 * Pricing on the GET/price pills renders LIVE from the admin catalog
 * (platform_retail_catalog_v2) — never hardcoded.
 */

const SECTIONS: ReadonlyArray<{
  group: StudioGroup;
  label: string;
  anchor: string;
  /** Preferred featured-hero key; falls back to the first available item. */
  flagship: string;
}> = [
  { group: 'setnayan_ai', label: 'Setnayan AI', anchor: 'studio-ai', flagship: 'setnayan-ai' },
  { group: 'website', label: 'Website', anchor: 'studio-website', flagship: 'save-the-date' },
  { group: 'capture', label: 'Capture', anchor: 'studio-capture', flagship: 'papic' },
  { group: 'branding', label: 'Branding', anchor: 'studio-branding', flagship: 'animated-monogram' },
];

/** Available add-ons first; coming-soon sinks to the bottom (stable order). */
function comingSoonLast(a: AddOnEntry, b: AddOnEntry): number {
  const av = a.status === 'coming_soon' ? 1 : 0;
  const bv = b.status === 'coming_soon' ? 1 : 0;
  return av - bv;
}

export default async function StudioPage({ params }: Props) {
  const { eventId } = await params;

  const supabase = await createClient();

  // Event-type surface gating (0053 · 2026-06-28): an add-on tagged with a
  // `surface` shows only when this event type's profile enables it — so a
  // non-wedding event never sees the wedding-only tools (Save-the-Date, RSVP,
  // website parts, Animated Monogram). Wedding enables ALL surfaces → nothing
  // filtered (byte-identical). Degrades to WEDDING_PROFILE on any read error.
  const profile = await resolveProfileByEvent(eventId);
  const surfaceOk = (a: (typeof ADD_ONS)[number]) =>
    !a.surface || surfaceEnabled(profile, a.surface);

  // Bundle-aware ownership for EVERY service in ONE query + live admin catalog
  // prices for the GET pills — fetched together. Ownership uses the admin client
  // (orders RLS is purchaser-scoped — a co-host who didn't place the order is
  // still an owner) and the bundle-aware reader, so `active` includes GUIDED_PACK
  // / MEDIA_PACK children — the grid badge can no longer disagree with the tool
  // surface (which gates on eventSkuActive). The catalog price read stays on the
  // user client (public catalog).
  const serviceKeys = Array.from(
    new Set(ADD_ONS.map((a) => a.serviceKey).filter((k): k is string => Boolean(k))),
  );
  const [{ active: ownedActive, pending: ownedPending }, { data: priceRows }] =
    await Promise.all([
      eventActiveSkus(createAdminClient(), eventId),
      supabase
        .from('platform_retail_catalog_v2')
        .select('service_code, retail_price_php')
        .in('service_code', serviceKeys),
    ]);

  const priceMap = new Map<string, string>();
  for (const r of priceRows ?? []) {
    if (r.service_code != null && r.retail_price_php != null) {
      priceMap.set(r.service_code as string, formatPhp(Number(r.retail_price_php)));
    }
  }

  // ── Coordinator "recommend a feature" (owner 2026-06-22) ──────────────────
  // Who's looking: the couple, or a booked coordinator (event delegate)? The
  // layout already admits only these two; mirror its role test (couple member,
  // else an accepted non-removed moderator row). A coordinator gets per-feature
  // "Recommend to couple" controls; the couple gets a "Your coordinator
  // suggests" strip. Recommendations (+statuses) are read under RLS — the
  // coordinator and couple each only see their own event's rows.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let isCoordinator = false;
  if (user) {
    const { data: membership } = await supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();
    if (!membership || membership.member_type !== 'couple') {
      const { data: moderator } = await supabase
        .from('event_moderators')
        .select('moderator_id')
        .eq('event_id', eventId)
        .eq('user_id', user.id)
        .not('accepted_at', 'is', null)
        .is('removed_at', null)
        .maybeSingle();
      isCoordinator = Boolean(moderator);
    }
  }

  const { data: recRows } = await supabase
    .from('coordinator_feature_recommendations')
    .select('addon_key, status, note')
    .eq('event_id', eventId);
  const recByKey = new Map<string, { status: string; note: string | null }>();
  for (const r of recRows ?? []) {
    recByKey.set(r.addon_key as string, {
      status: r.status as string,
      note: (r.note as string | null) ?? null,
    });
  }

  // ── Vendor "suggest to a couple" (owner 2026-06-30) ───────────────────────
  // The vendor-side twin of the coordinator strip: a connected vendor (accepted
  // chat thread) suggests a buyable Studio add-on, and the couple sees it here as
  // a "Suggested by your vendors" strip alongside the coordinator one. Read under
  // RLS (vfr_couple_select scopes to current_couple_event_ids), pending only. A
  // coordinator viewing the hub isn't a couple member, so RLS returns no rows for
  // them — the strip is couple-only without an extra role check. We resolve the
  // recommending vendor's business_name to attribute each suggestion.
  const { data: vendorRecRows } = await supabase
    .from('vendor_feature_recommendations')
    .select('addon_key, note, vendor_profile_id')
    .eq('event_id', eventId)
    .eq('status', 'pending');
  const vendorRecs = (vendorRecRows ?? []) as {
    addon_key: string;
    note: string | null;
    vendor_profile_id: string;
  }[];

  const vendorNameById = new Map<string, string>();
  if (vendorRecs.length > 0) {
    const vendorIds = Array.from(new Set(vendorRecs.map((r) => r.vendor_profile_id)));
    const { data: vendorRows } = await supabase
      .from('vendor_profiles')
      .select('vendor_profile_id, business_name')
      .in('vendor_profile_id', vendorIds);
    for (const v of (vendorRows ?? []) as {
      vendor_profile_id: string;
      business_name: string | null;
    }[]) {
      if (v.business_name) vendorNameById.set(v.vendor_profile_id, v.business_name);
    }
  }

  // An add-on is "owned" once it's active (paid/fulfilled) — directly OR via a
  // bundle it belongs to (bundle-aware, co-host-aware via the admin read above).
  function isOwned(entry: AddOnEntry): boolean {
    return entry.serviceKey ? ownedActive.has(entry.serviceKey) : false;
  }
  // Only real, buyable, not-yet-owned add-ons can be recommended — a free,
  // coming-soon, or already-owned feature has nothing for the couple to buy.
  function isRecommendable(entry: AddOnEntry): boolean {
    return (
      entry.status !== 'coming_soon'
      && entry.tier !== 'free'
      && Boolean(entry.serviceKey)
      && !isOwned(entry)
    );
  }

  // Resolve the App Store-style pill (price/status) for an entry.
  function pillFor(entry: AddOnEntry): RowPill {
    if (entry.status === 'coming_soon') return { text: 'Soon', tone: 'soon' };
    if (entry.serviceKey && ownedActive.has(entry.serviceKey))
      return { text: 'Active', tone: 'active' };
    if (entry.serviceKey && ownedPending.has(entry.serviceKey))
      return { text: 'Pending', tone: 'pending' };
    if (entry.tier === 'free') return { text: 'Free', tone: 'free' };
    if (entry.freeTrial) return { text: entry.freeTrial, tone: 'trial' };
    const price = entry.serviceKey ? priceMap.get(entry.serviceKey) : null;
    // A real SKU with no readable price shows a neutral "View", never a
    // money-style "Get" (which would imply the paid service is free).
    return { text: price ?? 'View', tone: 'price' };
  }

  // Owner deep-link (paid-features-auto-show applied to routing): once a couple
  // OWNS a service, tapping its card opens the working tool directly and skips
  // the marketing/learn-more interstitial — applied to every service.
  // Not-yet-owned → the normal detail route
  // (opensDirect-aware via appStoreDetailHref).
  function cardHref(entry: AddOnEntry): string {
    return isOwned(entry)
      ? addOnHref(entry.key, eventId)
      : appStoreDetailHref(entry.key, eventId);
  }

  // Coordinator's per-feature control: "Recommend" → "Suggested ✓" once sent,
  // or a muted "Dismissed" if the couple has already passed on it (a dismissed
  // suggestion is never re-sent, so the coordinator can't nag). Null for the
  // couple and for non-recommendable features.
  function coordinatorControl(entry: AddOnEntry) {
    if (!isCoordinator || !isRecommendable(entry)) return null;
    const rec = recByKey.get(entry.key);
    if (rec?.status === 'pending') {
      return (
        <span className="inline-flex items-center rounded-full bg-success-100 px-3 py-1 text-xs font-bold text-success-900">
          Suggested ✓
        </span>
      );
    }
    if (rec && rec.status !== 'pending') {
      return <span className="text-xs font-medium text-ink/40">Dismissed</span>;
    }
    return (
      <form action={recommendFeature}>
        <input type="hidden" name="event_id" value={eventId} />
        <input type="hidden" name="addon_key" value={entry.key} />
        <SubmitButton
          pendingLabel="Recommending…"
          className="rounded-full border border-terracotta/40 bg-terracotta/5 px-3 py-1 text-xs font-bold text-terracotta-700 transition-colors hover:bg-terracotta/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
        >
          Recommend
        </SubmitButton>
      </form>
    );
  }

  // The couple's digest: every pending, still-buyable suggestion the
  // coordinator has made, shown as a strip at the top of the hub.
  const entryByKey = new Map(ADD_ONS.map((a) => [a.key, a] as const));
  const coupleSuggestions = isCoordinator
    ? []
    : (recRows ?? [])
        .filter((r) => r.status === 'pending')
        .map((r) => ({
          entry: entryByKey.get(r.addon_key as string),
          note: (r.note as string | null) ?? null,
        }))
        .filter(
          (x): x is { entry: AddOnEntry; note: string | null } =>
            Boolean(x.entry) && isRecommendable(x.entry as AddOnEntry),
        );

  // The couple's vendor digest: every pending, still-buyable add-on a connected
  // vendor has suggested, attributed to the vendor's business name. Same
  // recommendable/not-owned gate as the coordinator strip (drops free,
  // coming-soon, junk-key, or already-owned add-ons). RLS already returns no rows
  // for a coordinator, so this is empty for them.
  const vendorSuggestions = vendorRecs
    .map((r) => ({
      entry: entryByKey.get(r.addon_key),
      note: r.note,
      vendorProfileId: r.vendor_profile_id,
      vendorName: vendorNameById.get(r.vendor_profile_id) ?? 'Your vendor',
    }))
    .filter(
      (x): x is {
        entry: AddOnEntry;
        note: string | null;
        vendorProfileId: string;
        vendorName: string;
      } => Boolean(x.entry) && isRecommendable(x.entry as AddOnEntry),
    );

  const tabs = SECTIONS.map((s) => ({ id: s.anchor, label: s.label }));

  return (
    <section className="space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
          Studio
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Everything you can make with Setnayan
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Browse the tools you can add to your event — from candid capture to
          your public website, planning aids, and music. Tap any one to see what
          it does. New ones light up as they ship.
        </p>
      </header>

      {coupleSuggestions.length > 0 ? (
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
            Your coordinator suggests
          </p>
          <ul className="mt-3 space-y-3">
            {coupleSuggestions.map(({ entry, note }) => {
              const Icon = entry.Icon;
              return (
                <li key={entry.key} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cream"
                    style={{ background: entry.poster.baseBackground }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {entry.label}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink/60">
                      {note ? `“${note}”` : entry.blurb}
                    </span>
                  </span>
                  <Link
                    href={cardHref(entry)}
                    className="shrink-0 rounded-full bg-terracotta px-3.5 py-1 text-xs font-bold text-cream transition-colors hover:bg-terracotta-700"
                  >
                    View
                  </Link>
                  <form action={dismissRecommendation}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="addon_key" value={entry.key} />
                    <SubmitButton
                      pendingLabel="Dismissing…"
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-ink/45 transition-colors hover:text-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                    >
                      Dismiss
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {vendorSuggestions.length > 0 ? (
        <div className="rounded-2xl border border-terracotta/30 bg-terracotta/[0.04] p-5 sm:p-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
            Suggested by your vendors
          </p>
          <ul className="mt-3 space-y-3">
            {vendorSuggestions.map(({ entry, note, vendorProfileId, vendorName }) => {
              const Icon = entry.Icon;
              return (
                <li key={`${vendorProfileId}:${entry.key}`} className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-cream"
                    style={{ background: entry.poster.baseBackground }}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-ink">
                      {entry.label}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] font-medium uppercase tracking-[0.1em] text-terracotta-600">
                      {vendorName}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink/60">
                      {note ? `“${note}”` : entry.blurb}
                    </span>
                  </span>
                  <Link
                    href={cardHref(entry)}
                    className="shrink-0 rounded-full bg-terracotta px-3.5 py-1 text-xs font-bold text-cream transition-colors hover:bg-terracotta-700"
                  >
                    View
                  </Link>
                  <form action={dismissVendorRecommendation}>
                    <input type="hidden" name="event_id" value={eventId} />
                    <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
                    <input type="hidden" name="addon_key" value={entry.key} />
                    <SubmitButton
                      pendingLabel="Dismissing…"
                      className="shrink-0 rounded-full px-2.5 py-1 text-xs font-medium text-ink/45 transition-colors hover:text-ink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terracotta"
                    >
                      Dismiss
                    </SubmitButton>
                  </form>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* Alaala — the pillar framing. The memory features (capture · website &
          story · music) are the pieces of the couple's living memory. */}
      <div className="rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-terracotta-600">
          Alaala · the memory you keep
        </p>
        <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-ink">
          The pieces below become your <span className="italic">Alaala</span> — the living memory of
          your day. The moments you’ll be too busy to see, the people who can’t be there, the stories
          your guests tell — all kept, and made into something you hold forever.
        </p>
        <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-ink/60">
          And it never gets in the way. The day stays yours — the tech just quietly remembers it.
        </p>
      </div>

      <StudioSectionTabs tabs={tabs} />

      {SECTIONS.map(({ group, label, anchor, flagship }) => {
        const addOns = ADD_ONS.filter((a) => a.studioGroup === group && surfaceOk(a))
          .slice()
          .sort(comingSoonLast);
        if (addOns.length === 0) return null;

        // Featured hero = the preferred flagship if it's available, else the
        // first available item. Coming-soon never gets featured.
        const available = addOns.filter((a) => a.status !== 'coming_soon');
        const featured =
          available.find((a) => a.key === flagship) ?? available[0] ?? null;
        const rows = addOns.filter((a) => a.key !== featured?.key);

        return (
          <div key={group} id={anchor} className="scroll-mt-24 space-y-4">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{label}</h2>

            {featured ? (
              <div className="space-y-2">
                <StudioFeaturedCard
                  href={cardHref(featured)}
                  eyebrow={label}
                  label={featured.label}
                  tagline={addOnDetail(featured.key)?.tagline ?? featured.blurb}
                  Icon={featured.Icon}
                  gradient={featured.poster.baseBackground}
                  pillText={pillFor(featured)?.text ?? 'Open'}
                />
                {coordinatorControl(featured) ? (
                  <div className="flex justify-end">{coordinatorControl(featured)}</div>
                ) : null}
              </div>
            ) : null}

            {rows.length > 0 ? (
              <RevealList
                as="ul"
                className="divide-y divide-ink/10 overflow-hidden rounded-2xl border border-ink/10 bg-cream"
              >
                {rows.map((addon) => {
                  const comingSoon = addon.status === 'coming_soon';
                  return (
                    <StudioAppRow
                      key={addon.key}
                      href={comingSoon ? null : cardHref(addon)}
                      label={addon.label}
                      blurb={addon.blurb}
                      Icon={addon.Icon}
                      gradient={addon.poster.baseBackground}
                      pill={pillFor(addon)}
                      trailing={coordinatorControl(addon)}
                    />
                  );
                })}
              </RevealList>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}
