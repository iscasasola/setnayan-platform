import { Lock } from 'lucide-react';
import { HeroMonogram } from '@/app/_components/hero-monogram';
import { formatEventDate } from '@/lib/events';
import type { MonogramConfig } from '@/lib/monogram';
import type { MonogramMotionKey } from '@/lib/monogram-motion';
import type { EventRow } from '../_lib/types';
import { InvitationShell } from './invitation-shell';

/**
 * Locked screen for landing-page-visibility='private' (CLAUDE.md 2026-05-22).
 *
 * Rendered when an unauthenticated visitor (or a signed-in visitor with no
 * host membership / no guest cookie for this event) opens the URL of a
 * private wedding. Polite — not severe. Monogram + couple name + date stay
 * visible so the visitor can confirm they have the right wedding and reach
 * out to the hosts if they should have access.
 */
export function PrivateLanding({
  event,
  monogram,
  animatedMonogram,
  bespokeSvg,
  proWatermarkHidden,
}: {
  event: EventRow;
  monogram: MonogramConfig;
  // The chosen Motion Library signature when the event owns the paid
  // ANIMATED_MONOGRAM upgrade, or false → static circle. See [slug]/page.tsx
  // resolution + lib/animated-monogram.ts + lib/monogram-motion.ts.
  animatedMonogram: MonogramMotionKey | false;
  // The applied Setnayan-AI bespoke mark (sanitized SVG) — wins over the
  // typographic circle when present. See [slug]/page.tsx resolution.
  bespokeSvg: string | null;
  /** Paid COUPLE_WEBSITE_PRO perk — drop the "Powered by Setnayan" footer
   *  watermark when the event owns the active upgrade. */
  proWatermarkHidden: boolean;
}) {
  return (
    <InvitationShell rolePalette={event.role_palette} hideWatermark={proWatermarkHidden}>
      <div className="space-y-8 text-center">
        <div className="flex justify-center">
          <HeroMonogram
            event={event}
            monogram={monogram}
            animatedMonogram={animatedMonogram}
            bespokeSvg={bespokeSvg}
          />
        </div>
        <div className="space-y-3">
          <h1 className="font-display text-4xl font-medium tracking-tight sm:text-5xl">
            {event.display_name}
          </h1>
          {event.event_date ? (
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              {formatEventDate(event.event_date)}
            </p>
          ) : null}
        </div>

        <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-ink/10 bg-cream/60 p-6 sm:p-8">
          <Lock
            aria-hidden
            className="mx-auto h-7 w-7 text-terracotta"
            strokeWidth={1.5}
          />
          <h2 className="font-serif text-2xl italic tracking-tight">
            This wedding&rsquo;s page is private
          </h2>
          <p className="text-sm text-ink/70">
            Only the couple&rsquo;s guests and moderators can view it. If you should
            have access, please ask your hosts to add you to the guest list.
          </p>
        </div>

        <p className="text-xs text-ink/45">
          Already invited? Open the personal link the couple sent you, or scan your
          invitation QR.
        </p>
      </div>
    </InvitationShell>
  );
}
