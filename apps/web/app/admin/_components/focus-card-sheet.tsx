'use client';

/**
 * FocusCardSheet — a request card opened from Focus rises as a sheet over the list (prototype
 * M2EWM32A9Y9LrJBsYXgagq: a row opens its card; ✕, Back and Esc close it back onto the list). The card inside is the
 * SAME approved 14 Nov card Full opens (`RequestCardView`, drawn on the server and handed in as children).
 *
 * The open card is the address (`/admin?card=<queue>:<id>`), so it is bookmarkable, works with a reload, and closing
 * is only "drop the parameter".
 */
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { Sheet } from '@/app/_components/sheet';

export function FocusCardSheet({ title, kicker, children }: { title: string; kicker: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <Sheet open onClose={() => router.replace('/admin', { scroll: false })} labelledById="focus-card-title" title={kicker}>
      <div className="flex flex-col gap-3 p-4">
        <h2 id="focus-card-title" className="sr-only">
          {title}
        </h2>
        {children}
      </div>
    </Sheet>
  );
}
