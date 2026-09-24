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

/**
 * THE PLAIN MASTHEAD'S EYEBROW — the words after "№ 01" when there is no card
 * (every hero-photo/video masthead, and the solemn register's text masthead).
 *
 * 🔴 A WAKE WAS TOLD "You are invited". `invitationCard` withholds the card for
 * the solemn register so the funeral "keeps the quiet masthead it has today" —
 * but that quiet masthead's eyebrow was `PahinaMasthead`'s DEFAULT, 'You are
 * invited', and no call site passed one. Measured by rendering it (2026-09-24):
 * a wake's first screen read "№ 01 · You are invited". `null` renders no words
 * at all — the same answer `invitationCard` gives, and the same answer the
 * story gives for Relive (the-wake-never-celebrates): the solemn arm withholds,
 * it does not invent new copy.
 *
 * 🔒 Every other register is byte-identical: 'You are invited' is the default
 * the masthead has always rendered.
 */
export function mastheadEyebrow(words: Pick<EventWords, 'solemn'>): string | null {
  return words.solemn ? null : 'You are invited';
}

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
