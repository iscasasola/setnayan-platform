import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft, Video } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { canManageWalkthrough } from './actions';
import { WalkthroughManager, type ZoneVM, type TableVM } from './_components/walkthrough-manager';

export const metadata = { title: 'Walkthrough videos · Seating' };

// Reads R2-backed clip refs (presigns previews) — never statically cached.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ eventId: string }> };

type ZoneRow = {
  zone_id: string;
  label: string;
  sort_order: number;
  video_r2_key: string | null;
  video_mime_type: string | null;
  published_at: string | null;
};

type TableRow = {
  table_id: string;
  table_label: string;
  link_group_label: string | null;
  walkthrough_zone_id: string | null;
};

export default async function WalkthroughPage({ params }: Props) {
  const { eventId } = await params;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  // Couple OR a seat_plan='edit' delegate (a no-coordinator couple's DIY helper
  // is exactly this) — wayfinding is never gated on having a coordinator.
  if (!(await canManageWalkthrough(eventId))) redirect(`/dashboard/${eventId}/seating`);

  const supabase = await createClient();
  const [{ data: zonesRaw }, { data: tablesRaw }] = await Promise.all([
    supabase
      .from('event_walkthrough_zones')
      .select('zone_id, label, sort_order, video_r2_key, video_mime_type, published_at')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('event_tables')
      .select('table_id, table_label, link_group_label, walkthrough_zone_id')
      .eq('event_id', eventId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true }),
  ]);

  const tableRows = (tablesRaw ?? []) as TableRow[];
  const tables: TableVM[] = tableRows.map((t) => ({
    tableId: t.table_id,
    label: (t.link_group_label?.trim() || t.table_label || 'Table').trim(),
  }));

  const zoneRows = (zonesRaw ?? []) as ZoneRow[];
  // Presign each zone's clip for the in-manager preview (parallel).
  const previewUrls = await Promise.all(
    zoneRows.map((z) => displayUrlForStoredAsset(z.video_r2_key).catch(() => null)),
  );
  const zones: ZoneVM[] = zoneRows.map((z, i) => ({
    zoneId: z.zone_id,
    label: z.label,
    hasVideo: Boolean(z.video_r2_key),
    videoUrl: previewUrls[i] ?? null,
    published: Boolean(z.published_at),
    tableIds: tableRows.filter((t) => t.walkthrough_zone_id === z.zone_id).map((t) => t.table_id),
  }));

  return (
    <section className="mx-auto w-full max-w-3xl space-y-5 px-1 py-2">
      <Link
        href={`/dashboard/${eventId}/seating`}
        className="inline-flex items-center gap-1.5 text-sm text-ink/60 hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> Back to seating
      </Link>

      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight sm:text-4xl">
          <Video className="h-7 w-7 text-terracotta" strokeWidth={1.75} /> Walkthrough videos
        </h1>
        <p className="max-w-prose text-base text-ink/65">
          Record a short first-person walk from the entrance to a cluster of tables, then tag the
          tables in that zone. When a guest finds their seat, they can watch the exact walk to their
          table — the kind of arrival help no printed sign can give.
        </p>
      </header>

      <WalkthroughManager eventId={eventId} zones={zones} tables={tables} />
    </section>
  );
}
