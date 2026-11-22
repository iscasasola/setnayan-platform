/**
 * How big a Papic pack is, in the three sizes the ticket sheet's words are drawn for (small · mid · the biggest).
 * The thresholds are CREDITS (photos) — never a price. They sit in their own file so no peso figure can be mistaken for
 * one, and so the words file carries no number at all.
 */
export type PapicPackSize = 'biggest' | 'mid' | 'small';

const BIGGEST_FROM_CREDITS = 3000;
const MID_FROM_CREDITS = 1000;

export function papicPackSize(credits: number): PapicPackSize {
  if (credits >= BIGGEST_FROM_CREDITS) return 'biggest';
  if (credits >= MID_FROM_CREDITS) return 'mid';
  return 'small';
}
