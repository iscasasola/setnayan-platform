import 'server-only';
import type { HostsStayDoor } from '@/lib/stay-doors/hosts';
import { eventScreen, type StayWords } from '@/lib/save-in-place';
import { removeHost, revokeHostInvite } from '@/app/dashboard/[eventId]/hosts/actions';
import { kind, type Door } from './_door';

/**
 * Who has access — the forms land back where they were pressed (`lib/seat-return-path.ts`): Event Details (`return_to=
 * details`) or the supplier's workspace. `?invite_error=` carries the page's own sentence ("You cannot remove
 * yourself."). `inviteHost` is NOT a door: its landing shows the one-time invite link from `?token=`.
 */
const HOSTS_WORDS: StayWords = {
  within: [eventScreen('details'), /^\/dashboard\/[^/]+\/vendors\/[^/]+\/workspace$/],
  refuse: (q) => q.get('invite_error'),
};
const hosts = kind(HOSTS_WORDS, null);

export const HOSTS: Readonly<Record<HostsStayDoor, Door>> = {
  'hosts.removeHost': hosts(removeHost),
  'hosts.revokeHostInvite': hosts(revokeHostInvite),
};
