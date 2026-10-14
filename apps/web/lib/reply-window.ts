/**
 * apps/web/lib/reply-window.ts
 *
 * 📬 WHEN MAY A GUEST REPLY? — the ONE answer (owner 2026-10-14, DECISION_LOG 📬 "RSVP GETS ITS OWN
 * OPEN AND CLOSE"; asked: *"what if we want to open invitation and launch RSVP one month after the
 * invitation was launched"* · *"RSVP switch just on/off or set when to launch with a date? and when to
 * close?"* → **"Approve"**).
 *
 * Measured before this file: a reply had no schedule of its own. It lived on the Invitation (the
 * 2026-10-06 Reply card), the Invitation opened by the clock or the couple's pin, and "Reply by"
 * asked guests but closed nothing (`lib/guest-list-closed.ts` freezes the ANSWER only once the
 * couple finalises the count). Now the couple sets, in Details › RSVP:
 *
 *   Replies open  ▾  With the invitation (default) · On a date… · Now · Closed
 *   Replies close ▾  On the event day (default) · On the reply-by date · On a date…
 *
 * stored in `events.rsvp_ask_config` (`repliesOpen` · `repliesOpenOn` · `repliesClose` ·
 * `repliesCloseOn` — sanitised by `sanitizeRsvpAskConfig`; no new column).
 *
 * ── THE RULES, ALL HERE ─────────────────────────────────────────────────────
 *   (5) The Invitation may open without replies; REPLIES NEVER OPEN WITHOUT THE INVITATION. If the
 *       page is not wearing the Invitation — still the Save the Date, or already The Day / the story —
 *       replies are not open, whatever the setting. The page's face is asked the way the page asks
 *       it: the couple's pin, else the clock (`getLifecyclePhase`, with the ONE date the Invitation
 *       opens), solemn-adjusted.
 *   (4) "Now" and "Closed" are manual and override the dates until switched back: Now opens replies
 *       whatever the open date AND the close date say (it is how a couple re-opens after a close);
 *       Closed shuts them whatever the dates say.
 *   "On the event day" closes when the Invitation hands over to The Day — the same moment the page's one
 *       action stops asking for a reply ("Show your ticket"). So the default is today's behaviour.
 *   "On the reply-by date" / "On a date…" close AFTER that day — a guest may still reply on it.
 *   "On a date…" (open) opens at the START of that day. A pick with no date set yet, or "On the
 *       reply-by date" with no reply-by date, reads as the default until a date is set.
 *   All days are the VENUE's calendar days (`tz`), never the server's.
 *
 * ── WHO ASKS IT ─────────────────────────────────────────────────────────────
 * Every reader and every writer of a guest's reply: the Event Hub's Reply card and one action
 * (site-body.tsx), the key gate (page.tsx), the reply page (invite/reply), the landing (invite/enter),
 * `submitRsvp` (refuses), the join door's request (refuses), and the reminder email's reply line.
 * `lib/every-reply-writer-asks-the-window.test.ts` fails a writer that stops asking.
 * The couple's OWN edits on the Guest list are never gated — they are not a reply.
 *
 * Pure: `now` and the zone are handed in, so every branch runs under a test.
 */
import { getLifecyclePhase, isWebsitePhasesEnabled, manualLaunchPhase } from './invitation-widgets';
import { invitationOpensOn, venueDayOf, ymdOf } from './invitation-opens-on';
import { sanitizeRsvpAskConfig, type RepliesClose, type RepliesOpen } from './rsvp-ask';
import { surfaceEnabled, type EventTypeProfile } from './event-type-profile';
import { solemnAdjustedPhase } from '@/app/[slug]/_lib/event-words';

export type ReplyWindowState = 'not_yet' | 'open' | 'closed';

export type ReplyWindowReason =
  /** The page is still the Save the Date (by the clock, or pinned there). */
  | 'invitation_not_open'
  /** The couple's own open date is still ahead. */
  | 'opens_on_date'
  /** Open by the defaults or the couple's dates. */
  | 'open'
  /** Open because the couple picked "Now". */
  | 'open_now'
  /** The couple picked "Closed". */
  | 'closed_by_couple'
  /** The reply-by date, or the couple's own close date, has passed. */
  | 'close_date_passed'
  /** The Invitation has handed over to The Day (or the story after it). */
  | 'the_day';

export type ReplyWindow = {
  state: ReplyWindowState;
  reason: ReplyWindowReason;
  /** `YYYY-MM-DD` replies open — only while `not_yet`, and only when a date is known. */
  opensOn: string | null;
  /** `YYYY-MM-DD`, the LAST day a reply is taken — when a date closes them. */
  closesOn: string | null;
};

/** Open — what a page that was handed no window draws (every mount before 2026-10-14, the Maker's canvas). */
export const OPEN_REPLY_WINDOW: ReplyWindow = { state: 'open', reason: 'open', opensOn: null, closesOn: null };

/** The event facts the window reads — every one a plain column of `public.events`. */
export type ReplyWindowEvent = {
  event_date: string | null;
  event_end_date?: string | null;
  launch_mode?: string | null;
  manual_phase?: string | null;
  std_invitation_launch_date?: string | null;
  /** The couple's Reply-by date (`guest_list_edit_deadline`). */
  guest_list_edit_deadline?: string | null;
  rsvp_ask_config: unknown;
};

/** The columns `ReplyWindowEvent` names, for a select that must carry them (the zone comes from the venue). */
export const REPLY_WINDOW_EVENT_COLUMNS =
  'event_type, event_date, event_end_date, launch_mode, manual_phase, std_invitation_launch_date, guest_list_edit_deadline, rsvp_ask_config, venue_latitude, venue_longitude' as const;

/** What of the event's TYPE the window needs: does it have a Save the Date face, and is it solemn. */
export type ReplyFace = { phasesEnabled: boolean; solemn: boolean };

/** The face, from the type's profile — the same two facts `app/[slug]/page.tsx` derives. */
export function replyFaceOf(profile: EventTypeProfile): ReplyFace {
  return {
    phasesEnabled: isWebsitePhasesEnabled() || surfaceEnabled(profile, 'website'),
    solemn: profile.terminology.register === 'solemn',
  };
}

const dayOf = (v: unknown): string | null => ymdOf(v);

/** The couple's two picks, as stored (defaults applied). */
export function readRepliesWindow(raw: unknown): {
  open: RepliesOpen;
  openOn: string | null;
  close: RepliesClose;
  closeOn: string | null;
} {
  const cfg = sanitizeRsvpAskConfig(raw);
  return {
    open: cfg.repliesOpen ?? 'with_invitation',
    openOn: cfg.repliesOpenOn ?? null,
    close: cfg.repliesClose ?? 'on_the_day',
    closeOn: cfg.repliesCloseOn ?? null,
  };
}

/** Where the page's face stands relative to the Invitation (rule 5). */
function invitationStage(event: ReplyWindowEvent, nowMs: number, tz: string | undefined, face: ReplyFace): 'before' | 'open' | 'after' {
  const pinned = face.phasesEnabled ? manualLaunchPhase(event.launch_mode, event.manual_phase) : null;
  const phase = solemnAdjustedPhase(
    pinned ??
      getLifecyclePhase(dayOf(event.event_date), tz, dayOf(event.event_end_date), nowMs, dayOf(event.std_invitation_launch_date)),
    face.solemn,
  );
  if (phase === 'event' || phase === 'editorial') return 'after';
  // With the lifecycle engine off there is no Save the Date face: the page IS the invitation.
  if (phase === 'save_the_date' && face.phasesEnabled) return 'before';
  return 'open';
}

/**
 * THE WINDOW. `now` is a Date or epoch ms; `tz` the venue's zone (`eventTimezoneFromCoords`).
 */
export function replyWindow(event: ReplyWindowEvent, now: Date | number, tz: string | null | undefined, face: ReplyFace): ReplyWindow {
  const nowMs = typeof now === 'number' ? now : now.getTime();
  const zone = (tz ?? '').trim() || undefined;
  const today = venueDayOf(zone, nowMs);
  const pick = readRepliesWindow(event.rsvp_ask_config);
  const stage = invitationStage(event, nowMs, zone, face);
  const pinnedBefore = face.phasesEnabled && manualLaunchPhase(event.launch_mode, event.manual_phase) === 'save_the_date';
  const invitationDay = pinnedBefore ? null : invitationOpensOn(event.event_date, event.std_invitation_launch_date);

  if (pick.open === 'closed') return { state: 'closed', reason: 'closed_by_couple', opensOn: null, closesOn: null };
  if (stage === 'after') return { state: 'closed', reason: 'the_day', opensOn: null, closesOn: null };

  if (pick.open === 'now') {
    return stage === 'open'
      ? { state: 'open', reason: 'open_now', opensOn: null, closesOn: null }
      : { state: 'not_yet', reason: 'invitation_not_open', opensOn: invitationDay, closesOn: null };
  }

  // The close — after its last day. "On the reply-by date" with no reply-by date reads as On the event day.
  const closesOn = pick.close === 'reply_by' ? dayOf(event.guest_list_edit_deadline) : pick.close === 'on_date' ? pick.closeOn : null;
  if (closesOn && today > closesOn) return { state: 'closed', reason: 'close_date_passed', opensOn: null, closesOn };

  const ownOpen = pick.open === 'on_date' ? pick.openOn : null;
  if (stage === 'before') {
    // Rule 5: never before the Invitation — the later of the two days, when both are known.
    const opensOn = invitationDay && ownOpen ? (ownOpen > invitationDay ? ownOpen : invitationDay) : invitationDay;
    return { state: 'not_yet', reason: 'invitation_not_open', opensOn, closesOn };
  }
  if (ownOpen && today < ownOpen) return { state: 'not_yet', reason: 'opens_on_date', opensOn: ownOpen, closesOn };
  return { state: 'open', reason: 'open', opensOn: null, closesOn };
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * "Saturday, 14 November" — the ruling's own shape for a day. Null for anything that is not a day.
 * The day and its month are joined by a no-break space, so a phone never wraps "14 / November".
 */
export function replyDayLabel(ymd: string | null | undefined): string | null {
  const day = dayOf(ymd);
  if (!day) return null;
  const [y = NaN, m = NaN, d = NaN] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (Number.isNaN(t.getTime())) return null;
  return `${WEEKDAYS[t.getUTCDay()]}, ${t.getUTCDate()}\u00a0${MONTHS[t.getUTCMonth()]}`;
}

/**
 * What a guest reads when replies are not open (DECISION_LOG 📬 items 2 and 3, the approved words).
 * `line` is the card's headline, `sub` the line under it. Null while replies are open.
 * `organizer` is the event's own word for its hosts (`EventWords.theOrganizer` — "the couple").
 */
export function replyWindowWords(window: ReplyWindow, organizer = 'the couple'): { line: string; sub: string | null } | null {
  if (window.state === 'open') return null;
  if (window.state === 'not_yet') {
    const label = replyDayLabel(window.opensOn);
    return { line: label ? `Replies open on ${label}` : 'Replies are not open yet', sub: null };
  }
  return { line: 'Replies are closed.', sub: `Need to change? Message ${organizer}.` };
}

/** The refusal a writer gives when a reply arrives outside the window — one sentence, the page shows it. */
export function replyRefusedWords(window: ReplyWindow, organizer = 'the couple'): string {
  const said = replyWindowWords(window, organizer);
  if (!said) return '';
  return `Your reply was not sent. ${said.line}${said.line.endsWith('.') ? '' : '.'}${said.sub ? ` ${said.sub}` : ''}`;
}
