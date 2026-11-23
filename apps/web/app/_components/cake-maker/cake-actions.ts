import 'server-only';

/**
 * 🎂 THE CAKE MAKER'S SERVER SIDE — NOT an action of its own. The action budget is full (1251/1251 with batch F,
 * 2026-11-21), so the Cake Maker adds ZERO routes: every cake read and write rides the Specialized tools' existing
 * dispatcher, `supplierScan` (`app/_actions/supplier-scan-actions.ts`), as `{ op: 'cake_tool', input }` — the Scanner and
 * the Cake Maker are the two tiles of Shop › Specialized tools. The client calls `cakeAction` from `./cake-call`.
 *
 *   · `design`  — one "Cake design" message, read for its card (both sides of the chat): the message names its stored
 *                 row ("Design ref:"), and the row (`cake_designs`, RLS: thread members) is the design.
 *   · `open`    — the couple opens "Design a cake" in their chat: the shop's options (server-side, scoped to the shop of
 *                 THEIR chat), its cake cards, their Mood Board colours, their monogram, their guest count, the photos.
 *   · `send`    — the couple sends the design: re-checked, stored once, posted as ONE message in that chat.
 *   · `invite`  — the supplier's "Ask for a cake design": posts the invite card in their own chat.
 *   · `options` / `save` — Shop › Specialized tools › Cake Maker: read and save the shop's options (Pro and up).
 *
 * Every refused read is `{ ok: false }` with the words to show — never an empty design or an empty Cake Maker.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRoleForProfile } from '@/lib/vendor-role';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sendChatMessageCore } from '@/lib/chat-send';
import { plusGateRefusal } from '@/lib/shop-plus-gate';
import { shopPlusGate } from '@/lib/shop-plus-gate.server';
import { resolveMonogram } from '@/lib/monogram';
import { HERO_MONOGRAM_COLUMNS } from '@/lib/hero-monogram-columns';
import { galleryImageUrl } from '@/lib/moodboard-gallery';
import { CAKE_CONFIG_REFUSAL_WORDS, type CakeConfig } from '@/lib/cake-config';
import {
  CAKE_DESIGN_UNREADABLE,
  CAKE_INVITE_BODY,
  cakeDesignRefOf,
  cakeShopTemplate,
  cupcakeCountOf,
  formatCakeDesignBlock,
  sanitizeCakeShopOptions,
  type CakeDesign,
  type CakeShopOptions,
  type MoodCakeColour,
} from '@/lib/cake-maker';
import {
  buildCakeDesign,
  dropCakeDesign,
  readMoodCakeColours,
  readShopCakeCards,
  readCakeMakerOn,
  readShopCakeMaker,
  readShopCakeToolOpen,
  readStoredCakeDesign,
  saveShopCakeMaker,
  storeCakeDesign,
  type ShopCakeCard,
} from '@/lib/cake-maker.server';

export type CakePhoto = { assetId: string; url: string; label: string | null; from: 'shop' | 'yours' };

export type CakeDesignRead = {
  ok: true;
  op: 'design';
  viewer: 'vendor' | 'couple';
  design: CakeDesign;
  config: CakeConfig;
  cupcakeCount: number;
  monogramText: string | null;
  inspirationUrl: string | null;
  cardId: string | null;
  usualPrepDays: number | null;
  /** A newer design from the couple in this chat — this card says it was replaced. */
  replaced: boolean;
  sentAt: string;
};

export type CakeOpenRead = {
  ok: true;
  op: 'open';
  shopName: string;
  options: CakeShopOptions;
  cards: ShopCakeCard[];
  mood: MoodCakeColour[];
  monogramText: string | null;
  guests: number | null;
  photos: CakePhoto[];
};

export type CakeActionInput =
  | { op: 'design'; threadId: string; messageId: string }
  | { op: 'open'; threadId: string }
  | { op: 'send'; threadId: string; config: unknown; cardId: string | null }
  | { op: 'invite'; threadId: string }
  /** The chat's ＋ tray asks: is this shop's Cake Maker on (and which side am I)? — draws "Design a cake" / "Ask for a cake design". */
  | { op: 'status'; threadId: string }
  | { op: 'options' }
  | { op: 'save'; options: unknown };

export type CakeActionResult =
  | CakeDesignRead
  | CakeOpenRead
  | { ok: true; op: 'send' | 'invite' | 'save' }
  | { ok: true; op: 'status'; on: boolean; side: 'couple' | 'vendor' }
  | { ok: true; op: 'options'; options: CakeShopOptions; saved: boolean; locked: boolean }
  | { ok: false; message: string };

const READ_FAILED = 'Couldn’t load this — try again.';
const fail = (message = READ_FAILED) => ({ ok: false as const, message });

export async function runCakeAction(input: CakeActionInput): Promise<CakeActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail('Sign in again to use the Cake Maker.');
  const op = input?.op;

  // ── The shop's own tool page ─────────────────────────────────────────────
  if (op === 'options' || op === 'save' || op === 'invite') {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return fail('Only a shop can do this.');
    const shop = profile.vendor_profile_id;
    // 🔒 The shop's Cake Maker options are the Shop Manager's (owner · admin), like every shop write (ship review
    // 22 Nov, HIGH): a helper seat never reads them as "not set up" and never overwrites them. A refused role read denies.
    if ((op === 'options' || op === 'save') && !canManageVendor(await resolveVendorRoleForProfile(supabase, user.id, shop))) {
      return fail('Only the shop owner or an admin can change the Cake Maker.');
    }
    const admin = createAdminClient();
    const allowed = await readShopCakeToolOpen(admin, shop);
    if (allowed.status !== 'ok') return fail();
    if (op === 'options') {
      const read = await readShopCakeMaker(supabase, shop);
      if (read.status === 'unread') return fail('Couldn’t load your Cake Maker — try again.');
      return { ok: true, op, options: read.status === 'ok' ? read.data : cakeShopTemplate(), saved: read.status === 'ok', locked: !allowed.data };
    }
    // 🔒 Pro and up after the start date — the saved options are kept, nothing changes.
    if (!allowed.data) return fail('The Cake Maker is included in Pro. Upgrade to change it — your saved options are kept.');
    if (op === 'save') {
      const checked = sanitizeCakeShopOptions((input as { options: unknown }).options);
      if (!checked.ok) return fail(checked.problem);
      return (await saveShopCakeMaker(admin, { vendorProfileId: shop, options: checked.options, userId: user.id })) ? { ok: true, op } : fail('Your Cake Maker didn’t save — try again.');
    }
    // invite
    const threadId = String((input as { threadId?: string }).threadId ?? '');
    const [thread, options] = await Promise.all([
      supabase.from('chat_threads').select('thread_id').eq('thread_id', threadId).eq('vendor_profile_id', shop).maybeSingle(),
      // Read with the service client: the chat (read under RLS above) proves this person works this client, and an
      // Account Manager (role agent) cannot read the shop's options under RLS — they must still be able to invite.
      readShopCakeMaker(admin, shop),
    ]);
    if (thread.error || options.status === 'unread') return fail();
    if (!thread.data) return fail('This chat is not your shop’s.');
    if (options.status !== 'ok') return fail('Set up your Cake Maker first — Shop › Your widgets › Cake Maker.');
    // 🪪 A ＋ tool needs a verified shop (owner 21 Nov 2026) — asked HERE, at the server, before the invite is written:
    // hiding the tile is not a check. A refused read refuses too ('unknown'), never lets the invite through. Read with
    // the service client for the same reason as the options above (an Account Manager cannot read the shop row).
    const plusRefusal = plusGateRefusal(await shopPlusGate(admin, shop));
    if (plusRefusal) return fail(plusRefusal);
    const sent = await sendChatMessageCore(supabase, { threadId, body: CAKE_INVITE_BODY, asSide: 'vendor' });
    return sent.ok ? { ok: true, op } : fail('The invite didn’t send — try again.');
  }

  const threadId = String((input as { threadId?: string }).threadId ?? '');
  if (!threadId) return fail();

  // ── The ＋ tray's question (either side): is the Cake Maker on for this chat's shop? ──
  if (op === 'status') {
    const [threadRes, profile] = await Promise.all([
      supabase.from('chat_threads').select('vendor_profile_id').eq('thread_id', threadId).maybeSingle(),
      fetchOwnVendorProfile(supabase, user.id),
    ]);
    if (threadRes.error) {
      logQueryError('cakeAction.status', threadRes.error, { thread_id: threadId }, 'graceful_degrade');
      return fail();
    }
    const shop = (threadRes.data as { vendor_profile_id: string } | null)?.vendor_profile_id;
    if (!shop) return fail();
    const on = await readCakeMakerOn(createAdminClient(), shop);
    if (on.status !== 'ok') return fail();
    return { ok: true, op: 'status', on: on.data, side: profile && profile.vendor_profile_id === shop ? 'vendor' : 'couple' };
  }

  // ── A design's card (either side of the chat) ────────────────────────────
  if (op === 'design') {
    const messageId = String((input as { messageId?: string }).messageId ?? '');
    const [msgRes, threadRes] = await Promise.all([
      supabase.from('chat_messages').select('message_id, body, sender_role, created_at').eq('message_id', messageId).eq('thread_id', threadId).maybeSingle(),
      supabase.from('chat_threads').select('thread_id, event_id, vendor_profile_id').eq('thread_id', threadId).maybeSingle(),
    ]);
    const failed = msgRes.error ?? threadRes.error;
    if (failed) {
      logQueryError('cakeAction.design', failed, { thread_id: threadId }, 'graceful_degrade');
      return fail();
    }
    const msg = msgRes.data as { body: string | null; sender_role: string | null; created_at: string } | null;
    // Only the couple's own words name a design.
    if (!threadRes.data || !msg || msg.sender_role !== 'couple') return fail();
    const ref = cakeDesignRefOf(msg.body);
    if (!ref) return fail();
    const thread = threadRes.data as { event_id: string | null; vendor_profile_id: string };
    const [stored, profile, newer] = await Promise.all([
      readStoredCakeDesign(supabase, { threadId, designId: ref }),
      fetchOwnVendorProfile(supabase, user.id),
      supabase.from('cake_designs').select('design_id').eq('thread_id', threadId).gt('created_at', msg.created_at).limit(1),
    ]);
    if (stored.status !== 'ok' || newer.error) return fail();
    const { config, design, vendorServiceId } = stored.data;
    const admin = createAdminClient();
    const [cardRes, eventRes, assetRes] = await Promise.all([
      vendorServiceId
        ? admin.from('vendor_services').select('usual_prep_days').eq('vendor_service_id', vendorServiceId).eq('vendor_profile_id', thread.vendor_profile_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      config.monogram && thread.event_id ? supabase.from('events').select(HERO_MONOGRAM_COLUMNS).eq('event_id', thread.event_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      config.inspirationRef ? admin.from('moodboard_library_assets').select('storage_path').eq('asset_id', config.inspirationRef).maybeSingle() : Promise.resolve({ data: null, error: null }),
    ]);
    // The photo and the making time sit beside the design: a refused read leaves them out and is logged.
    for (const e of [cardRes.error, eventRes.error, assetRes.error]) if (e) logQueryError('cakeAction.design.beside', e, { thread_id: threadId }, 'graceful_degrade');
    const ev = eventRes.data as Parameters<typeof resolveMonogram>[0] | null;
    const path = (assetRes.data as { storage_path: string } | null)?.storage_path ?? null;
    return {
      ok: true,
      op: 'design',
      viewer: profile && profile.vendor_profile_id === thread.vendor_profile_id ? 'vendor' : 'couple',
      design,
      config,
      cupcakeCount: cupcakeCountOf(config),
      monogramText: ev ? resolveMonogram(ev).text || null : null,
      inspirationUrl: path ? galleryImageUrl(path) : null,
      cardId: vendorServiceId,
      usualPrepDays: (cardRes.data as { usual_prep_days: number | null } | null)?.usual_prep_days ?? null,
      replaced: (newer.data ?? []).length > 0,
      sentAt: msg.created_at,
    };
  }

  // ── The couple's side: their own chat with a cake shop ───────────────────
  const { data: threadRow, error: threadErr } = await supabase.from('chat_threads').select('thread_id, event_id, vendor_profile_id, pax_current').eq('thread_id', threadId).maybeSingle();
  if (threadErr) {
    logQueryError('cakeAction.thread', threadErr, { thread_id: threadId }, 'graceful_degrade');
    return fail();
  }
  const t = threadRow as { event_id: string | null; vendor_profile_id: string; pax_current: number | null } | null;
  if (!t || !t.event_id) return fail('Open this from your chat with the shop.');
  const admin = createAdminClient();

  if (op === 'send') {
    const { config, cardId } = input as { config: unknown; cardId: string | null };
    const built = await buildCakeDesign(supabase, admin, { vendorProfileId: t.vendor_profile_id, eventId: t.event_id, cardId: cardId ?? null, config });
    if (!built.ok) return fail(built.reason === 'unread' ? CAKE_DESIGN_UNREADABLE : CAKE_CONFIG_REFUSAL_WORDS[built.reason]);
    const id = await storeCakeDesign(admin, { threadId, built: built.built, userId: user.id });
    if (!id) return fail('Your design didn’t go into the chat. It is kept here — send it again.');
    const sent = await sendChatMessageCore(supabase, { threadId, body: formatCakeDesignBlock(built.built.design, id) });
    if (!sent.ok) {
      await dropCakeDesign(admin, id);
      return fail('Your design didn’t go into the chat. It is kept here — send it again.');
    }
    return { ok: true, op: 'send' };
  }

  if (op !== 'open') return fail();
  const [options, allowed, cards, mood, shopRes, eventRes, shopPhotos, ownPhotos] = await Promise.all([
    readShopCakeMaker(admin, t.vendor_profile_id),
    readShopCakeToolOpen(admin, t.vendor_profile_id, t.event_id),
    readShopCakeCards(admin, t.vendor_profile_id),
    readMoodCakeColours(supabase, t.event_id),
    admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', t.vendor_profile_id).maybeSingle(),
    supabase.from('events').select(HERO_MONOGRAM_COLUMNS).eq('event_id', t.event_id).maybeSingle(),
    admin
      .from('moodboard_library_assets')
      .select('asset_id, storage_path, label')
      .eq('vendor_profile_id', t.vendor_profile_id)
      .not('approved_at', 'is', null)
      .is('retired_at', null)
      .order('created_at', { ascending: false })
      .limit(12),
    supabase
      .from('event_inspiration_assets')
      .select('library_asset_id, caption, moodboard_library_assets!inner(asset_id, storage_path, approved_at, retired_at)')
      .eq('event_id', t.event_id)
      .is('removed_at', null)
      .not('library_asset_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(12),
  ]);
  if (options.status === 'unread' || allowed.status === 'unread' || cards.status !== 'ok' || mood.status === 'unread' || shopRes.error || eventRes.error) {
    for (const e of [shopRes.error, eventRes.error]) if (e) logQueryError('cakeAction.open', e, { thread_id: threadId }, 'graceful_degrade');
    return fail('Couldn’t open the Cake Maker — try again.');
  }
  if (options.status !== 'ok' || allowed.status !== 'ok' || !allowed.data) return fail('This shop’s Cake Maker isn’t on.');
  // The photos are a way to start — a refused read leaves them out (logged); "Design your own" still opens.
  for (const e of [shopPhotos.error, ownPhotos.error]) if (e) logQueryError('cakeAction.open.photos', e, { thread_id: threadId }, 'graceful_degrade');
  const photos: CakePhoto[] = [];
  for (const p of (shopPhotos.data ?? []) as { asset_id: string; storage_path: string; label: string | null }[]) {
    photos.push({ assetId: p.asset_id, url: galleryImageUrl(p.storage_path), label: p.label, from: 'shop' });
  }
  type Own = { library_asset_id: string; caption: string | null; moodboard_library_assets: { asset_id: string; storage_path: string; approved_at: string | null; retired_at: string | null } | null };
  for (const p of (ownPhotos.data ?? []) as unknown as Own[]) {
    const a = p.moodboard_library_assets;
    if (!a || !a.approved_at || a.retired_at || photos.some((x) => x.assetId === a.asset_id)) continue;
    photos.push({ assetId: a.asset_id, url: galleryImageUrl(a.storage_path), label: p.caption, from: 'yours' });
  }
  const ev = eventRes.data as Parameters<typeof resolveMonogram>[0] | null;
  return {
    ok: true,
    op: 'open',
    shopName: ((shopRes.data as { business_name: string | null } | null)?.business_name ?? '').trim() || 'the shop',
    options: options.data,
    cards: cards.data,
    mood: mood.status === 'ok' ? mood.data : [],
    monogramText: ev ? resolveMonogram(ev).text || null : null,
    guests: t.pax_current && t.pax_current > 0 ? t.pax_current : null,
    photos,
  };
}
