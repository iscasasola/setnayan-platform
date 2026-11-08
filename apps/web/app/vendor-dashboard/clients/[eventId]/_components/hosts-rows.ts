/**
 * 👥 The hosts as rows, worded on the SERVER (`ROLE_SUBTYPE_LABEL` lives in a server-only module), then handed to the
 * client `HostsList`. The source is C2's `brief.hosts` (`event_chat_hosts()`, migration 20271324946509), parsed by the
 * ONE parser the chat uses (`chatHostsFrom`) and named by the ONE word rule (`hostFirstName` · `hostInitials`) — so
 * Details and the chat strip can never call the same host two different things (integration, 8 Nov 2026).
 */
import { ROLE_SUBTYPE_LABEL } from '@/lib/event-moderators';
import { chatHostsFrom, hostFirstName, hostInitials } from '@/lib/chat-hosts';

export type HostRow = { id: string; name: string; initials: string; role: string };

/** A brief whose `hosts` is missing or not a list was not read — `undefined`, never drawn as "no hosts". */
export function hostRows(rawHosts: unknown): HostRow[] | undefined {
  const hosts = chatHostsFrom(rawHosts);
  if (hosts === null) return undefined;
  return hosts.map((h) => {
    const role = h.role ? (ROLE_SUBTYPE_LABEL as Record<string, string>)[h.role] : undefined;
    return {
      id: h.userId,
      name: hostFirstName(h),
      initials: hostInitials(h),
      role: role ? `Host · ${role.toLowerCase()}` : h.label || 'Host',
    };
  });
}
