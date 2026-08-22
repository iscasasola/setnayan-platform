/**
 * JoinShell — the /join family's door, now a thin binding over the shared
 * <DoorShell> rather than its own chrome.
 *
 * WHAT CHANGED AND WHY. This file had the right idea before anything else did:
 * one centred card for every step. It just never left `/join` — and three of
 * its own siblings (check-email, set-password, success) hand-copied its
 * wrapper instead of importing it, so "the shared shell" was shared with
 * nobody. The chrome now lives in `_components/door/door-shell.tsx` where the
 * other seven doors can reach it; this keeps the event-shaped signature
 * (`event` in, header out) that JoinFlow and /[slug]/invite already call.
 *
 * 🎨 The eyebrow was `text-terracotta` — which in this repo is the atelier GOLD
 * #A9834B at 3.37:1 on cream, an AA failure, not the CTA terracotta. DoorShell
 * owns that colour now and gets it right; see its header note.
 */
import Link from 'next/link';
import { DoorShell } from '@/app/_components/door/door-shell';
import { joinDoorMeta } from '@/lib/join-door-meta';

export type JoinShellEvent = {
  display_name: string;
  event_date: string | null;
  /** Required, never optional — see lib/join-door-meta.ts for why. */
  event_date_precision: string | null;
  venue_name: string | null;
} | null;

/** Shared centered card chrome for every /join step (role, claim, verify, pending). */
export function JoinShell({
  event,
  children,
}: {
  event: JoinShellEvent;
  children: React.ReactNode;
}) {
  return (
    <DoorShell
      eyebrow="You're invited"
      title={event?.display_name || 'Event invite'}
      meta={event ? joinDoorMeta(event) : undefined}
    >
      {children}
    </DoorShell>
  );
}

export function InvalidTokenScreen() {
  return (
    <DoorShell
      /*
        A dead link is not a threshold — there is nothing here to walk through,
        so it does not wear the action colour. The only control is the way home,
        which DoorShell always renders above the card.
      */
      tone="dead_end"
      eyebrow="Invite link"
      title="This invite link isn't valid."
      sub="It might have been revoked, or the address got cut off when it was shared. Ask whoever invited you for a fresh link."
    >
      <Link className="button-secondary" href="/">
        Back home
      </Link>
    </DoorShell>
  );
}
