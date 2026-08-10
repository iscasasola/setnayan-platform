import { resolveSiteReachability, type LaunchState } from './launch-save-the-date';

/**
 * ⚠ IS THE SHARED JOIN LINK ACTUALLY REACHABLE? — the one answer, for the four
 * screens that hand it out.
 *
 * 🚨 THE BUG THIS EXISTS TO KILL, found by the owner on the live site
 * (2026-08-10). `/{slug}/invite` is the ONE link a host shows a room: it is on
 * the Papic crew page as a poster QR, on the printable poster, on the guest
 * list, and on the guest-invite page. **None of those four checked whether the
 * link could work.** They built it from the slug and printed a QR.
 *
 * On 2026-08-06 the invite door was correctly hardened: a PRIVATE event now
 * returns `notFound()`, because a stranger who guessed the address could
 * otherwise type a name, join the guest list, receive a guest session and use it
 * to open the couple's private page. That fix is right and stays.
 *
 * But nothing told the other side. The owner opened his own event's shared QR
 * and got **"Link not found"** — the same screen a mistyped address gets. Three
 * of his five events are private, so the QR was dead on all three, from four
 * screens, with no explanation anywhere.
 *
 * 🔑 A DOOR THAT REFUSES AND A DOOR THAT IS BROKEN LOOK IDENTICAL FROM OUTSIDE.
 * The refusal is deliberate; the SILENCE is the defect.
 *
 * 🔑 AND THIS DOES NOT RE-DERIVE REACHABILITY — IT ASKS THE EXISTING ANSWER.
 * `resolveSiteReachability` (lib/launch-save-the-date.ts) already decides
 * whether a person opening the address sees anything: it folds in a due
 * scheduled launch, the missing-slug case, and the private case, and the
 * `/website` screen has rendered from it for months. A second copy of that rule
 * here is exactly the "second door" this codebase keeps paying for — it would
 * drift the day someone adds a visibility state. All this adds is the ONE thing
 * reachability cannot know (the join token) and the wording for THIS link.
 *
 * PURE — no client, no I/O. Callers already read the event; they pass what they
 * have, so the sentence cannot differ between the four screens.
 */

/** What a shared-link surface must tell the host. */
export type SharedJoinLinkState =
  /** Hand it out — it works. */
  | 'ready'
  /** The event has no address yet, so there is no link to build. */
  | 'no_address'
  /** The event is private: the door refuses everyone, by design. */
  | 'private'
  /** The link exists but its token is missing, revoked or expired. */
  | 'link_expired';

export type SharedJoinLink = {
  state: SharedJoinLinkState;
  /** True only when the QR/link should be shown at all. */
  usable: boolean;
  /**
   * What the host reads when it is NOT usable — plain English, always naming
   * the thing they can change. Null when usable.
   */
  notice: string | null;
};

/**
 * Resolve whether the shared join link can be handed out.
 *
 * @param event       the event row — the same shape `resolveSiteReachability`
 *   takes, plus `slug`. Pass what you already selected; do not pre-compute
 *   visibility, or a due scheduled launch is lost.
 * @param tokenValid  whether a live, unrevoked, unexpired join token exists.
 *
 * ⚠ ORDER MATTERS AND IS NOT ARBITRARY. It mirrors the order the door itself
 * refuses in (`app/[slug]/invite/page.tsx`): no event/slug, then private, then
 * the token. Telling a host to make their event public while the link is ALSO
 * missing its token would send them to do the wrong thing first.
 */
export function sharedJoinLinkState(opts: {
  event: LaunchState & { slug?: string | null };
  tokenValid: boolean;
  now?: number;
}): SharedJoinLink {
  const reach = resolveSiteReachability(opts.event, opts.now ?? Date.now());

  if (!opts.event.slug || !String(opts.event.slug).trim()) {
    return {
      state: 'no_address',
      usable: false,
      notice:
        'This event does not have its own web address yet, so there is no link to share. Give it one on your event website page, then come back.',
    };
  }

  if (!reach.reachable) {
    // reachable is false here only for privacy — the no-slug case returned above.
    return {
      state: 'private',
      usable: false,
      notice: reach.scheduled
        ? 'Your event page has a launch date set and has not gone live yet, so this link opens to “Link not found” for everyone — including your own guests. It starts working by itself the moment it launches, or you can launch it now.'
        : reach.launchedButHidden
          ? 'You launched this event, but its page has since been set back to private — so this link opens to “Link not found” for everyone, including your own guests. Set it to public or unlisted to switch the link back on.'
          : 'Your event is set to private, so this link opens to “Link not found” for everyone — including your own guests. Set it to public or unlisted when you are ready for people to join, and the link starts working straight away.',
    };
  }

  if (!opts.tokenValid) {
    return {
      state: 'link_expired',
      usable: false,
      notice:
        'This link has been turned off or has expired. Issue a fresh one, and reprint anything carrying the old QR.',
    };
  }

  return { state: 'ready', usable: true, notice: null };
}
