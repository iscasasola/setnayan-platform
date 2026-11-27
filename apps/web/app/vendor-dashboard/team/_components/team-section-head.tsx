'use client';

/**
 * ‹ A SECTION OF THE TEAM LAYER (final check B13 · B14, drawing `final-check-area-5_2026-11-25.html` § B13 · B14,
 * approved 25 Nov): Roles, and Who gets new inquiries under it, open IN PLACE inside Team's risen screen (`@rise/(.)team`)
 * — one level, never a popup on a popup (Add 1). While a section is up, the layer's head reads "‹ <section>" over
 * Team's own name; ‹ steps back one level (Inquiries → Roles → Team), replacing the address so the phone's Back still
 * closes Team as it always did. On a hard load (no risen layer) the section draws that ‹ row itself.
 * 🔒 app/vendor-dashboard/team/roles-open-in-place.test.ts
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { useRiseRouteHead } from '@/app/_components/rise/rise-route';

export function TeamSectionHead({ title, backTo }: { title: string; /** One level up (Team, or Roles). */ backTo: string }) {
  const router = useRouter();
  const head = useRiseRouteHead();
  const setHead = head?.set;
  useEffect(() => {
    if (!setHead) return;
    setHead({ title, back: { label: 'Back', onBack: () => router.replace(backTo, { scroll: false }) } });
    return () => setHead(null);
  }, [setHead, title, backTo, router]);
  if (head) return null;
  return (
    <div className="flex min-h-12 items-center gap-2.5 pt-1" data-team-section-own-head="">
      <ActionButton tone="neutral" iconOnly icon={ChevronLeft} label="Back" href={backTo} />
      <h1 className="min-w-0 flex-1 truncate text-sn-xl font-bold text-ink">{title}</h1>
    </div>
  );
}
