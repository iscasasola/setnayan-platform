'use client';

/**
 * HostServiceDetails — the DIY-parity editor for a MANUAL (off-platform)
 * vendor's package (owner doctrine 2026-06-11: pure-DIY planning must let the
 * host "add information about their order… what's included on their service.
 * link other services to it as well.").
 *
 * Renders in the workspace's "What's included" slot when the booking has no
 * vendor-authored package. Two host-authored fields, saved together:
 *   1. Inclusions — free-text lines ("Full-day coverage", "2 photographers").
 *      Flow to Compare's expandable inclusions cell.
 *   2. Also covers — the Suppliers page's own rows ("my caterer includes the
 *      cake", "Dunkin' is our food truck"). Since 2026-10-20 it is the SAME
 *      `ServicesCoveredPicker` the card sheet uses, fed the page's rows
 *      (`readCoverCatalog`) — it was a wall of ~30 plan-group chips that could
 *      not name Food Truck at all. A ticked row draws the card under it.
 *
 * Marketplace vendors never see this editor — their package/links are
 * vendor-authored (the server action is manual-only too).
 */

import { useState, useTransition } from 'react';
import { Check, Link2, Package as PackageIcon } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { updateHostServiceDetails } from '../actions';
import { useSaveLoader } from '@/components/sd-loader';
import { ServicesCoveredPicker } from '@/app/dashboard/[eventId]/_components/services-covered-picker';
import type { CoverCatalogFolder } from '@/lib/shortlist-taxonomy';

export function HostServiceDetails({
  eventId,
  vendorId,
  displayName,
  initialInclusions,
  initialCovers,
  category,
  homeTile,
  claimAsk,
  ownLabel,
  catalog,
}: {
  eventId: string;
  vendorId: string;
  /** Only for the copy — omitted renders a neutral "they handle". */
  displayName?: string;
  initialInclusions: string[];
  initialCovers: string[];
  /** The booking's own category — its row is said locked, never offered. */
  category: string;
  /** The row the card is drawn under (`homeTileForRow`) — a moved supplier's may be finer than `category`. */
  homeTile?: string | null;
  /** They claimed the couple's link and wait for Approve — the move's confirm says what Approve will give. */
  claimAsk?: boolean;
  ownLabel: string;
  /** The Suppliers page's rows; omitted (a failed read) → the picker reads them itself. */
  catalog?: readonly CoverCatalogFolder[];
}) {
  const [pending, startTransition] = useTransition();
  const [text, setText] = useState(initialInclusions.join('\n'));
  // The picker owns which rows are ticked; this keeps the keys it reports, and
  // starts from the stored set so a save without touching it changes nothing.
  const [covers, setCovers] = useState<readonly string[]>(initialCovers);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const save = useSaveLoader();

  function onSave() {
    setErr(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        fd.set('inclusions', text);
        // ⚖ THE LOCKED OWN-GROUP IS NOT PERSISTED. It is already implied by
        // `event_vendors.category`; the chip states the fact on screen and the
        // column keeps meaning "ALSO covers". `bucketForVendor` files the money
        // by the row's own category and never under an ALSO-covered group
        // (`isHomeGroupFor`, 2026-09-21), so what is sent here cannot move it.
        for (const c of covers) fd.append('covers', c);
        await save.run(() => updateHostServiceDetails(fd), {
          steps: ['Saving service details'],
          hint: 'Saving',
        });
        setSaved(true);
      } catch {
        setErr('Could not save — try again.');
      }
    });
  }

  return (
    // 📐 DESIGN TEMPLATE (14 Nov 2026, rules 1 · 2 · 3 · 7 · 13 · 15): no card and no serif heading — the section's
    // grey capitals, each explaining line behind its ⓘ, the shared pill to save (grey while it saves, no spinner).
    <section aria-labelledby="included-heading">
      <h2 id="included-heading" className="mb-3 mt-[18px] flex items-center gap-2">
        <PackageIcon aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={1.75} />
        <InfoTip label="What’s included" labelAs="span" labelClassName="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70" align="start">
          You booked them outside Setnayan — describe the package so your plan stays complete.
        </InfoTip>
      </h2>

      <label
        htmlFor="host-inclusions"
        className="block text-[13px] font-semibold text-ink"
      >
        Inclusions <span className="font-normal text-ink/70">(one per line)</span>
      </label>
      <textarea
        id="host-inclusions"
        rows={4}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSaved(false);
        }}
        placeholder={'e.g.\nFull-day coverage\n2 photographers\nSame-day edit'}
        className="mt-1.5 w-full rounded-lg border border-ink/15 bg-cream px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-terracotta focus:outline-none"
        disabled={pending}
      />

      <p className="mt-4 flex items-center gap-1.5">
        <Link2 aria-hidden className="h-4 w-4 text-ink/70" strokeWidth={1.9} />
        <InfoTip label="What services does this cover" labelAs="span" labelClassName="text-[13px] font-semibold text-ink" align="start">
          Pick every category {displayName ? `${displayName} handles` : 'they handle'} — one booking, one price, counted
          once across all of them. Covered categories show on your shortlist card as &ldquo;✓ comes with&rdquo;.
        </InfoTip>
      </p>
      <div className="mt-2">
        <ServicesCoveredPicker
          eventId={eventId}
          category={category}
          homeTile={homeTile}
          ownLabel={ownLabel}
          catalog={catalog}
          initialSelected={initialCovers}
          disabled={pending}
          onChange={(keys) => {
            setCovers(keys);
            setSaved(false);
          }}
          // "Move <name> to another category" (owner 2026-10-20). The move is
          // its own write, and it revalidates: the header names the new row on
          // the action's own answer (no second render).
          move={{ vendorId, name: displayName?.trim() || 'This supplier', claimAsk }}
        />
      </div>

      {err ? (
        <p role="alert" className="mt-3 text-[13px] text-[rgb(var(--color-danger))]">
          {err}
        </p>
      ) : null}

      <div className="mt-4 flex items-center gap-3">
        <ActionButton
          tone="brand"
          main
          icon={Check}
          label={pending ? 'Saving…' : 'Save details'}
          onClick={onSave}
          waiting={pending}
        />
        {saved ? (
          <span className="inline-flex items-center gap-1 text-[13px] text-success-800">
            <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.2} />
            Saved — your card and Compare are up to date.
          </span>
        ) : null}
      </div>
    </section>
  );
}
