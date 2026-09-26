/**
 * /suppliers/[event]/[category]/[city] — one event type, one category, one
 * city, e.g. /suppliers/debut/coordinator/quezon-city. All rules and the
 * render live in `../../../_landing.tsx`; this file only hands over the slugs.
 */
import { notFound } from 'next/navigation';
import { SupplierLanding, landingExists, landingMetadata } from '../../../_landing';

type Props = { params: Promise<{ event: string; category: string; city: string }> };

export async function generateMetadata({ params }: Props) {
  return landingMetadata(await params);
}

export default async function SupplierCityPage({ params }: Props) {
  const p = await params;
  // A mistyped slug is a real 404 — never a streamed 200 (see _landing.tsx).
  if (!(await landingExists(p))) notFound();
  return <SupplierLanding params={p} />;
}
