/**
 * guest-reply-panel.ts — 🖥 ON A DESKTOP THE GUEST'S REPLY OPENS THE ONE REPLY PAGE IN THE 440-px SIDE PANEL.
 *
 * DECISION_LOG 2026-10-19 "FIVE CONTROLLER RECOMMENDATIONS APPROVED" (3): *"REPLY ON DESKTOP OPENS THE ONE REPLY PAGE
 * INSIDE THE 440-px SIDE PANEL (keeps the guest on the invitation; amends the 2026-10-15 'Reply as a side panel'
 * against the 2026-10-11 ONE REPLY FORM)"*. The panel is the desktop system sheet's piece 3 (2026-10-15, built in
 * #6662 — `lib/guest-hub-desktop.ts`), and it sits behind the SAME gate: `guestHubDesktopEnabled`.
 *
 * 🔑 ONE REPLY FORM, STILL. The panel draws NO form of its own: it frames the reply PAGE (`/{slug}/invite/reply`,
 * `inviteReplyPath`) — the same route, the same `RsvpWidget`, the same Terms tick, the same save and every redirect
 * the save already makes. Nothing about the reply page changes, so the phone's page and the panel's are one source.
 *
 * Why a frame and not an intercepting route: an intercepting route takes EVERY client navigation to its path — the
 * phone's too, and a guest's with the gate off — so phones would stop reaching the page they reach today; and a
 * parallel slot would sit in the layout of every guest route. The frame is opened only by a click this file allows
 * (a desktop width, the gate on), so with the gate off, or under 1024 px, the Reply link is the plain link it is now.
 *
 * Pure: what the panel component (`app/[slug]/_components/reply-panel.tsx`) decides, so node can hold it.
 */
import { GUEST_DESK_FROM_PX } from '@/lib/guest-hub-desktop';

/** The desktop line — the system sheet's (`GUEST_DESK_FROM_PX`); under it a Reply is the plain link. */
export const REPLY_PANEL_MEDIA = `(min-width: ${GUEST_DESK_FROM_PX}px)`;

/**
 * The keywords the reply's save lands on when the reply WAS saved (`submitRsvp`, `app/[slug]/actions.ts`:
 * `const outcome = answerRefused ? 'refused' : replyLocked ? 'details' : 'ok'`) — the thank-you door's `?rsvp=`, and
 * the words the Event Hub already says for each (`rsvpFlash`, `app/[slug]/page.tsx`). Every other `?rsvp=` (error ·
 * terms · choose · mobile · window) comes back to the reply page itself, which says what to fix — the panel stays.
 */
export const REPLY_PANEL_OUTCOMES = ['ok', 'details', 'refused'] as const;
export type ReplyPanelOutcome = (typeof REPLY_PANEL_OUTCOMES)[number];

const lower = (p: string) => p.replace(/\/+$/, '').toLowerCase();

/** A press the panel takes — a plain left click with no key held, on a same-tab link to the reply page, on a desktop. */
export function opensInReplyPanel(input: {
  href: string;
  origin: string;
  replyPath: string;
  wide: boolean;
  button: number;
  modified: boolean;
  target: string | null;
  download: boolean;
}): boolean {
  if (!input.wide || input.button !== 0 || input.modified || input.download) return false;
  if (input.target && input.target !== '_self') return false;
  let url: URL;
  try {
    url = new URL(input.href, input.origin);
  } catch {
    return false;
  }
  return url.origin === input.origin && lower(url.pathname) === lower(input.replyPath);
}

/** What the panel does when its frame is somewhere: keep showing it, close as replied, or hand the address to the page. */
export type ReplyPanelStep =
  | { kind: 'stay' }
  | { kind: 'replied'; outcome: ReplyPanelOutcome }
  | { kind: 'leave'; href: string };

export function replyPanelStep(
  href: string,
  at: { origin: string; replyPath: string; thanksPath: string; framePath: string; saved?: boolean },
): ReplyPanelStep {
  let url: URL;
  try {
    url = new URL(href, at.origin);
  } catch {
    return { kind: 'stay' };
  }
  /* The frame before its first address (`about:blank`) — nothing to decide yet. */
  if (url.protocol === 'about:') return { kind: 'stay' };
  const path = lower(url.pathname);
  const outcome = url.searchParams.get('rsvp');
  /* 🎟 ONCE SAVED, THE THANK-YOU DOOR STAYS IN THE PANEL (controller 2026-10-19): the guest must not lose its QR ticket,
     "Save to my account" and the plus-ones' invites — whatever the door does to its own address after (it puts its
     address back once its effect has started) is still the door. */
  if (at.saved && url.origin === at.origin && path === lower(at.thanksPath)) return { kind: 'stay' };
  if (url.origin === at.origin && path === lower(at.thanksPath) && (REPLY_PANEL_OUTCOMES as readonly string[]).includes(outcome ?? '')) {
    return { kind: 'replied', outcome: outcome as ReplyPanelOutcome };
  }
  if (url.origin === at.origin && (path === lower(at.replyPath) || path === lower(at.framePath))) return { kind: 'stay' };
  return { kind: 'leave', href: url.origin === at.origin ? `${url.pathname}${url.search}${url.hash}` : url.href };
}

/**
 * The invitation, as it reads after a saved reply: the page the guest is on, with the save's outcome — the Event
 * Hub's own `?rsvp=` words ("Your reply is in — thank you.") and its replied Reply card, from a fresh server read.
 */
export function repliedHref(current: string, outcome: ReplyPanelOutcome): string {
  const url = new URL(current);
  url.searchParams.set('rsvp', outcome);
  return `${url.pathname}${url.search}${url.hash}`;
}
