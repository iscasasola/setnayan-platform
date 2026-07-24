'use client';

// Shared presentational shell for the in-chat negotiation INFORMATION CARDS
// (schedule / discount / inclusion). Deliberately distinct from a message
// bubble: full-width, a coloured left stripe + icon tile, a small-caps type
// label, a bold title, a status pill, a structured details grid, and a dedicated
// action footer. Resolved cards (agreed / declined) COLLAPSE to a single tidy
// line so a long negotiation doesn't clutter the thread — tap to expand.
//
// Owner 2026-07-24: "make this cleaner and easy to manage — differentiate from a
// message, a larger information card." Data + actions stay in the two concrete
// cards (chat-appointment-card, chat-change-order-card); this is layout only.

import { useState, type ReactNode } from 'react';
import { CalendarClock, Percent, PlusCircle, ChevronDown, ChevronUp } from 'lucide-react';

export type NegType = 'schedule' | 'discount' | 'inclusion';
export type NegStatusTone = 'awaiting' | 'agreed' | 'declined';

const TYPE_META: Record<
  NegType,
  { label: string; Icon: typeof CalendarClock; stripe: string; tile: string }
> = {
  schedule: {
    label: 'Schedule request',
    Icon: CalendarClock,
    stripe: 'border-l-mulberry',
    tile: 'bg-mulberry/10 text-mulberry',
  },
  discount: {
    label: 'Discount request',
    Icon: Percent,
    stripe: 'border-l-terracotta',
    tile: 'bg-terracotta/10 text-terracotta',
  },
  inclusion: {
    label: 'Inclusion request',
    Icon: PlusCircle,
    stripe: 'border-l-gold-700',
    tile: 'bg-gold/20 text-gold-700',
  },
};

const STATUS_META: Record<NegStatusTone, { label: string; cls: string }> = {
  awaiting: { label: 'Awaiting', cls: 'bg-warn-100 text-warn-900' },
  agreed: { label: 'Agreed', cls: 'bg-success-100 text-success-900' },
  declined: { label: 'Declined', cls: 'bg-ink/10 text-ink/55' },
};

export type NegRow = { label: string; value: ReactNode };

export function NegotiationCardShell({
  type,
  title,
  statusTone,
  statusLabel,
  rows,
  footer,
}: {
  type: NegType;
  title: string;
  statusTone: NegStatusTone;
  /** Override the default status pill text (e.g. "Confirmed", "Accepted"). */
  statusLabel?: string;
  rows: NegRow[];
  /** Action footer — only rendered while the request is still awaiting. */
  footer?: ReactNode;
}) {
  const t = TYPE_META[type];
  const s = STATUS_META[statusTone];
  const Icon = t.Icon;
  const resolved = statusTone !== 'awaiting';
  const [open, setOpen] = useState(!resolved);
  const pill = statusLabel ?? s.label;

  // Resolved + collapsed → one tidy line.
  if (resolved && !open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`flex w-full max-w-[92%] items-center gap-2.5 rounded-xl border border-ink/10 border-l-[3px] ${t.stripe} bg-surface px-3 py-2 text-left ${statusTone === 'declined' ? 'opacity-70' : ''}`}
      >
        <Icon className="h-4 w-4 shrink-0 text-ink/45" strokeWidth={1.75} aria-hidden />
        <span className="truncate text-sm text-ink/80">
          <span className="text-ink/50">{t.label}: </span>
          {title}
        </span>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
          {pill}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-ink/35" strokeWidth={2} aria-hidden />
      </button>
    );
  }

  return (
    <div
      className={`w-full max-w-[92%] overflow-hidden rounded-xl border border-ink/10 border-l-[3px] ${t.stripe} bg-surface shadow-sm ${statusTone === 'declined' ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3 px-3.5 py-3">
        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] ${t.tile}`}>
          <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
        </span>
        <div className="min-w-0 leading-tight">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/50">{t.label}</p>
          <p className="truncate text-[15px] font-medium text-ink">{title}</p>
        </div>
        <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${s.cls}`}>
          {pill}
        </span>
        {resolved ? (
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Collapse"
            className="shrink-0 text-ink/35 hover:text-ink/60"
          >
            <ChevronUp className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border-t border-ink/10 px-3.5 py-3 text-[13px]">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-ink/50">{r.label}</dt>
            <dd className="text-ink/85">{r.value}</dd>
          </div>
        ))}
      </dl>

      {footer ? (
        <div className="flex flex-wrap gap-2 border-t border-ink/10 bg-ink/[0.02] px-3.5 py-2.5">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
