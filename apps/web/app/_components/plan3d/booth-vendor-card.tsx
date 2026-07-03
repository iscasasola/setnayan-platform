'use client';

/**
 * BoothVendorCard — the bottom-sheet (mobile) / right-drawer (desktop) that
 * opens when a guest taps a vendor booth in the 3D walk (Slice B, owner
 * interaction model 2026-07-03). Built on the shared `Sheet` primitive so it
 * inherits the app's overlay conventions: backdrop-tap + X to close, ESC, focus
 * trap, scroll-lock, and the mobile→desktop bottom-sheet→side-drawer layout.
 *
 * Content, in order:
 *   · the booth type + label (always).
 *   · the booked vendor's business name + logo (or initials) + category, when
 *     the booth is linked to an event_vendor (business identity only — zero PII).
 *   · the "what they're serving" offerings line, when set.
 *   · a "Walk to this booth" button — steers the walker to a point just in
 *     front of the booth, facing it (handled by the scene via `onWalkTo`).
 *
 * Unlinked booths just show label/type (+ offerings if the couple set one).
 * Pure presentational — the scene owns booth state + the walk-to action.
 */

import { useId, useMemo } from 'react';
import { Footprints, Store } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { boothTypeLabel, type Lab3DBooth } from '@/lib/seating-3d';

/** Two-letter initials fallback for a vendor with no logo. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '·';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** Title-case a raw vendor_category enum value ("mobile_bar" → "Mobile bar"). */
function prettyCategory(cat: string): string {
  const s = cat.replace(/_/g, ' ').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function BoothVendorCard({
  booth,
  onClose,
  onWalkTo,
}: {
  booth: Lab3DBooth | null;
  onClose: () => void;
  /** Steer the walker to a point in front of this booth, facing it. */
  onWalkTo: (booth: Lab3DBooth) => void;
}) {
  const headingId = useId();
  const vendor = booth?.vendor ?? null;
  const typeLabel = useMemo(() => (booth ? boothTypeLabel(booth.kind) : ''), [booth]);

  return (
    <Sheet open={booth != null} onClose={onClose} labelledById={headingId} title="Booth">
      {booth ? (
        <div className="flex flex-col gap-5 px-5 py-5">
          {/* Booth identity */}
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">{typeLabel}</p>
            <h2 id={headingId} className="mt-1 text-xl font-semibold leading-tight text-ink">
              {booth.label}
            </h2>
          </div>

          {/* Booked vendor — business identity only (name + logo + category). */}
          {vendor ? (
            <div className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-ink/[0.03] p-3">
              {vendor.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vendor.logoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-xl object-cover"
                  loading="lazy"
                />
              ) : (
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-terracotta/15 text-sm font-semibold text-terracotta">
                  {initials(vendor.name)}
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-[15px] font-semibold text-ink">{vendor.name}</p>
                <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-ink/55">
                  <Store aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                  {prettyCategory(vendor.category)}
                </p>
              </div>
            </div>
          ) : null}

          {/* Offerings — "what they're serving". */}
          {booth.offerings ? (
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink/45">
                What they&rsquo;re serving
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink/80">{booth.offerings}</p>
            </div>
          ) : null}

          {/* Walk-to action */}
          <button
            type="button"
            onClick={() => {
              onWalkTo(booth);
              onClose();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-medium text-cream transition-colors hover:bg-ink/90"
          >
            <Footprints aria-hidden className="h-4 w-4" strokeWidth={2} />
            Walk to this booth
          </button>
        </div>
      ) : null}
    </Sheet>
  );
}
