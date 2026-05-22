'use client';

/**
 * Task #37 (2026-05-22) — Wedding-type chip on event home.
 *
 * Three states:
 *   1. unlocked + 0 confirmed vendors → terracotta "Set wedding type" CTA
 *      that opens the modal.
 *   2. unlocked + ≥1 confirmed vendor → muted Lock chip ("Wedding type ·
 *      Not set"), tooltip explains support-mediated change.
 *   3. locked → muted outline chip ("Wedding type · {DisplayLabel}"),
 *      no click. Immutable per spec.
 *
 * Rendered immediately under the wedding-date row in event home so the
 * two basics share visual weight.
 */

import { useState } from 'react';
import { Lock, Sparkles, Sun } from 'lucide-react';
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

  const isLocked = Boolean(ceremonyTypeLockedAt);
  const vendorBlocked = !isLocked && confirmedVendorCount > 0;

  // State 3: Locked / read-only.
  if (isLocked && ceremonyType) {
    const label = DISPLAY_LABEL[ceremonyType] ?? ceremonyType;
    return (
      <div
        className="inline-flex items-center gap-2 rounded-md border border-ink/15 px-2.5 py-1 text-sm text-ink/70"
        title="Wedding type was set and is permanent. Contact support if there is a genuine reason to change it."
      >
        <Sun aria-hidden className="h-4 w-4 text-ink/55" strokeWidth={1.75} />
        <span>
          Wedding type · <strong className="font-medium text-ink">{label}</strong>
        </span>
      </div>
    );
  }

  // State 2: Unlocked but a vendor has confirmed. Muted lock chip.
  if (vendorBlocked) {
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
