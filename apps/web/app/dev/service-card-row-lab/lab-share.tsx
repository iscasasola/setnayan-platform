'use client';

/**
 * The lab's Share frames. `LabOpenShare` presses the FIRST card's real Share icon once on load (frame G is the sheet
 * open). `LabChat` is frame H: the SHIPPED `ChatOfferedServiceCard` — the exact component the chat stream draws for a
 * posted card — under the toast the Share leaves ("<Client> notified", the real `sharedToast`). Its card read
 * (`/api/chat/offered-service/<id>`) is answered by the screenshot script; with no answer it shows its own fallback.
 */
import { useEffect } from 'react';
import { ChatOfferedServiceCard } from '@/app/_components/chat-offered-service-card';
import { sharedToast } from '@/app/vendor-dashboard/services/_components/service-card-share-sheet';
import { guestToast } from '@/app/dashboard/[eventId]/guests/_components/undo-store';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';

export function LabOpenShare() {
  useEffect(() => {
    const t = setTimeout(() => document.querySelector<HTMLButtonElement>('[data-card-share]')?.click(), 50);
    return () => clearTimeout(t);
  }, []);
  return null;
}

export function LabChat() {
  useEffect(() => {
    guestToast.success(sharedToast('Reyes–Santos Wedding', 2));
  }, []);
  return (
    <main className="mx-auto w-full max-w-xl space-y-4 px-4 py-6">
      <div className="space-y-0.5">
        <p className="text-[17px] font-semibold text-ink">Reyes–Santos Wedding</p>
        <p className="text-xs text-ink/55">Lab · the supplier’s chat with this client after Share — the shipped card</p>
      </div>
      <div className="flex flex-col items-end" data-lab-chat="">
        <ChatOfferedServiceCard messageId="00000000-0000-4000-8000-0000000c4a71" fallbackBody="Offered: Garden Wedding Live Band" />
      </div>
      <UndoToastHost />
    </main>
  );
}
