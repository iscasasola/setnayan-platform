/**
 * /suppliers/[event]/[category] — the NATIONWIDE landing page for one event
 * type and one category, e.g. /suppliers/debut/coordinator. All rules and the
 * render live in `../../_landing.tsx`; this file only hands over the slugs.
 */
import { notFound } from 'next/navigation';
import { SupplierLanding, landingExists, landingMetadata } from '../../_landing';

type Props = { params: Promise<{ event: string; category: string }> };

export async function generateMetadata({ params }: Props) {
  return landingMetadata(await params);
}

export default async function SupplierCategoryPage({ params }: Props) {
  const p = await params;
  // A mistyped slug is a real 404 — never a streamed 200 (see _landing.tsx).
  if (!(await landingExists(p))) notFound();
  return <SupplierLanding params={p} />;
}
