'use client';

// Explicit "+" composer entry (negotiation rework · council verdict 2026-07-24).
// Above the message box, a "+" opens two deliberate choices — "Send a deal" and
// "Request a meeting" — so a structured card can be created without waiting for
// the auto-suggest chip to fire. Reuses the same server actions + builder the
// chips use. Flag-gated; nothing renders when the negotiation flag is off.
//
// Owner's two entry points stand (the verdict's "OWNER DECISIONS": the "+" AND
// the auto-suggest chip). What changed on 2026-09-19 is only WHEN "Send a deal"
// is offered: a Deal is "current total → changes → new total", so with no quote
// on the thread it is withheld (`entry.offerDeal`, from `lib/deal-entry.ts`).
// Request a meeting is never withheld.

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { chatNegotiationEnabled } from '@/lib/chat-negotiation-flag';
import { AmendmentBuilder } from './amendment-builder';
import { createAmendmentFromChat, createScheduleRequestFromChat } from './negotiation-actions';
import { revealThreadTool } from './chat/reveal-thread-tool';
import type { DealEntry } from '@/lib/deal-entry';
import {
  TIME_SLOTS,
  todayIsoLocal,
  dayBeforeEventIso,
} from '@/lib/appointment-slots';
import { APPOINTMENT_KINDS, APPOINTMENT_KIND_LABEL, type AppointmentKind } from '@/lib/appointments';

type Mode = null | 'menu' | 'deal' | 'meeting';

export function NegotiationComposerMenu({
  threadId,
  returnPath,
  eventDate,
  initialMode = null,
  embedded = false,
  entry,
}: {
  threadId: string;
  /** `dealEntryFor(...)` for this thread — whether "Send a deal" is offered at all. */
  entry: DealEntry;
  returnPath: string;
  eventDate: string | null;
  /**
   * Opens straight into a mode. `?compose=deal` sets this, which is how the
   * Counter-offer button on a quote card reaches the amendment builder — the
   * builder has existed for some time behind "Deal or meeting", below the fold
   * and named after neither countering nor quoting.
   */
  initialMode?: 'deal' | 'meeting' | null;
  /**
   * Mounted inside a tool panel the page already opened (One Chat Box,
   * 2026-09-18). The panel's own header names it and carries Close, so the
   * "+ Deal or meeting" pill would be a second door inside the first: the two
   * choices show at once, and Cancel returns to them rather than to nothing.
   */
  embedded?: boolean;
}) {
  // `?compose=deal` cannot open the amendment builder over nothing — with no
  // quote on the thread it lands on the menu instead.
  const opening = initialMode === 'deal' && !entry.offerDeal ? 'menu' : initialMode;
  const [mode, setMode] = useState<Mode>(opening ?? (embedded ? 'menu' : null));
  const [kind, setKind] = useState<AppointmentKind>('video');

  if (!chatNegotiationEnabled()) return null;

  const minDate = todayIsoLocal();
  const maxDate = dayBeforeEventIso(eventDate);
  const close = () => setMode(embedded ? 'menu' : null);

  if (mode === null) {
    return (
      <button
        type="button"
        onClick={() => setMode('menu')}
        className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-ink/15 px-3 py-1 text-xs font-medium text-ink/70 hover:bg-ink/[0.04]"
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden /> Deal or meeting
      </button>
    );
  }

  // A 'deal' mode with nothing to amend shows the menu — never an empty panel.
  if (mode === 'menu' || (mode === 'deal' && !entry.offerDeal)) {
    return (
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        {entry.menuQuote ? (
          <button
            type="button"
            onClick={() => revealThreadTool(entry.menuQuote!.reveal)}
            className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
          >
            🧾 {entry.menuQuote.label}
          </button>
        ) : null}
        {entry.offerDeal ? (
          <button
            type="button"
            onClick={() => setMode('deal')}
            className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
          >
            🧾 Send a deal
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setMode('meeting')}
          className="inline-flex items-center gap-1.5 rounded-full border border-mulberry/30 bg-mulberry/[0.06] px-3 py-1 text-xs font-medium text-mulberry hover:bg-mulberry/10"
        >
          📅 Request a meeting
        </button>
        {embedded ? null : (
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-ink/40 hover:bg-ink/[0.06] hover:text-ink"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
        )}
        {entry.menuNote ? <p className="w-full text-xs text-ink/55">{entry.menuNote}</p> : null}
      </div>
    );
  }

  if (mode === 'deal' && entry.offerDeal) {
    return (
      <div className="mb-1.5">
        <AmendmentBuilder
          action={createAmendmentFromChat}
          threadId={threadId}
          returnPath={returnPath}
          submitLabel="Send deal"
          onCancel={close}
        />
      </div>
    );
  }

  // meeting
  return (
    <form
      action={createScheduleRequestFromChat}
      className="mb-1.5 flex flex-col gap-2 rounded-xl border border-mulberry/20 bg-mulberry/[0.04] p-2.5"
    >
      <input type="hidden" name="thread_id" value={threadId} />
      <input type="hidden" name="return_to" value={returnPath} />
      <input type="hidden" name="kind" value={kind} />
      <div className="flex flex-wrap gap-1.5">
        {APPOINTMENT_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              kind === k ? 'bg-mulberry text-cream' : 'border border-ink/15 text-ink/70 hover:bg-ink/[0.04]'
            }`}
          >
            {APPOINTMENT_KIND_LABEL[k]}
          </button>
        ))}
      </div>
      <input
        type="text"
        name="title"
        maxLength={120}
        placeholder="Title (e.g. Ocular, Pre-shoot call)"
        className="input-field h-9 text-sm"
      />
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          Date
          <input
            type="date"
            name="date"
            required
            min={minDate}
            max={maxDate ?? undefined}
            className="input-field h-9 text-sm"
          />
        </label>
        <label className="flex flex-1 flex-col gap-1 text-[11px] font-medium text-ink/60">
          Time
          <select name="time" required defaultValue="" className="input-field h-9 text-sm">
            <option value="" disabled>
              Pick a time
            </option>
            {TIME_SLOTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex gap-2">
        <button className="inline-flex h-9 items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600">
          Send request
        </button>
        <button
          type="button"
          onClick={close}
          className="inline-flex h-9 items-center rounded-lg border border-ink/15 px-3.5 text-sm text-ink/60 hover:bg-ink/[0.04]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
