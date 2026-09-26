/**
 * /suppliers/[event]/[category] — the NATIONWIDE landing page for one event
 * type and one category, e.g. /suppliers/debut/coordinator. All rules and the
 * render live in `../../_landing.tsx`; this file only hands over the slugs.
 */
import { SupplierLanding, landingMetadata } from '../../_landing';

type Props = { params: Promise<{ event: string; category: string }> };

export async function generateMetadata({ params }: Props) {
  return landingMetadata(await params);
}

export default async function SupplierCategoryPage({ params }: Props) {
  return <SupplierLanding params={await params} />;
}
