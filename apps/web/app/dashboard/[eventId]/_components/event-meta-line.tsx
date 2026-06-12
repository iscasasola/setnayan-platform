'use client';

/**
 * Task #65 (2026-05-22) — Consolidated header meta line.
 * Amended 2026-05-22 — duplicate date removed; AuspiciousChip is now the
 * canonical date display + edit entry point.
 *
 * Owner directive 2026-05-22 verbatim:
 *   "there are 2 wedding dates. maybe we can remove the lower one and
 *   just show the countdown for that and stay uneditable?"
 *
 * Two surfaces previously showed the wedding date on event home:
 *   1. AuspiciousChip (PR #333 · Phase 0) — "YOUR DATE · {formatted} ·
 *      See why this date works ▸" pill. Routes to /date-selection.
 *   2. EventMetaLine (PR #339) — formatted date + countdown + ceremony
 *      type with inline pencils.
 *
 * AuspiciousChip wins as canonical because it routes hosts into the full
 * Phase 0 surface (auspicious reasoning + calendar picker) instead of an
 * inline editor. EventMetaLine now shows only:
 *
 *   210 days to go
 *   {Catholic ceremony [✎]} OR {Set wedding type CTA} OR {Wedding type not set lock}
 *
 * What stayed:
 *   - Countdown string from formatEventCountdown()
 *   - Ceremony-type chip + pencil + CeremonyTypeModal (all four states
 *     preserved: confirmed-editable, confirmed-vendor-locked, not-set
 *     vendor-locked, not-set CTA)
 *
 * What was removed:
 *   - Formatted date string (lives in AuspiciousChip above)
 *   - Date edit pencil button + locked-Lock icon variant
 *   - `dateEditing` local state
 *   - Inline <EventDateInput> render with autoEdit + onClose
 *   - `formatEventDateWithPrecision` + `EventDateInput` imports
 *   - `dateLocked` derivation (no longer needed without the pencil)
 *
 * Date edits now flow exclusively through:
 *   AuspiciousChip → /dashboard/[eventId]/date-selection
 *
 * The countdown row is uneditable by design — it reflects the host's
 * chosen date but is not a date-entry surface.
 *
 * Scope boundary:
 *   - Does NOT touch StageStrip (renders below this component, unchanged)
 *   - Does NOT touch AuspiciousChip (sibling above in page.tsx)
 *   - Does NOT touch BudgetCountdownHeader (out of scope per Task #65)
 */

import { useState } from 'react';
import { Pencil, Lock } from 'lucide-react';
import {
  formatEventCountdown,
  type EventDatePrecision,
} from '@/lib/events';
import { CeremonyTypeModal } from './ceremony-type-modal';

type Props = {
  eventId: string;
  eventDate: string | null;
  eventDatePrecision: EventDatePrecision;
  eventType: string;
  ceremonyType: string | null;
  ceremonyTypeLockedAt: string | null;
  confirmedVendorCount: number;
  now: Date;
};

const CEREMONY_DISPLAY_LABEL: Record<string, string> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  aglipayan: 'Aglipayan (IFI)',
  lds: 'LDS (Latter-day Saints)',
  sda: 'Seventh-day Adventist',
  jw: "Jehovah's Witnesses",
  hindu: 'Hindu',
  sikh: 'Sikh',
  buddhist: 'Buddhist',
  orthodox: 'Orthodox Christian',
  mixed: 'Mixed',
};

export function EventMetaLine({
  eventId,
  eventDate,
  eventDatePrecision,
  eventType,
  ceremonyType,
  ceremonyTypeLockedAt,
  confirmedVendorCount,
  now,
}: Props) {
  // Local UI state: ceremony modal only — date editing migrated to
  // AuspiciousChip → /date-selection.
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // Countdown is the only date-derived value rendered here. Returns null
  // when the date is unset OR too distant for a meaningful countdown
  // (e.g. year-precision 2+ years out) — in which case the line hides
  // entirely and AuspiciousChip carries the call-to-action above.
  const countdown = formatEventCountdown(eventDate, eventDatePrecision, now);

  // Ceremony display state mirrors CeremonyTypeChip's logic.
  const isWeddingEvent = eventType === 'wedding';
  const ceremonyConfirmed = Boolean(ceremonyTypeLockedAt) && Boolean(ceremonyType);
  const ceremonyVendorLocked = confirmedVendorCount > 0;
  const ceremonyLabel = ceremonyType ? CEREMONY_DISPLAY_LABEL[ceremonyType] ?? ceremonyType : null;

  // Build the ceremony fragment. Two inline-render paths:
  //   - confirmed + label → "{Label} ceremony" + pencil (or lock when vendorLocked)
  //   - everything else → handled by the chips/CTAs below the countdown row
  const ceremonyFragment =
    isWeddingEvent && ceremonyConfirmed && ceremonyLabel ? `${ceremonyLabel} ceremony` : null;

  function handleEditTypeClick() {
    if (ceremonyVendorLocked && ceremonyConfirmed) return; // hard-locked
    setTypeModalOpen(true);
  }

  // Ceremony lock tooltip copy.
  const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
  const ceremonyLockTooltip = `Wedding type is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to change.`;

  return (
    <div className="space-y-2">
      {/* Countdown-only row. Renders only when formatEventCountdown returns
          a non-null string (date is set AND not too distant). When the
          date isn't set, AuspiciousChip above carries the call-to-action,
          so this row stays hidden rather than rendering an empty surface. */}
      {countdown ? (
        <p className="text-sm text-ink/55">
          <span>{countdown}</span>
          {ceremonyFragment ? (
            <>
              <span aria-hidden className="mx-2">
                ·
              </span>
              <span>{ceremonyFragment}</span>
              {/* Ceremony type edit affordance — only on wedding events,
                  inline next to the ceremony fragment. */}
              {isWeddingEvent ? (
                ceremonyVendorLocked && ceremonyConfirmed ? (
                  <span
                    role="img"
                    aria-label={ceremonyLockTooltip}
                    title={ceremonyLockTooltip}
                    className="ml-1 inline-flex h-11 w-11 items-center justify-center text-ink/40 align-middle"
                  >
                    <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleEditTypeClick}
                    aria-label="Edit wedding type"
                    title="Edit wedding type"
                    className="ml-1 inline-flex h-11 w-11 items-center justify-center rounded-md text-ink/55 transition-colors align-middle hover:bg-ink/[0.04] hover:text-ink focus:bg-ink/[0.04] focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
                  >
                    <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )
              ) : null}
            </>
          ) : null}
        </p>
      ) : null}

      {/* Ceremony fragment when countdown is null (no date or too distant)
          — surface the ceremony chip on its own line so it stays visible
          regardless of date state. Only renders when the ceremony is
          confirmed; the not-set cases render their own CTA/lock chips
          below. */}
      {!countdown && ceremonyFragment ? (
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/55">
          <span>{ceremonyFragment}</span>
          {isWeddingEvent ? (
            ceremonyVendorLocked && ceremonyConfirmed ? (
              <span
                role="img"
                aria-label={ceremonyLockTooltip}
                title={ceremonyLockTooltip}
                className="inline-flex h-11 w-11 items-center justify-center text-ink/40"
              >
                <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              </span>
            ) : (
              <button
                type="button"
                onClick={handleEditTypeClick}
                aria-label="Edit wedding type"
                title="Edit wedding type"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/[0.04] hover:text-ink focus:bg-ink/[0.04] focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
              >
                <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )
          ) : null}
        </p>
      ) : null}

      {/* Date editor removed (PR #359). The date is owned by AuspiciousChip
          above this component, and edits flow through it to
          /dashboard/[eventId]/date-selection. PR #359 removed the
          `dateEditing` state + EventDateInput import + helper handlers but
          left this orphan JSX block in place by accident — fixed in Task #67
          (PR #361) which lands alongside the AuspiciousChip date-detection
          fix because both surfaces are the canonical date surface and need
          to land coherently. Per CLAUDE.md 2026-05-22 + [[feedback_setnayan_senior_dev_persona]]
          (verify before recommend) + [[feedback_setnayan_orphan_prevention]]
          (no orphan JSX referencing removed state). */}

      {/* State 2 of CeremonyTypeChip — host never set the ceremony before
          a vendor confirmed. Render the muted "Not set" chip so the
          locked state stays surfaced without polluting the main line. */}
      {isWeddingEvent && !ceremonyConfirmed && ceremonyVendorLocked ? (
        <div
          className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-xs text-ink/60"
          title={`Type is locked because ${confirmedVendorCount} ${noun} confirmed. Contact support.`}
        >
          <Lock aria-hidden className="h-3.5 w-3.5 text-ink/50" strokeWidth={1.75} />
          <span>Wedding type not set</span>
        </div>
      ) : null}

      {/* State 1 of CeremonyTypeChip — host hasn't set ceremony yet, no
          vendors confirmed. Surface the actionable CTA so the host can
          complete the foundation. */}
      {isWeddingEvent && !ceremonyConfirmed && !ceremonyVendorLocked ? (
        <button
          type="button"
          onClick={handleEditTypeClick}
          className="inline-flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta/[0.06] px-2.5 py-1 text-xs text-terracotta hover:border-terracotta hover:bg-terracotta/[0.1]"
        >
          <Pencil aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span>Set wedding type</span>
        </button>
      ) : null}

      {/* Ceremony modal */}
      {typeModalOpen ? (
        <CeremonyTypeModal
          eventId={eventId}
          currentValue={ceremonyType ?? undefined}
          onClose={() => setTypeModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
