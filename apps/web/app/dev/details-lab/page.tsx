import { notFound } from 'next/navigation';
import { LookLab } from './look-lab';
import { detailsLabNode } from './details-lab-node';

export default async function DetailsLabPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="h-dvh bg-cream text-ink">
      <LookLab>{detailsLabNode(await searchParams)}</LookLab>
    </div>
  );
}

