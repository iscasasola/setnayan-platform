'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import type { WhoMadeTheDaySupplier } from '@/lib/who-made-the-day';

/**
 * 🚪 "WHO MADE THE DAY?" — prototype 6 Nov § 8, door 2: one row on the guest's Hub after the day; a tap opens ONE
 * dropdown of this event's delivered suppliers ("Bloom & Co. · flowers" · Not yet rated); each choice opens the one
 * guest-review screen for that supplier alone. The page decides whether the row exists (`readWhoMadeTheDay`).
 */
export function WhoMadeTheDay({ eventId, suppliers }: { eventId: string; suppliers: WhoMadeTheDaySupplier[] }) {
  const router = useRouter();
  return (
    <div className="mt-6" data-who-made-the-day="">
      <PickMenu
        label="Who made the day?"
        value={null}
        options={suppliers.map((s) => ({
          key: s.slug,
          label: s.trade ? `${s.name} · ${s.trade}` : s.name,
          trail: s.rated ? { text: 'Rated', tone: 'ok' as const } : { text: 'Not yet rated', tone: 'muted' as const },
        }))}
        onPick={(slug) => router.push(`/v/${slug}/guest-review?event=${encodeURIComponent(eventId)}`)}
        dataAttr="data-who-made-the-day-pick"
        className="w-full border-t border-ink/10 py-3 text-left"
        trigger={
          <span className="flex w-full items-center justify-between gap-3">
            <span className="min-w-0">
              <span className="block text-[15px] font-medium text-ink">Who made the day?</span>
              <span className="block text-xs text-ink/65">Rate a supplier you saw at work</span>
            </span>
            <ChevronDown aria-hidden className="h-5 w-5 shrink-0 text-terracotta" strokeWidth={2} />
          </span>
        }
      />
    </div>
  );
}
