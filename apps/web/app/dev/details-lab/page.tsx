import { notFound } from 'next/navigation';
import { LookLab } from './look-lab';
import { detailsLabNode } from './details-lab-node';
import { LabStudioActions } from './lab-studio-actions';
import { SeatLab } from './seat-lab';
import { AccessClaimLab } from './access-claim-lab';
import { AccessGrantLab } from './access-grant-lab';
import { MoodBoardAsksLab } from './mood-board-asks-lab';
import { LabPageSpotlight } from '../_components/lab-page-spotlight';
import { TOURS } from '@/lib/tours';
import { HOST_PAGE_TOURS } from '@/lib/host-page-tours';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  /* 🔢 `?seat=1` — the Seat plan's table sheet with the seat counter (`seat-lab.tsx`), no database. */
  if (sp.seat === '1') {
    const nums = (v: unknown, d: number[]) => (typeof v === 'string' ? v.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 10) : d);
    return <SeatLab removed={nums(sp.removed, [8, 9])} seated={nums(sp.seated, [0, 1, 2, 3, 4, 5])} />;
  }
  /* 🤝 `?access=claim` — Event access with suppliers who joined from the link waiting for Approve (`access-claim-lab.tsx`). */
  if (sp.access === 'claim') {
    return <AccessClaimLab claims={sp.claims === '0' ? 'none' : sp.claims === 'fail' ? 'fail' : 'some'} />;
  }
  /* 🖼 `?access=grant` — Event access where the hosts give one person Mood Board Edit (`access-grant-lab.tsx`). */
  if (sp.access === 'grant') return <AccessGrantLab />;
  /* 🖼⏱ `?asks=moodboard` — Home's Mood Board lines: a supplier's photo to approve, a coordinator's change to Undo. */
  if (sp.asks === 'moodboard') {
    return <MoodBoardAsksLab open={sp.open === 'changes' || sp.open === 'approve' ? sp.open : null} />;
  }
  return (
    <div className="h-dvh bg-cream text-ink">
      {/* Studio pages' writes stand in locally here — a lab press never reaches the database (`the-studio-lab-cannot-reach-the-database.test.ts`). */}
      <LabStudioActions>
        <LookLab>{detailsLabNode(sp)}</LookLab>
      </LabStudioActions>
      {/* 🔦 `&spot=mood` — the Mood Board's first-visit spotlight (owner 2026-10-22), first run. */}
      {sp.spot === 'mood' && TOURS[HOST_PAGE_TOURS.moodBoard].spotlight ? (
        <LabPageSpotlight tourKey={HOST_PAGE_TOURS.moodBoard} script={TOURS[HOST_PAGE_TOURS.moodBoard].spotlight!} />
      ) : null}
    </div>
  );
}

