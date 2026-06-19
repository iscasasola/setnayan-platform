/**
 * Shared vendor-verification document-slot card primitives.
 *
 * Extracted 2026-06-14 for the dashboard-consolidation dedup (Track A6).
 * The vendor submit surface (`app/vendor-dashboard/verify/page.tsx`) renders
 * one of these cards per `DOC_SLOTS` entry — a tile with the slot number/label
 * eyebrow, a completeness/kind badge, the hint copy, and a role-specific input
 * form. The card *shell* (everything except the input form) is presentation
 * shared by the whole 12-item checklist; this module owns it. The per-slot
 * input form (file upload / URL field / "Setnayan runs this" notice) differs
 * by slot kind and is passed in as `children`, so the submit-side action wiring
 * stays in the page.
 *
 * The admin review surface renders the same `DOC_SLOTS` as a compact read-only
 * `<details>` list (not cards) — genuinely different DOM, so it is intentionally
 * NOT routed through this module.
 *
 * No DOM change: reproduces the vendor page's existing card markup byte-for-byte.
 * Mirrors the role-parameterized pattern of
 * `app/_components/chat-message-stream.tsx`.
 */

import type { ReactNode } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { DOC_SLOTS, type DocSlot, type DocSlotKind } from '@/lib/vendor-verification';

/**
 * Completeness / kind badge for a doc slot. `complete` wins; otherwise the
 * badge reflects the slot kind (external = Setnayan-run, manual = Scheduled,
 * upload = Pending).
 */
export function SlotBadge({
  kind,
  complete,
}: {
  kind: DocSlotKind;
  complete: boolean;
}) {
  if (complete) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-success-800">
        <CheckCircle2 aria-hidden className="h-3 w-3" strokeWidth={2} />
        Complete
      </span>
    );
  }
  if (kind === 'external') {
    return (
      <span className="inline-flex rounded-full bg-warn-50 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-warn-800">
        Setnayan-run
      </span>
    );
  }
  if (kind === 'manual') {
    return (
      <span className="inline-flex rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
        Scheduled
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-full bg-ink/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-ink/65">
      Pending
    </span>
  );
}

/**
 * The doc-slot card shell: the bordered tile, the "Item N of N" eyebrow, the
 * slot label, the kind/completeness badge, and the hint line. The slot's input
 * form (which carries the submit-side server action) is passed as `children`.
 */
export function DocSlotCard({
  slot,
  complete,
  children,
}: {
  slot: DocSlot;
  /** Whether this slot's upload is already complete (drives border + badge). */
  complete: boolean;
  /** The role-specific input form for this slot. */
  children: ReactNode;
}) {
  return (
    <article
      className={`flex h-full flex-col gap-3 rounded-2xl border bg-cream p-4 ${
        complete ? 'border-success-300/60' : 'border-ink/10'
      }`}
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink/55">
            Item {slot.number} of {DOC_SLOTS.length}
          </p>
          <h3 className="mt-0.5 text-base font-semibold text-ink">
            {slot.label}
          </h3>
        </div>
        <SlotBadge kind={slot.kind} complete={complete} />
      </header>
      <p className="text-xs text-ink/65">{slot.hint}</p>

      {children}
    </article>
  );
}
