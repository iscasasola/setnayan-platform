'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { EditableRow, ServiceCoverageRow, type ProfileFieldData } from './editable-row';

/**
 * The interactive body of the My Shop → Profile panel (2026-07-02).
 *
 * Replaces the old read-only checklist (every row deep-linked to the full
 * /profile form) with in-place editing: each of the 8 profile-surface rows is an
 * `<EditableRow>` that expands into a one-field editor and auto-saves. Exactly
 * ONE row is open at a time (mirrors the ManageTiles one-open discipline a level
 * down). Verification documents are NOT a checklist item (2026-07-03) — they
 * live in the always-visible "Get verified" section below the Manage grid.
 *
 * Signature moment: the completeness bar + % (derived from `items`, which
 * revalidate after each save) sweeps forward as gaps close — the one animated
 * element on the surface.
 */
export function ProfileChecklistEditor({
  items,
  data,
  isVerified,
}: {
  items: BusinessProfileItem[];
  data: ProfileFieldData;
  isVerified: boolean;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  const done = items.filter((i) => i.ok).length;
  const total = items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {isVerified ? (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: 'color-mix(in srgb, var(--m-sage-deep) 12%, transparent)',
                color: 'var(--m-sage-deep)',
              }}
            >
              <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Verified
            </span>
          ) : (
            <span
              className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: 'var(--m-paper)', color: 'var(--m-slate-3)' }}
            >
              Unverified
            </span>
          )}
          <span className="text-xs tabular-nums" style={{ color: 'var(--m-slate)' }} aria-live="polite">
            {done} of {total} complete · {pct}%
          </span>
        </div>
        {/* Signature moment — the one animated element: the bar sweeps as gaps
            close (items revalidate after each inline save). Snaps under
            reduced-motion. */}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--m-line-soft)' }}
        >
          <span
            className="block h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%`, background: 'var(--m-orange)' }}
          />
        </div>
        {pct < 100 ? (
          <p className="text-xs" style={{ color: 'var(--m-slate-3)' }}>
            Fix each item right here — couples can see and contact you once your profile is complete.
          </p>
        ) : (
          <p
            className="inline-flex items-center gap-1 text-xs font-medium"
            style={{ color: 'var(--m-sage-deep)' }}
          >
            <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            All set — your profile is ready to publish.
          </p>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) =>
          // "Services covered" is taxonomy-driven — it jumps to the Coverage
          // flow instead of editing a column inline (owner 2026-07-03).
          item.key === 'services' ? (
            <ServiceCoverageRow key={item.key} item={item} count={data.services.length} />
          ) : (
            <EditableRow
              key={item.key}
              item={item}
              data={data}
              isOpen={openKey === item.key}
              onOpen={() => setOpenKey(item.key)}
              onClose={() => setOpenKey((cur) => (cur === item.key ? null : cur))}
              // Re-open after a rejected save ONLY if the user hasn't opened a
              // different row meanwhile — a late rejection must never steal the
              // open slot from (and force-commit) the row they moved to.
              onReopenAfterError={() => setOpenKey((cur) => (cur === null ? item.key : cur))}
            />
          ),
        )}
      </ul>
    </div>
  );
}
