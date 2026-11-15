'use client';

import type { ReactNode } from 'react';
import { PhotoChatContext } from '@/app/vendor-dashboard/collections/_components/send-photo-to-chat';
import type { ShareTarget } from '@/lib/service-share-targets';

/**
 * 🧪 Send to a chat, from fixtures (ruling 5951) — `/dev/supplier-lab?s=portfolio-tab`. The SAME panel the page mounts,
 * handed sample client chats and a stand-in post that answers like the shipped door (`notified: 0` — this door never
 * claims who was told). `&unread=1` → the chats read as refused. No database, no network.
 */
const LAB_CHATS: ShareTarget[] = [
  { threadId: 'lab-t1', eventId: 'ev-santos', name: 'Santos – Dela Cruz wedding', eventDate: '2026-11-07', dateLabel: '7 Nov 2026', initials: 'SD' },
  { threadId: 'lab-t2', eventId: 'ev-cruz', name: 'Cruz debut', eventDate: '2026-12-05', dateLabel: '5 Dec 2026', initials: 'CD' },
  { threadId: 'lab-t3', eventId: 'ev-lim', name: 'Lim 50th anniversary', eventDate: '2027-01-16', dateLabel: '16 Jan 2027', initials: 'LA' },
];

export function LabPortfolioChats({ unread, children }: { unread: boolean; children: ReactNode }) {
  return (
    <PhotoChatContext.Provider
      value={{
        targets: unread ? null : LAB_CHATS,
        share: async () => {
          await new Promise((r) => requestAnimationFrame(r));
          return { status: 'ok', notified: 0 };
        },
      }}
    >
      {children}
    </PhotoChatContext.Provider>
  );
}
