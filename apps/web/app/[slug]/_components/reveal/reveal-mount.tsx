import type { ComponentProps } from 'react';
import type { RevealStudioConfig } from '@/lib/reveal-config-pure';
import { revealAllowedFor, REVEAL_NONE } from '@/lib/reveal-access';
import { RevealOverlay } from './reveal-overlay';
import { StdTouchGlow } from './std-touch-glow';

/**
 * The SYNCHRONOUS half of RevealOverlayServer — everything after its two reads
 * (Reveal Studio config · Event Hub Pro ownership). Split out so a test can
 * render it without a database: `reveal-mount.test.ts` pins that a free
 * couple's page mounts NO reveal even with the admin master toggle ON.
 *
 * ALL REVEAL IS PAID (owner 2026-09-24). A couple without Event Hub Pro does
 * not get the overlay mounted at all. The client overlay re-runs the same
 * `revealAllowedFor` (it alone can read a staff preview's `?reveal=`), so the
 * two halves agree by construction.
 */
export type RevealMountProps = Omit<
  ComponentProps<typeof RevealOverlay>,
  'config' | 'premiumUnlocked' | 'seenEventId'
> & {
  config: RevealStudioConfig;
  /** The event holds Event Hub Pro (STD_PREMIUM_OPENINGS, active). */
  ownsPro: boolean;
  eventId?: string;
  /** Build-time preview authority (NEXT_PUBLIC_STD_REVEAL=1). Never a guest. */
  isStaffPreview: boolean;
};

export function RevealMount({
  config,
  ownsPro,
  eventId,
  isStaffPreview,
  ...props
}: RevealMountProps) {
  const glow = config.touchGlow;
  const decision = revealAllowedFor({
    ownsPro,
    chosenTemplate: props.eventTemplate ?? null,
    adminDefault: config.defaultTemplate,
    isStaffPreview,
    allowed: config.templates,
  });
  // On a staff preview build the overlay is always mounted so a `?reveal=`
  // (readable only on the client) can still demo an opening. Everywhere else
  // the server decides here, and a free couple's page carries no overlay.
  const mountOverlay = props.enabled && (isStaffPreview || decision !== REVEAL_NONE);
  return (
    <>
      {/* Press-to-glow runs wherever the reveal is enabled (`enabled`) when the
          admin has it on — independent of whether the premium reveal shows, so
          it brightens both the reveal and the bare film underneath. Since
          2026-08-29 that is the Save-the-Date window AND the invitation. */}
      {props.enabled && glow.enabled ? (
        <StdTouchGlow color={glow.color} intensity={glow.intensity} size={glow.size} />
      ) : null}
      {mountOverlay ? (
        <RevealOverlay
          {...props}
          petalsColor={props.petalsColor ?? config.petalsColor}
          config={config}
          premiumUnlocked={ownsPro}
          /* ONE REVEAL ON THE WAY IN (owner Q6 = B). The id is already held for
             the ownership read; forwarding it is what lets the mark be keyed per
             event, so two invitations open in one tab cannot silence each
             other. `oncePerVisit` rides in through `...props` from the two
             mounts that take a side — the invite door records, the Event Hub
             defers. */
          seenEventId={eventId ?? null}
        />
      ) : null}
    </>
  );
}
