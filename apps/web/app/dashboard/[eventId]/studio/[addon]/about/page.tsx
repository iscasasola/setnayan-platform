import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { Rocket, Clock3, ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { formatPhp } from '@/lib/orders';
import { ADD_ONS, addOnHref } from '@/lib/add-ons-catalog';
import { addOnDetail } from '@/lib/add-ons-detail';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import {
  AppStoreLayout,
  type PlanRow,
  type PreviewItem,
} from '@/app/_components/app-store/layout';

// Catalog-driven App Store-style detail page for every couple-side in-app
// service (the fan-out of the 2026-05-17 Panood pilot — owner 2026-06-19
// "Studio should look like the App Store so we can see info on each feature").
//
// One renderer, content per feature in lib/add-ons-detail.ts. Pricing renders
// LIVE from the admin catalog (platform_retail_catalog_v2) by serviceKey — this
// page is never a price source (owner: "admin pricing controls all prices").
// The primary CTA hands off to the feature's own functional surface, which
// already owns the buy / launch flow.

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string; addon: string }> };

export async function generateMetadata({ params }: Props) {
  const { addon } = await params;
  const entry = ADD_ONS.find((a) => a.key === addon);
  return { title: entry ? `${entry.label} · Setnayan` : 'Studio · Setnayan' };
}

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;

  const entry = ADD_ONS.find((a) => a.key === addon);
  const detail = addOnDetail(addon);
  // Panood owns a bespoke detail page; coming-soon features and anything
  // without authored content fall through to the placeholder/redirect route.
  if (!entry || !detail || addon === 'panood' || entry.status === 'coming_soon') {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: event } = await supabase
    .from('events')
    .select('event_id')
    .eq('event_id', eventId)
    .maybeSingle();
  if (!event) notFound();

  // Live admin-catalog price (display only) + this event's order status for
  // the feature, fetched together. A catalog miss only blanks the price label.
  const [sku, orderRow] = await Promise.all([
    entry.serviceKey ? formatV2Sku(entry.serviceKey).catch(() => null) : Promise.resolve(null),
    entry.serviceKey
      ? supabase
          .from('orders')
          .select('status')
          .eq('event_id', eventId)
          .eq('service_key', entry.serviceKey)
          .not('status', 'in', '("cancelled","refunded","lapsed")')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
          .then((r) => r.data)
      : Promise.resolve(null),
  ]);

  const isFree = entry.tier === 'free';
  const priceLabel = sku ? formatPhp(sku.price_php) : null;
  const status = orderRow?.status ?? null;
  const isActive = status === 'paid' || status === 'fulfilled';
  const isPending = status === 'submitted' || status === 'awaiting_payment';

  const surfaceHref = addOnHref(addon, eventId);

  // App Store "GET / OPEN" CTA — hands off to the feature's own surface, which
  // owns the buy/launch flow. Label + tone reflect the resolved state.
  const cta = isPending ? (
    <Link
      href={`/dashboard/${eventId}/orders`}
      className="inline-flex items-center gap-2 rounded-full border border-warn-300/70 bg-warn-50 px-5 py-2 text-sm font-semibold text-warn-900 hover:bg-warn-100"
    >
      <Clock3 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
      Pending review
    </Link>
  ) : isActive || isFree ? (
    <Link
      href={surfaceHref}
      className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
    >
      <Rocket aria-hidden className="h-4 w-4" strokeWidth={2} />
      Open
    </Link>
  ) : (
    <Link
      href={surfaceHref}
      className="inline-flex items-center gap-2 rounded-full bg-mulberry px-5 py-2 text-sm font-semibold text-cream transition-colors hover:bg-mulberry-600"
    >
      {priceLabel ? `Get · ${priceLabel}` : 'Get'}
      <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
    </Link>
  );

  const statusPill = isActive
    ? { label: 'Active on this event', tone: 'success' as const }
    : isPending
      ? { label: 'Pending review', tone: 'accent' as const }
      : isFree
        ? { label: 'Free', tone: 'muted' as const }
        : entry.freeTrial
          ? { label: entry.freeTrial, tone: 'accent' as const }
          : undefined;

  const preview: PreviewItem[] = detail.preview.map((p) => ({
    context: p.context,
    caption: p.caption,
    aspect: p.aspect,
    body: (
      <span>
        <span aria-hidden className="block text-3xl">
          {p.glyph}
        </span>
        {p.sub ? (
          <span className="mt-2 block text-[11px] text-ink/55">{p.sub}</span>
        ) : null}
      </span>
    ),
  }));

  const plans: PlanRow[] | undefined =
    !isFree && priceLabel
      ? [
          {
            name: entry.label,
            scope: detail.tagline,
            price: priceLabel,
            unit: '',
          },
        ]
      : undefined;

  return (
    <AppStoreLayout
      back={{ href: `/dashboard/${eventId}/studio`, label: 'Back to Studio' }}
      hero={{
        Icon: entry.Icon,
        eyebrow: detail.eyebrow,
        title: detail.heroTitle,
        tagline: detail.tagline,
        statusPill,
        cta,
      }}
      preview={preview}
      demo={detail.demo}
      demoSlug={addon}
      highlights={{ title: "What you'll have", items: detail.highlights }}
      description={{
        paragraphs: detail.paragraphs,
        plans,
      }}
    />
  );
}
