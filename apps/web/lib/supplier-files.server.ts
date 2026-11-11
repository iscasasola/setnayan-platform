import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { displayUrlForPrivateStoredAsset, displayUrlForStoredAsset, parseStoredAsset } from '@/lib/uploads';
import { shopStateOf, type CoupleDecision, type FileGroup, type FileKind, type ShopState } from '@/lib/supplier-files';

/**
 * 📁 A SUPPLIER'S FILES FOR ONE EVENT — server reads (Piece 3b). One batched read per screen.
 *
 * 🔑 A refused read is SAID, never drawn as emptiness: each reader returns `{ status: 'unread' }` on any refused part.
 */

export type QuotedService = { id: string; title: string };

export type EventFile = {
  fileId: string;
  grp: FileGroup;
  kind: FileKind;
  name: string;
  serviceId: string | null;
  sizeBytes: number | null;
  takenAt: string | null;
  createdAt: string;
  decision: CoupleDecision;
  decidedAt: string | null;
  counts: boolean;
  /** The supplier's view of this photo on the shop (null for documents and links). */
  state: ShopState | null;
  /** A signed address to draw it (photos/videos/documents), or the link itself. */
  url: string | null;
};

export type PortfolioPick = { ref: string; url: string; serviceId: string | null; serviceTitle: string | null };

export type EventFilesRead =
  | {
      status: 'ok';
      eventDate: string | null;
      /** Services in THIS event's quote (sent · seen · accepted) — the only ones a photo may be filed under. */
      quoted: QuotedService[];
      /** Every card of the shop, for "Linked · <its service>". */
      serviceTitles: Record<string, string>;
      files: EventFile[];
    }
  | { status: 'unread' };

const FILE_COLS =
  'file_id, grp, kind, file_name, vendor_service_id, size_bytes, taken_at, created_at, couple_decision, decided_at, counts, link_url, portfolio_ref, media_id, supplier_media(r2_ref)';

type FileRow = {
  file_id: string;
  grp: FileGroup;
  kind: FileKind;
  file_name: string;
  vendor_service_id: string | null;
  size_bytes: number | null;
  taken_at: string | null;
  created_at: string;
  couple_decision: CoupleDecision;
  decided_at: string | null;
  counts: boolean;
  link_url: string | null;
  portfolio_ref: string | null;
  media_id: string | null;
  supplier_media: { r2_ref: string } | { r2_ref: string }[] | null;
};

/**
 * Sign one stored ref for drawing: a portfolio photo through the public signer; a private stored copy ONLY when it sits
 * in THIS shop's own `supplier-files/<shop>/` folder (the policy-checked private signer — never a raw one).
 */
export async function signStoredRef(ref: string | null | undefined, shop: string): Promise<string | null> {
  if (!ref) return null;
  const parsed = parseStoredAsset(ref);
  if (!parsed || parsed.kind === 'legacy_url') return null;
  if (parsed.bucket === 'setnayan-media') return displayUrlForStoredAsset(ref);
  return displayUrlForPrivateStoredAsset(ref, { bucket: 'setnayan-thread-files', prefixes: [`supplier-files/${shop}/`] }, { ttlSeconds: 60 * 60 });
}

/** The quoted services of one shop on one event: the union of its sent · seen · accepted quotes' cards. */
export function quotedIdsOf(rows: readonly { service_card_ids: unknown }[]): string[] {
  const ids = new Set<string>();
  for (const r of rows) if (Array.isArray(r.service_card_ids)) for (const s of r.service_card_ids) if (typeof s === 'string') ids.add(s);
  return [...ids];
}

export async function readEventSupplierFiles(
  supabase: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; eventDate?: string | null },
): Promise<EventFilesRead> {
  const { eventId, vendorProfileId } = args;
  const [filesRes, quotesRes, cardsRes] = await Promise.all([
    supabase
      .from('event_supplier_files')
      .select(FILE_COLS)
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: false }),
    supabase
      .from('vendor_proposals')
      .select('service_card_ids')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .in('status', ['sent', 'viewed', 'accepted']),
    supabase.from('vendor_services').select('vendor_service_id, title, category').eq('vendor_profile_id', vendorProfileId),
  ]);
  const err = filesRes.error ?? quotesRes.error ?? cardsRes.error;
  if (err) {
    logQueryError('readEventSupplierFiles', err, { event_id: eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const serviceTitles: Record<string, string> = {};
  for (const c of (cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string }[]) {
    serviceTitles[c.vendor_service_id] = c.title?.trim() || c.category;
  }
  const quoted = quotedIdsOf((quotesRes.data ?? []) as { service_card_ids: unknown }[])
    .filter((id) => serviceTitles[id])
    .map((id) => ({ id, title: serviceTitles[id]! }));
  const eventDate = args.eventDate ?? null;
  const files = await Promise.all(((filesRes.data ?? []) as unknown as FileRow[]).map((r) => toFile(r, eventDate, vendorProfileId)));
  return { status: 'ok', eventDate, quoted, serviceTitles, files };
}

async function toFile(r: FileRow, eventDate: string | null, shop: string): Promise<EventFile> {
  const media = Array.isArray(r.supplier_media) ? r.supplier_media[0] : r.supplier_media;
  const url = r.grp === 'links' ? r.link_url : await signStoredRef(r.portfolio_ref ?? media?.r2_ref ?? null, shop);
  return {
    fileId: r.file_id,
    grp: r.grp,
    kind: r.kind,
    name: r.file_name,
    serviceId: r.vendor_service_id,
    sizeBytes: r.size_bytes,
    takenAt: r.taken_at,
    createdAt: r.created_at,
    decision: r.couple_decision,
    decidedAt: r.decided_at,
    counts: r.counts,
    state: shopStateOf(r, eventDate),
    url,
  };
}

/**
 * "From your portfolio · for this event": the shop's portfolio photos and its quoted cards' own photos. A pick MAPS
 * the photo (no copy). Portfolio-wide photos carry no service; a card's photos carry their card.
 */
export async function readPortfolioPicks(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; quotedIds: string[] },
): Promise<{ status: 'ok'; picks: PortfolioPick[] } | { status: 'unread' }> {
  const [profRes, cardsRes] = await Promise.all([
    supabase.from('vendor_profiles').select('portfolio_r2_keys').eq('vendor_profile_id', args.vendorProfileId).maybeSingle(),
    args.quotedIds.length
      ? supabase
          .from('vendor_services')
          .select('vendor_service_id, title, category, primary_photo_r2_key, showcase_photo_r2_keys')
          .eq('vendor_profile_id', args.vendorProfileId)
          .in('vendor_service_id', args.quotedIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (profRes.error || cardsRes.error) {
    logQueryError('readPortfolioPicks', (profRes.error ?? cardsRes.error)!, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const want: { ref: string; serviceId: string | null; serviceTitle: string | null }[] = [];
  const seen = new Set<string>();
  const push = (ref: unknown, serviceId: string | null, serviceTitle: string | null) => {
    if (typeof ref !== 'string' || !ref.startsWith('r2://') || seen.has(ref)) return;
    seen.add(ref);
    want.push({ ref, serviceId, serviceTitle });
  };
  for (const c of (cardsRes.data ?? []) as {
    vendor_service_id: string;
    title: string | null;
    category: string;
    primary_photo_r2_key: string | null;
    showcase_photo_r2_keys: string[] | null;
  }[]) {
    const t = c.title?.trim() || c.category;
    push(c.primary_photo_r2_key, c.vendor_service_id, t);
    for (const k of c.showcase_photo_r2_keys ?? []) push(k, c.vendor_service_id, t);
  }
  for (const k of ((profRes.data as { portfolio_r2_keys: string[] | null } | null)?.portfolio_r2_keys ?? []).slice(0, 60)) push(k, null, null);
  const picks = (await Promise.all(want.map(async (w) => ({ ...w, url: await signStoredRef(w.ref, args.vendorProfileId) })))).filter(
    (p): p is PortfolioPick => typeof p.url === 'string',
  );
  return { status: 'ok', picks };
}

/** The couple's side: the photos a shop asks to show as from their day (service photos that count), waiting first. */
export async function readCoupleApprovals(
  supabase: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; eventDate: string | null },
): Promise<{ status: 'ok'; files: EventFile[]; serviceTitles: Record<string, string> } | { status: 'unread' }> {
  const [filesRes, cardsRes] = await Promise.all([
    supabase
      .from('event_supplier_files')
      .select(FILE_COLS)
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', args.vendorProfileId)
      .eq('grp', 'service')
      .eq('counts', true)
      .order('created_at', { ascending: true }),
    supabase.from('vendor_services').select('vendor_service_id, title, category').eq('vendor_profile_id', args.vendorProfileId),
  ]);
  if (filesRes.error) {
    logQueryError('readCoupleApprovals', filesRes.error, { event_id: args.eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const serviceTitles: Record<string, string> = {};
  for (const c of (cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string }[]) {
    serviceTitles[c.vendor_service_id] = c.title?.trim() || c.category;
  }
  const files = await Promise.all(((filesRes.data ?? []) as unknown as FileRow[]).map((r) => toFile(r, args.eventDate, args.vendorProfileId)));
  const rank = { waiting: 0, shown: 1, hidden: 2 } as const;
  files.sort((a, b) => rank[a.decision] - rank[b.decision]);
  return { status: 'ok', files, serviceTitles };
}
