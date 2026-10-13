import { notFound } from 'next/navigation';
import { LookLab } from './look-lab';
import { detailsLabNode } from './details-lab-node';
import { LabStudioActions } from './lab-studio-actions';
import { SeatLab } from './seat-lab';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  /* 🔢 `?seat=1` — the Seat plan's table sheet with the seat counter (`seat-lab.tsx`), no database. */
  if (sp.seat === '1') {
    const nums = (v: unknown, d: number[]) => (typeof v === 'string' ? v.split(',').map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 10) : d);
    return <SeatLab removed={nums(sp.removed, [8, 9])} seated={nums(sp.seated, [0, 1, 2, 3, 4, 5])} />;
  }
  return (
    <div className="h-dvh bg-cream text-ink">
      {/* Studio pages' writes stand in locally here — a lab press never reaches the database (`the-studio-lab-cannot-reach-the-database.test.ts`). */}
      <LabStudioActions>
        <LookLab>{detailsLabNode(sp)}</LookLab>
      </LabStudioActions>
    </div>
  );
}

