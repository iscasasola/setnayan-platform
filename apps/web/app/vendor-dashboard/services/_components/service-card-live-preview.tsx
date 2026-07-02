'use client';

import { useEffect, useRef, useState } from 'react';
import { Star, Gift, Plus, AlertCircle, Lock, ImageIcon, CheckCircle2 } from 'lucide-react';

/**
 * Live service-card preview (v20 prototype — owner: "when we create a service
 * card, we want to see the exact card"). Renders INSIDE the create/edit form
 * and mirrors it as the vendor types: name, "from ₱X" anchor per pricing
 * basis, best discount badge, inclusions value story, add-ons floor,
 * not-included flags, and the Setnayan Exclusive teaser.
 *
 * HOW IT READS THE FORM: on mount it finds its closest <form> and snapshots
 * FormData on every input/change event — plus a light interval, because the
 * bracket/inclusion/discount editors write React-controlled HIDDEN inputs
 * whose updates fire no native DOM events. Purely presentational: it renders
 * no inputs of its own, so it adds nothing to the submitted payload.
 */

type Snapshot = {
  name: string;
  priceText: string;
  discountBadge: string | null;
  includesLine: string | null;
  notIncluded: string[];
  hasExclusive: boolean;
  hasCover: boolean;
};

function num(v: FormDataEntryValue | null | undefined): number | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().replace(/[^0-9.]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
function php(n: number): string {
  return `₱${Math.round(n).toLocaleString('en-PH')}`;
}

const DISCOUNT_LABEL: Record<string, string> = {
  early_booking: 'Early booking',
  off_peak: 'Off-peak',
  bundle: 'Bundle',
  promo: 'Promo',
  returning: 'Returning couple',
};

function readSnapshot(fd: FormData): Snapshot {
  const name = String(fd.get('title') ?? '').trim() || 'Untitled service';
  const basis = String(fd.get('pricing_basis') ?? 'fixed');

  // ── "from ₱X" anchor per basis (v20 priceText) ─────────────────────────
  let anchor: number | null = null;
  let priceText = 'from ₱—';
  if (basis === 'per_pax') {
    const rate = num(fd.get('per_pax_price_php'));
    const minPax = num(fd.get('min_pax'));
    if (rate != null) {
      anchor = minPax ? rate * minPax : rate;
      priceText = minPax
        ? `from ${php(rate * minPax)} · ${php(rate)}/guest`
        : `from ${php(rate)} / guest`;
    }
  } else if (basis === 'per_hour') {
    const base = num(fd.get('hour_base_php'));
    const minHrs = num(fd.get('min_hours'));
    const extra = num(fd.get('extra_hour_php'));
    if (base != null) {
      anchor = base;
      priceText =
        `from ${php(base)}` +
        (minHrs ? ` · ${minHrs}-hr min` : '') +
        (extra ? ` · +${php(extra)}/hr` : '');
    }
  } else {
    const bracketPrices = fd
      .getAll('bracket_price')
      .map((v) => num(v))
      .filter((n): n is number => n != null);
    const flat = num(fd.get('starting_price_php'));
    if (bracketPrices.length) {
      anchor = Math.min(...bracketPrices);
      priceText = `from ${php(anchor)}${bracketPrices.length > 1 ? ' · by pax' : ''}`;
    } else if (flat != null) {
      anchor = flat;
      priceText = `from ${php(flat)}`;
    }
  }

  // ── Best discount (couples see the single best one) ────────────────────
  const dTypes = fd.getAll('discount_type').map(String);
  const dRates = fd.getAll('discount_rate').map((v) => num(v));
  const dUnits = fd.getAll('discount_unit').map(String);
  let best: { label: string; savings: number } | null = null;
  for (let i = 0; i < dTypes.length; i++) {
    const type = dTypes[i];
    const rate = dRates[i] ?? null;
    if (!type || rate == null || rate <= 0) continue;
    const unit = dUnits[i] === 'php' ? 'php' : 'pct';
    const savings =
      unit === 'pct' ? ((anchor ?? 0) * rate) / 100 : Math.min(rate, anchor ?? rate);
    const label = `${DISCOUNT_LABEL[type] ?? type} · ${
      unit === 'pct' ? `${rate}% off` : `−${php(rate)}`
    }`;
    if (!best || savings > best.savings) best = { label, savings };
  }

  // ── Inclusions — the FREE value story ───────────────────────────────────
  const iLabels = fd.getAll('inclusion_label').map((v) => String(v).trim());
  const iWorths = fd.getAll('inclusion_worth').map((v) => num(v));
  const incNames: string[] = [];
  let worth = 0;
  for (let i = 0; i < iLabels.length; i++) {
    const label = iLabels[i];
    if (!label) continue;
    incNames.push(label);
    worth += iWorths[i] ?? 0;
  }
  const includesLine = incNames.length
    ? `Includes: ${incNames.slice(0, 3).join(' · ')}${incNames.length > 3 ? ` +${incNames.length - 3}` : ''}${
        worth > 0 ? ` · ${php(worth)} free` : ''
      }`
    : null;

  // ── Not-included flags ──────────────────────────────────────────────────
  const notIncluded: string[] = [];
  if (fd.get('crew_meal_included') !== 'on') notIncluded.push('crew meal');
  if (fd.get('transport_included') !== 'on') {
    const fee = num(fd.get('transport_flat_fee_php'));
    notIncluded.push(fee != null ? `transport (+${php(fee)})` : 'transport (by distance)');
  }

  return {
    name,
    priceText,
    discountBadge: best?.label ?? null,
    includesLine,
    notIncluded,
    hasExclusive: String(fd.get('exclusive_perk_text') ?? '').trim().length > 0,
    hasCover: String(fd.get('primary_photo_r2_key') ?? '').trim().length > 0,
  };
}

export function ServiceCardLivePreview({
  leafPathLabel,
  addonsFromPhp,
  initialCoverUrl,
}: {
  /** "Leaf · Parent" context line under the name (server-resolved). */
  leafPathLabel: string;
  /** Cheapest PAID add-on (server-known; the AddonsEditor manages its own forms). */
  addonsFromPhp?: number | null;
  /** Presigned/public URL of the current cover when editing; null on create. */
  initialCoverUrl?: string | null;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);

  useEffect(() => {
    const form = holderRef.current?.closest('form');
    if (!form) return;
    const read = () => {
      try {
        setSnap(readSnapshot(new FormData(form)));
      } catch {
        /* a mid-render read never breaks the form */
      }
    };
    read();
    form.addEventListener('input', read);
    form.addEventListener('change', read);
    // The list editors write React-controlled hidden inputs (no DOM events);
    // a light poll keeps the preview honest while the form is on screen.
    const tick = setInterval(read, 800);
    return () => {
      form.removeEventListener('input', read);
      form.removeEventListener('change', read);
      clearInterval(tick);
    };
  }, []);

  if (!snap) return <div ref={holderRef} aria-hidden />;

  return (
    <div ref={holderRef}>
      <div className="mb-1 flex items-center justify-between">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.13em]"
          style={{ color: 'var(--m-slate-3)' }}
        >
          Card preview · exactly what couples see
        </span>
      </div>
      <div
        className="flex items-start gap-3 rounded-2xl border p-3"
        style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper-2)' }}
      >
        <div
          className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg"
          style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-3)' }}
        >
          {initialCoverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={initialCoverUrl} alt="" className="h-full w-full object-cover" />
          ) : snap.hasCover ? (
            <CheckCircle2 aria-hidden className="h-6 w-6" strokeWidth={1.5} />
          ) : (
            <ImageIcon aria-hidden className="h-6 w-6" strokeWidth={1.5} />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
              {snap.name}
            </span>
            {snap.discountBadge ? (
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{ background: 'var(--m-sage)', color: 'var(--m-ink)' }}
              >
                {snap.discountBadge}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[11px]" style={{ color: 'var(--m-slate-2)' }}>
            {leafPathLabel}
          </p>
          <p className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1" style={{ color: 'var(--m-orange-2)' }}>
              <Star aria-hidden className="h-3 w-3" strokeWidth={1.75} /> 4.5
            </span>
            <span className="font-medium" style={{ color: 'var(--m-orange-2)' }}>
              {snap.priceText}
            </span>
          </p>
          {snap.includesLine ? (
            <p className="flex items-start gap-1 text-[11px] font-medium" style={{ color: 'var(--m-sage-deep, var(--m-ink))' }}>
              <Gift aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>{snap.includesLine}</span>
            </p>
          ) : null}
          {addonsFromPhp != null ? (
            <p className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--m-slate-3)' }}>
              <Plus aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Add-ons from +{php(addonsFromPhp)}
            </p>
          ) : null}
          {snap.notIncluded.length ? (
            <p
              className="flex items-start gap-1 rounded-md px-2 py-1 text-[11px]"
              style={{ background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }}
            >
              <AlertCircle aria-hidden className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>Not included: {snap.notIncluded.join(' · ')}</span>
            </p>
          ) : null}
          {snap.hasExclusive ? (
            <p className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--m-orange-2)' }}>
              <Lock aria-hidden className="h-3 w-3" strokeWidth={1.75} />
              Setnayan Exclusive inside · unlocked in chat
            </p>
          ) : null}
          <p className="flex items-center gap-2 pt-1">
            <span
              className="rounded-lg px-3 py-1.5 text-[11px] font-medium"
              style={{ background: 'var(--m-ink)', color: 'var(--m-paper)' }}
            >
              Request a quote
            </span>
            <span className="text-[10px]" style={{ color: 'var(--m-slate-3)' }}>
              final price by quote
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
