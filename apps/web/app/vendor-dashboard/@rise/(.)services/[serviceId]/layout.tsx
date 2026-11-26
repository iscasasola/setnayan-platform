import type { ReactNode } from 'react';
import { RiseRoute } from '@/app/_components/rise/rise-route';
import { createClient } from '@/lib/supabase/server';
import { isServiceCardId } from '@/lib/service-card-id';

/**
 * ⤴ EDITING A SERVICE CARD RISES OVER SHOP (final check B8). A tap on a card row draws the card maker inside the one
 * layer, headed by the card's own name (the drawing); a hard load draws the whole page. The name is the card's one
 * column, read here under the session (RLS: the shop's own cards); a refused or empty read heads it "Your service", the
 * page's own name — never a made-up one. 🔒 app/vendor-dashboard/services/the-maker-rises.test.ts
 */
export default async function RisenServiceCardLayout({ children, params }: { children: ReactNode; params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  // Not a card (a services page beside the maker): no layer at all — the page loads as its own (see page.tsx).
  if (!isServiceCardId(serviceId)) return <>{children}</>;
  const supabase = await createClient();
  const { data, error } = await supabase.from('vendor_services').select('title').eq('vendor_service_id', serviceId).maybeSingle();
  if (error) console.error('[supabase-error] @rise/(.)services/[serviceId]/layout.tsx · from:vendor_services.select (title)', error.message);
  const name = (data as { title: string | null } | null)?.title?.trim() || 'Your service';
  return (
    <RiseRoute page kind="stack" title={name} data="service-maker-edit">
      {children}
    </RiseRoute>
  );
}
