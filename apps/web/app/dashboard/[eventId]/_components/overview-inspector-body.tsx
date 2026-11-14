import { ActionButton } from '@/components/action-button';
import { Badge } from '@/app/_components/badge';
import { ArrowRight } from 'lucide-react';
import { InspectorColumn } from '@/app/_components/inspector/inspector-column';

/**
 * Inspector bodies for the event Overview — a new PRESENTATION of decision /
 * "Sai on watch" rows the board already renders. Every fact (label, amount/chip,
 * copy) and the single action (the decision's own CTA → its room) is passed in
 * unchanged from event-dashboard.tsx; nothing here is fabricated or a new action.
 */

type ChipStyle = { color: string; background: string };

export function OverviewDecisionInspector({
  swapKey,
  groupTitle,
  groupSub,
  label,
  sub,
  chip,
  chipStyle,
  ctaLabel,
  href,
  why,
}: {
  swapKey: string;
  groupTitle: string;
  groupSub: string;
  label: string;
  sub: string;
  /** null = the row already says it — the "pick" decisions carry no chip. */
  chip: string | null;
  chipStyle: ChipStyle;
  ctaLabel: string;
  href: string;
  /**
   * Why this one matters, for TODAY'S ONE THING only (2026-09-22).
   *
   * The standalone "Today's one thing" card carried a 26-word paragraph. When
   * that card folded into a row on the board, the paragraph had nowhere to go:
   * a board of one-line rows is not the place for prose, and the row's own
   * sub-line already carries the fact ("Nothing booked · overdue by 278 days").
   *
   * This is the surface built for one row at a time, so it lands here. Absent
   * on every other row — `undefined` renders nothing, it does not render an
   * empty paragraph.
   */
  why?: string;
}) {
  return (
    <InspectorColumn
      eyebrow={groupTitle}
      title={label}
      swapKey={swapKey}
      ariaLabel={`${label} — decision details`}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {chip ? (
            <span
              className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[12px] font-semibold"
              style={chipStyle}
            >
              {chip}
            </span>
          ) : null}
          <Badge tone="quiet">{groupSub}</Badge>
        </div>
        <p className="text-sm leading-relaxed text-ink/75">{sub}</p>
        {why ? <p className="text-sm leading-relaxed text-ink/75">{why}</p> : null}
        {/* The SAME action the row offers — this decision's own CTA to its room. */}
        {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 3 · 5 · 14): the one main terracotta pill, not a hand-painted gold one;
            the group line is the shared soft chip (no outline). */}
        <ActionButton tone="brand" main href={href} icon={<ArrowRight aria-hidden strokeWidth={1.9} />} label={ctaLabel} />
      </div>
    </InspectorColumn>
  );
}

export function OverviewWatchInspector({
  swapKey,
  category,
  templateId,
  copy,
}: {
  swapKey: string;
  category: string;
  templateId: string;
  copy: string;
}) {
  const isGuard = category === 'guard';
  const roleLabel = isGuard ? 'Guard' : 'Secretary';
  return (
    <InspectorColumn
      eyebrow="Sai on watch"
      title={roleLabel}
      swapKey={swapKey}
      ariaLabel="Sai on watch"
    >
      <div className="space-y-3">
        {/* 📐 DESIGN TEMPLATE (14 Nov 2026, rules 13 · 14): grey capitals in the words' own font, not a coloured typewriter
            caption; the guard's template id is no longer printed as words (a programmer label) — it stays on the line's
            title for whoever needs to trace it. */}
        <p className="text-xs font-semibold uppercase tracking-[0.06em] text-ink/70" title={templateId}>
          {roleLabel}
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">
          {copy}
        </p>
        <p className="text-[13px] text-ink/75">
          A background guard surfaced this — it only speaks up when something
          changes. There&rsquo;s nothing you must do.
        </p>
      </div>
    </InspectorColumn>
  );
}
