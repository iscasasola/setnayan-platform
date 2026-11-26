import 'server-only';

/**
 * 👗 THE GOWN MAKER SHARE — the server side (owner, 26 Nov 2026). Every write is the service role's, after
 * `parseGownExport` (lib/gown-maker.ts); every read hands back only what its caller may see.
 *
 *   · `storeGownDesign`        — the supplier's share sheet: one `gown_designs` row (Shortlist or Booked).
 *   · `linkGownDesignToLockedQr` — a booked share and the ONE Booked QR it was issued with (`issueLockedQr`).
 *   · `readGownShare`          — the Shortlist QR landing's preview of a share code (card fields only).
 *   · `postGownDesignCard`     — the scan: the design lands as ONE message in that couple-supplier chat (the thread is
 *                                opened if it did not exist — one per event + shop, the schema's own UNIQUE).
 *   · `readGownDesignCard`     — the card's fields for either side of that chat, never the tool's `state`.
 *
 * Never throws: a refused read is `'unread'`, a refused write is `false`/`null`, each logged.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { buildVendorInviteUrl } from '@/lib/vendor-couple-invite';
import {
  formatGownDesignBlock,
  GOWN_DESIGN_REF,
  GOWN_SHARE_PARAM,
  type GownDesignInput,
  type GownShareAs,
  type GownWhich,
} from '@/lib/gown-maker';

export type GownCard = {
  designId: string;
  which: GownWhich;
  summary: string[];
  priceShownCentavos: number | null;
  thumbDataUrl: string;
};

type Row = {
  design_id: string;
  vendor_profile_id: string;
  share_as: GownShareAs;
  event_type: string | null;
  category: string | null;
  which: GownWhich;
  summary: unknown;
  price_shown_centavos: number | string | null;
  thumb_data_url: string;
  created_by: string | null;
};

/** The card columns — `state` is never selected for a card. */
const CARD_COLUMNS = 'design_id, vendor_profile_id, share_as, event_type, category, which, summary, price_shown_centavos, thumb_data_url, created_by';

function cardOf(r: Row): GownCard {
  return {
    designId: r.design_id,
    which: r.which,
    summary: Array.isArray(r.summary) ? r.summary.filter((s): s is string => typeof s === 'string') : [],
    priceShownCentavos: r.price_shown_centavos == null ? null : Number(r.price_shown_centavos),
    thumbDataUrl: r.thumb_data_url,
  };
}

export async function storeGownDesign(
  admin: SupabaseClient,
  args: { vendorProfileId: string; shareAs: GownShareAs; eventType: string | null; category: string | null; design: GownDesignInput; userId: string },
): Promise<{ designId: string; shareCode: string } | null> {
  const { data, error } = await admin
    .from('gown_designs')
    .insert({
      vendor_profile_id: args.vendorProfileId,
      share_as: args.shareAs,
      event_type: args.eventType,
      category: args.category,
      which: args.design.which,
      summary: args.design.summary,
      price_shown_centavos: args.design.priceShownCentavos,
      thumb_data_url: args.design.thumbDataUrl,
      state: args.design.state,
      created_by: args.userId,
    })
    .select('design_id, share_code')
    .single();
  if (error || !data) {
    logQueryError('storeGownDesign', error ?? { message: 'no row' }, { vendorProfileId: args.vendorProfileId });
    return null;
  }
  const d = data as { design_id: string; share_code: string };
  return { designId: d.design_id, shareCode: d.share_code };
}

/** A waiting booked share of THIS shop, for the Booked QR form ("Gown design attached"). */
export async function readOwnBookedGownShare(
  admin: SupabaseClient,
  args: { vendorProfileId: string; designId: string },
): Promise<(GownCard & { eventType: string | null }) | null | 'unread'> {
  const { data, error } = await admin
    .from('gown_designs')
    .select(CARD_COLUMNS)
    .eq('design_id', args.designId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('share_as', 'booked')
    .is('locked_token', null)
    .maybeSingle();
  if (error) {
    logQueryError('readOwnBookedGownShare', error, { designId: args.designId }, 'graceful_degrade');
    return 'unread';
  }
  const r = data as Row | null;
  return r ? { ...cardOf(r), eventType: r.event_type } : null;
}

/** Link a booked share to its one Booked QR. Only this shop's, only once. */
export async function linkGownDesignToLockedQr(
  admin: SupabaseClient,
  args: { vendorProfileId: string; designId: string; token: string },
): Promise<boolean> {
  const { data, error } = await admin
    .from('gown_designs')
    .update({ locked_token: args.token })
    .eq('design_id', args.designId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('share_as', 'booked')
    .is('locked_token', null)
    .select('design_id');
  if (error) logQueryError('linkGownDesignToLockedQr', error, { designId: args.designId });
  return !error && (data ?? []).length === 1;
}

/** The booked share a Booked QR carries, or null when it carries none. */
export async function gownDesignOfLockedQr(admin: SupabaseClient, token: string): Promise<string | null | 'unread'> {
  const { data, error } = await admin.from('gown_designs').select('design_id').eq('locked_token', token).maybeSingle();
  if (error) {
    logQueryError('gownDesignOfLockedQr', error, {}, 'graceful_degrade');
    return 'unread';
  }
  return (data as { design_id: string } | null)?.design_id ?? null;
}

export type GownShare = GownCard & { vendorProfileId: string; eventType: string | null; category: string | null };

/** A Shortlist share code → its card (the landing's preview and the claim). Booked shares never answer a code. */
export async function readGownShare(admin: SupabaseClient, code: string): Promise<GownShare | null | 'unread'> {
  const { data, error } = await admin.from('gown_designs').select(CARD_COLUMNS).eq('share_code', code).eq('share_as', 'shortlist').maybeSingle();
  if (error) {
    logQueryError('readGownShare', error, {}, 'graceful_degrade');
    return 'unread';
  }
  const r = data as Row | null;
  return r ? { ...cardOf(r), vendorProfileId: r.vendor_profile_id, eventType: r.event_type, category: r.category } : null;
}

/**
 * The design lands in the couple-supplier chat of THIS event: the thread is opened if it did not exist (UNIQUE
 * event + shop), and the message is posted once per design per chat — a second scan of a Shortlist code by the same
 * couple adds nothing. Posted as the supplier who shared it (`sender_role = 'vendor'`, explicit sender on the service
 * role, the same way a supplier's purchase change is posted). Never throws.
 */
export async function postGownDesignCard(admin: SupabaseClient, args: { designId: string; eventId: string; openedBy: string }): Promise<string | null> {
  try {
    const { data: row, error: rowErr } = await admin.from('gown_designs').select(CARD_COLUMNS).eq('design_id', args.designId).maybeSingle();
    if (rowErr || !row) {
      if (rowErr) logQueryError('postGownDesignCard.design', rowErr, { designId: args.designId });
      return null;
    }
    const d = row as Row;
    const { error: upErr } = await admin
      .from('chat_threads')
      .upsert({ event_id: args.eventId, vendor_profile_id: d.vendor_profile_id, created_by_user_id: args.openedBy }, { onConflict: 'event_id,vendor_profile_id', ignoreDuplicates: true });
    if (upErr) logQueryError('postGownDesignCard.thread.open', upErr, { event_id: args.eventId });
    const { data: thread, error: threadErr } = await admin
      .from('chat_threads')
      .select('thread_id')
      .eq('event_id', args.eventId)
      .eq('vendor_profile_id', d.vendor_profile_id)
      .maybeSingle();
    const threadId = (thread as { thread_id?: string } | null)?.thread_id ?? null;
    if (threadErr || !threadId) {
      if (threadErr) logQueryError('postGownDesignCard.thread', threadErr, { event_id: args.eventId });
      return null;
    }
    const { data: already, error: seenErr } = await admin
      .from('chat_messages')
      .select('message_id')
      .eq('thread_id', threadId)
      .like('body', `%${GOWN_DESIGN_REF}${d.design_id}`)
      .limit(1);
    if (seenErr) {
      logQueryError('postGownDesignCard.seen', seenErr, { thread_id: threadId });
      return null;
    }
    if ((already ?? []).length > 0) return threadId;
    const { error } = await admin.from('chat_messages').insert({
      thread_id: threadId,
      event_id: args.eventId,
      vendor_profile_id: d.vendor_profile_id,
      sender_user_id: d.created_by,
      sender_role: 'vendor',
      body: formatGownDesignBlock(cardOf(d), d.design_id),
    });
    if (error) {
      logQueryError('postGownDesignCard.insert', error, { thread_id: threadId });
      return null;
    }
    return threadId;
  } catch (caught) {
    logQueryError('postGownDesignCard (threw)', caught, { event_id: args.eventId });
    return null;
  }
}

/** The card's fields for a message in a chat the caller can read (the caller checks the thread first). */
export async function readGownDesignCard(admin: SupabaseClient, args: { designId: string; vendorProfileId: string }): Promise<GownCard | null | 'unread'> {
  const { data, error } = await admin.from('gown_designs').select(CARD_COLUMNS).eq('design_id', args.designId).eq('vendor_profile_id', args.vendorProfileId).maybeSingle();
  if (error) {
    logQueryError('readGownDesignCard', error, { designId: args.designId }, 'graceful_degrade');
    return 'unread';
  }
  const r = data as Row | null;
  return r ? cardOf(r) : null;
}

/**
 * The Shortlist code's address: the shop's Shortlist QR landing, scoped to the design's event type and category, with
 * the share code. The same page and the same claim as the Shortlist QR — the code only adds the design.
 */
export function buildGownShareUrl(slug: string, share: { shareCode: string; eventType: string | null; category: string | null }): string {
  const url = new URL(buildVendorInviteUrl(slug, { eventType: share.eventType, category: share.category }));
  url.searchParams.set(GOWN_SHARE_PARAM, share.shareCode);
  return url.toString();
}
