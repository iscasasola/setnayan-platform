import { notFound } from 'next/navigation';
import { LookLab } from './look-lab';
import { detailsLabNode } from './details-lab-node';
import { LabStudioActions } from './lab-studio-actions';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="h-dvh bg-cream text-ink">
      {/* Studio pages' writes stand in locally here — a lab press never reaches the database (`the-studio-lab-cannot-reach-the-database.test.ts`). */}
      <LabStudioActions>
        <LookLab>{detailsLabNode(await searchParams)}</LookLab>
      </LabStudioActions>
    </div>
  );
}

