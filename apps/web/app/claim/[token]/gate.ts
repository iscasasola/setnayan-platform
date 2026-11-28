import 'server-only';
import { redirect } from 'next/navigation';
import { dependentPeopleEnabled } from '@/lib/dependent-people-flag';

/**
 * The one answer this door gives that is not a door — "switched off, go home" — decided by `./layout.tsx` BEFORE
 * `./loading.tsx` streams, so it stays a 307 instead of a 200, a skeleton and a client hop. The page asks again (a
 * flag read, no I/O) so it never draws the door on its own when the flag is off.
 * 🔒 app/_components/a-route-decides-before-it-streams.test.ts
 */
export function gateClaimDoor(): void {
  if (!dependentPeopleEnabled()) redirect('/');
}
