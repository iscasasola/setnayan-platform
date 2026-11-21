'use server';

/**
 * 🎂 THE CAKE MAKER'S ONE SERVER ACTION (the action budget is full, so every cake read rides one door).
 *
 *   · `design` — one "Cake design" message, read for the supplier's card in the chat and on the order: the couple's
 *                message (RLS, the shop's own thread, the couple's own words) names its stored row ("Design ref:"),
 *                and the row (`cake_designs`, RLS: thread members) is the design — never a re-parse of the text.
 *                With it: the card's own words for each pick, the event's monogram, the inspiration photo, and the
 *                card's usual time.
 *
 * Saving the options rides `commitVendorService`; sending a design rides `startServiceInquiry`. Nothing here writes.
 * Every refused read is `{ ok: false }` — the card then says "Couldn't load this cake design", never an empty design.
 */
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readCakePackage, readStoredCakeDesign } from '@/lib/cake-maker.server';
import { cakeDesignOf, cakeDesignRefOf, cupcakeCountOf, flavourLabelOn, type CakeDesign } from '@/lib/cake-maker';
import type { CakeConfig } from '@/lib/cake-config';
import { resolveMonogram } from '@/lib/monogram';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-columns';
import { galleryImageUrl } from '@/lib/moodboard-gallery';

export type CakeActionResult =
  | {
      ok: true;
      op: 'design';
      design: CakeDesign;
      config: CakeConfig;
      /** Flavour key → the card's words, so the picture draws each sponge. */
      flavourLabels: Record<string, string>;
      cupcakeCount: number;
      monogramText: string | null;
      inspirationUrl: string | null;
      cardId: string | null;
      usualPrepDays: number | null;
    }
  | { ok: false };

export async function cakeAction(input: { op: 'design'; threadId: string; messageId: string }): Promise<CakeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false };
  const shop = profile.vendor_profile_id;

  const threadId = String(input.threadId ?? '');
  const messageId = String(input.messageId ?? '');
  if (input.op !== 'design' || !threadId || !messageId) return { ok: false };
  const [msgRes, threadRes] = await Promise.all([
    supabase.from('chat_messages').select('message_id, body, sender_role').eq('message_id', messageId).eq('thread_id', threadId).maybeSingle(),
    supabase.from('chat_threads').select('thread_id, event_id').eq('thread_id', threadId).eq('vendor_profile_id', shop).maybeSingle(),
  ]);
  const failed = msgRes.error ?? threadRes.error;
  if (failed) {
    logQueryError('cakeAction.design', failed, { thread_id: threadId }, 'graceful_degrade');
    return { ok: false };
  }
  // Only the shop's own thread, and only the couple's own words, name a design.
  if (!threadRes.data || !msgRes.data || (msgRes.data as { sender_role: string | null }).sender_role !== 'couple') return { ok: false };
  const ref = cakeDesignRefOf((msgRes.data as { body: string | null }).body);
  if (!ref) return { ok: false };
  const stored = await readStoredCakeDesign(supabase, { threadId, designId: ref });
  if (stored.status !== 'ok') return { ok: false };
  const { config, vendorServiceId, estimateCentavos } = stored.data;
  if (!vendorServiceId) return { ok: false };

  const eventId = (threadRes.data as { event_id: string | null }).event_id;
  const [cardRes, cake, eventRes, assetRes] = await Promise.all([
    supabase.from('vendor_services').select('vendor_service_id, title, usual_prep_days').eq('vendor_service_id', vendorServiceId).eq('vendor_profile_id', shop).maybeSingle(),
    readCakePackage(supabase, { vendorProfileId: shop, vendorServiceId }),
    config.monogram && eventId
      ? supabase.from('events').select(HERO_MONOGRAM_COLUMNS).eq('event_id', eventId).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    config.inspirationRef
      ? supabase.from('moodboard_library_assets').select('storage_path').eq('asset_id', config.inspirationRef).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  // The inspiration photo is a picture beside the design: a refused read leaves it out and is logged; the design stands.
  if (assetRes.error) logQueryError('cakeAction.design.inspiration', assetRes.error, { thread_id: threadId }, 'graceful_degrade');
  const readErr = cardRes.error ?? eventRes.error;
  if (readErr || cake.status !== 'ok' || !cardRes.data) {
    if (readErr) logQueryError('cakeAction.design.reads', readErr, { thread_id: threadId }, 'graceful_degrade');
    return { ok: false };
  }
  const card = cardRes.data as { vendor_service_id: string; title: string | null; usual_prep_days: number | null };
  const design = cakeDesignOf(cake.data.card, config, {
    cardName: (card.title ?? '').trim() || cake.data.pkg.package_name,
    oneCentavos: cake.data.pkg.total_price_centavos,
    estimateCentavos,
  });
  const flavourLabels: Record<string, string> = {};
  for (const t of config.tiers) {
    if (t.flavourRef && !(t.flavourRef in flavourLabels)) {
      const words = flavourLabelOn(cake.data.card, t.flavourRef);
      if (words) flavourLabels[t.flavourRef] = words;
    }
  }
  const ev = eventRes.data as { display_name: string | null; monogram_text: string | null; monogram_color: string | null } | null;
  const path = (assetRes.data as { storage_path: string } | null)?.storage_path ?? null;
  return {
    ok: true,
    op: 'design',
    design,
    config,
    flavourLabels,
    cupcakeCount: cupcakeCountOf(config),
    monogramText: ev ? resolveMonogram(ev).text || null : null,
    inspirationUrl: path ? galleryImageUrl(path) : null,
    cardId: card.vendor_service_id,
    usualPrepDays: card.usual_prep_days,
  };
}
