'use client';

/**
 * Card 14 Photobooths + Booths · client UI · multi-pick variant.
 *
 * 2026-05-25 (this commit) · the host now sees a labeled section PER
 * canonical sub-type (Cocktail bars · Photobooths · Coffee stations ·
 * Perfume bars · etc.) rather than two coarse buckets. Each section
 * carries its own short list of top-rated vendors with a [Lock] CTA.
 *
 * Same-sub-type compare gate · the picked-list summary now groups
 * locked booths by their booth_subtype snapshot (BOOTH_SUBTYPE:<canonical>
 * in notes) so a host who locked 1 photobooth + 1 cocktail bar + 1
 * coffee station sees three distinct groups instead of one mashed
 * "you've locked 3 booths" pile. Mirrors the owner directive
 * "only compare if same like photobooth to photobooth, cocktail bar to
 * cocktail bar, coffee station to coffee station" inside the booths
 * card's own multi-pick UX (the broader PlanCardCompare drawer doesn't
 * mount this card).
 *
 * The host can lock multiple booth vendors (mix of any sub-type) without
 * the wizard auto-advancing. Each [Lock] click calls lockBoothToEvent
 * which inserts an event_vendors row (mapping the canonical sub-type to
 * the coarse photobooth / mobile_bar enum + snapshotting the canonical
 * into notes) but does NOT touch wizard_state. The host clicks [I have
 * all the booths I need] to advance via the generic markTaskDone server
 * action.
 *
 * Layout sections, top → bottom:
 *   1. Picked list — if the host has already locked any booths, surface
 *      a per-sub-type grouped summary so they remember what's in.
 *   2. Per-canonical recommendation sections — only renders sections
 *      with ≥1 vendor in range; the rest are collapsed into the custom-
 *      booth form's category dropdown.
 *   3. Custom booth form — toggle reveals an inline form for off-platform
 *      vendors. Category picker required (specific canonical sub-type).
 *   4. [I have all the booths I need] CTA — calls markTaskDone with
 *      task_id='photobooths_booths'. Below it a polite escape hatch for
 *      hosts who intentionally go booth-less.
 *
 * NO LINKS to /vendors or /dashboard/[eventId]/vendors — every interaction
 * happens inside the card per the canonical wizard contract.
 */

import { useState, useTransition } from 'react';
import Image from 'next/image';
import {
  Lock,
  Plus,
  Star,
  Camera,
  Wine,
  CheckCircle2,
} from 'lucide-react';
import type { WizardVendorRec } from '@/lib/wizard-recommendations';
import { lockBoothToEvent, markTaskDone } from '../../wizard-actions';

export type BoothCategory = 'photobooth' | 'mobile_bar';

export type BoothSubtypeGroup = {
  /** Canonical_service value (e.g. 'photo_booth', 'mobile_bar', 'coffee_booth'). */
  canonical: string;
  /** Human label rendered as the section header (e.g. "Cocktail bars"). */
  label: string;
  /** Coarse event_vendors.category value this canonical maps to on lock. */
  category: BoothCategory;
  recs: ReadonlyArray<WizardVendorRec>;
};

type PickedBooth = {
  vendor_id: string;
  vendor_name: string;
  category: BoothCategory;
  marketplace_vendor_id: string | null;
  /** Canonical sub-type extracted from notes (BOOTH_SUBTYPE:<canonical>).
   *  null on legacy picks where the snapshot wasn't recorded — those fall
   *  back to a coarse-category bucket in the picked-list grouping. */
  booth_subtype: string | null;
};

type Props = {
  eventId: string;
  subtypeGroups: ReadonlyArray<BoothSubtypeGroup>;
  pickedBooths: ReadonlyArray<PickedBooth>;
};

/**
 * Best-available section label for the picked-list grouping. If we have
 * a recorded booth_subtype snapshot we use the matching group's label;
 * otherwise we fall back to a coarse "Photobooths" / "Cocktail bars &
 * other stations" label per the legacy category enum.
 */
function labelForPickedGroup(
  groupKey: string,
  subtypeGroups: ReadonlyArray<BoothSubtypeGroup>,
): string {
  if (groupKey === '__photobooth__') return 'Photobooths (unrecorded sub-type)';
  if (groupKey === '__mobile_bar__') return 'Cocktail bars & stations (unrecorded sub-type)';
  const group = subtypeGroups.find((g) => g.canonical === groupKey);
  return group?.label ?? groupKey.replace(/_/g, ' ');
}

/**
 * Returns the icon to use for a picked-list group · capture-shaped
 * sub-types get the Camera glyph, food/beverage sub-types get the Wine
 * glyph. Falls back to Camera for unknown groups.
 */
function iconForGroupKey(groupKey: string): typeof Camera {
  if (groupKey === '__mobile_bar__') return Wine;
  const beverages = new Set([
    'mobile_bar',
    'coffee_booth',
    'mocktail_bar',
    'tea_bar',
    'whiskey_cigar_bar',
    'mocktail_booth_mini',
    'live_cooking_station',
    'mini_lechon_station',
    'halo_halo_station',
    'ice_cream_cart',
    'sorbetes_cart',
    'crepe_pancake_station',
    'dessert_station',
    'cotton_candy_cart',
    'donut_wall_display',
    'food_cart_generic',
  ]);
  return beverages.has(groupKey) ? Wine : Camera;
}

export function PhotoboothsBoothsCardClient({
  eventId,
  subtypeGroups,
  pickedBooths,
}: Props) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingMarketplaceId, setPendingMarketplaceId] = useState<string | null>(
    null,
  );
  const [showCustom, setShowCustom] = useState(false);
  const [isMarkingDone, startMarkDoneTransition] = useTransition();
  const [, startLockTransition] = useTransition();

  function handleLockMarketplace(
    rec: WizardVendorRec,
    group: BoothSubtypeGroup,
  ) {
    setErrorMessage(null);
    setPendingMarketplaceId(rec.vendor_profile_id);

    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('booth_category', group.category);
    formData.set('booth_subtype', group.canonical);
    formData.set('marketplace_vendor_id', rec.vendor_profile_id);
    formData.set('vendor_name', rec.business_name);

    startLockTransition(async () => {
      try {
        await lockBoothToEvent(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock this booth. Try again or add them manually below.";
        setErrorMessage(message);
      } finally {
        setPendingMarketplaceId(null);
      }
    });
  }

  function handleMarkDone() {
    setErrorMessage(null);
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('task_id', 'photobooths_booths');

    startMarkDoneTransition(async () => {
      try {
        await markTaskDone(formData);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't advance — try again.";
        setErrorMessage(message);
      }
    });
  }

  // Build the picked-list grouping. Picks with a recorded booth_subtype
  // snapshot bucket under that canonical; legacy picks (no snapshot)
  // bucket under a coarse-category sentinel key.
  const pickedByGroup = new Map<string, PickedBooth[]>();
  for (const pick of pickedBooths) {
    const key =
      pick.booth_subtype ??
      (pick.category === 'photobooth' ? '__photobooth__' : '__mobile_bar__');
    const bucket = pickedByGroup.get(key) ?? [];
    bucket.push(pick);
    pickedByGroup.set(key, bucket);
  }
  // Ordered groups · honor BOOTH_CANONICALS ordering (via subtypeGroups),
  // then coarse-category sentinels last.
  const orderedPickedGroups: Array<{ key: string; picks: PickedBooth[] }> = [];
  for (const grp of subtypeGroups) {
    const picks = pickedByGroup.get(grp.canonical);
    if (picks && picks.length > 0) {
      orderedPickedGroups.push({ key: grp.canonical, picks });
    }
  }
  for (const sentinel of ['__photobooth__', '__mobile_bar__'] as const) {
    const picks = pickedByGroup.get(sentinel);
    if (picks && picks.length > 0) {
      orderedPickedGroups.push({ key: sentinel, picks });
    }
  }

  // Sections to render · skip groups with zero recommendations so the
  // card stays tight. Empty-state copy below the sections covers the
  // case where ZERO groups have vendors.
  const populatedGroups = subtypeGroups.filter((g) => g.recs.length > 0);
  const totalRecs = populatedGroups.reduce((n, g) => n + g.recs.length, 0);

  return (
    <div className="space-y-5">
      {/* Picked summary — surfaces above the recommendation lists so the
          host sees their progress at a glance. Grouped by sub-type per the
          2026-05-25 owner directive ("only compare if same like photobooth
          to photobooth"). */}
      {pickedBooths.length > 0 ? (
        <div className="rounded-xl border border-emerald-300/50 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2
              aria-hidden
              className="h-4 w-4 text-emerald-700"
              strokeWidth={2}
            />
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800">
              You&apos;ve locked {pickedBooths.length} booth
              {pickedBooths.length === 1 ? '' : 's'}
            </p>
          </div>
          <div className="mt-3 space-y-3">
            {orderedPickedGroups.map((g) => {
              const Icon = iconForGroupKey(g.key);
              return (
                <div key={g.key}>
                  <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-emerald-800/80">
                    {labelForPickedGroup(g.key, subtypeGroups)} · {g.picks.length}
                  </p>
                  <ul className="mt-1.5 flex flex-wrap gap-2">
                    {g.picks.map((pick) => (
                      <li
                        key={pick.vendor_id}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/40 bg-white px-3 py-1 text-xs text-ink"
                      >
                        <Icon
                          aria-hidden
                          className="h-3 w-3 text-emerald-700"
                          strokeWidth={2}
                        />
                        {pick.vendor_name}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-emerald-800/70">
            Manage these in your Vendors page later if you change your
            mind. Add more below or wrap up with the button at the bottom.
          </p>
        </div>
      ) : null}

      {/* Per-sub-type recommendation sections. Each section caps at 5 to
          keep the card scannable; sub-types with zero vendors in range
          are hidden (the host can still add them via the custom-booth
          form below if they have an off-platform vendor in mind). */}
      {populatedGroups.length > 0 ? (
        <div className="space-y-5">
          {populatedGroups.map((group) => {
            const Icon = iconForGroupKey(group.canonical);
            return (
              <div key={group.canonical}>
                <div className="mb-2 flex items-center gap-2">
                  <Icon
                    aria-hidden
                    className="h-3.5 w-3.5 text-terracotta"
                    strokeWidth={2}
                  />
                  <h4 className="font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta">
                    {group.label}
                  </h4>
                  <span className="ml-1 text-[10px] text-ink/45">
                    {group.recs.length} vendor{group.recs.length === 1 ? '' : 's'}
                  </span>
                </div>
                <ul className="divide-y divide-ink/10 overflow-hidden rounded-xl border border-ink/10 bg-white/60">
                  {group.recs.slice(0, 5).map((rec) => (
                    <BoothRecRow
                      key={rec.vendor_profile_id}
                      rec={rec}
                      subtypeLabel={group.label}
                      isPending={pendingMarketplaceId === rec.vendor_profile_id}
                      onLock={() => handleLockMarketplace(rec, group)}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-ink/15 bg-white/40 px-4 py-4 text-sm leading-relaxed text-ink/65">
          No booth vendors curated in your area yet across any sub-type.
          Add yours below — photobooths, cocktail bars, coffee stations,
          perfume bars, sorbetes carts, donut walls, and more all fit.
        </p>
      )}

      {totalRecs > 0 ? (
        <p className="text-[11px] text-ink/45">
          Showing the top vendors per sub-type within 10 km of your reception.
          {populatedGroups.length < subtypeGroups.length
            ? ' Other sub-types appear here once vendors join your area.'
            : ''}
        </p>
      ) : null}

      {errorMessage ? (
        <p
          role="alert"
          className="rounded-md border border-rose-300/60 bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {errorMessage}
        </p>
      ) : null}

      {/* Custom booth form */}
      <div className="border-t border-ink/10 pt-4">
        {!showCustom ? (
          <button
            type="button"
            onClick={() => setShowCustom(true)}
            className="inline-flex items-center gap-2 text-sm font-medium text-ink/70 transition-colors hover:text-ink"
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            Booked an off-platform booth? Add it
          </button>
        ) : (
          <CustomBoothForm
            eventId={eventId}
            subtypeGroups={subtypeGroups}
            onCancel={() => setShowCustom(false)}
            onError={(msg) => setErrorMessage(msg)}
          />
        )}
      </div>

      {/* Wrap-up CTA · advances the wizard */}
      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-5">
        <button
          type="button"
          onClick={handleMarkDone}
          disabled={isMarkingDone}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-lg bg-terracotta px-5 py-3 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={2} />
          {isMarkingDone
            ? 'Saving…'
            : pickedBooths.length > 0
              ? 'I have all the booths I need'
              : 'Skip · no booths for our wedding'}
        </button>
        {pickedBooths.length === 0 ? (
          <p className="text-xs text-ink/55">
            Going booth-less is fine. Pick at least one above or skip to
            move on.
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Single booth-recommendation row · logo + name + tagline + city + rating
 * + [Lock] button. Same shape as VendorPickCard's VendorRecRow but
 * dispatches lockBoothToEvent (multi-pick no-advance) instead of
 * completeVendorPickFromMarketplace.
 */
function BoothRecRow({
  rec,
  subtypeLabel,
  isPending,
  onLock,
}: {
  rec: WizardVendorRec;
  subtypeLabel: string;
  isPending: boolean;
  onLock: () => void;
}) {
  const ratingDisplay =
    rec.avg_rating_overall && rec.avg_rating_overall > 0
      ? rec.avg_rating_overall.toFixed(1)
      : null;
  const reviewCount = rec.review_count ?? 0;
  const isSetnayanPay = rec.ad_rank !== null && rec.ad_rank > 0;

  return (
    <li className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-cream/40 sm:px-5 sm:py-4">
      <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-terracotta/10">
        {rec.logo_url ? (
          <Image
            src={rec.logo_url}
            alt=""
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-display text-base italic text-terracotta/70">
            {rec.business_name.charAt(0)}
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-semibold text-ink sm:text-base">
            {rec.business_name}
          </p>
          {isSetnayanPay ? (
            <span
              title="Setnayan-Pay enabled"
              className="inline-flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-emerald-800"
            >
              Verified
            </span>
          ) : null}
        </div>
        {rec.tagline ? (
          <p className="mt-0.5 truncate text-xs text-ink/65 sm:text-sm">
            {rec.tagline}
          </p>
        ) : null}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-ink/55">
          {rec.location_city ? <span>{rec.location_city}</span> : null}
          {ratingDisplay ? (
            <span className="inline-flex items-center gap-0.5">
              <Star
                aria-hidden
                className="h-3 w-3 fill-current text-amber-500"
                strokeWidth={1.5}
              />
              {ratingDisplay}
              {reviewCount > 0 ? (
                <span className="ml-0.5 text-ink/45">({reviewCount})</span>
              ) : null}
            </span>
          ) : null}
          <span className="font-mono uppercase tracking-[0.12em] text-ink/40">
            {subtypeLabel}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={onLock}
        disabled={isPending}
        className="inline-flex min-h-[36px] flex-shrink-0 items-center justify-center gap-1.5 rounded-lg border border-terracotta bg-terracotta px-3 py-2 text-xs font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
      >
        {isPending ? (
          'Locking…'
        ) : (
          <>
            <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Lock
          </>
        )}
      </button>
    </li>
  );
}

/**
 * Inline custom booth form · captures vendor name + sub-type + optional
 * phone/email. Sub-type dropdown lists every booth canonical sourced from
 * the server-passed subtypeGroups so off-platform vendors land in the
 * correct picked-list group + their canonical is snapshotted to notes.
 */
function CustomBoothForm({
  eventId,
  subtypeGroups,
  onCancel,
  onError,
}: {
  eventId: string;
  subtypeGroups: ReadonlyArray<BoothSubtypeGroup>;
  onCancel: () => void;
  onError: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [vendorName, setVendorName] = useState('');
  // Default the picker to the first sub-type in the canonical ordering ·
  // typically `mobile_bar` which is the most common off-platform booth.
  const defaultSubtype = subtypeGroups[0]?.canonical ?? 'mobile_bar';
  const [boothSubtype, setBoothSubtype] = useState(defaultSubtype);
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (vendorName.trim().length === 0) {
      onError('Booth vendor name is required.');
      return;
    }
    const group = subtypeGroups.find((g) => g.canonical === boothSubtype);
    if (!group) {
      onError('Pick a booth type from the list.');
      return;
    }
    const formData = new FormData();
    formData.set('event_id', eventId);
    formData.set('booth_category', group.category);
    formData.set('booth_subtype', group.canonical);
    formData.set('vendor_name', vendorName);
    if (contactPhone.trim()) formData.set('contact_phone', contactPhone);
    if (contactEmail.trim()) formData.set('contact_email', contactEmail);

    startTransition(async () => {
      try {
        await lockBoothToEvent(formData);
        // Reset form fields so the host can quickly add another booth
        // without re-toggling the section. Keeps the multi-pick flow fast.
        setVendorName('');
        setContactPhone('');
        setContactEmail('');
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : "Couldn't lock this booth. Try again.";
        onError(message);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl bg-cream/60 p-4">
      <div>
        <label
          htmlFor="custom-booth-subtype"
          className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Type
        </label>
        <select
          id="custom-booth-subtype"
          value={boothSubtype}
          onChange={(e) => setBoothSubtype(e.target.value)}
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30 sm:max-w-md"
        >
          {subtypeGroups.map((group) => (
            <option key={group.canonical} value={group.canonical}>
              {group.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label
          htmlFor="custom-booth-name"
          className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
        >
          Vendor name <span className="text-rose-700">*</span>
        </label>
        <input
          id="custom-booth-name"
          type="text"
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
          required
          maxLength={128}
          placeholder="e.g. Smile Studio · 360 Photobooth"
          className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label
            htmlFor="custom-booth-phone"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Phone (optional)
          </label>
          <input
            id="custom-booth-phone"
            type="tel"
            value={contactPhone}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="0917…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
        <div>
          <label
            htmlFor="custom-booth-email"
            className="block font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55"
          >
            Email (optional)
          </label>
          <input
            id="custom-booth-email"
            type="email"
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            placeholder="hello@…"
            className="mt-1 w-full rounded-md border border-ink/15 bg-white px-3 py-2 text-sm placeholder-ink/35 focus:border-terracotta focus:outline-none focus:ring-2 focus:ring-terracotta/30"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-[40px] items-center gap-1.5 rounded-lg bg-terracotta px-4 py-2 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-700 focus:outline-none focus:ring-2 focus:ring-terracotta focus:ring-offset-2 focus:ring-offset-cream disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
          {isPending ? 'Locking…' : 'Lock this booth'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isPending}
          className="text-sm text-ink/55 transition-colors hover:text-ink disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
