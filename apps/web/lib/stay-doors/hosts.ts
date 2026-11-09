/** Hosts — Event Details › People with access (Remove…) and a supplier's workspace (Revoke an invite). */
export const HOSTS_STAY_DOORS = ['hosts.removeHost', 'hosts.revokeHostInvite'] as const;
export type HostsStayDoor = (typeof HOSTS_STAY_DOORS)[number];
