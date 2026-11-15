import { notFound } from 'next/navigation';
import { RowBody } from '../row-body';

/** A hard load of a row's address: the full page, as the real routes draw on a deep link. */
export default async function RiseRouteLabRowPage({ params }: { params: Promise<{ row: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { row } = await params;
  return (
    <main className="min-h-dvh bg-cream text-ink">
      <h1 className="px-4 pt-6 text-2xl font-semibold">{row}</h1>
      <RowBody row={row} />
    </main>
  );
}
