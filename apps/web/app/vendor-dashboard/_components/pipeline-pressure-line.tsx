import Link from 'next/link';
import {
  pipelineDayLabel,
  pipelinePressureLine,
  type PipelinePressure,
} from '@/lib/vendor-pipeline-pressure';

/**
 * The ladder line — how many customers this shop is already chasing for the
 * date of the inquiry on screen, drawn beside the Accept button.
 *
 * ── WHAT IT IS FOR ─────────────────────────────────────────────────────────
 * The per-tier ceiling has been enforceable since 2026-08-09 and has never been
 * SAID. A supplier's first contact with it was the refusal. This is the number
 * before the wall, the wall itself, and the two ways out — the owner's own
 * requirement that hitting a ceiling *"read as a ladder"*, not as a fault.
 *
 * ── WHAT IT NEVER DOES ─────────────────────────────────────────────────────
 *  · It NEVER hides the message, the couple, or the Decline control. The
 *    2026-07-24 lock is *"your inbox is never locked"*: a supplier at their
 *    ceiling still receives, reads and answers every inquiry. What is bounded
 *    is how many they may PURSUE on one single date.
 *  · It NEVER renders when the ceilings are switched off, when the couple has
 *    no date yet, or when the read fails — `fetchPipelinePressure` returns null
 *    in every one of those cases and this component returns null. A missing
 *    line costs a warning; an invented one tells a supplier they are full when
 *    they are not.
 *  · It is NOT the gate. The gate is a database trigger, because accepting is
 *    reachable from the inbox, this desk, the admin demo console and the
 *    auto-reply, and a per-date count is racy client-side.
 *
 * Colours: light-locked app, so these are the plain palette values —
 * `terracotta-700` #8C6932 (5.02:1) for the gold "last slot" copy and
 * `mulberry-700` #9D3F1E (6.42:1) for the limit heading. Bare `terracotta`
 * #A9834B is 3.48:1 and is used here only as a border and a fill, never as
 * words.
 */
export function PipelinePressureLine({
  pressure,
}: {
  pressure: PipelinePressure | null;
}) {
  if (!pressure) return null;
  const line = pipelinePressureLine(pressure);
  if (!line) return null;
  const day = pipelineDayLabel(pressure.dateIso);

  const pips = Array.from({ length: Math.max(pressure.cap, 1) }, (_, i) => i);

  if (pressure.state === 'full') {
    return (
      <div className="mt-3 rounded-xl border border-mulberry/30 bg-mulberry/[0.05] p-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-mulberry-700">
          <Pips filled={pressure.used} of={pips.length} tone="full" />
          {line}
        </p>
        <p className="mt-1.5 text-[13px] text-ink/70">
          Nothing is lost — this customer stays in your inbox and you can still read
          and reply. You just can&rsquo;t start chasing another for {day ?? 'this date'}.
        </p>
        <ul className="mt-2 space-y-1 text-[13px] text-ink/80">
          <li>
            <span className="font-semibold">Sign one of them</span> — a signed booking
            stops counting.
          </li>
          <li>
            <span className="font-semibold">Let one go</span> — declining frees the slot
            straight away.
          </li>
        </ul>
        <p className="mt-2 border-t border-mulberry/20 pt-2 text-[13px] text-ink/70">
          Or move up:{' '}
          <Link href="/vendor-dashboard/subscription" className="font-semibold text-link underline">
            see the plans
          </Link>
          .
        </p>
      </div>
    );
  }

  if (pressure.state === 'last') {
    return (
      <p className="mt-3 flex items-center gap-2 rounded-lg border border-terracotta/30 bg-terracotta/10 px-2.5 py-1.5 text-[13px] font-medium text-terracotta-700">
        <Pips filled={pressure.used} of={pips.length} tone="last" />
        {line}
      </p>
    );
  }

  return (
    <p className="mt-3 flex items-center gap-2 text-[13px] text-ink/60">
      <Pips filled={pressure.used} of={pips.length} tone="room" />
      {line}
    </p>
  );
}

/**
 * The slots, drawn. Decorative only — the sentence beside it carries the same
 * facts in words, so the pips are `aria-hidden` rather than given a label that
 * would have a screen reader read the count twice.
 */
function Pips({
  filled,
  of,
  tone,
}: {
  filled: number;
  of: number;
  tone: 'room' | 'last' | 'full';
}) {
  // A very generous plan (Enterprise = 10) would draw a row of ten squares that
  // reads as noise; past six the sentence alone does the work.
  if (of > 6) return null;
  const color =
    tone === 'full'
      ? 'border-mulberry-700 text-mulberry-700'
      : tone === 'last'
        ? 'border-terracotta-700 text-terracotta-700'
        : 'border-ink/40 text-ink/40';
  return (
    <span aria-hidden className="flex flex-none gap-[3px]">
      {Array.from({ length: of }, (_, i) => (
        <span
          key={i}
          className={`h-[9px] w-[9px] rounded-sm border ${color} ${
            i < filled ? 'bg-current' : ''
          }`}
        />
      ))}
    </span>
  );
}
