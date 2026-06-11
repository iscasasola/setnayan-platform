import { Fragment } from 'react';
import Link from 'next/link';
import {
  PencilLine,
  Send,
  CircleCheck,
  LayoutGrid,
  QrCode,
  ChevronRight,
} from 'lucide-react';

/**
 * Guest-list lifecycle ribbon (redesign Phase 1) — the navigable spine of the
 * guest journey: Build → Invite → Confirm → Seat → Day-of. Purely additive,
 * presentational links over surfaces that already exist; no behavior change to
 * the list/filters/carousel.
 *
 * DESKTOP-ONLY for now (rendered inside the `hidden lg:block` chrome block) to
 * respect the locked "mobile top = just the guest list" directive (2026-06-03);
 * the mobile lifecycle affordance lands in the MobileGuestCarousel in a later
 * increment. The Confirm step badges the pending invite-claims count (0034 /
 * #1220 review queue).
 */
type LifecycleStep = 'build' | 'invite' | 'confirm' | 'seat' | 'dayof';

const ICONS = {
  build: PencilLine,
  invite: Send,
  confirm: CircleCheck,
  seat: LayoutGrid,
  dayof: QrCode,
} as const;

export function LifecycleRibbon({
  eventId,
  active = 'build',
  pendingClaims = 0,
}: {
  eventId: string;
  active?: LifecycleStep;
  pendingClaims?: number;
}) {
  const steps: { key: LifecycleStep; label: string; href: string; badge?: number; soon?: boolean }[] = [
    { key: 'build', label: 'Build', href: `/dashboard/${eventId}/guests` },
    { key: 'invite', label: 'Invite', href: `/dashboard/${eventId}/guests/claims` },
    { key: 'confirm', label: 'Confirm', href: `/dashboard/${eventId}/guests/claims`, badge: pendingClaims },
    { key: 'seat', label: 'Seat', href: `/dashboard/${eventId}/seating` },
    { key: 'dayof', label: 'Day-of', href: `/dashboard/${eventId}`, soon: true },
  ];

  return (
    <nav
      aria-label="Guest planning lifecycle"
      className="flex items-center gap-1 overflow-x-auto rounded-xl border border-ink/10 bg-cream px-3 py-2"
    >
      {steps.map((s, i) => {
        const Icon = ICONS[s.key];
        const isActive = s.key === active;
        return (
          <Fragment key={s.key}>
            {i > 0 ? (
              <ChevronRight className="h-4 w-4 shrink-0 text-ink/30" strokeWidth={1.75} aria-hidden />
            ) : null}
            <Link
              href={s.href}
              aria-current={isActive ? 'step' : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-sm transition-colors ${
                isActive
                  ? 'bg-terracotta/10 font-medium text-terracotta-700'
                  : 'text-ink/60 hover:bg-ink/5 hover:text-ink'
              } ${s.soon ? 'opacity-60' : ''}`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {s.label}
              {s.badge ? (
                <span className="rounded-full bg-terracotta/15 px-1.5 text-[11px] font-semibold text-terracotta-700">
                  {s.badge}
                </span>
              ) : null}
              {s.soon ? (
                <span className="rounded-full bg-ink/10 px-1.5 text-[10px] font-medium text-ink/55">soon</span>
              ) : null}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
