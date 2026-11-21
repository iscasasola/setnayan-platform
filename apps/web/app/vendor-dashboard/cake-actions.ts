'use server';

/**
 * 🎂 THE CAKE MAKER'S ONE SERVER ACTION (the action budget has two slots left, so every cake read rides one door).
 *
 *   · `portfolio` — the Design photos a supplier may pick: their own portfolio and the card's own photos (ruling 4).
 *   · `design`    — one "Cake design" message, read for the supplier's card in the chat: the design (parsed from the
 *                   couple's own message, read under RLS), the card it was made on, and the card's usual time.
 *
 * Saving the options rides `commitVendorService`; sending a design rides `startServiceInquiry`. Nothing here writes.
 * Every refused read is `{ ok: false }` — the card then says "Couldn't load this cake design", never an empty design.
 */
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { logQueryError } from '@/lib/supabase/error-detect';
import { readCakePortfolio } from '@/lib/cake-maker.server';
import { parseCakeDesignBlock, type CakeDesign } from '@/lib/cake-maker';

export type CakeActionResult =
  | { ok: true; op: 'portfolio'; photos: { ref: string; url: string }[] }
  | { ok: true; op: 'design'; design: CakeDesign; cardId: string | null; usualPrepDays: number | null }
  | { ok: false };

export async function cakeAction(
  input: { op: 'portfolio'; serviceId: string | null } | { op: 'design'; threadId: string; messageId: string },
): Promise<CakeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false };
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { ok: false };
  const shop = profile.vendor_profile_id;

  if (input.op === 'portfolio') {
    const serviceId = typeof input.serviceId === 'string' && input.serviceId.length > 0 ? input.serviceId : null;
    const r = await readCakePortfolio(supabase, { vendorProfileId: shop, vendorServiceId: serviceId });
    return r.status === 'ok' ? { ok: true, op: 'portfolio', photos: r.data } : { ok: false };
  }

  const threadId = String(input.threadId ?? '');
  const messageId = String(input.messageId ?? '');
  if (!threadId || !messageId) return { ok: false };
  const [msgRes, threadRes, interestRes] = await Promise.all([
    supabase.from('chat_messages').select('message_id, body, sender_role').eq('message_id', messageId).eq('thread_id', threadId).maybeSingle(),
    supabase.from('chat_threads').select('thread_id').eq('thread_id', threadId).eq('vendor_profile_id', shop).maybeSingle(),
    supabase
      .from('thread_service_interests')
      .select('vendor_service_id, source')
      .eq('thread_id', threadId)
      .not('vendor_service_id', 'is', null)
      .order('created_at', { ascending: true }),
  ]);
  const failed = msgRes.error ?? threadRes.error ?? interestRes.error;
  if (failed) {
    logQueryError('cakeAction.design', failed, { thread_id: threadId }, 'graceful_degrade');
    return { ok: false };
  }
  // Only the shop's own thread, and only the couple's own words, are a design.
  if (!threadRes.data || !msgRes.data || (msgRes.data as { sender_role: string | null }).sender_role !== 'couple') return { ok: false };
  const design = parseCakeDesignBlock((msgRes.data as { body: string | null }).body);
  if (!design) return { ok: false };

  const interests = (interestRes.data ?? []) as { vendor_service_id: string; source: string | null }[];
  const ids = interests.map((i) => i.vendor_service_id);
  let cardId: string | null = null;
  let usualPrepDays: number | null = null;
  if (ids.length > 0) {
    const { data: cards, error } = await supabase
      .from('vendor_services')
      .select('vendor_service_id, title, category, usual_prep_days')
      .eq('vendor_profile_id', shop)
      .in('vendor_service_id', ids);
    if (error) {
      logQueryError('cakeAction.design.cards', error, { thread_id: threadId }, 'graceful_degrade');
      return { ok: false };
    }
    const rows = (cards ?? []) as { vendor_service_id: string; title: string | null; usual_prep_days: number | null }[];
    // The card the design names; else the card the couple first asked about.
    const named = rows.find((c) => (c.title ?? '').trim() === design.cardName);
    const first = interests.find((i) => i.source === 'initial') ?? interests[0];
    const card = named ?? rows.find((c) => c.vendor_service_id === first?.vendor_service_id) ?? null;
    cardId = card?.vendor_service_id ?? null;
    usualPrepDays = card?.usual_prep_days ?? null;
  }
  return { ok: true, op: 'design', design, cardId, usualPrepDays };
}
