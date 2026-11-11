/**
 * 🚫 The claim-word list the labs check against — the 8 Nov list as PR #7480 seeds it (a slice), so a lab shows the
 * fair-presentation notes exactly as a shop would (`lib/fair-presentation.ts`). Dev labs only; never read in the app.
 */
import type { ClaimWord } from '@/lib/service-card-checks';

export const LAB_FAIR_WORDS: ClaimWord[] = [
  ['best', 'Rank: a claim a couple cannot check'],
  ['the best', 'Rank: a claim a couple cannot check'],
  ['#1', 'Rank: a claim a couple cannot check'],
  ['no. 1', 'Rank: a claim a couple cannot check'],
  ['number one', 'Rank: a claim a couple cannot check'],
  ['top', 'Rank: a claim a couple cannot check'],
  ['leading', 'Rank: a claim a couple cannot check'],
  ['trending', 'Popularity: a claim a couple cannot check'],
  ['most booked', 'Popularity: a claim a couple cannot check'],
  ['guaranteed', 'Promise: a claim a couple cannot check'],
  ['100%', 'Promise: a claim a couple cannot check'],
  ['official', 'Promise: a claim a couple cannot check'],
  ['lowest price', 'Promise: a claim a couple cannot check'],
  ['hurry', 'Pressure: rushes a decision'],
  ['sikat', 'Tagalog claim'],
  ['verified', 'Setnayan’s earned badge — given by Setnayan, never self-claimed'],
].map(([phrase, why]) => ({ phrase: phrase!, why: why! }));
