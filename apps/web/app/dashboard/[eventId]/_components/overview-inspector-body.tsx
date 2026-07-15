import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { InspectorColumn } from '@/app/_components/inspector/inspector-column';

/**
 * Inspector bodies for the event Overview — a new PRESENTATION of decision /
 * "Suri on watch" rows the board already renders. Every fact (label, amount/chip,
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
}: {
  swapKey: string;
  groupTitle: string;
  groupSub: string;
  label: string;
  sub: string;
  chip: string;
  chipStyle: ChipStyle;
  ctaLabel: string;
  href: string;
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
          <span
            className="whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold"
            style={chipStyle}
          >
            {chip}
          </span>
          <span className="rounded-full border border-ink/10 px-2.5 py-0.5 text-[11px] font-medium text-ink/55">
            {groupSub}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink/75">{sub}</p>
        {/* The SAME action the row offers — this decision's own CTA to its room. */}
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-transform hover:-translate-y-0.5"
          style={{ background: 'var(--sn-gold-500)', color: '#FFFDF8' }}
        >
          {ctaLabel}
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
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
  const color = isGuard ? 'var(--sn-info)' : 'var(--sn-gold-600)';
  const roleLabel = isGuard ? 'Guard' : 'Secretary';
  return (
    <InspectorColumn
      eyebrow="Suri on watch"
      title={roleLabel}
      swapKey={swapKey}
      ariaLabel="Suri on watch"
    >
      <div className="space-y-3">
        <p
          className="font-mono text-[11px] font-bold uppercase tracking-[0.13em]"
          style={{ color }}
        >
          {roleLabel} · {templateId}
        </p>
        <p className="whitespace-pre-line text-sm leading-relaxed text-ink/80">
          {copy}
        </p>
        <p className="text-xs text-ink/45">
          A background guard surfaced this — it only speaks up when something
          changes. There&rsquo;s nothing you must do.
        </p>
      </div>
    </InspectorColumn>
  );
}
