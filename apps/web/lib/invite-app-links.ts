/**
 * INVITE THROUGH A MESSAGING APP — WhatsApp · Viber · Messenger · More apps…
 *
 * Owner, 2026-10-26, verbatim: *"Viber/Whatsapp invite buttons. we need to allow
 * the invite to work seamlessly with messaging apps."* — and 2026-10-25: *"how do
 * we connect our app to their viber and messenger? so they can send invitation to
 * viber and fb messenger. and other social media messaging apps"*.
 *
 * ⛔ WE SEND NOTHING (the rulings this respects): no SMS in V1, no email, never a
 * send on the host's behalf. Every link below only OPENS the host's own app with
 * the guest's message ready; the host picks the chat and presses send there.
 * None of these links names a recipient — there is no phone number in any of
 * them — so the host chooses who gets it, inside their own app.
 *
 * ── WHAT EACH CHOICE DOES (`inviteAppPlan`, executed by its test) ─────────────
 *   · WhatsApp  → `https://wa.me/?text=<message>` on a phone AND a computer.
 *                 WhatsApp's own link: the app (or WhatsApp Web / Desktop) opens
 *                 with the message typed in, and asks who to send it to.
 *   · Viber     → a phone: `viber://forward?text=<message>` — Viber's forward
 *                 screen with the message typed in.
 *                 A computer: COPY. Viber Desktop takes no prefilled text from a
 *                 link, so we copy the message and SAY so; never a dead link.
 *   · Messenger → COPY, then open Messenger empty (`fb-messenger://` on a phone,
 *                 messenger.com on a computer). The web send-dialog needs a
 *                 Facebook app id this repo does not have, and
 *                 `fb-messenger://share?link=` is unverified — the measured
 *                 finding is in `app/realstories/_components/share-buttons.tsx`
 *                 ("WHY THERE IS NO MESSENGER BUTTON"). So the words say exactly
 *                 what happens: the message is copied, paste it in the chat.
 *   · More apps… → the phone's own share sheet (Telegram, Instagram, LINE, …) —
 *                 the shipped `shareInvite` in send-invite.tsx, message + ticket.
 *                 Where there is no share sheet: COPY.
 *
 * 🔑 THE MESSAGE IS THE SHIPPED ONE (`buildGuestInviteMessage`), so every link
 * carries the guest's OWN personal link — the one the share sheet and Copy
 * message already hand over — URL-encoded with `encodeURIComponent`. Nothing is
 * added to a URL beyond that message: it is the same text the share sheet hands
 * to the same app.
 *
 * 🔑 OPENING AN APP IS NOT A SEND. We cannot see whether the host pressed send in
 * WhatsApp, so none of these ever stamps Sent ✓; the surface OFFERS "Mark as
 * sent" (the shipped rule for a copy — `send-invite-is-honest.test.ts` ⓷). Only
 * a share sheet that an app took (`shareInvite` → 'shared') stamps by itself.
 */

export const INVITE_APPS = ['whatsapp', 'viber', 'messenger', 'more'] as const;
export type InviteApp = (typeof INVITE_APPS)[number];

/** The app's name as the host reads it — plain words, no brand artwork (none is licensed in this repo). */
export const INVITE_APP_NAMES: Record<InviteApp, string> = {
  whatsapp: 'WhatsApp',
  viber: 'Viber',
  messenger: 'Messenger',
  more: 'More apps…',
};

/** Messenger opened empty, for the paste — a computer's and a phone's. Static: no recipient, no text. */
export const MESSENGER_WEB_URL = 'https://www.messenger.com/';
export const MESSENGER_APP_URL = 'fb-messenger://';

export type InviteAppPlan =
  /** The app opens with the message typed in. */
  | { kind: 'open'; url: string }
  /** The message is copied first, then the app opens empty — paste it. */
  | { kind: 'copy-open'; url: string }
  /** The message is copied; the words say where to paste it. */
  | { kind: 'copy' }
  /** The phone's own share sheet (`shareInvite`). */
  | { kind: 'share' };

export type InviteDevice = {
  /** A finger, not a mouse (`(pointer: coarse)`) — a phone or a tablet. */
  touch: boolean;
  /** `navigator.share` exists. */
  share: boolean;
};

export function whatsAppInviteUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function viberInviteUrl(text: string): string {
  return `viber://forward?text=${encodeURIComponent(text)}`;
}

/** What tapping `app` does on this device, for this message. Pure — the test executes every branch. */
export function inviteAppPlan(app: InviteApp, text: string, device: InviteDevice): InviteAppPlan {
  switch (app) {
    case 'whatsapp':
      return { kind: 'open', url: whatsAppInviteUrl(text) };
    case 'viber':
      return device.touch ? { kind: 'open', url: viberInviteUrl(text) } : { kind: 'copy' };
    case 'messenger':
      return { kind: 'copy-open', url: device.touch ? MESSENGER_APP_URL : MESSENGER_WEB_URL };
    case 'more':
      return device.share ? { kind: 'share' } : { kind: 'copy' };
  }
}

/** One short line under each choice — what it will do here (title + one short line; the rest is in the ⓘ). */
export function inviteAppHint(app: InviteApp, device: InviteDevice): string {
  const plan = inviteAppPlan(app, '', device);
  if (app === 'more') return plan.kind === 'share' ? 'Message + ticket, any app' : 'Copies the message';
  if (plan.kind === 'open') return 'Opens with the message ready';
  if (plan.kind === 'copy-open') return 'Copies it, then opens — paste';
  return app === 'viber' ? 'Copies it — paste it in Viber' : 'Copies the message';
}

/** What the host is told after the tap — never "sent": we only opened their app. */
export function inviteAppSaid(app: InviteApp, plan: InviteAppPlan, first: string): string {
  const name = INVITE_APP_NAMES[app];
  if (plan.kind === 'open') return `${name} opened with the message. Pick ${first}, send it, then mark it sent.`;
  if (plan.kind === 'copy-open') return `Message copied. Paste it to ${first} in ${name}, then mark it sent.`;
  if (app === 'viber') return `Viber on a computer can’t take a message from a link, so it’s copied. Paste it to ${first} in Viber.`;
  return `Message copied. Paste it to ${first}, then mark it sent.`;
}

/** A phone or tablet — a finger, not a mouse. SSR-safe: false on the server. */
export function isTouchDevice(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches === true;
}

export function inviteDevice(): InviteDevice {
  return {
    touch: isTouchDevice(),
    share: typeof navigator !== 'undefined' && typeof navigator.share === 'function',
  };
}

/**
 * Carries out an 'open' / 'copy-open' / 'copy' plan inside the tap ('share' is the
 * caller's own `shareInvite`). Returns what happened so the surface can say it:
 *   'done'   — opened and/or copied;
 *   'manual' — the clipboard refused (some in-app browsers): show the text to select.
 *
 * 🪤 A phone opens the app in the SAME tab (`location.href`) — a scheme or a
 * universal link hands off to the app and the page stays. A computer opens a new
 * tab, so the guest list is still there to Mark as sent. The copy happens BEFORE
 * the new tab: a page that has lost focus is refused the clipboard.
 */
export async function runInviteAppPlan(
  plan: Exclude<InviteAppPlan, { kind: 'share' }>,
  text: string,
  touch: boolean,
): Promise<'done' | 'manual'> {
  if (plan.kind !== 'open') {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return 'manual';
    }
  }
  if (plan.kind === 'copy') return 'done';
  if (touch) {
    window.location.href = plan.url;
  } else {
    const tab = window.open(plan.url, '_blank');
    if (tab) tab.opener = null;
  }
  return 'done';
}
