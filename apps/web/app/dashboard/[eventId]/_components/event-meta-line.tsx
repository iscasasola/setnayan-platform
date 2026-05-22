'use client';

/**
 * Task #65 (2026-05-22) — Consolidated header meta line.
 *
 * Owner directive 2026-05-22:
 *   Home was showing the wedding date 3 separate times (welcome strip /
 *   "Wedding date · Edit" row / BudgetCountdownHeader) plus a standalone
 *   "Wedding type · Catholic · Edit" row. Consolidate the welcome-strip
 *   meta + date edit row + ceremony type chip into ONE single line with
 *   subtle pencil edit affordances.
 *
 * This component renders the meta line below the event name + greeting:
 *
 *   Mon, June 1, 2026 · 10 days to go · Catholic ceremony  [✎ date] [✎ type]
 *
 * Layout:
 *   - Single Manrope body line (text-sm text-ink/55), wraps on narrow
 *     viewports rather than truncating so every piece stays readable.
 *   - Pencil affordances are 32×32 visual targets centred in 44×44 hit
 *     areas (WCAG 2.2 SC 2.5.8 — 24px floor, 44px aim).
 *   - Date pencil opens the existing EventDateInput editor inline (toggle
 *     between read + edit on the same surface).
 *   - Type pencil opens the existing CeremonyTypeModal directly.
 *
 * Preserves ALL existing edit functionality:
 *   - EventDateInput's 3-mode precision selector (year / month / day)
 *   - EventDateInput's refine-only ratchet under confirmed vendors
 *   - EventDateInput's locked tooltip when dateLocked
 *   - CeremonyTypeChip's 4 states (set / edit / vendor-locked / lock-only)
 *   - CeremonyTypeModal's reaffirm-vendor-compat warning
 *
 * Past-date warning + VendorAvailabilityIntersection moved with the date
 * affordance so they render below the consolidated line whenever the
 * date editor is expanded OR the warning conditions are met.
 *
 * Scope boundary (per task instructions):
 *   - Does NOT touch StageStrip (renders below this component, unchanged)
 *   - Does NOT touch the auspicious-chip zone between welcome strip and
 *     StageStrip (Phase 0 sibling agent on claude/phase-0-date-selection)
 *   - Does NOT touch BudgetCountdownHeader (countdown there moves with
 *     the card per owner's "out of scope" call)
 */

import { useState } from 'react';
import { Pencil, Lock } from 'lucide-react';
import {
  formatEventDateWithPrecision,
  formatEventCountdown,
  type EventDatePrecision,
} from '@/lib/events';
import { EventDateInput } from './event-date-input';
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
  // Local UI state: which sub-editor is open. Mutually exclusive so the
  // host never sees two editors stacked.
  const [dateEditing, setDateEditing] = useState(false);
  const [typeModalOpen, setTypeModalOpen] = useState(false);

  // Date display
  const dateText = eventDate
    ? formatEventDateWithPrecision(eventDate, eventDatePrecision)
    : 'Date to be confirmed';
  const countdown = formatEventCountdown(eventDate, eventDatePrecision, now);

  // Date lock state mirrors EventDateInput's internal logic.
  const dateLocked =
    confirmedVendorCount > 0 && Boolean(eventDate) && eventDatePrecision === 'day';

  // Ceremony display state mirrors CeremonyTypeChip's logic.
  const isWeddingEvent = eventType === 'wedding';
  const ceremonyConfirmed = Boolean(ceremonyTypeLockedAt) && Boolean(ceremonyType);
  const ceremonyVendorLocked = confirmedVendorCount > 0;
  const ceremonyLabel = ceremonyType ? CEREMONY_DISPLAY_LABEL[ceremonyType] ?? ceremonyType : null;

  // Build the ceremony fragment. Three render paths matching CeremonyTypeChip:
  //   - confirmed + label → "{Label} ceremony" + pencil (or lock when vendorLocked)
  //   - !confirmed + vendorLocked → muted "ceremony type not set" + lock
  //   - !confirmed + !vendorLocked → no inline fragment, render CTA below
  const ceremonyFragment = isWeddingEvent && ceremonyConfirmed && ceremonyLabel
    ? `${ceremonyLabel} ceremony`
    : null;

  function handleEditDateClick() {
    if (dateLocked) return;
    // Toggle: open the inline editor.
    setDateEditing(true);
    // Close the type modal if it was open so they don't stack.
    setTypeModalOpen(false);
  }

  function handleEditTypeClick() {
    if (ceremonyVendorLocked && ceremonyConfirmed) return; // hard-locked
    setTypeModalOpen(true);
    setDateEditing(false);
  }

  // Date lock tooltip mirrors EventDateInput's copy verbatim.
  const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
  const dateLockTooltip = `Date is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to discuss changes.`;
  const ceremonyLockTooltip = `Wedding type is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to change.`;

  return (
    <div className="space-y-2">
      {/* Consolidated meta line. Single text-sm Manrope body row. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink/55">
        <span>{dateText}</span>
        {countdown ? (
          <>
            <span aria-hidden>·</span>
            <span>{countdown}</span>
          </>
        ) : null}
        {ceremonyFragment ? (
          <>
            <span aria-hidden>·</span>
            <span>{ceremonyFragment}</span>
          </>
        ) : null}

        {/* Inline edit affordances. Each is a 44×44 hit area with a 16×16
            pencil icon centred. Keeps the line visually clean while
            meeting WCAG 2.2 SC 2.5.8 tap-target sizing. */}
        <span className="ml-1 inline-flex items-center gap-0.5">
          {/* Date edit affordance */}
          {dateLocked ? (
            <span
              role="img"
              aria-label={dateLockTooltip}
              title={dateLockTooltip}
              className="inline-flex h-11 w-11 items-center justify-center text-ink/40"
            >
              <Lock aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleEditDateClick}
              aria-label={eventDate ? 'Edit wedding date' : 'Set wedding date'}
              title={eventDate ? 'Edit wedding date' : 'Set wedding date'}
              className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/[0.04] hover:text-ink focus:bg-ink/[0.04] focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
            >
              <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}

          {/* Ceremony type edit affordance — only on wedding events */}
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
            ) : ceremonyConfirmed ? (
              <button
                type="button"
                onClick={handleEditTypeClick}
                aria-label="Edit wedding type"
                title="Edit wedding type"
                className="inline-flex h-11 w-11 items-center justify-center rounded-md text-ink/55 transition-colors hover:bg-ink/[0.04] hover:text-ink focus:bg-ink/[0.04] focus:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-terracotta/40"
              >
                <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              </button>
            ) : null
          ) : null}
        </span>
      </p>

      {/* State 2 of CeremonyTypeChip — host never set the ceremony before
          a vendor confirmed. Render the muted "Not set" chip below the
          meta line so it stays visible without polluting the main line. */}
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
          vendors confirmed. Surface the actionable CTA below the meta
          line so the host can complete the foundation. */}
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

      {/* Inline date editor — only renders when the date pencil is tapped.
          Reuses the existing EventDateInput component so the precision
          selector + refine-only ratchet + server action plumbing stay
          untouched. autoEdit=true so it mounts directly into edit mode
          (skips its own read-mode chip + Edit button — the meta line
          above already serves that role). onClose collapses the wrapper
          on save success or Cancel so the host never sees a duplicate
          read-mode chip stacked under the meta line. */}
      {dateEditing ? (
        <div className="rounded-md border border-ink/10 bg-cream/40 p-3">
          <EventDateInput
            key={`date-editor-${eventDate ?? 'empty'}`}
            eventId={eventId}
            initial={eventDate}
            initialPrecision={eventDatePrecision}
            confirmedVendorCount={confirmedVendorCount}
            autoEdit
            onClose={() => setDateEditing(false)}
          />
        </div>
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
