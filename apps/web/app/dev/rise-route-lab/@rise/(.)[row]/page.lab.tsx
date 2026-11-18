import { notFound } from 'next/navigation';
import { RowBody } from '../../row-body';

/** A slow body (a real supplier page reads a lot): it streams into the already-risen screen. */
export default async function RisenLabRow({ params }: { params: Promise<{ row: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { row } = await params;
  await new Promise((r) => setTimeout(r, 2500));
  return <RowBody row={row} />;
}
