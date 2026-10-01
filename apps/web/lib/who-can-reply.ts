/**
 * who-can-reply.ts — does the Guest list's first visit ask "Who can reply?"
 *
 * ⚖ Owner 2026-09-30 (DECISION_LOG "THE FIRST VISIT TO THE GUEST LIST ASKS WHICH
 * KIND OF LIST"): *"so when we first enter the guestlist. we have settings where
 * guest based or anyone and i approve. to make it easier, we do a popup so they
 * can initially pick what type of guestlist"*. One question, two answers,
 * writing the EXISTING "Who can RSVP?" value (`events.rsvp_ask_config.whoCanRsvp`,
 * read everywhere through `readWhoCanRsvp`) — no new setting.
 *
 * 🔑 ONCE PER EVENT, BECAUSE THE ANSWER IS THE MEMORY. The pop-up asks only
 * while the key is ABSENT — live AND in the Maker's draft. Absent is what
 * `readWhoCanRsvp` reads as the default ("Only my Guest List"), so the page
 * cannot tell "chose the default" from "never asked" by reading the value; it
 * reads whether the key exists. An answer from anywhere — this pop-up, the
 * Maker's RSVP page, onboarding — ends the question for that event.
 *
 * 🔑 THE BASE IS WHAT THE DRAFT HOLDS, OR ELSE THE LIVE VALUE. The one writer
 * (`hubDraftAction` save, the Maker's door) replaces the whole
 * `rsvp_ask_config` object in the draft. Posting only `{ whoCanRsvp }` would
 * silently switch every one of the six RSVP questions back on, so the pop-up
 * posts `{ ...base, whoCanRsvp }` — the same shape `maker-rsvp-ask.tsx` posts.
 *
 * Pure, so `who-can-reply.test.ts` executes every branch.
 */

import { sanitizeRsvpAskConfig, type RsvpAskConfig, type WhoCanRsvp } from './rsvp-ask';

export type WhoCanReplyDraft =
  /** The draft read failed — nothing may be written over it. */
  | { read: 'refused' }
  /** No draft, or a draft that holds no `rsvp_ask_config`. */
  | { read: 'ok'; drafted: false }
  | { read: 'ok'; drafted: true; value: unknown };

/** The config the pop-up extends, or null when it must not ask. */
export function whoCanReplyBase(input: {
  /** Only a host may answer — the writer refuses anyone else. */
  isHost: boolean;
  /** False when the live read was refused: unknown is never "unanswered". */
  liveMeasured: boolean;
  live: unknown;
  draft: WhoCanReplyDraft;
}): RsvpAskConfig | null {
  if (!input.isHost || !input.liveMeasured || input.draft.read === 'refused') return null;
  const live = sanitizeRsvpAskConfig(input.live);
  if (live.whoCanRsvp !== undefined) return null;
  if (input.draft.drafted) {
    const drafted = sanitizeRsvpAskConfig(input.draft.value);
    if (drafted.whoCanRsvp !== undefined) return null;
    return drafted;
  }
  return live;
}

/** The two answers, in the owner's words (DECISION_LOG 2026-09-30). */
export const WHO_CAN_REPLY_CHOICES: ReadonlyArray<{ value: WhoCanRsvp; label: string }> = [
  { value: 'guest_list', label: 'Only people on my list' },
  { value: 'anyone', label: 'Anyone, I approve' },
];

/** The whole object the pop-up posts — never the one key alone. */
export function whoCanReplyPatch(base: RsvpAskConfig, value: WhoCanRsvp): RsvpAskConfig {
  return sanitizeRsvpAskConfig({ ...base, whoCanRsvp: value });
}
