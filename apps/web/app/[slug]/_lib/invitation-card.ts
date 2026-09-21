/**
 * apps/web/app/[slug]/_lib/invitation-card.ts
 *
 * THE INVITATION CARD'S WORDS (owner 2026-09-21 — canvas "1 · Arrival").
 *
 * Pure: every word comes from `EventWords`, never from a literal wedding. A
 * wedding reads "Together with their families · … invite you to celebrate
 * their wedding"; a birthday "their birthday"; one person at the centre
 * "invites you to celebrate". The solemn register (a funeral) gets NO card —
 * `null` — and keeps the quiet masthead it has today (the-wake-never-celebrates).
 */
import type { EventWords } from './event-words';
import { formatBlockTimeRange } from '@/lib/schedule';
import { SITE_MENU_ANCHORS } from './site-menu';

export type InvitationCard = {
  eyebrow: string;
  line: string | null;
  timeLabel: string | null;
  hubHref: string;
  hubLabel: string;
};

export function invitationCard(input: {
  words: Pick<EventWords, 'solemn' | 'twoPeople' | 'eventWord'>;
  /** The programme's first moment, as stored (the event's own wall-clock). */
  firstStartAt: string | null | undefined;
}): InvitationCard | null {
  const { words } = input;
  if (words.solemn) return null;
  return {
    eyebrow: words.twoPeople ? 'Together with their families' : 'You are invited',
    line: words.twoPeople
      ? `invite you to celebrate their ${words.eventWord}`
      : 'invites you to celebrate',
    // The programme's own formatter, so the card, the pass and the run of show
    // read one clock (the pass once added eight hours by converting twice).
    timeLabel: input.firstStartAt ? formatBlockTimeRange(input.firstStartAt, null) || null : null,
    hubHref: `#${SITE_MENU_ANCHORS.details}`,
    hubLabel: 'the day, the place, the story',
  };
}
