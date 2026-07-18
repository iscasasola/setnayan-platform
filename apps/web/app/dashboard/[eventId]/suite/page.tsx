import {
  ADD_ONS,
  appStoreDetailHref,
  addOnHref,
  type AddOnEntry,
  type StudioGroup,
} from '@/lib/add-ons-catalog';
import { recommendStudioAddOns } from '@/lib/studio-recommendations';
import { fetchRoadmapState } from '@/lib/wedding-roadmap-signals';
import { formatPhp } from '@/lib/orders';
import { eventActiveSkus } from '@/lib/entitlements';
import { StudioAppRow, type RowPill } from '../studio/_components/studio-app-row';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveProfileByEvent, surfaceEnabled } from '@/lib/event-type-profile';
import { routes } from '@/lib/routes';
import { RevealList } from '@/app/_components/reveal-list';
import { notFound } from 'next/navigation';
import {
  CalendarSearch,
  Users,
  Wallet,
  CalendarClock,
  ListChecks,
  Scale,
  type LucideIcon,
} from 'lucide-react';

export const metadata = { title: 'Suite' };
export const dynamic = 'force-dynamic';

/**
 * Suite — the guided in-app services surface (owner 2026-07-18: "build the full
 * services surface", name locked to "Suite"). A single flagged home that leads
 * with the AI secretary's recommendations, shows what the couple already owns,
 * then everything they can add, and finally the complete FREE layer — every free
 * tool a real tappable doorway, which closes the wayfinding gap the 2026-07-18
 * audit found (7 of 13 free tools were buried outside the nav).
 *
 * NEW SURFACE, FLAG-DARK IN PROD: shown on every Vercel PREVIEW deploy (so the
 * owner can review it on the PR) but 404 in PRODUCTION until NEXT_PUBLIC_SUITE
 * is switched on — the live Studio (../studio) stays byte-untouched. Reuses the
 * proven Studio data layer wholesale — live admin-catalog prices (never
 * hardcoded), bundle-aware ownership, roadmap-aware recommendations, event-type
 * surface gating — so the open pricing decisions don't block it: prices read
 * live, and the name lives in the single SUITE_NAME constant.
 */

/** The surface name — single source of truth so a rename is one edit. */
const SUITE_NAME = 'Suite';

/** Outcome-framed section headers for the "Add to your day" cards (owner:
 *  group by what you get, not by internal category). Maps the locked
 *  studioGroup to an outcome label. */
const OUTCOME_LABEL: Record<StudioGroup, string> = {
  setnayan_ai: 'Plan your day',
  website: 'Your website',
  capture: 'Your day, captured',
  branding: 'Your look & keepsakes',
  utility: 'More',
};

/**
 * The free PLANNING tools — first-class dashboard surfaces that are NOT in the
 * add-ons catalog (Guest List, Budget, Schedule, …). Every href comes from a
 * `routes.*` helper (audit guardrail: no hand-typed paths). Mood Board / Seat
 * Plan / Playlist etc. are NOT here — they're free catalog SKUs and render from
 * ADD_ONS below, so nothing double-lists.
 */
type FreeTool = {
  key: string;
  label: string;
  blurb: string;
  Icon: LucideIcon;
  href: (eventId: string) => string;
  gradient: string;
  /** The one hero free helper, given a featured card instead of a strip row. */
  featured?: boolean;
};

const FREE_TOOLS: readonly FreeTool[] = [
  {
    key: 'find-date',
    label: 'Find your date',
    blurb: 'Your people and your vendors, matched to the dates you’re weighing — your 3 best, ranked.',
    Icon: CalendarSearch,
    href: (id) => routes.dashboard.findDate(id),
    gradient: 'linear-gradient(135deg, #1F2A3D 0%, #2E4063 50%, #44608F 100%)',
    featured: true,
  },
  {
    key: 'guests',
    label: 'Guest List',
    blurb: 'Your living roster — add, group, and seat every guest.',
    Icon: Users,
    href: (id) => routes.dashboard.guests.index(id),
    gradient: 'linear-gradient(135deg, #3A1E2E 0%, #6E3A55 50%, #A8617F 100%)',
  },
  {
    key: 'budget',
    label: 'Budget Planner',
    blurb: 'Track every payment — vendor packages, crew meals, and proof.',
    Icon: Wallet,
    href: (id) => routes.dashboard.budget(id),
    gradient: 'radial-gradient(ellipse at 30% 70%, #F4D9B0 0%, #C97B4B 70%)',
  },
  {
    key: 'schedule',
    label: 'Schedule',
    blurb: 'Your run-of-show — every block of the day, in order.',
    Icon: CalendarClock,
    href: (id) => routes.dashboard.schedule(id),
    gradient: 'radial-gradient(ellipse at 50% 50%, #4A2E1C 0%, #1A1A1A 80%)',
  },
  {
    key: 'checklist',
    label: 'Checklist',
    blurb: 'Everything to do for your day, timed to your date.',
    Icon: ListChecks,
    href: (id) => routes.dashboard.checklist(id),
    gradient: 'linear-gradient(135deg, #1A1410 0%, #3A281C 55%, #6B4A30 100%)',
  },
  {
    key: 'compare',
    label: 'Compare vendors',
    blurb: 'Put two saved vendors side by side — price, inclusions, reviews.',
    Icon: Scale,
    href: () => routes.explore.compare(),
    gradient: 'linear-gradient(135deg, #2B1810 0%, #5A2818 55%, #C97B4B 100%)',
  },
];

type Props = { params: Promise<{ eventId: string }> };

/** Available add-ons first; coming-soon sinks (stable order). */
function comingSoonLast(a: AddOnEntry, b: AddOnEntry): number {
  return (a.status === 'coming_soon' ? 1 : 0) - (b.status === 'coming_soon' ? 1 : 0);
}

export default async function SuitePage({ params }: Props) {
  // Flag-dark in PRODUCTION: 404 until NEXT_PUBLIC_SUITE is switched on, so the
  // live Studio is unaffected. Always visible on Vercel PREVIEW deploys
  // (VERCEL_ENV==='preview') so the owner can review the PR without setting env
  // vars — production is never 'preview', so prod stays dark.
  const suiteOn =
    process.env.NEXT_PUBLIC_SUITE === 'true' || process.env.VERCEL_ENV === 'preview';
  if (!suiteOn) notFound();

  const { eventId } = await params;
  const supabase = await createClient();

  // ── Event-type surface gating (0053) — same contract as the Studio hub. ────
  const profile = await resolveProfileByEvent(eventId);
  const surfaceOk = (a: AddOnEntry) => !a.surface || surfaceEnabled(profile, a.surface);

  // ── Bundle-aware ownership + live admin-catalog prices, one round-trip each
  // (mirrors the Studio hub exactly: ownership on the admin client so a co-host
  // who didn't place the order still counts as an owner; prices from the public
  // catalog; roadmap state powers the secretary strip). ──────────────────────
  const serviceKeys = Array.from(
    new Set(ADD_ONS.map((a) => a.serviceKey).filter((k): k is string => Boolean(k))),
  );
  const [{ active: ownedActive, pending: ownedPending }, { data: priceRows }, roadmapState] =
    await Promise.all([
      eventActiveSkus(createAdminClient(), eventId),
      supabase
        .from('platform_retail_catalog_v2')
        .select('service_code, retail_price_php')
        .in('service_code', serviceKeys),
      fetchRoadmapState(supabase, eventId, new Date()).catch(() => null),
    ]);

  const priceMap = new Map<string, string>();
  for (const r of priceRows ?? []) {
    if (r.service_code != null && r.retail_price_php != null) {
      priceMap.set(r.service_code as string, formatPhp(Number(r.retail_price_php)));
    }
  }

  function isOwned(entry: AddOnEntry): boolean {
    return entry.serviceKey ? ownedActive.has(entry.serviceKey) : false;
  }

  // Resolve the App Store-style pill (price/status) — identical rules to Studio.
  function pillFor(entry: AddOnEntry): RowPill {
    if (entry.status === 'coming_soon') return { text: 'Soon', tone: 'soon' };
    if (entry.serviceKey && ownedActive.has(entry.serviceKey))
      return { text: 'Active', tone: 'active' };
    if (entry.serviceKey && ownedPending.has(entry.serviceKey))
      return { text: 'Pending', tone: 'pending' };
    if (entry.tier === 'free') return { text: 'Free', tone: 'free' };
    if (entry.freeTrial) return { text: entry.freeTrial, tone: 'trial' };
    const price = entry.serviceKey ? priceMap.get(entry.serviceKey) : null;
    return { text: price ?? 'View', tone: 'price' };
  }

  // Owned services deep-link into the working tool; not-yet-owned open the
  // detail/learn-more route (opensDirect-aware) — same as the Studio hub.
  function cardHref(entry: AddOnEntry): string {
    return isOwned(entry) ? addOnHref(entry.key, eventId) : appStoreDetailHref(entry.key, eventId);
  }

  // ── The secretary's lead: the phase-aware "what to set up next" picks. ─────
  const monthsToDate = roadmapState?.months ?? null;
  const recommended = recommendStudioAddOns({
    monthsToDate,
    signals: roadmapState?.signals ?? null,
    completed: roadmapState?.completed ?? [],
    followRoadmap: profile.eventType === 'wedding',
    isEligible: (key) => {
      const e = ADD_ONS.find((a) => a.key === key);
      return e ? e.status !== 'coming_soon' && surfaceOk(e) : false;
    },
    isOwned: (key) => {
      const e = ADD_ONS.find((a) => a.key === key);
      return e ? isOwned(e) : false;
    },
    limit: 3,
  })
    .map((key) => ADD_ONS.find((a) => a.key === key))
    .filter((e): e is AddOnEntry => Boolean(e));

  const recommendLede =
    monthsToDate === null
      ? 'Great places to start while your date settles.'
      : monthsToDate > 6
        ? 'Where couples put their energy with this much time to go.'
        : monthsToDate > 3
          ? 'The pieces to line up as your day gets closer.'
          : 'Your last stretch — capture, and the day itself.';

  // ── Partition the catalog: what you own, what you can add, what's free. ────
  const eligible = ADD_ONS.filter((a) => surfaceOk(a) && a.studioGroup !== 'utility');
  const active = eligible.filter((a) => isOwned(a));
  const freeSkus = eligible
    .filter((a) => !isOwned(a) && a.tier === 'free' && a.status !== 'coming_soon')
    .slice()
    .sort(comingSoonLast);
  // "Add" = sellable (not owned, not a free tool) — grouped by outcome.
  const addable = eligible.filter(
    (a) => !isOwned(a) && a.tier !== 'free' && a.status !== 'coming_soon',
  );
  const addByOutcome: { group: StudioGroup; label: string; items: AddOnEntry[] }[] = (
    ['setnayan_ai', 'website', 'capture', 'branding'] as StudioGroup[]
  )
    .map((group) => ({
      group,
      label: OUTCOME_LABEL[group],
      items: addable.filter((a) => a.studioGroup === group).slice().sort(comingSoonLast),
    }))
    .filter((s) => s.items.length > 0);

  const rowFor = (a: AddOnEntry) => (
    <StudioAppRow
      key={a.key}
      href={cardHref(a)}
      label={a.label}
      blurb={a.blurb}
      Icon={a.Icon}
      gradient={a.poster.baseBackground}
      pill={pillFor(a)}
    />
  );

  const featuredFree = FREE_TOOLS.find((t) => t.featured);
  const stripFree = FREE_TOOLS.filter((t) => !t.featured);

  return (
    <section className="space-y-8">
      <header className="sn-reveal space-y-2">
        <p className="sn-eye">In-app services</p>
        <h1 className="sn-h1 mt-1.5">{SUITE_NAME}</h1>
        <p className="max-w-prose text-base text-ink/65">
          Everything for your day, in one room — what you have, what’s free, and what you
          can add. Start with what we suggest for where you are.
        </p>
      </header>

      {/* Secretary lead — the phase-aware next steps. */}
      {recommended.length > 0 ? (
        <section aria-label="Recommended for you now" className="space-y-3">
          <div>
            <p className="sn-eye">Recommended for you now</p>
            <p className="mt-1 text-sm text-ink/60">{recommendLede}</p>
          </div>
          <RevealList as="ul" className="sn-tile divide-y divide-ink/10 overflow-hidden p-0">
            {recommended.map((a) => (
              <StudioAppRow
                key={a.key}
                href={cardHref(a)}
                label={a.label}
                blurb={a.blurb}
                Icon={a.Icon}
                gradient={a.poster.baseBackground}
                pill={pillFor(a)}
              />
            ))}
          </RevealList>
        </section>
      ) : null}

      {/* Yours — what's already working for this event. */}
      {active.length > 0 ? (
        <section aria-label="Yours for this event" className="space-y-3">
          <div>
            <p className="sn-eye">Yours</p>
            <p className="mt-1 text-sm text-ink/60">Already working for your day.</p>
          </div>
          <RevealList as="ul" className="sn-tile divide-y divide-ink/10 overflow-hidden p-0">
            {active.map(rowFor)}
          </RevealList>
        </section>
      ) : null}

      {/* Add to your day — sellable features, grouped by outcome. */}
      {addByOutcome.length > 0 ? (
        <section aria-label="Add to your day" className="space-y-5">
          <div className="border-t border-ink/10 pt-6">
            <h2 className="sn-sec text-xl">Add to your day</h2>
            <p className="mt-1 max-w-prose text-sm text-ink/60">
              Grouped by what you get. Every price is live — no surprises.
            </p>
          </div>
          {addByOutcome.map(({ group, label, items }) => (
            <div key={group} className="space-y-3">
              <h3 className="sn-sec text-base">{label}</h3>
              <RevealList as="ul" className="sn-tile divide-y divide-ink/10 overflow-hidden p-0">
                {items.map(rowFor)}
              </RevealList>
            </div>
          ))}
        </section>
      ) : null}

      {/* Free to use — the complete free layer, every tool a real doorway. */}
      <section aria-label="Free to use" className="space-y-4">
        <div className="border-t border-ink/10 pt-6">
          <h2 className="sn-sec text-xl">Free to use</h2>
          <p className="mt-1 max-w-prose text-sm text-ink/60">
            Your planning tools and everything free — no purchase, all yours.
          </p>
        </div>

        {featuredFree ? (
          <StudioAppRow
            href={featuredFree.href(eventId)}
            label={featuredFree.label}
            blurb={featuredFree.blurb}
            Icon={featuredFree.Icon}
            gradient={featuredFree.gradient}
            pill={{ text: 'Free', tone: 'free' }}
          />
        ) : null}

        <RevealList as="ul" className="sn-tile divide-y divide-ink/10 overflow-hidden p-0">
          {stripFree.map((t) => (
            <StudioAppRow
              key={t.key}
              href={t.href(eventId)}
              label={t.label}
              blurb={t.blurb}
              Icon={t.Icon}
              gradient={t.gradient}
              pill={{ text: 'Free', tone: 'free' }}
            />
          ))}
          {freeSkus.map(rowFor)}
        </RevealList>
      </section>
    </section>
  );
}
