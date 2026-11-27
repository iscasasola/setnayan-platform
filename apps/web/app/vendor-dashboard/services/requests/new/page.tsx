import { redirect } from 'next/navigation';

import { SERVICE_MAKER_HREF } from '@/lib/service-picker-anchor';
import type { TellUsSearch } from '../_components/tell-us-view';

export const metadata = { title: 'Tell us what you do · Supplier' };

/**
 * /vendor-dashboard/services/requests/new — A FORWARD (final check B9, drawing `final-check-area-5_2026-11-25.html`
 * § B9, approved 25 Nov). "Tell us what you do" now opens IN PLACE inside the card maker's layer (`TellUsHost`), not as
 * three page loads, so this address — the Services page's links, a bookmark, an old notice — opens the maker with the
 * section open, standing where the address said (`group` · `tile`), with a refusal it carried (`tell_error`).
 * Sign-in and the shop are checked by the maker's own page. 🔒 app/vendor-dashboard/services/requests/tell-us-opens-in-place.test.ts
 */
export default async function TellUsWhatYouDoForward({ searchParams }: { searchParams: Promise<TellUsSearch> }) {
  const sp = await searchParams;
  const to = new URLSearchParams({ tell: '1' });
  if (sp.group) to.set('group', sp.group);
  if (sp.tile) to.set('tile', sp.tile);
  if (sp.error) to.set('tell_error', sp.error);
  redirect(`${SERVICE_MAKER_HREF}?${to.toString()}`);
}
