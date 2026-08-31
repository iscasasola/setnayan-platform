import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { manilaToday } from '@/lib/std-views';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';
import { isDataPrivacyControlActive } from '@/lib/data-privacy-controls';
import {
  DEPENDENT_KIND_LABELS,
  DEPENDENT_RELATIONSHIP_LABELS,
  isPersonDependent,
  type DependentKind,
} from '@/lib/dependent-people';
import {
  buildDependentTimeline,
  UNMEASURED_COPY,
  type TimelineEventRow,
  type TimelineGodparentRow,
  type TimelineShopRow,
} from '@/lib/dependent-timeline';
import { PageMasthead } from '@/app/_components/page-masthead';

export const metadata = {
  title: 'Alaga',
};

/**
 * /dashboard/people/[dependentId] — ONE alaga's own page.
 *
 * ── WHY THIS ROUTE DID NOT EXIST, AND WHAT ITS ABSENCE COST ────────────────
 * Measured on origin/main 2026-08-30: there was NO route to a dependent
 * anywhere under `apps/web/app`. An alaga was a row in a list and nothing more.
 * That is why a business had no timeline — and why a CHILD had none either, for
 * exactly the same reason. Building the page once answers both, which is why it
 * is written against the KIND rather than against businesses.
 *
 * ── THE GATE ───────────────────────────────────────────────────────────────
 * Same fail-closed pair the People page itself uses: `dependentPeopleEnabled()`
 * AND the `dependent_minor_profiles` control. ⚠ BOTH ARE ON IN PRODUCTION
 * (measured 2026-08-30, P0-b) — this ships to real users the moment it merges,
 * not into the dark. `notFound()` rather than a redirect: with the surface off,
 * this address should not exist.
 *
 * ── THE AUTHORIZATION IS RLS, DELIBERATELY ─────────────────────────────────
 * Every read here uses the USER's client. `dependents_owner_all` (+ the married-
 * household share) already decides who may see this row, so an id belonging to
 * someone else returns nothing and this page 404s. No admin client is
 * constructed anywhere in this file — a page that renders a whole person's
 * history is the last place to hold service-role rights.
 *
 * ── A REFUSED READ IS NOT AN EMPTY LIFE ────────────────────────────────────
 * Three of the four reads can be refused, and PostgREST returns `[]` when they
 * are — byte-identical to a genuinely new record. The timeline therefore takes
 * `null` for "we do not know" and hands back `unmeasured`, and this page RENDERS
 * that list. A log line never changed a pixel.
 */
export default async function DependentPage({
  params,
}: {
  params: Promise<{ dependentId: string }>;
}) {
  if (!dependentPeopleEnabled()) notFound();
  if (!(await isDataPrivacyControlActive('dependent_minor_profiles'))) notFound();

  const { dependentId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const { data: depRow, error: depError } = await supabase
    .from('dependents')
    .select(
      'dependent_id, name, dependent_kind, relationship, birth_date, created_at, handed_over_at, claimed_user_id, owner_user_id, vendor_profile_id',
    )
    .eq('dependent_id', dependentId)
    .maybeSingle();
  // ⚠ NOT the same as "no such alaga". A refused read must not render as a 404
  // that tells the owner their child's record is gone — but there is nothing to
  // draw either, so it is logged and 404s with the reason on the record.
  if (depError) {
    logQueryError('DependentPage.dependent', depError, { dependentId }, 'graceful_degrade');
  }
  if (!depRow) notFound();

  const dependent = depRow as {
    dependent_id: string;
    name: string;
    dependent_kind: DependentKind | null;
    relationship: string | null;
    birth_date: string | null;
    created_at: string;
    handed_over_at: string | null;
    claimed_user_id: string | null;
    owner_user_id: string;
    vendor_profile_id: string | null;
  };
  const isPerson = isPersonDependent(dependent.dependent_kind);

  // The events that NAME this alaga. RLS scopes `events` to the ones this
  // account is a member of, which is the same set the dashboard already shows.
  const { data: eventRows, error: eventsError } = await supabase
    .from('events')
    .select('event_id, display_name, event_type, event_date, created_at, archived')
    .eq('honoree_dependent_id', dependent.dependent_id)
    .order('created_at', { ascending: true });
  if (eventsError) {
    logQueryError('DependentPage.events', eventsError, { dependentId }, 'graceful_degrade');
  }
  const events = eventsError ? null : ((eventRows ?? []) as TimelineEventRow[]);

  // Ninong / ninang — the PERSON case only. A sari-sari store has none, so the
  // query is not even spent for the other kinds.
  let godparents: TimelineGodparentRow[] | null = [];
  if (isPerson) {
    const { data: gpRows, error: gpError } = await supabase
      .from('godparents')
      .select('godparent_id, godparent_name, role, created_at')
      .eq('dependent_id', dependent.dependent_id)
      .order('created_at', { ascending: true });
    if (gpError) {
      logQueryError('DependentPage.godparents', gpError, { dependentId }, 'graceful_degrade');
    }
    godparents = gpError ? null : ((gpRows ?? []) as TimelineGodparentRow[]);
  }

  // The shop this alaga IS, when open-shop made it. NULL here means EITHER not a
  // shop OR an unreadable one — `shopExpected` below is what tells those apart.
  let shop: TimelineShopRow | null = null;
  if (dependent.vendor_profile_id) {
    const { data: shopRow, error: shopError } = await supabase
      .from('vendor_profiles')
      .select('business_name, business_slug, created_at')
      .eq('vendor_profile_id', dependent.vendor_profile_id)
      .maybeSingle();
    if (shopError) {
      logQueryError('DependentPage.shop', shopError, { dependentId }, 'graceful_degrade');
    }
    shop = (shopRow as TimelineShopRow | null) ?? null;
  }

  const { entries, unmeasured } = buildDependentTimeline(
    {
      dependent: {
        name: dependent.name,
        dependent_kind: dependent.dependent_kind,
        birth_date: dependent.birth_date,
        created_at: dependent.created_at,
        handed_over_at: dependent.handed_over_at,
        vendor_profile_id: dependent.vendor_profile_id,
      },
      events,
      godparents,
      shop,
      shopExpected: !!dependent.vendor_profile_id,
    },
    manilaToday(),
  );

  const kind = (dependent.dependent_kind ?? 'person') as DependentKind;
  const subtitle =
    dependent.claimed_user_id === user.id
      ? 'You'
      : kind !== 'person'
        ? DEPENDENT_KIND_LABELS[kind]
        : dependent.relationship
          ? DEPENDENT_RELATIONSHIP_LABELS[
              dependent.relationship as keyof typeof DEPENDENT_RELATIONSHIP_LABELS
            ]
          : 'My alaga';

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/dashboard/people"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink/55 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        People
      </Link>
      <PageMasthead title={dependent.name} />
      <p className="-mt-4 text-sm text-ink/55">{subtitle}</p>

      {shop?.business_slug ? (
        <Link
          href={`/${shop.business_slug}`}
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-gold-deep underline-offset-2 hover:underline"
        >
          Visit the shop
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      ) : null}

      <section className="mt-8">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-ink/50">
          Timeline
        </h2>

        {/* ⚠ THE MEASUREMENT REACHES THE RENDER. Every refused read gets its own
            sentence here — the whole point of the `unmeasured` list. Without
            this the page would state a short history as though it were the
            complete one. */}
        {unmeasured.length > 0 ? (
          <div
            role="status"
            className="mb-4 rounded-md border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm text-terracotta-700"
          >
            {unmeasured.map((source) => (
              <p key={source}>{UNMEASURED_COPY[source]}</p>
            ))}
          </div>
        ) : null}

        {entries.length > 0 ? (
          <ol className="space-y-2.5">
            {entries.map((entry) => {
              const body = (
                <>
                  <p className="text-xs font-medium uppercase tracking-[0.1em] text-ink/45">
                    {entry.dateISO}
                    {entry.upcoming ? ' · upcoming' : ''}
                  </p>
                  <p className="mt-0.5 font-medium text-ink">{entry.label}</p>
                  {entry.detail ? (
                    <p className="text-xs text-ink/55">{entry.detail}</p>
                  ) : null}
                </>
              );
              return (
                <li
                  key={entry.id}
                  className="rounded-xl border border-ink/10 bg-ink/[0.015] px-4 py-3"
                >
                  {entry.href ? (
                    <Link className="block" href={entry.href}>
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ol>
        ) : (
          // Reachable only when nothing was refused — an alaga always has at
          // least the day it was added, so a truly empty list means the row's
          // own created_at was unparseable, not that nothing has happened.
          <p className="text-sm text-ink/55">
            Nothing on {dependent.name}&rsquo;s timeline yet.
          </p>
        )}
      </section>
    </div>
  );
}
