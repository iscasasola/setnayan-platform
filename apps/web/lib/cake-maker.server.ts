import 'server-only';
/**
 * 🎂 THE CAKE MAKER — the reads and writes (rules in ./cake-maker.ts and ./cake-config.ts).
 *
 * Every read here is HONEST: a refused read is `{ status: 'unread' }`, never an empty Cake Maker and never a cake with
 * fewer options than the shop set (the 20 Aug disease — a failure that renders identically to emptiness).
 *
 * The shop's options are read SERVER-SIDE for a couple, with the admin client scoped to the shop of the couple's own
 * chat (the caller proves the thread first, on the couple's own session). Nothing here trusts the browser's word for a
 * shop, a price or a colour.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { moodCakeColours } from '@/lib/cake-mood-colours';
import { specialToolsAllowed } from '@/lib/special-tools';
import { readSpecialToolsPaidFrom } from '@/lib/special-tools.server';
import { asVendorTier } from '@/lib/vendor-tier-caps';
import { CAKE_MESSAGE_MAX, fullCakeOffer, sanitizeCakeConfig, type CakeConfig, type CakeConfigRefusal } from '@/lib/cake-config';
import { cakeDesignOf, cakeOfferOf, isCakeKind, sanitizeCakeShopOptions, type CakeDesign, type CakeShopOptions, type MoodCakeColour } from '@/lib/cake-maker';

export type Read<T> = { status: 'ok'; data: T } | { status: 'unread' } | { status: 'none' };

/** The shop's Cake Maker options. `none` = the shop never set it up; a stored row that no longer reads is `unread`. */
export async function readShopCakeMaker(client: SupabaseClient, vendorProfileId: string): Promise<Read<CakeShopOptions>> {
  const { data, error } = await client.from('vendor_cake_makers').select('options').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) {
    logQueryError('readShopCakeMaker', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const checked = sanitizeCakeShopOptions((data as { options: unknown }).options);
  if (!checked.ok) {
    logQueryError('readShopCakeMaker.shape', { message: checked.problem }, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', data: checked.options };
}

/** Is the shop's plan allowed the special tools now (Pro and up, or before the admin's start date)? */
export async function readShopSpecialToolsAllowed(admin: SupabaseClient, vendorProfileId: string): Promise<Read<boolean>> {
  const [paid, shop] = await Promise.all([
    readSpecialToolsPaidFrom(admin),
    admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', vendorProfileId).maybeSingle(),
  ]);
  if (paid.status !== 'ok' || shop.error) {
    if (shop.error) logQueryError('readShopSpecialToolsAllowed', shop.error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!shop.data) return { status: 'none' };
  const tier = asVendorTier((shop.data as { tier_state?: string | null }).tier_state ?? 'free');
  return { status: 'ok', data: specialToolsAllowed(tier, paid.paidFrom, Date.now()) };
}

export type ShopCakeCard = { id: string; name: string; oneCentavos: number | null; usualPrepDays: number | null };

/** The shop's live cake cards — the one price a design is estimated from (the same read Make a quote lists). */
export async function readShopCakeCards(client: SupabaseClient, vendorProfileId: string): Promise<Read<ShopCakeCard[]>> {
  const { data, error } = await client
    .from('vendor_services')
    .select('vendor_service_id, title, category, starting_price_php, usual_prep_days')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) {
    logQueryError('readShopCakeCards', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  type Row = { vendor_service_id: string; title: string | null; category: string | null; starting_price_php: number | null; usual_prep_days: number | null };
  return {
    status: 'ok',
    data: ((data ?? []) as Row[])
      .filter((r) => isCakeKind(r.category))
      .map((r) => ({
        id: r.vendor_service_id,
        name: r.title?.trim() || 'Cake',
        oneCentavos: r.starting_price_php == null ? null : Math.round(Number(r.starting_price_php) * 100),
        usualPrepDays: r.usual_prep_days,
      })),
  };
}

/** The couple's own Mood Board colours (the Cake part first), read on their own session. */
export async function readMoodCakeColours(supabase: SupabaseClient, eventId: string): Promise<Read<MoodCakeColour[]>> {
  const { data, error } = await supabase.from('events').select('role_palette').eq('event_id', eventId).maybeSingle();
  if (error) {
    logQueryError('readMoodCakeColours', error, { event_id: eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  return { status: 'ok', data: moodCakeColours(sanitizeRolePalette((data as { role_palette: unknown }).role_palette)) };
}

export type BuiltCakeDesign = { config: CakeConfig; design: CakeDesign; cardId: string | null };

/**
 * A design the browser sent, re-checked on the server against the shop's OWN Cake Maker (sanitizeCakeConfig against
 * cakeOfferOf), the shop's plan gate, the couple's own board colours or the shop's own colours, and a live library
 * photo. Priced from the cake card it names (one of the shop's own live cake cards — or the only one). Refused —
 * never thinned — when any of that fails; the caller says so and creates nothing.
 */
export async function buildCakeDesign(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  args: { vendorProfileId: string; eventId: string; cardId: string | null; config: unknown },
): Promise<{ ok: true; built: BuiltCakeDesign } | { ok: false; reason: CakeConfigRefusal | 'unread' }> {
  const [options, allowed, cards, mood] = await Promise.all([
    readShopCakeMaker(admin, args.vendorProfileId),
    readShopSpecialToolsAllowed(admin, args.vendorProfileId),
    readShopCakeCards(admin, args.vendorProfileId),
    readMoodCakeColours(supabase, args.eventId),
  ]);
  if (options.status === 'unread' || allowed.status === 'unread' || cards.status !== 'ok' || mood.status === 'unread') return { ok: false, reason: 'unread' };
  // 🔒 The same plan rule the shop's tool page reads: below Pro after the start date, the shop takes no designs.
  if (options.status !== 'ok' || allowed.status !== 'ok' || !allowed.data) return { ok: false, reason: 'not_offered' };
  const o = options.data;
  const checked = sanitizeCakeConfig(args.config, cakeOfferOf(o));
  if (!checked.ok) return { ok: false, reason: checked.reason };
  const config = checked.config;

  const board = mood.status === 'ok' ? mood.data : [];
  if (config.colours.length > o.colourPick) return { ok: false, reason: 'colours' };
  for (const c of config.colours) {
    const own = board.some((b) => b.hex.toUpperCase() === c.hex && b.name === c.name);
    const shop = o.colours.some((s) => s.hex === c.hex && s.name === c.name);
    if (!own && !shop) return { ok: false, reason: 'colours' };
  }
  if (config.inspirationRef) {
    const { data, error } = await admin
      .from('moodboard_library_assets')
      .select('asset_id')
      .eq('asset_id', config.inspirationRef)
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .maybeSingle();
    if (error) return { ok: false, reason: 'unread' };
    if (!data) return { ok: false, reason: 'not_offered' };
  }
  // The one price: the card the couple picked, or the shop's only cake card. A card that is not this shop's live cake
  // card is refused; no card at all prices the extras only (the shop quotes the price — never a guessed one).
  const priced = cards.data.filter((c) => c.oneCentavos != null);
  let card: (typeof cards.data)[number] | null = null;
  if (args.cardId) {
    card = cards.data.find((c) => c.id === args.cardId) ?? null;
    if (!card) return { ok: false, reason: 'not_offered' };
  } else if (priced.length === 1) card = priced[0]!;
  return {
    ok: true,
    built: {
      config,
      cardId: card?.id ?? null,
      design: cakeDesignOf(o, config, card && card.oneCentavos != null ? { name: card.name, oneCentavos: card.oneCentavos } : null),
    },
  };
}

/** Stores a checked design once (service role — no browser writes). Returns its id, or null when the write failed. */
export async function storeCakeDesign(admin: SupabaseClient, args: { threadId: string; built: BuiltCakeDesign; userId: string | null }): Promise<string | null> {
  const { data, error } = await admin
    .from('cake_designs')
    .insert({
      thread_id: args.threadId,
      vendor_service_id: args.built.cardId,
      config: args.built.config,
      design: args.built.design,
      estimate_centavos: args.built.design.estimateCentavos,
      created_by: args.userId,
    })
    .select('design_id')
    .single();
  if (error || !data) {
    if (error) logQueryError('storeCakeDesign', error, { thread_id: args.threadId }, 'graceful_degrade');
    return null;
  }
  return (data as { design_id: string }).design_id;
}

/** Removes a stored design whose message never posted, so no design exists that nobody was sent. Best effort. */
export async function dropCakeDesign(admin: SupabaseClient, designId: string): Promise<void> {
  const { error } = await admin.from('cake_designs').delete().eq('design_id', designId);
  if (error) logQueryError('dropCakeDesign', error, { design_id: designId }, 'graceful_degrade');
}

export type StoredCakeDesign = { designId: string; vendorServiceId: string | null; config: CakeConfig; design: CakeDesign; createdAt: string };

const isDesign = (v: unknown): v is CakeDesign => {
  const d = v as Partial<CakeDesign> | null;
  return !!d && typeof d === 'object' && typeof d.sizeWords === 'string' && Array.isArray(d.tiers) && Array.isArray(d.rows) && Array.isArray(d.quoteLines) && typeof d.extrasCentavos === 'number';
};

/** One stored design, on the reader's own session (RLS: thread members). A row that does not read is `unread`. */
export async function readStoredCakeDesign(supabase: SupabaseClient, args: { threadId: string; designId: string }): Promise<Read<StoredCakeDesign>> {
  const { data, error } = await supabase
    .from('cake_designs')
    .select('design_id, vendor_service_id, config, design, created_at')
    .eq('design_id', args.designId)
    .eq('thread_id', args.threadId)
    .maybeSingle();
  if (error) {
    logQueryError('readStoredCakeDesign', error, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const row = data as { design_id: string; vendor_service_id: string | null; config: unknown; design: unknown; created_at: string };
  // The shape is re-checked against the whole catalog (the shop refs it carried are taken as stored — the send checked
  // them against the shop). A row that does not read is `unread`, never an empty cake.
  const c = (row.config ?? {}) as { tiers?: { flavourRef?: unknown }[]; cupcakes?: { packRef?: unknown; flavourRef?: unknown } | null };
  const refs = (c.tiers ?? []).map((t) => t?.flavourRef).filter((r): r is string => typeof r === 'string');
  const cup = c.cupcakes ?? null;
  const checked = sanitizeCakeConfig(row.config, {
    ...fullCakeOffer(),
    flavourRefs: refs,
    messageMax: CAKE_MESSAGE_MAX,
    cupcakes: cup && typeof cup.packRef === 'string' ? { packRefs: [cup.packRef], flavourRefs: typeof cup.flavourRef === 'string' ? [cup.flavourRef] : [], tower: true } : null,
  });
  if (!checked.ok || !isDesign(row.design)) {
    logQueryError('readStoredCakeDesign.shape', { message: checked.ok ? 'design' : checked.reason }, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', data: { designId: row.design_id, vendorServiceId: row.vendor_service_id, config: checked.config, design: row.design, createdAt: row.created_at } };
}

/** Saves the shop's options (service role, after the caller checked the plan and the shop). False = not saved. */
export async function saveShopCakeMaker(admin: SupabaseClient, args: { vendorProfileId: string; options: CakeShopOptions; userId: string }): Promise<boolean> {
  const { error } = await admin
    .from('vendor_cake_makers')
    .upsert({ vendor_profile_id: args.vendorProfileId, options: args.options, updated_by: args.userId, updated_at: new Date().toISOString() }, { onConflict: 'vendor_profile_id' });
  if (error) {
    logQueryError('saveShopCakeMaker', error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
    return false;
  }
  return true;
}

/**
 * 🎂 Is "Design a cake" offered in a chat with this shop? Its Cake Maker is set up AND its plan allows the special
 * tools now. For the chat ＋ tray (couple) and the supplier's ＋ › For your service. `unread` → show nothing new.
 */
export async function readCakeMakerOn(admin: SupabaseClient, vendorProfileId: string): Promise<Read<boolean>> {
  const [options, allowed] = await Promise.all([readShopCakeMaker(admin, vendorProfileId), readShopSpecialToolsAllowed(admin, vendorProfileId)]);
  if (options.status === 'unread' || allowed.status === 'unread') return { status: 'unread' };
  return { status: 'ok', data: options.status === 'ok' && allowed.status === 'ok' && allowed.data };
}
