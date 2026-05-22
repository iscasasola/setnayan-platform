'use client';

/**
 * Task #43 (2026-05-22 evening) — Wedding-type chip on event home.
 *
 * REVERSES Task #37's set-once-immutable rule. New semantic mirrors the
 * wedding-date editor (PR #301): the foundation can be changed during
 * early planning (0 confirmed vendors) and locks the moment any vendor
 * commits to the booking.
 *
 * Four states:
 *   1. !ceremonyTypeLockedAt + 0 confirmed →
 *        terracotta "Set wedding type" CTA, opens modal.
 *   2. !ceremonyTypeLockedAt + ≥1 confirmed →
 *        muted Lock chip "Wedding type · Not set", tooltip points to
 *        support since the host never confirmed before vendors locked in.
 *   3. ceremonyTypeLockedAt + 0 confirmed → NEW post-Task-#43:
 *        editable chip "Wedding type · {Label}" with an Edit affordance
 *        that reopens the modal pre-populated with the current value.
 *   4. ceremonyTypeLockedAt + ≥1 confirmed →
 *        locked chip "Wedding type · {Label}" with Lock icon + tooltip
 *        explaining the vendor commitment locks the foundation.
 *
 * Rendered immediately under the wedding-date row in event home so the
 * two basics share visual weight + edit semantics.
 */

import { useState } from 'react';
import { Lock, Pencil, Sparkles, Sun } from 'lucide-react';
import { CeremonyTypeModal } from './ceremony-type-modal';

type Props = {
  eventId: string;
  eventType: string; // expect 'wedding' to render; other types return null
  ceremonyType: string | null;
  ceremonyTypeLockedAt: string | null;
  confirmedVendorCount: number;
};

const DISPLAY_LABEL: Record<string, string> = {
  catholic: 'Catholic',
  civil: 'Civil',
  inc: 'INC',
  christian: 'Christian',
  muslim: 'Muslim',
  cultural: 'Cultural',
  mixed: 'Mixed',
};

export function CeremonyTypeChip({
  eventId,
  eventType,
  ceremonyType,
  ceremonyTypeLockedAt,
  confirmedVendorCount,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (eventType !== 'wedding') return null;

  const isConfirmed = Boolean(ceremonyTypeLockedAt);
  const vendorLocked = confirmedVendorCount > 0;

  // State 4: Confirmed + vendor-locked. Read-only with Lock icon.
  if (isConfirmed && vendorLocked && ceremonyType) {
    const label = DISPLAY_LABEL[ceremonyType] ?? ceremonyType;
    const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-sm text-ink/70"
        title={`Wedding type is locked — ${confirmedVendorCount} confirmed ${noun}. Contact support to change.`}
      >
        <Lock aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
        <span>
          Wedding type · <strong className="font-medium text-ink">{label}</strong>
        </span>
      </div>
    );
  }

  // State 3: Confirmed + 0 vendors. Editable chip with Edit affordance.
  if (isConfirmed && ceremonyType) {
    const label = DISPLAY_LABEL[ceremonyType] ?? ceremonyType;
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          aria-label="Edit wedding type"
          className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-2.5 py-1 text-sm text-ink/70 transition hover:border-ink/30 hover:bg-ink/[0.03] hover:text-ink"
        >
          <Sun aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
          <span>
            Wedding type · <strong className="font-medium text-ink">{label}</strong>
          </span>
          <span className="ml-1 inline-flex items-center gap-1 text-xs text-ink/55">
            <Pencil aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Edit
          </span>
        </button>
        {modalOpen ? (
          <CeremonyTypeModal
            eventId={eventId}
            currentValue={ceremonyType}
            onClose={() => setModalOpen(false)}
          />
        ) : null}
      </>
    );
  }

  // State 2: Not confirmed + vendor has locked the foundation.
  if (vendorLocked) {
    const noun = confirmedVendorCount === 1 ? 'vendor' : 'vendors';
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border border-ink/15 bg-ink/[0.03] px-2.5 py-1 text-sm text-ink/60"
        title={`Type is locked because ${confirmedVendorCount} ${noun} confirmed. Contact support.`}
      >
        <Lock aria-hidden className="h-4 w-4 text-ink/50" strokeWidth={1.75} />
        <span>
          Wedding type · <span className="text-ink/70">Not set</span>
        </span>
      </div>
    );
  }

  // State 1: Actionable CTA.
  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="inline-flex items-center gap-2 rounded-md border border-terracotta/40 bg-terracotta/[0.06] px-2.5 py-1 text-sm text-terracotta hover:border-terracotta hover:bg-terracotta/[0.1]"
      >
        <Sparkles aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        <span>Set wedding type</span>
      </button>
      {modalOpen ? (
        <CeremonyTypeModal eventId={eventId} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  );
}
