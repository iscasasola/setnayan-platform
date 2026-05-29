import Link from 'next/link';
import {
  CheckCircle2,
  Clock3,
  Lock,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import type { AddOnState, AddOnStateContext } from '@/lib/add-on-state';
import {
  ChoosePlanSheet,
  type ChoosePlanSheetProps,
} from './choose-plan-sheet';

// Renders the App Store-style hero CTA according to the resolved
// AddOnStateContext. One of:
//   add           → <ChoosePlanSheet>  (terracotta filled button → bottom sheet)
//   request_sent  → disabled chip linking to the order detail (reference code)
//   launch        → <Link href={setupHref}>  (terracotta filled button)
//   blocked       → disabled chip with the admin block-reason tooltip
//   expired       → disabled chip explaining the event ended
//
// The choosePlan props only matter for the 'add' state — the caller
// always passes them so the user can fall through cleanly. Other states
// just consume the resolved href / reason fields.

export type AddOnStateCtaProps = {
  context: AddOnStateContext;
  // Props for the 'add' state's plan sheet — passed through verbatim.
  choosePlan: ChoosePlanSheetProps;
  // Label for the 'launch' state. Defaults to "Launch".
  launchLabel?: string;
};

export function AddOnStateCta({
  context,
  choosePlan,
  launchLabel = 'Launch',
}: AddOnStateCtaProps) {
  switch (context.state) {
    case 'add':
      return <ChoosePlanSheet {...choosePlan} />;
    case 'launch':
      return (
        <Link
          href={context.href ?? '#'}
          className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
        >
          <Rocket aria-hidden className="h-4 w-4" strokeWidth={2} />
          {launchLabel}
        </Link>
      );
    case 'request_sent':
      return (
        <Link
          href={context.href ?? '#'}
          className="inline-flex items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 px-5 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
        >
          <Clock3 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
          Request sent
          {context.pendingOrderPublicId ? (
            <span className="font-mono text-xs font-normal opacity-80">
              · {context.pendingOrderPublicId}
            </span>
          ) : null}
        </Link>
      );
    case 'blocked':
      return (
        <DisabledChip
          Icon={Lock}
          label="Blocked"
          tone="muted"
          sub={context.blockReason ?? 'Not available for this account. Contact support.'}
        />
      );
    case 'expired':
      return (
        <DisabledChip
          Icon={CheckCircle2}
          label="Expired"
          tone="muted"
          sub={
            context.expiredAt === 'archived'
              ? 'This event has been archived.'
              : 'Your event ended. Past purchases stay available; new purchases are paused.'
          }
        />
      );
  }
}

function DisabledChip({
  Icon,
  label,
  sub,
  tone,
}: {
  Icon: LucideIcon;
  label: string;
  sub: string;
  tone: 'muted';
}) {
  void tone;
  return (
    <span
      aria-disabled="true"
      title={sub}
      className="inline-flex max-w-xs items-center gap-2 rounded-full border border-ink/15 bg-ink/5 px-5 py-2 text-sm font-semibold text-ink/55"
    >
      <Icon aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      {label}
    </span>
  );
}

// Map a resolved AddOnState to the hero.statusPill (label + tone) so the
// hero pill always agrees with the CTA below. Returns null when the
// caller wants the default (e.g. "Web V1") for the 'add' state.
export function statusPillForState(
  state: AddOnState,
): { label: string; tone: 'accent' | 'muted' | 'success' } | null {
  switch (state) {
    case 'launch':
      return { label: 'Active on this event', tone: 'success' };
    case 'request_sent':
      return { label: 'Pending review', tone: 'accent' };
    case 'blocked':
      return { label: 'Unavailable', tone: 'muted' };
    case 'expired':
      return { label: 'Event ended', tone: 'muted' };
    case 'add':
      return null;
  }
}
