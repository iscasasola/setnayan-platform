import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { parseVideoLink } from '@/lib/video-embed';
import { signStoredRef } from '@/lib/supplier-file-sign.server';
import { fileKindOf, linksIn, shopStateOf, siteOf, type CoupleDecision, type FileGroup, type FileKind, type ShopState } from '@/lib/supplier-files';

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
  /** 📥 Piece 3c: collected from the chat (not a filed row) — its message, and whether the shop sent it. */
  fromChat?: { messageId: string; bySupplier: boolean };
  /** A video link (YouTube · Vimeo · …) — the Links tile wears a play mark. */
  isVideoLink?: boolean;
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
      /** 📥 The chat messages already filed here (they leave "From the chat · not filed yet"). */
      filedMessageIds: Set<string>;
    }
  | { status: 'unread' };

const FILE_COLS =
  'file_id, grp, kind, file_name, chat_message_id, vendor_service_id, size_bytes, taken_at, created_at, couple_decision, decided_at, counts, link_url, portfolio_ref, media_id, supplier_media(r2_ref)';

type FileRow = {
  file_id: string;
  grp: FileGroup;
  kind: FileKind;
  file_name: string;
  chat_message_id: string | null;
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

// `signStoredRef` lives in its own module so a reader can sign without importing this file's quote reads (the cached
// shop page walks imports); re-exported so every caller is unchanged.
export { signStoredRef };

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
  const rows = (filesRes.data ?? []) as unknown as FileRow[];
  const files = await Promise.all(rows.map((r) => toFile(r, eventDate, vendorProfileId)));
  const filedMessageIds = new Set(rows.map((r) => r.chat_message_id).filter((x): x is string => Boolean(x)));
  return { status: 'ok', eventDate, quoted, serviceTitles, files, filedMessageIds };
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

// ── 📥 Piece 3c — everything shared in the chat is collected on Files, sorted by kind ──────────────────────────────
/**
 * The files and links of THIS shop's conversation with THIS event, sorted by kind (DECISION_LOG 2026-11-12 "EVERYTHING
 * SHARED IN THE CHAT IS COLLECTED ON FILES, SORTED BY KIND"): a document → This booking · a photo/video → From the chat ·
 * not filed yet (until it is filed under a service) · a link → Links. Read from the messages themselves — nothing is
 * copied to show them; a chat file opens through the shipped `/api/chat/attachment/<message>` route, which re-proves the
 * reader. A refused read is SAID (`unread`), never an empty chat.
 */
export async function readChatCollected(
  supabase: SupabaseClient,
  args: { threadId: string | null; filedMessageIds: ReadonlySet<string> },
): Promise<{ status: 'ok'; files: EventFile[] } | { status: 'unread' }> {
  if (!args.threadId) return { status: 'ok', files: [] };
  const { data, error } = await supabase
    .from('chat_messages')
    .select('message_id, body, attachment_name, attachment_mime, attachment_size_bytes, attachment_r2_key, attachment_url, created_at, sender_role')
    .eq('thread_id', args.threadId)
    .order('created_at', { ascending: false })
    .limit(400);
  if (error) {
    logQueryError('readChatCollected', error, { thread_id: args.threadId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const files: EventFile[] = [];
  for (const m of (data ?? []) as {
    message_id: string;
    body: string | null;
    attachment_name: string | null;
    attachment_mime: string | null;
    attachment_size_bytes: number | null;
    attachment_r2_key: string | null;
    attachment_url: string | null;
    created_at: string;
    sender_role: string | null;
  }[]) {
    const base = {
      serviceId: null,
      takenAt: null,
      createdAt: m.created_at,
      decision: 'waiting' as const,
      decidedAt: null,
      counts: false,
      state: null,
    };
    if ((m.attachment_r2_key || m.attachment_url) && !args.filedMessageIds.has(m.message_id)) {
      const kind = fileKindOf(m.attachment_mime, m.attachment_name ?? '');
      files.push({
        ...base,
        fileId: `chat:${m.message_id}`,
        grp: kind === 'document' ? 'booking' : 'unfiled',
        kind,
        name: m.attachment_name?.trim() || (kind === 'document' ? 'Document' : kind === 'video' ? 'Video' : 'Photo'),
        sizeBytes: m.attachment_size_bytes,
        url: `/api/chat/attachment/${m.message_id}`,
        fromChat: { messageId: m.message_id, bySupplier: m.sender_role === 'vendor' },
      });
    }
    for (const url of linksIn(m.body)) {
      const video = parseVideoLink(url);
      files.push({
        ...base,
        fileId: `link:${m.message_id}:${url}`,
        grp: 'links',
        kind: 'link',
        name: video ? `${video.label} · ${siteOf(url)}` : siteOf(url),
        sizeBytes: null,
        url,
        fromChat: { messageId: m.message_id, bySupplier: m.sender_role === 'vendor' },
        isVideoLink: Boolean(video),
      });
    }
  }
  return { status: 'ok', files };
}
