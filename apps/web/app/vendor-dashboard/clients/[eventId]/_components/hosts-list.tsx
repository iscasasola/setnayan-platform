'use client';

import { ChevronRight } from 'lucide-react';
import { ROLE_SUBTYPE_LABEL } from '@/lib/event-moderators';
import { usePickedNav } from './picked-client-nav';

/**
 * 👥 HOSTS · in your shared chat — on Details (THE ONE BUILD, 8 Nov 2026 · v113 · B1 step 6.3).
 *
 * ⏳ TYPED STUB until C2's `-data` lands `brief.hosts` (`event_chat_hosts()` — spec §9 #1). The shape below is that
 * RPC's JSON row. While the brief carries no `hosts` key the section is not drawn at all — absent data is never
 * drawn as "no hosts". Each row: initials · first name · role label (`ROLE_SUBTYPE_LABEL`, else "Host") · In chat ›.
 */
export type BriefHost = {
  user_id: string;
  first_name: string | null;
  name: string | null;
  role: string | null;
  label: string | null;
};

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1]![0] : '')).toUpperCase() || '·';
}

function roleWords(h: BriefHost): string {
  const role = h.role && (ROLE_SUBTYPE_LABEL as Record<string, string>)[h.role];
  return role ? `Host · ${role.toLowerCase()}` : h.label?.trim() || 'Host';
}

export function HostsList({ hosts }: { hosts: BriefHost[] | undefined }) {
  const nav = usePickedNav();
  if (hosts === undefined) return null;
  return (
    <section data-details-hosts="" aria-label="Hosts">
      <p className="home-k2 pb-1">Hosts · in your shared chat</p>
      {hosts.length === 0 ? (
        <p className="text-[13px] text-ink/60">Nobody from the event is in the chat yet.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {hosts.map((h) => {
            const name = h.first_name?.trim() || h.name?.trim() || 'A host';
            return (
              <li key={h.user_id}>
                <button
                  type="button"
                  onClick={() => nav?.select('chat')}
                  className="sn-press flex min-h-12 w-full items-center gap-3 py-2 text-left"
                  data-details-host={h.user_id}
                >
                  <span aria-hidden className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink/[0.06] text-[12px] font-semibold text-ink/70">
                    {initialsOf(name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{name}</span>
                    <span className="block text-[12px] text-ink/60">{roleWords(h)}</span>
                  </span>
                  <span className="flex items-center gap-0.5 text-[12px] text-ink/60">
                    In chat <ChevronRight aria-hidden className="h-3.5 w-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
