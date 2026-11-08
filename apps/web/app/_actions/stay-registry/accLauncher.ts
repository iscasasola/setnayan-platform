import 'server-only';
import { INCOMING_REQUEST_FAILED, type AccLauncherStayDoor } from '@/lib/stay-doors/accLauncher';
import { redirectPath, type StayResult } from '@/lib/save-in-place';
import { answerIncomingRequest, muteInviter } from '@/app/dashboard/(launcher)/incoming-request-actions';
import { kindRead, type Door } from './_door';

/**
 * The launcher IS bare `/dashboard`, which the shared reader always lets through (a "not on this event" bounce lands
 * there) — so this area reads its own two outcomes and nothing else: `?request_declined=1` / `?inviter_muted=1` →
 * saved (the card leaves the list in place); `?request_error=1` → refused, in the card's own words. Everything else
 * navigates as before: Yes → the invitation's own page, a malformed form → bare `/dashboard`, signed out → `/login`.
 */
function readLauncher(url: string): StayResult | 'navigate' {
  if (redirectPath(url) !== '/dashboard') return 'navigate';
  const q = new URLSearchParams(url.includes('?') ? (url.slice(url.indexOf('?') + 1).split('#')[0] ?? '') : '');
  if (q.get('request_error') === '1') return { ok: false, error: INCOMING_REQUEST_FAILED };
  if (q.get('request_declined') === '1' || q.get('inviter_muted') === '1') return { ok: true };
  return 'navigate';
}
const accLauncher = kindRead(readLauncher, null);

export const ACC_LAUNCHER: Readonly<Record<AccLauncherStayDoor, Door>> = {
  'accLauncher.answerIncomingRequest': accLauncher(answerIncomingRequest),
  'accLauncher.muteInviter': accLauncher(muteInviter),
};
