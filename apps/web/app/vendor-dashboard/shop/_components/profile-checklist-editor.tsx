'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';

import type { BusinessProfileItem } from '@/lib/vendor-profile';
import { EditableRow, type ProfileFieldData } from './editable-row';

/**
 * The interactive body of the My Shop → Profile panel (2026-07-02).
 *
 * Replaces the old read-only checklist (every row deep-linked to the full
 * /profile form) with in-place editing: each of the 8 profile-surface rows is an
 * `<EditableRow>` that expands into a one-field editor and saves without leaving
 * the panel. Exactly ONE row is open at a time (mirrors the ManageTiles
 * one-open discipline a level down). The 9th item — business documents — is a
 * genuinely separate multi-file verification flow, so it stays a deep-link,
 * sequenced last and visually marked as the one step that lives elsewhere.
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
          item.surface === 'documents' ? (
            <DocumentsRow key={item.key} item={item} />
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

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link
          href="/vendor-dashboard/profile"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-terracotta hover:underline"
        >
          <ShieldCheck className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          Open the full profile editor
          <ArrowRight className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/**
 * The documents row — the one item that can't be edited in place (a separate
 * multi-file verification flow at /vendor-dashboard/verify). Rendered as an
 * honest deep-link, clearly the exception.
 */
function DocumentsRow({ item }: { item: BusinessProfileItem }) {
  return (
    <li
      className="flex items-center gap-3 rounded-lg border bg-white p-3"
      style={{ borderColor: 'var(--m-line)' }}
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={
          item.ok
            ? {
                background: 'color-mix(in srgb, var(--m-sage-deep) 14%, transparent)',
                color: 'var(--m-sage-deep)',
              }
            : { background: 'var(--m-orange-4)', color: 'var(--m-orange-2)' }
        }
      >
        {item.ok ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
        ) : (
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block truncate text-sm"
          style={{ color: item.ok ? 'var(--m-slate)' : 'var(--m-ink)' }}
        >
          {item.label}
        </span>
        <span className="block truncate text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Verified separately
        </span>
      </span>
      {item.ok ? (
        <span className="shrink-0 text-xs" style={{ color: 'var(--m-slate-3)' }}>
          Documents in
        </span>
      ) : (
        <Link
          href="/vendor-dashboard/verify"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-terracotta transition-colors hover:bg-[color:var(--m-orange-4)]"
        >
          Upload
          <ArrowRight className="h-3 w-3" strokeWidth={2} aria-hidden />
        </Link>
      )}
    </li>
  );
}
