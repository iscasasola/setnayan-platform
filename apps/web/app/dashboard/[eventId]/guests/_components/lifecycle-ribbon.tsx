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
  unsent = 0,
  unseated = 0,
  arrived = 0,
}: {
  eventId: string;
  active?: LifecycleStep;
  pendingClaims?: number;
  /** Guests (not declined) whose QR invitation hasn't been sent yet. */
  unsent?: number;
  /** Attending guests without a seat assignment. */
  unseated?: number;
  /** Guests checked in at the day-of desk. */
  arrived?: number;
}) {
  // Phase 3: each step badges its live "work remaining" (or, for Day-of, the
  // live arrivals). A zero count = no badge — a quiet ribbon means on-track.
  const steps: {
    key: LifecycleStep;
    label: string;
    href: string;
    badge?: number;
    // The badge counts WORK REMAINING (or, for Day-of, arrivals). A bare
    // number read backwards — "Seat 192" looked like 192 *are* seated when
    // it means 192 are NOT. `badgeWord` spells out the direction inline
    // (owner clarity fix 2026-06-13) so the count is unambiguous without
    // relying on the (touch-invisible) title tooltip.
    badgeWord?: string;
    badgeTitle?: string;
    badgeTone?: 'accent' | 'done';
  }[] = [
    { key: 'build', label: 'Build', href: `/dashboard/${eventId}/guests` },
    {
      key: 'invite',
      label: 'Invite',
      href: `/dashboard/${eventId}/guests/claims`,
      badge: unsent,
      badgeWord: 'to send',
      badgeTitle: `${unsent} ${unsent === 1 ? 'invitation' : 'invitations'} not yet sent`,
    },
    {
      key: 'confirm',
      label: 'Confirm',
      href: `/dashboard/${eventId}/guests/claims`,
      badge: pendingClaims,
      badgeWord: 'to review',
      badgeTitle: `${pendingClaims} guest ${pendingClaims === 1 ? 'request' : 'requests'} to review`,
    },
    {
      key: 'seat',
      label: 'Seat',
      href: `/dashboard/${eventId}/seating`,
      badge: unseated,
      badgeWord: 'to seat',
      badgeTitle: `${unseated} attending ${unseated === 1 ? 'guest' : 'guests'} without a seat`,
    },
    {
      key: 'dayof',
      label: 'Day-of',
      href: `/dashboard/${eventId}/guests/checkin`,
      badge: arrived,
      badgeWord: 'arrived',
      badgeTitle: `${arrived} ${arrived === 1 ? 'guest has' : 'guests have'} arrived`,
      badgeTone: 'done',
    },
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
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
              {s.label}
              {s.badge ? (
                <span
                  title={s.badgeTitle}
                  className={`rounded-full px-1.5 text-[11px] font-semibold ${
                    s.badgeTone === 'done'
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-terracotta/15 text-terracotta-700'
                  }`}
                >
                  {s.badge}
                  {s.badgeWord ? (
                    <span className="ml-1 font-normal opacity-80">{s.badgeWord}</span>
                  ) : null}
                </span>
              ) : null}
            </Link>
          </Fragment>
        );
      })}
    </nav>
  );
}
