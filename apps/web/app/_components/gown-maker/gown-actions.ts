import 'server-only';

/**
 * 👗 THE ATTIRE MAKER'S SERVER SIDE (plan step B3) — NOT an action of its own. The action budget is full, so every gown
 * read and write rides the Specialized tools' existing dispatcher `supplierScan` as `{ op: 'gown_tool', input }`, exactly
 * as the Cake Maker does (`../cake-maker/cake-actions.ts`). The client calls `gownAction` from `./gown-call`.
 *
 *   · `options` / `save` — Shop › Your widgets › Attire Maker: the shop's own price list (Shop Manager only; bought AND
 *                          on a plan to save; a locked shop still reads what it saved).
 *   · `status`  — the chat's ＋ tray: is this shop's Attire Maker on, and which side am I?
 *   · `open`    — the bride opens "Design a gown" in her chat: what she may see of the shop (its name, the fabric and
 *                 lace rows WITHOUT their prices, its looks, the add-ons as words, the offer). Never the price list.
 *   · `invite`  — the designer's "Invite to design a gown": posts the invite card in their own chat.
 *   · `send`    — the bride sends: re-checked, priced on the server, stored once (no cost line), posted as ONE message.
 *   · `design`  — one design message, read for its card: the bride gets her design and the one estimate; the shop also
 *                 gets the cost lines, computed now from its own list — never stored where she can read them.
 *   · `fit`     — the designer saves the tape at the fitting (`gown_fittings`, the shop only).
 *
 * Every refused read is `{ ok: false }` with the words to show — never an empty gown maker.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRoleForProfile } from '@/lib/vendor-role';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sendChatMessageCore } from '@/lib/chat-send';
import { plusGateRefusal } from '@/lib/shop-plus-gate';
import { shopPlusGate } from '@/lib/shop-plus-gate.server';
import { GOWN_MEASURES, GOWN_REFUSAL_WORDS, type GownBody, type GownMeasures } from '@/lib/gown-config';
import {
  GOWN_DESIGN_NOT_SENT,
  GOWN_DESIGN_UNREADABLE,
  GOWN_INVITE_BODY,
  formatGownDesignBlock,
  gownDesignOf,
  gownDesignRefOf,
  gownShopTemplate,
  sanitizeGownShopOptions,
  type GownDesignForBride,
  type GownDesignForShop,
  type GownShopOptions,
} from '@/lib/gown-maker';
import {
  brideAddOnsOf,
  buildGownDesign,
  dropGownDesign,
  gownOfferOf,
  readGownFabricTypeIds,
  readGownFitting,
  readGownMakerOn,
  readShopGownFabrics,
  readShopGownLooks,
  readShopGownMaker,
  readShopGownToolOpen,
  readStoredGownDesign,
  sanitizeGownTape,
  saveGownFitting,
  saveShopGownMaker,
  storeGownDesign,
  type BrideGownFabric,
  type GownTape,
} from '@/lib/gown-maker.server';
import type { GownOffer } from '@/lib/gown-config';

export type GownOpenRead = {
  ok: true;
  op: 'open';
  shopName: string;
  offer: GownOffer;
  fabrics: BrideGownFabric[];
  looks: { id: string; name: string; photoKey: string | null; config: unknown }[];
  addOns: GownDesignForBride['addOns'];
};

export type GownDesignRead = {
  ok: true;
  op: 'design';
  viewer: 'vendor' | 'couple';
  config: unknown;
  body: GownBody | null;
  measures: GownMeasures;
  estimateCentavos: number | null;
  /** The shop only: the cost lines, priced now from its own list. Null for the bride, or when the list does not read. */
  forShop: GownDesignForShop | null;
  /** The shop only: the designer's tape. */
  tape: { tape: GownTape; fitAt: string } | null;
  replaced: boolean;
  sentAt: string;
};

export type GownActionInput =
  | { op: 'design'; threadId: string; messageId: string }
  | { op: 'open'; threadId: string }
  | { op: 'send'; threadId: string; config: unknown; body: unknown; measures: unknown; quantities: unknown; addOns: unknown }
  | { op: 'invite'; threadId: string }
  | { op: 'status'; threadId: string }
  | { op: 'fit'; threadId: string; designId: string; tape: unknown }
  | { op: 'options' }
  | { op: 'save'; options: unknown };

export type GownActionResult =
  | GownDesignRead
  | GownOpenRead
  | { ok: true; op: 'send' | 'invite' | 'save' | 'fit' }
  | { ok: true; op: 'status'; on: boolean; side: 'couple' | 'vendor' }
  | { ok: true; op: 'options'; options: GownShopOptions; saved: boolean; locked: boolean }
  | { ok: false; message: string };

const READ_FAILED = 'Couldn’t load this. Try again.';
const fail = (message = READ_FAILED) => ({ ok: false as const, message });
const TAPE_KEYS = GOWN_MEASURES.map((m) => m.id);

export async function runGownAction(input: GownActionInput): Promise<GownActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in again to use the Attire Maker.');
  const op = input?.op;

  // ── The shop's own tool page, and the shop's invite ──────────────────────
  if (op === 'options' || op === 'save' || op === 'invite') {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return fail('Only a shop can do this.');
    const shop = profile.vendor_profile_id;
    // 🔒 The price list is the Shop Manager's (owner · admin), like every shop write. A refused role read denies.
    if ((op === 'options' || op === 'save') && !canManageVendor(await resolveVendorRoleForProfile(supabase, user.id, shop))) {
      return fail('Only the shop owner or an admin can change the Attire Maker.');
    }
    const admin = createAdminClient();
    const allowed = await readShopGownToolOpen(admin, shop);
    if (allowed.status !== 'ok') return fail();
    if (op === 'options') {
      const read = await readShopGownMaker(supabase, shop);
      if (read.status === 'unread') return fail('Couldn’t load your Attire Maker. Try again.');
      return { ok: true, op, options: read.status === 'ok' ? read.data : gownShopTemplate(), saved: read.status === 'ok', locked: !allowed.data };
    }
    if (!allowed.data) return fail('The Attire Maker isn’t on for your shop yet. Open it in the Toolkit; your saved price list is kept.');
    if (op === 'save') {
      const checked = sanitizeGownShopOptions((input as { options: unknown }).options);
      if (!checked.ok) return fail(checked.problem);
      return (await saveShopGownMaker(admin, { vendorProfileId: shop, options: checked.options, userId: user.id })) ? { ok: true, op } : fail('Your price list didn’t save. Try again.');
    }
    // invite
    const threadId = String((input as { threadId?: string }).threadId ?? '');
    const [thread, options] = await Promise.all([
      supabase.from('chat_threads').select('thread_id').eq('thread_id', threadId).eq('vendor_profile_id', shop).maybeSingle(),
      readShopGownMaker(admin, shop),
    ]);
    if (thread.error || options.status === 'unread') return fail();
    if (!thread.data) return fail('This chat is not your shop’s.');
    if (options.status !== 'ok') return fail('Set up your Attire Maker first: Shop › Your widgets › Attire Maker.');
    const plusRefusal = plusGateRefusal(await shopPlusGate(admin, shop));
    if (plusRefusal) return fail(plusRefusal);
    const sent = await sendChatMessageCore(supabase, { threadId, body: GOWN_INVITE_BODY, asSide: 'vendor' });
    return sent.ok ? { ok: true, op } : fail('The invite didn’t send. Try again.');
  }

  const threadId = String((input as { threadId?: string }).threadId ?? '');
  if (!threadId) return fail();

  // ── The ＋ tray's question (either side) ─────────────────────────────────
  if (op === 'status') {
    const [threadRes, profile] = await Promise.all([
      supabase.from('chat_threads').select('vendor_profile_id').eq('thread_id', threadId).maybeSingle(),
      fetchOwnVendorProfile(supabase, user.id),
    ]);
    if (threadRes.error) {
      logQueryError('gownAction.status', threadRes.error, { thread_id: threadId }, 'graceful_degrade');
      return fail();
    }
    const shop = (threadRes.data as { vendor_profile_id: string } | null)?.vendor_profile_id;
    if (!shop) return fail();
    const on = await readGownMakerOn(createAdminClient(), shop);
    if (on.status !== 'ok') return fail();
    return { ok: true, op: 'status', on: on.data, side: profile && profile.vendor_profile_id === shop ? 'vendor' : 'couple' };
  }

  // ── A design's card (either side of the chat) ────────────────────────────
  if (op === 'design') {
    const messageId = String((input as { messageId?: string }).messageId ?? '');
    const [msgRes, threadRes] = await Promise.all([
      supabase.from('chat_messages').select('message_id, body, sender_role, created_at').eq('message_id', messageId).eq('thread_id', threadId).maybeSingle(),
      supabase.from('chat_threads').select('thread_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle(),
    ]);
    const failed = msgRes.error ?? threadRes.error;
    if (failed) {
      logQueryError('gownAction.design', failed, { thread_id: threadId }, 'graceful_degrade');
      return fail();
    }
    const msg = msgRes.data as { body: string | null; sender_role: string | null; created_at: string } | null;
    // Only the bride's own words name a design.
    if (!threadRes.data || !msg || msg.sender_role !== 'couple') return fail();
    const ref = gownDesignRefOf(msg.body);
    if (!ref) return fail();
    const shop = (threadRes.data as { vendor_profile_id: string }).vendor_profile_id;
    const [stored, profile, newer] = await Promise.all([
      readStoredGownDesign(supabase, { threadId, designId: ref }),
      fetchOwnVendorProfile(supabase, user.id),
      supabase.from('gown_designs').select('design_id').eq('thread_id', threadId).gt('created_at', msg.created_at).limit(1),
    ]);
    if (stored.status !== 'ok' || newer.error) return fail();
    const isShop = !!profile && profile.vendor_profile_id === shop;
    let forShop: GownDesignForShop | null = null;
    let tape: GownDesignRead['tape'] = null;
    if (isShop) {
      // 🔒 The cost lines exist only here, for the shop, priced now from its own list. Never stored on the design row.
      const admin = createAdminClient();
      const [options, fabrics, fit] = await Promise.all([readShopGownMaker(admin, shop), readShopGownFabrics(admin, shop), readGownFitting(supabase, ref)]);
      const q = stored.data.quantities;
      const c = stored.data.config as Parameters<typeof gownDesignOf>[1] | null;
      if (options.status === 'ok' && fabrics.status === 'ok' && q && c) {
        const map = new Map(fabrics.data.map((f) => [f.id, { name: f.name, pricePerMetreCentavos: f.pricePerMetreCentavos }]));
        forShop = gownDesignOf(options.data, c, q, [], map).forShop;
      }
      if (fit.status === 'ok') tape = fit.data;
    }
    return {
      ok: true,
      op: 'design',
      viewer: isShop ? 'vendor' : 'couple',
      config: stored.data.config,
      body: stored.data.body,
      measures: stored.data.measures,
      estimateCentavos: stored.data.estimateCentavos,
      forShop,
      tape,
      replaced: (newer.data ?? []).length > 0,
      sentAt: msg.created_at,
    };
  }

  // ── The designer's tape (the shop only) ──────────────────────────────────
  if (op === 'fit') {
    const { designId, tape } = input as { designId: string; tape: unknown };
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return fail('Only the shop can save the tape.');
    // The design must be this shop's, read on the shop's own session (RLS: the shop and the chat's hosts).
    const { data: row, error } = await supabase.from('gown_designs').select('design_id').eq('design_id', designId).eq('thread_id', threadId).eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle();
    if (error) return fail();
    if (!row) return fail('This design is not your shop’s.');
    const checked = sanitizeGownTape(tape, TAPE_KEYS);
    if (!checked.ok) return fail('A measurement could not be read. Check it and save again.');
    return (await saveGownFitting(createAdminClient(), { designId, tape: checked.tape, userId: user.id })) ? { ok: true, op: 'fit' } : fail('The tape didn’t save. Try again.');
  }

  // ── The bride's side: her own chat with a gown shop ──────────────────────
  const { data: threadRow, error: threadErr } = await supabase.from('chat_threads').select('thread_id, event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle();
  if (threadErr) {
    logQueryError('gownAction.thread', threadErr, { thread_id: threadId }, 'graceful_degrade');
    return fail();
  }
  const t = threadRow as { event_id: string | null; vendor_profile_id: string } | null;
  if (!t || !t.event_id) return fail('Open this from your chat with the shop.');
  const admin = createAdminClient();

  if (op === 'send') {
    const i = input as { config: unknown; body: unknown; measures: unknown; quantities: unknown; addOns: unknown };
    const built = await buildGownDesign(supabase, admin, { vendorProfileId: t.vendor_profile_id, eventId: t.event_id, ...i });
    if (!built.ok) return fail(built.reason === 'unread' ? GOWN_DESIGN_UNREADABLE : GOWN_REFUSAL_WORDS[built.reason]);
    const id = await storeGownDesign(admin, { threadId, vendorProfileId: t.vendor_profile_id, built: built.built, userId: user.id });
    if (!id) return fail(GOWN_DESIGN_NOT_SENT);
    const sent = await sendChatMessageCore(supabase, { threadId, body: formatGownDesignBlock(built.built.config, built.built.forBride, id) });
    if (!sent.ok) {
      await dropGownDesign(admin, id);
      return fail(GOWN_DESIGN_NOT_SENT);
    }
    return { ok: true, op: 'send' };
  }

  if (op !== 'open') return fail();
  const [options, allowed, fabrics, looks, types, shopRes] = await Promise.all([
    readShopGownMaker(admin, t.vendor_profile_id),
    readShopGownToolOpen(admin, t.vendor_profile_id, t.event_id),
    readShopGownFabrics(admin, t.vendor_profile_id),
    readShopGownLooks(admin, t.vendor_profile_id),
    readGownFabricTypeIds(supabase),
    admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', t.vendor_profile_id).maybeSingle(),
  ]);
  if (options.status === 'unread' || allowed.status === 'unread' || fabrics.status !== 'ok' || looks.status !== 'ok' || types.status !== 'ok' || shopRes.error) {
    if (shopRes.error) logQueryError('gownAction.open', shopRes.error, { thread_id: threadId }, 'graceful_degrade');
    return fail('Couldn’t open the Attire Maker. Try again.');
  }
  if (options.status !== 'ok' || allowed.status !== 'ok' || !allowed.data) return fail('This shop’s Attire Maker isn’t on.');
  return {
    ok: true,
    op: 'open',
    shopName: ((shopRes.data as { business_name: string | null } | null)?.business_name ?? '').trim() || 'the shop',
    offer: gownOfferOf(types.data, fabrics.data, looks.data),
    // 🔒 Never the per-metre price: the bride gets the public columns only.
    fabrics: fabrics.data.map(({ pricePerMetreCentavos: _price, ...publicCols }) => publicCols),
    looks: looks.data,
    addOns: brideAddOnsOf(options.data),
  };
}
