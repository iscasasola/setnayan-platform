import { notFound } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { CalendarDays, CalendarPlus, LogIn, Plus, Store, UserPlus } from 'lucide-react';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import { TEMPLATE_SUBLINE, TemplateSection } from '@/app/_components/template-rows';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { listHostEvents, coerceVendorCategory } from '@/lib/vendor-couple-invite';
import {
  VENDOR_CATEGORIES,
  VENDOR_CATEGORY_LABEL,
  type VendorCategory,
} from '@/lib/vendors';
import { getEventTypeVocab } from '@/lib/event-types-db';
import { formatEventDate } from '@/lib/events';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { isShopLive } from '@/lib/vendor-visibility';
import { SubmitButton } from '@/app/_components/submit-button';
import { claimVendorInviteToEvent } from './actions';

export const metadata = {
  title: 'Add a supplier to your plan',
  // Per-vendor invite landings shouldn't be indexed.
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ status?: string; et?: string; cat?: string }>;
};

const STATUS_COPY: Record<string, string> = {
  pick_event: 'Choose which event to add this supplier to.',
  not_your_event: 'That event isn’t one you host — pick one of yours.',
  not_found: 'This supplier link is no longer available.',
  error: 'Something went wrong adding the supplier. Please try again.',
};

/**
 * 🪤 `logo_url` DOES NOT ALWAYS HOLD A URL. It holds `r2://bucket/key` for
 * anything uploaded through the shop editor, and a browser cannot fetch that —
 * it renders a broken-image glyph, throws nothing, logs nothing. This is the
 * landing a couple reaches from the vendor's own Shortlist QR, so the logo is
 * the whole reason the page reads as coming from that vendor.
 *
 * Same shape as `app/v/[slug]/page.tsx`. Swallows presign failures on purpose:
 * the block already falls back to the neutral Store glyph, and a logo is
 * decoration — it must never take the invite down.
 */
async function resolveDisplayUrl(value: string | null | undefined): Promise<string | null> {
  try {
    return await displayUrlForStoredAsset(value);
  } catch {
    return null;
  }
}

export default async function VendorInvitePage({ params, searchParams }: Props) {
  const { slug } = await params;
  const { status, et, cat } = await searchParams;

  const admin = createAdminClient();
  const { data: vendor } = await admin
    .from('vendor_profiles')
    // The two liveness columns are spelled out rather than interpolated from
    // SHOP_LIVE_COLUMNS: a template literal costs PostgREST's literal-type
    // inference on the returned row. The constant remains the single place the
    // pair is NAMED, and `one-definition-of-live.test.ts` is what keeps a call
    // site from selecting only half of it.
    .select(
      'vendor_profile_id, business_name, tagline, logo_url, services, location_city, public_visibility, verification_state',
    )
    .eq('business_slug', slug)
    .maybeSingle();
  // 🚨 THIS LINE READ `!vendor.is_published` AND 404'd FOR EVERY VENDOR ALIVE.
  // Nothing in the approval flow writes that column — /admin/verify sets
  // public_visibility + verification_state and never touches it, so a fully
  // approved shop (the owner's own included, measured 2026-08-11) handed its
  // own customers a not-found page. See `isShopLive` for the whole story.
  //
  // The gate is deliberately NOT loosened: an unapproved shop still 404s here,
  // exactly as it does on its public shop page, because this screen publishes
  // the business name, logo, tagline and services to anyone holding the slug.
  // What changed is only WHICH definition of "approved" is asked.
  if (!vendor || !isShopLive(vendor)) notFound();

  // Resolved ONCE for this render — see resolveDisplayUrl: the stored value is
  // an `r2://` reference, not something an <img> can load.
  const logoDisplayUrl = await resolveDisplayUrl(vendor.logo_url);

  // The vendor's Shortlist QR can scope the invite to one of their service
  // categories (`cat`) and a target event-type (`et`). Validate both; an
  // invalid value falls back to the coarse coercion / no event context.
  const pickedCategory =
    cat && VENDOR_CATEGORIES.includes(cat as VendorCategory)
      ? (cat as VendorCategory)
      : null;
  const category =
    pickedCategory ?? coerceVendorCategory((vendor.services ?? []) as string[]);
  const categoryLabel =
    VENDOR_CATEGORY_LABEL[category as VendorCategory] ?? 'Supplier';

  const eventTypes = et ? await getEventTypeVocab() : [];
  const eventTypeLabel = et
    ? (eventTypes.find((t) => t.key === et)?.label ?? null)
    : null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const hostEvents = user ? await listHostEvents(admin, user.id) : [];
  // Preserve the QR's event/service scope across the sign-up + create-event
  // round-trips so the couple returns to the same scoped invite.
  const scopeQs = new URLSearchParams();
  if (et) scopeQs.set('et', et);
  if (cat) scopeQs.set('cat', cat);
  const scopeSuffix = scopeQs.toString() ? `?${scopeQs.toString()}` : '';
  const nextPath = `/vendor-invite/${slug}${scopeSuffix}`;
  const statusMessage = status ? STATUS_COPY[status] ?? null : null;

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8 sm:px-6">
      {/* Supplier identity — rule 13: the top of the page, on the warm surface. */}
      <div className="rounded-[var(--m-r-lg)] bg-[color:var(--m-paper-2)] p-6 text-center">
        {logoDisplayUrl ? (
          <Image
            src={logoDisplayUrl}
            alt={vendor.business_name}
            width={88}
            height={88}
            className="mx-auto h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-[color:var(--m-line)]">
            <Store aria-hidden className="h-8 w-8 text-[color:var(--m-slate-2)]" strokeWidth={1.5} />
          </div>
        )}
        <p className="mt-4 text-[13px] font-semibold text-[color:var(--m-slate-2)]">
          {categoryLabel} · invites you{eventTypeLabel ? ` · ${eventTypeLabel}` : ''}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">
          {vendor.business_name}
        </h1>
        {vendor.tagline ? (
          <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>{vendor.tagline}</p>
        ) : null}
        {vendor.location_city ? (
          <p className={`mt-1 ${TEMPLATE_SUBLINE}`}>{vendor.location_city}</p>
        ) : null}
      </div>

      {statusMessage ? (
        <p role="alert" className="mt-4 py-2 text-[14px] font-semibold" style={{ color: 'rgb(var(--color-warn))' }}>
          {statusMessage}
        </p>
      ) : null}

      {/* Action zone — depends on auth + event state. Rule 2: no card; the one next step is the main button. */}
      <div className="mt-4">
        {!user ? (
          // Signed out → sign up / sign in, returning to this page.
          <div className="space-y-3 text-center">
            <div className="flex justify-center text-[15px] font-semibold text-ink">
              <InfoTip label={`Save ${vendor.business_name} to your event`}>
                Create your free Setnayan plan — and manage your whole wedding in one place.
              </InfoTip>
            </div>
            <Link
              href={`/signup?as=couple&next=${encodeURIComponent(nextPath)}`}
              className={`${actionButtonClass('brand', { main: true })} w-full`}
              data-tone="brand"
              data-main=""
            >
              <UserPlus aria-hidden strokeWidth={1.9} />
              <span>Sign up free & add this supplier</span>
            </Link>
            <ActionButton
              tone="neutral"
              quiet
              icon={<LogIn aria-hidden />}
              label="I already have an account"
              href={`/login?next=${encodeURIComponent(nextPath)}`}
            />
          </div>
        ) : hostEvents.length === 0 ? (
          // Signed in, no event yet → create one, returning here to finish.
          <div className="space-y-3 text-center">
            <p className={TEMPLATE_SUBLINE}>
              Create your {eventTypeLabel ? `${eventTypeLabel.toLowerCase()} ` : ''}
              event first, then we’ll add {vendor.business_name} to its shortlist.
            </p>
            <Link
              href={`/dashboard/create-event?next=${encodeURIComponent(nextPath)}`}
              className={`${actionButtonClass('brand', { main: true })} w-full`}
              data-tone="brand"
              data-main=""
            >
              <CalendarPlus aria-hidden strokeWidth={1.9} />
              <span>Create your {eventTypeLabel ? `${eventTypeLabel.toLowerCase()} ` : ''}event</span>
            </Link>
          </div>
        ) : (
          // Signed in with events → pick which one to add the vendor to.
          <form action={claimVendorInviteToEvent} className="space-y-3">
            <input type="hidden" name="slug" value={slug} />
            {pickedCategory ? (
              <input type="hidden" name="cat" value={pickedCategory} />
            ) : null}
            {et ? <input type="hidden" name="et" value={et} /> : null}
            <TemplateSection label="Add to which event?" first>
              <fieldset className="[&>label+label]:border-t [&>label+label]:border-[color:var(--m-line)]">
                <legend className="sr-only">Add to which event?</legend>
                {hostEvents.map((ev, i) => (
                  <label
                    key={ev.event_id}
                    className="flex min-h-14 cursor-pointer items-center gap-3 py-2"
                  >
                    <input
                      type="radio"
                      name="event_id"
                      value={ev.event_id}
                      defaultChecked={i === 0}
                      className="h-5 w-5 accent-mulberry"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 truncate text-[15px] font-semibold text-ink">
                        <span className="truncate">{ev.display_name ?? 'Untitled event'}</span>
                        {ev.is_primary ? <Badge tone="quiet">Primary</Badge> : null}
                      </span>
                      <span className={`mt-0.5 flex items-center gap-1 ${TEMPLATE_SUBLINE}`}>
                        <CalendarDays aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                        {ev.event_date ? formatEventDate(ev.event_date, 'en-PH') : 'Date TBD'}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            </TemplateSection>
            <SubmitButton
              pendingLabel="Adding…"
              className={`${actionButtonClass('brand', { main: true })} w-full`}
            >
              Add {vendor.business_name} to my plan
            </SubmitButton>
            <div className="text-center">
              <ActionButton
                tone="neutral"
                quiet
                icon={<Plus aria-hidden />}
                label="or create a new event"
                href={`/dashboard/create-event?next=${encodeURIComponent(nextPath)}`}
              />
            </div>
          </form>
        )}
      </div>

      <p className={`mt-6 text-center ${TEMPLATE_SUBLINE}`}>
        Adding a supplier to your plan is free. You can remove them any time.
      </p>
    </div>
  );
}
