/**
 * 👥 The hosts as rows, worded on the SERVER (`ROLE_SUBTYPE_LABEL` lives in a server-only module), then handed to the
 * client `HostsList`. ⏳ `BriefHost` is the typed stub of C2's `event_chat_hosts()` row until `-data` lands.
 */
import { ROLE_SUBTYPE_LABEL } from '@/lib/event-moderators';

export type BriefHost = {
  user_id: string;
  first_name: string | null;
  name: string | null;
  role: string | null;
  label: string | null;
};

export type HostRow = { id: string; name: string; initials: string; role: string };

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '·';
}

/** `undefined` (the brief carries no `hosts` yet) stays `undefined` — never drawn as "no hosts". */
export function hostRows(hosts: BriefHost[] | undefined): HostRow[] | undefined {
  if (hosts === undefined) return undefined;
  return hosts.map((h) => {
    const name = h.first_name?.trim() || h.name?.trim() || 'A host';
    const role = h.role ? (ROLE_SUBTYPE_LABEL as Record<string, string>)[h.role] : undefined;
    return { id: h.user_id, name, initials: initialsOf(name), role: role ? `Host · ${role.toLowerCase()}` : h.label?.trim() || 'Host' };
  });
}
