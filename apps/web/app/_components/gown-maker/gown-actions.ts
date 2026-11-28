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
 *   · `types` / `type_save` — Admin › Studio › Fabric types (step B5b): the fabric-type registry, Setnayan admin only
 *                 (owner Q4). Hide, never delete.
 *   · `stock` / `fabric_save` / `look_save` — Shop › Attire Maker › Fabrics and lace, Inspirations (step B5): the shop's
 *                 own stock, hidden rows and prices included (Shop Manager only; bought AND on a plan to save). A fabric's
 *                 photos must sit in the shop's own gown folder; a look's design gets the same check a bride's does.
 *
 * Every refused read is `{ ok: false }` with the words to show — never an empty gown maker.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { canManageVendor, resolveVendorRoleForProfile } from '@/lib/vendor-role';
import { requireAdminAction } from '@/lib/admin/require-admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { sendChatMessageCore } from '@/lib/chat-send';
import { gownPlanAllows, gownPlanRefusal, type GownPlanState, type GownPlanUse } from '@/lib/gown-plan';
import { stampGownTrial } from '@/lib/gown-plan.server';
import { GOWN_MEASURES, GOWN_REFUSAL_WORDS, gownLookOf, sanitizeGownConfig, startingGownConfig, type GownBody, type GownConfig, type GownMeasures } from '@/lib/gown-config';
import {
  GOWN_ADD_ON_ASK,
  GOWN_DESIGN_NOT_SENT,
  GOWN_DESIGN_UNREADABLE,
  GOWN_INVITE_BODY,
  formatGownDesignBlock,
  gownDesignOf,
  gownDesignRefOf,
  gownDesignRows,
  gownQuotePrefill,
  type GownCardRow,
  type GownQuotePrefill,
  gownShopTemplate,
  gownShopPaper,
  gownShopSeamAllow,
  sanitizeGownOrderPattern,
  GOWN_ORDER_PATTERN_DEFAULT,
  type GownOrderPattern,
  gownFabricGroups,
  sanitizeGownFabricType,
  type GownFabricGroup,
  type GownFabricSlot,
  sanitizeGownShopFabric,
  sanitizeGownShopLookShell,
  type GownFabricTypeRow,
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
  readGownFabricTypeRows,
  readGownFabricTypes,
  readGownFitting,
  readGownMakerOn,
  readShopGownFabrics,
  readShopGownLooks,
  readShopGownMaker,
  readShopGownStock,
  readShopGownPlan,
  readStoredGownDesign,
  sanitizeGownTape,
  saveGownFitting,
  saveGownFabricType,
  saveShopGownFabric,
  saveShopGownLook,
  saveShopGownMaker,
  storeGownDesign,
  type BrideGownFabric,
  type GownFabricTypeOption,
  type GownTape,
  type StoredGownDesign,
  type ShopGownStockFabric,
  type ShopGownStockLook,
} from '@/lib/gown-maker.server';
import type { GownOffer } from '@/lib/gown-config';
import { gownCutContext, type GownCutContext } from '@/lib/gown-pattern/cutting-list';
import type { GownSeamAllow } from '@/lib/gown-pattern/allowance';
import type { GownPaper } from '@/lib/gown-pattern/export';

export type GownOpenRead = {
  ok: true;
  op: 'open';
  shopName: string;
  offer: GownOffer;
  fabrics: BrideGownFabric[];
  looks: { id: string; name: string; photoKey: string | null; config: unknown }[];
  addOns: GownDesignForBride['addOns'];
  /** B15: the Fabric step, grouped by family, each slot offering only the types that suit it. */
  fabricGroups: Record<GownFabricSlot, GownFabricGroup[]>;
};

export type GownDesignPattern = {
  shop: GownSeamAllow;
  paper: GownPaper;
  order: GownOrderPattern;
  cut: GownCutContext | null;
  /** B9 (v209): her lines in cm, drawn on the blocks and printed on the sheet; `unread` is said, never drawn as none. */
  lines: StoredGownDesign['edges'];
};

export type GownDesignRead = {
  ok: true;
  op: 'design';
  viewer: 'vendor' | 'couple';
  /** The stored design this message names (the designer saves the tape against it). */
  designId: string;
  config: unknown;
  body: GownBody | null;
  measures: GownMeasures;
  estimateCentavos: number | null;
  /** The shop only: the cost lines, priced now from its own list. Null for the bride, or when the list does not read. */
  forShop: GownDesignForShop | null;
  /** A7b: what she painted by hand (her own design, so both sides read it): sent · none (not sent) · unread. */
  hand: StoredGownDesign['hand'];
  /** The shop only: the designer's tape. */
  tape: { tape: GownTape; fitAt: string } | null;
  /** The shop only (B11/B12, drawing v205): its allowances and paper, this order's own pattern settings, and which
   *  fabrics the blocks are cut in with the quote's metres. Lengths only; no money. */
  pattern: GownDesignPattern | null;
  /** B8: the card's rows (words only; both sides read the same). */
  rows: GownCardRow[];
  /** B8, the shop only: what Make a quote opens with (the estimate she saw and her priced add-ons). Null for her, and
   *  null on a plan without quotation (owner 2026-11-28: Full only). */
  quote: GownQuotePrefill | null;
  /** The shop only: its Attire Maker plan (the screens draw the 🔒 cards from it). Null for her. */
  shopPlan: GownPlanState | null;
  replaced: boolean;
  sentAt: string;
};

export type GownActionInput =
  | { op: 'design'; threadId: string; messageId: string }
  | { op: 'open'; threadId: string }
  | { op: 'send'; threadId: string; config: unknown; body: unknown; measures: unknown; quantities: unknown; addOns: unknown; hand?: unknown; lines?: unknown }
  | { op: 'invite'; threadId: string }
  | { op: 'status'; threadId: string }
  | { op: 'fit'; threadId: string; designId: string; tape?: unknown; pattern?: unknown }
  | { op: 'options' }
  | { op: 'save'; options: unknown }
  | { op: 'stock' }
  | { op: 'fabric_save'; fabric: unknown }
  | { op: 'look_save'; look: unknown }
  | { op: 'types' }
  | { op: 'type_save'; type: unknown };

export type GownActionResult =
  | GownDesignRead
  | GownOpenRead
  | { ok: true; op: 'send' | 'invite' | 'save' | 'fit' }
  | { ok: true; op: 'status'; on: boolean; side: 'couple' | 'vendor' }
  | { ok: true; op: 'options'; options: GownShopOptions; saved: boolean; locked: boolean; plan: GownPlanState }
  | { ok: true; op: 'stock'; shop: string; fabrics: ShopGownStockFabric[]; looks: ShopGownStockLook[]; types: GownFabricTypeOption[]; locked: boolean }
  | { ok: true; op: 'fabric_save' | 'look_save'; id: string }
  | { ok: true; op: 'types'; types: GownFabricTypeRow[] }
  | { ok: true; op: 'type_save' }
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

  // ── The fabric-type registry: Setnayan admin only (owner Q4), never a shop ──────────────
  if (op === 'types' || op === 'type_save') {
    try {
      await requireAdminAction();
    } catch {
      return fail('Only a Setnayan admin can change the fabric types.');
    }
    const admin = createAdminClient();
    const rows = await readGownFabricTypeRows(admin);
    if (rows.status !== 'ok') return fail('Couldn’t load the fabric types. Try again.');
    if (op === 'types') return { ok: true, op, types: rows.data };
    const checked = sanitizeGownFabricType((input as { type: unknown }).type, new Set(rows.data.map((t) => t.id)));
    if (!checked.ok) return fail(checked.problem);
    return (await saveGownFabricType(admin, { type: checked.type, userId: user.id })) ? { ok: true, op } : fail('That fabric type didn’t save. Try again.');
  }

  // ── The shop's own tool page, and the shop's invite ──────────────────────
  if (op === 'options' || op === 'save' || op === 'invite' || op === 'stock' || op === 'fabric_save' || op === 'look_save') {
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return fail('Only a shop can do this.');
    const shop = profile.vendor_profile_id;
    // 🔒 The price list is the Shop Manager's (owner · admin), like every shop write. A refused role read denies.
    if (op !== 'invite' && !canManageVendor(await resolveVendorRoleForProfile(supabase, user.id, shop))) {
      return fail('Only the shop owner or an admin can change the Attire Maker.');
    }
    const admin = createAdminClient();
    let planRead = await readShopGownPlan(admin, shop);
    if (planRead.status !== 'ok') return fail(gownPlanRefusal({ s: 'unread' }, 'read'));
    // The shop's first open starts its one 30-day trial (owner 2026-11-28, Q2). Only the Shop Manager's open counts.
    if (op === 'options' && planRead.data.s === 'fresh') {
      await stampGownTrial(admin, shop, new Date().toISOString());
      planRead = await readShopGownPlan(admin, shop);
      if (planRead.status !== 'ok') return fail(gownPlanRefusal({ s: 'unread' }, 'read'));
    }
    const plan = planRead.data;
    if (plan.s === 'not_eligible') return fail(gownPlanRefusal(plan, 'read'));
    const canMake = plan.s !== 'fresh' && gownPlanAllows(plan, 'make');
    if (op === 'options') {
      const read = await readShopGownMaker(supabase, shop);
      if (read.status === 'unread') return fail('Couldn’t load your Attire Maker. Try again.');
      return { ok: true, op, options: read.status === 'ok' ? read.data : gownShopTemplate(), saved: read.status === 'ok', locked: !canMake, plan };
    }
    if (op === 'stock') {
      // The shop's own stock list, hidden rows and prices included (the shop's panel only — never a bride's read).
      const [stock, types] = await Promise.all([readShopGownStock(admin, shop), readGownFabricTypes(supabase)]);
      if (stock.status !== 'ok' || types.status !== 'ok') return fail('Couldn’t load your fabrics and looks. Try again.');
      return { ok: true, op, shop, fabrics: stock.data.fabrics, looks: stock.data.looks, types: types.data, locked: !canMake };
    }
    if (!canMake) return fail(gownPlanRefusal(plan, 'make'));
    if (op === 'fabric_save') {
      const types = await readGownFabricTypeIds(supabase);
      if (types.status !== 'ok') return fail();
      const checked = sanitizeGownShopFabric((input as { fabric: unknown }).fabric, { vendorProfileId: shop, typeIds: new Set<string>(types.data) });
      if (!checked.ok) return fail(checked.problem);
      const id = await saveShopGownFabric(admin, { vendorProfileId: shop, fabric: checked.fabric, userId: user.id });
      return id ? { ok: true, op, id } : fail('That fabric didn’t save. Try again.');
    }
    if (op === 'look_save') {
      const shell = sanitizeGownShopLookShell((input as { look: unknown }).look, shop);
      if (!shell.ok) return fail(shell.problem);
      // The look's design is checked against this shop's own offer, the same check a bride's design gets.
      const [types, fabrics, looks] = await Promise.all([readGownFabricTypeIds(supabase), readShopGownFabrics(admin, shop), readShopGownLooks(admin, shop)]);
      if (types.status !== 'ok' || fabrics.status !== 'ok' || looks.status !== 'ok') return fail();
      const raw = shell.config && typeof shell.config === 'object' ? (shell.config as Record<string, unknown>) : null;
      if (!raw) return fail('Open a design on the mannequin, then save it as a look.');
      const config = sanitizeGownConfig({ ...startingGownConfig(), ...raw }, gownOfferOf(types.data, fabrics.data, looks.data));
      if (!config.ok) return fail(GOWN_REFUSAL_WORDS[config.reason]);
      const id = await saveShopGownLook(admin, { vendorProfileId: shop, look: { ...shell.look, config: gownLookOf(config.config) }, userId: user.id });
      return id ? { ok: true, op, id } : fail('That look didn’t save. Try again.');
    }
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
    let pattern: GownDesignRead['pattern'] = null;
    let shopPlan: GownPlanState | null = null;
    if (isShop) {
      // 🔒 The cost lines exist only here, for the shop, priced now from its own list. Never stored on the design row.
      const admin = createAdminClient();
      const [options, fabrics, fit, types, planRead] = await Promise.all([readShopGownMaker(admin, shop), readShopGownFabrics(admin, shop), readGownFitting(supabase, ref), readGownFabricTypes(supabase), readShopGownPlan(admin, shop)]);
      shopPlan = planRead.status === 'ok' ? planRead.data : { s: 'unread' };
      // Owner 2026-11-28: the costing, the quote pre-fill and the pattern work are the Full plan's (and the trial's).
      // Her numbers and the designer's tape stay readable on every plan, paused included.
      const full = gownPlanAllows(shopPlan, 'full');
      const q = stored.data.quantities;
      const c = stored.data.config as Parameters<typeof gownDesignOf>[1] | null;
      if (full && options.status === 'ok' && fabrics.status === 'ok' && q && c) {
        const map = new Map(fabrics.data.map((f) => [f.id, { name: f.name, pricePerMetreCentavos: f.pricePerMetreCentavos }]));
        // A7b: her hand work joins the bead and lace lines; hand work that couldn't be read prices nothing extra.
        forShop = gownDesignOf(options.data, c, q, stored.data.addOns, map, stored.data.hand.s === 'sent' ? stored.data.hand.hand : null).forShop;
      }
      if (fit.status === 'ok') tape = { tape: fit.data.tape, fitAt: fit.data.fitAt };
      // The blocks' settings: a failed read of the shop's options or the tape row is "Couldn't read", never the defaults.
      if (full && (options.status === 'ok' || options.status === 'none') && fit.status !== 'unread') {
        const shopOptions = options.status === 'ok' ? options.data : gownShopTemplate();
        const outerName =
          (c?.fabricRef && fabrics.status === 'ok' ? fabrics.data.find((f) => f.id === c.fabricRef)?.name : null) ??
          (c && types.status === 'ok' ? types.data.find((t) => t.id === c.fabric)?.name : null) ??
          null;
        pattern = {
          shop: gownShopSeamAllow(shopOptions),
          paper: gownShopPaper(shopOptions),
          order: fit.status === 'ok' ? fit.data.pattern : { ...GOWN_ORDER_PATTERN_DEFAULT },
          cut: c ? gownCutContext(stored.data.config as GownConfig, q, outerName) : null,
          lines: stored.data.edges,
        };
      }
    }
    // B8: the card's rows (words only, both sides) and, for the shop alone, the quote its Make a quote opens with.
    const rows = gownDesignRows(stored.data.config, stored.data.addOns, stored.data.hand.s === 'sent' ? stored.data.hand.hand : null);
    return {
      ok: true,
      op: 'design',
      rows,
      quote: isShop && shopPlan && gownPlanAllows(shopPlan, 'full') ? gownQuotePrefill(stored.data.estimateCentavos, forShop, rows) : null,
      shopPlan,
      viewer: isShop ? 'vendor' : 'couple',
      designId: ref,
      config: stored.data.config,
      body: stored.data.body,
      measures: stored.data.measures,
      estimateCentavos: stored.data.estimateCentavos,
      forShop,
      hand: stored.data.hand,
      tape,
      pattern,
      replaced: (newer.data ?? []).length > 0,
      sentAt: msg.created_at,
    };
  }

  // ── The designer's tape (the shop only) ──────────────────────────────────
  if (op === 'fit') {
    const { designId, tape, pattern } = input as { designId: string; tape?: unknown; pattern?: unknown };
    const profile = await fetchOwnVendorProfile(supabase, user.id);
    if (!profile) return fail('Only the shop can save the tape.');
    // The design must be this shop's, read on the shop's own session (RLS: the shop and the chat's hosts).
    const { data: row, error } = await supabase.from('gown_designs').select('design_id').eq('design_id', designId).eq('thread_id', threadId).eq('vendor_profile_id', profile.vendor_profile_id).maybeSingle();
    if (error) return fail();
    if (!row) return fail('This design is not your shop’s.');
    if (tape === undefined && pattern === undefined) return fail();
    // Saving the tape is making (trial or a plan); saving the order's pattern settings is the Full plan's.
    const planRead = await readShopGownPlan(createAdminClient(), profile.vendor_profile_id);
    if (planRead.status !== 'ok') return fail(gownPlanRefusal({ s: 'unread' }, 'make'));
    const need: GownPlanUse = pattern !== undefined ? 'full' : 'make';
    if (planRead.data.s === 'fresh' || !gownPlanAllows(planRead.data, need)) return fail(gownPlanRefusal(planRead.data, need));
    const checked = tape === undefined ? null : sanitizeGownTape(tape, TAPE_KEYS);
    if (checked && !checked.ok) return fail('A measurement could not be read. Check it and save again.');
    const pat = pattern === undefined ? null : sanitizeGownOrderPattern(pattern);
    if (pattern !== undefined && !pat) return fail('The seam allowances could not be read. Check them and try again.');
    const saved = await saveGownFitting(createAdminClient(), { designId, ...(checked?.ok ? { tape: checked.tape } : {}), ...(pat ? { pattern: pat } : {}), userId: user.id });
    return saved ? { ok: true, op: 'fit' } : fail(tape === undefined ? 'The seam allowances didn’t save. Try again.' : 'The tape didn’t save. Try again.');
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
    const i = input as { config: unknown; body: unknown; measures: unknown; quantities: unknown; addOns: unknown; hand?: unknown; lines?: unknown };
    const built = await buildGownDesign(supabase, admin, {
      vendorProfileId: t.vendor_profile_id,
      eventId: t.event_id,
      config: i.config,
      body: i.body,
      measures: i.measures,
      quantities: i.quantities,
      addOns: i.addOns,
      hand: i.hand,
      lines: i.lines,
    });
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
  const [options, planRead, fabrics, looks, types, shopRes] = await Promise.all([
    readShopGownMaker(admin, t.vendor_profile_id),
    readShopGownPlan(admin, t.vendor_profile_id),
    readShopGownFabrics(admin, t.vendor_profile_id),
    readShopGownLooks(admin, t.vendor_profile_id),
    readGownFabricTypes(supabase),
    admin.from('vendor_profiles').select('business_name').eq('vendor_profile_id', t.vendor_profile_id).maybeSingle(),
  ]);
  if (options.status === 'unread' || planRead.status === 'unread' || fabrics.status !== 'ok' || looks.status !== 'ok' || types.status !== 'ok' || shopRes.error) {
    if (shopRes.error) logQueryError('gownAction.open', shopRes.error, { thread_id: threadId }, 'graceful_degrade');
    return fail('Couldn’t open the Attire Maker. Try again.');
  }
  // The shop's trial or plan must be live; a paused shop takes no new design (its work stays its own).
  if (options.status !== 'ok' || planRead.status !== 'ok' || planRead.data.s === 'fresh' || !gownPlanAllows(planRead.data, 'make')) return fail('This shop’s Attire Maker isn’t on.');
  const fullPlan = gownPlanAllows(planRead.data, 'full');
  return {
    ok: true,
    op: 'open',
    shopName: ((shopRes.data as { business_name: string | null } | null)?.business_name ?? '').trim() || 'the shop',
    offer: gownOfferOf(types.data.map((x) => x.id), fabrics.data, looks.data),
    // B15: the Fabric step's choices, grouped by type and only what suits each garment part (A wires the step).
    fabricGroups: {
      gown: gownFabricGroups('gown', types.data, fabrics.data),
      accent: gownFabricGroups('accent', types.data, fabrics.data),
      lining: gownFabricGroups('lining', types.data, fabrics.data),
    },
    // 🔒 Never the per-metre price: the bride gets the public columns only.
    fabrics: fabrics.data.map(({ pricePerMetreCentavos: _price, ...publicCols }) => publicCols),
    looks: looks.data,
    // Owner 2026-11-28: the gown estimate is the Full plan's; on Use and save every price reads "Ask your designer".
    addOns: brideAddOnsOf(options.data).map((a) => (fullPlan || a.centavos === null ? a : { ...a, centavos: null, words: GOWN_ADD_ON_ASK })),
  };
}
