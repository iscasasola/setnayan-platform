import 'server-only';
/**
 * 👗 gown-maker.server — the Attire Maker's reads and writes (plan steps B3/B4; migration 20271365509280). Server only.
 * Built as lib/cake-maker.server.ts is: every read is `ok · none · unread` (a refused read is never an empty gown
 * maker), the shop's rows are written with the service client only after the caller checked the shop and the plan.
 *
 * 🔒 Owner rule held here: the shop's price list, its fabrics' per-metre prices and every cost line stay on the server.
 * `readGownOpenForBride` hands a bride only what she may see; `gownDesignOf` is priced here, and only its `forBride`
 * half and the one estimate are ever stored on the row she can read (`gown_designs`).
 * 🔒 lib/gown-maker.server.test.ts
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { publicUrlForStoredAsset } from '@/lib/uploads';
import { readShopSpecialToolOpen } from '@/lib/paid-widget-open.server';
import {
  GOWN_STOCK_FABRICS,
  sanitizeGownBody,
  sanitizeGownConfig,
  sanitizeGownMeasures,
  sanitizeGownQuantities,
  type GownBody,
  type GownConfig,
  type GownMeasures,
  type GownOffer,
  type GownQuantities,
  type GownMeasureKey,
  type GownRefusal,
} from '@/lib/gown-config';

/** The designer's tape for one design (gown_fittings.fit): cm by measurement. Same shape as lib/gown-pattern GownTape. */
export type GownTape = Partial<Record<GownMeasureKey, number>>;
import {
  gownAddOnsOffered,
  gownDesignOf,
  GOWN_ADD_ONS,
  GOWN_ADD_ON_ASK,
  GOWN_ADD_ON_INCLUDED,
  sanitizeGownShopOptions,
  type GownFabricColour,
  type GownFabricTune,
  type GownShopFabricInput,
  type GownShopLookInput,
  type GownFabricTypeOption,
  type GownFabricTypeRow,
  type ShopGownStockFabric,
  type ShopGownStockLook,
  type GownAddOnKey,
  type GownDesignForBride,
  type GownShopFabric,
  type GownShopOptions,
} from '@/lib/gown-maker';

export type Read<T> = { status: 'ok'; data: T } | { status: 'unread' } | { status: 'none' };

/** The shop's Attire Maker options. `none` = never set up; a stored row that no longer reads is `unread`. */
export async function readShopGownMaker(client: SupabaseClient, vendorProfileId: string): Promise<Read<GownShopOptions>> {
  const { data, error } = await client.from('vendor_gown_makers').select('options').eq('vendor_profile_id', vendorProfileId).maybeSingle();
  if (error) {
    logQueryError('readShopGownMaker', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const checked = sanitizeGownShopOptions((data as { options: unknown }).options);
  if (!checked.ok) {
    logQueryError('readShopGownMaker.shape', { message: checked.problem }, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', data: checked.options };
}

/** The Attire Maker's gate — the one answer (bought in the Toolkit AND on Plus, Pro or Ultra) for `attire_tool`. */
export function readShopGownToolOpen(admin: SupabaseClient, vendorProfileId: string, eventId: string | null = null): Promise<Read<boolean>> {
  return readShopSpecialToolOpen(admin, vendorProfileId, 'attire_tool', eventId);
}

/** Saves the shop's options (service role, after the caller checked the shop and the plan). False = not saved. */
export async function saveShopGownMaker(admin: SupabaseClient, args: { vendorProfileId: string; options: GownShopOptions; userId: string }): Promise<boolean> {
  const { error } = await admin
    .from('vendor_gown_makers')
    .upsert({ vendor_profile_id: args.vendorProfileId, options: args.options, updated_by: args.userId, updated_at: new Date().toISOString() }, { onConflict: 'vendor_profile_id' });
  if (error) {
    logQueryError('saveShopGownMaker', error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
    return false;
  }
  return true;
}

/** Is "Design a gown" offered in a chat with this shop? Set up AND open now. `unread` → show nothing new. */
export async function readGownMakerOn(admin: SupabaseClient, vendorProfileId: string): Promise<Read<boolean>> {
  const [options, allowed] = await Promise.all([readShopGownMaker(admin, vendorProfileId), readShopGownToolOpen(admin, vendorProfileId)]);
  if (options.status === 'unread' || allowed.status === 'unread') return { status: 'unread' };
  return { status: 'ok', data: options.status === 'ok' && allowed.status === 'ok' && allowed.data };
}

/** A shop fabric or lace row, with its price — server side only. */
export type ShopGownFabricRow = {
  id: string;
  kind: 'fabric' | 'lace';
  name: string;
  code: string | null;
  typeId: string | null;
  pricePerMetreCentavos: number | null;
  thumbKey: string | null;
  tileKey: string | null;
};
/** What a bride may see of a shop fabric: never its price. */
export type BrideGownFabric = Omit<ShopGownFabricRow, 'pricePerMetreCentavos'>;
export type ShopGownLook = { id: string; name: string; photoKey: string | null; config: unknown };

/** The shop's active fabrics and laces (service client; the caller decides what leaves the server). */
export async function readShopGownFabrics(admin: SupabaseClient, vendorProfileId: string): Promise<Read<ShopGownFabricRow[]>> {
  const { data, error } = await admin
    .from('vendor_gown_fabrics')
    .select('fabric_id, kind, name, code, type_id, price_per_metre_centavos, thumb_key, tile_key')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('active', true)
    .order('kind')
    .order('sort');
  if (error) {
    logQueryError('readShopGownFabrics', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  type Row = { fabric_id: string; kind: 'fabric' | 'lace'; name: string; code: string | null; type_id: string | null; price_per_metre_centavos: number | string | null; thumb_key: string | null; tile_key: string | null };
  return {
    status: 'ok',
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.fabric_id,
      kind: r.kind,
      name: r.name,
      code: r.code,
      typeId: r.type_id,
      pricePerMetreCentavos: r.price_per_metre_centavos == null ? null : Number(r.price_per_metre_centavos),
      thumbKey: r.thumb_key,
      tileKey: r.tile_key,
    })),
  };
}

/** The shop's active looks. */
export async function readShopGownLooks(admin: SupabaseClient, vendorProfileId: string): Promise<Read<ShopGownLook[]>> {
  const { data, error } = await admin
    .from('vendor_gown_looks')
    .select('look_id, name, photo_key, config')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('active', true)
    .order('sort');
  if (error) {
    logQueryError('readShopGownLooks', error, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', data: ((data ?? []) as { look_id: string; name: string; photo_key: string | null; config: unknown }[]).map((r) => ({ id: r.look_id, name: r.name, photoKey: r.photo_key, config: r.config })) };
}

/** The active fabric-type ids in the registry (everyone signed in reads it). A refused read falls back to nothing. */
export async function readGownFabricTypeIds(client: SupabaseClient): Promise<Read<string[]>> {
  const { data, error } = await client.from('gown_fabric_types').select('type_id').eq('active', true).order('sort');
  if (error) {
    logQueryError('readGownFabricTypeIds', error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  return { status: 'ok', data: ((data ?? []) as { type_id: string }[]).map((r) => r.type_id) };
}

/** What one shop offers a bride (the contract's GownOffer): the stock types plus the registry, and its own rows. */
export function gownOfferOf(typeIds: readonly string[], fabrics: readonly ShopGownFabricRow[], looks: readonly ShopGownLook[]): GownOffer {
  const types = new Set<string>([...GOWN_STOCK_FABRICS.map((f) => f.id), ...typeIds]);
  return {
    fabricTypes: [...types],
    fabricRefs: fabrics.filter((f) => f.kind === 'fabric').map((f) => f.id),
    laceRefs: fabrics.filter((f) => f.kind === 'lace').map((f) => f.id),
    lookRefs: looks.map((l) => l.id),
  };
}

/** The add-ons a bride is shown: offered ones only, each with its words or her amount — never a cost. */
export function brideAddOnsOf(o: GownShopOptions): GownDesignForBride['addOns'] {
  return gownAddOnsOffered(o).map((id) => {
    const a = o.addOns[id];
    const label = GOWN_ADD_ONS.find((x) => x.id === id)!.label;
    if (a.state === 'priced') return { id, label, centavos: a.centavos, words: a.centavos === null ? GOWN_ADD_ON_ASK : null };
    return { id, label, centavos: null, words: a.state === 'free' ? GOWN_ADD_ON_INCLUDED : GOWN_ADD_ON_ASK };
  });
}

export type BuiltGownDesign = {
  config: GownConfig;
  body: GownBody;
  measures: GownMeasures;
  quantities: GownQuantities;
  forBride: GownDesignForBride;
};

/**
 * A design the bride's device sent, re-checked on the server against this shop's own offer and plan, then priced
 * with the shop's own list. Refused — never thinned — when any of that fails.
 */
export async function buildGownDesign(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  args: { vendorProfileId: string; eventId: string; config: unknown; body: unknown; measures: unknown; quantities: unknown; addOns: unknown },
): Promise<{ ok: true; built: BuiltGownDesign } | { ok: false; reason: GownRefusal | 'unread' }> {
  const [options, allowed, fabrics, looks, types] = await Promise.all([
    readShopGownMaker(admin, args.vendorProfileId),
    readShopGownToolOpen(admin, args.vendorProfileId, args.eventId),
    readShopGownFabrics(admin, args.vendorProfileId),
    readShopGownLooks(admin, args.vendorProfileId),
    readGownFabricTypeIds(supabase),
  ]);
  if (options.status === 'unread' || allowed.status === 'unread' || fabrics.status !== 'ok' || looks.status !== 'ok' || types.status !== 'ok') return { ok: false, reason: 'unread' };
  if (options.status !== 'ok' || allowed.status !== 'ok' || !allowed.data) return { ok: false, reason: 'not_offered' };
  const config = sanitizeGownConfig(args.config, gownOfferOf(types.data, fabrics.data, looks.data));
  if (!config.ok) return config;
  const body = sanitizeGownBody(args.body);
  if (!body.ok) return body;
  const measures = sanitizeGownMeasures(args.measures);
  if (!measures.ok) return measures;
  const quantities = sanitizeGownQuantities(args.quantities);
  if (!quantities.ok) return quantities;
  // Her add-ons: ids only, each one the shop offers. Anything else refuses (never silently dropped).
  const picked = Array.isArray(args.addOns) ? args.addOns : [];
  const offered = new Set<string>(gownAddOnsOffered(options.data));
  if (!picked.every((a) => typeof a === 'string' && offered.has(a))) return { ok: false, reason: 'not_offered' };
  const shopFabrics = new Map<string, GownShopFabric>(fabrics.data.map((f) => [f.id, { name: f.name, pricePerMetreCentavos: f.pricePerMetreCentavos }]));
  const priced = gownDesignOf(options.data, config.config, quantities.quantities, picked as GownAddOnKey[], shopFabrics);
  return { ok: true, built: { config: config.config, body: body.body, measures: measures.measures, quantities: quantities.quantities, forBride: priced.forBride } };
}

/** Stores a checked design once (service role). No cost line is stored: only quantities and the one estimate. */
export async function storeGownDesign(
  admin: SupabaseClient,
  args: { threadId: string; vendorProfileId: string; built: BuiltGownDesign; userId: string | null },
): Promise<string | null> {
  const { data, error } = await admin
    .from('gown_designs')
    .insert({
      thread_id: args.threadId,
      vendor_profile_id: args.vendorProfileId,
      config: args.built.config,
      body: args.built.body,
      measures: args.built.measures,
      quantities: args.built.quantities,
      estimate_centavos: args.built.forBride.estimateCentavos,
      created_by: args.userId,
    })
    .select('design_id')
    .single();
  if (error || !data) {
    if (error) logQueryError('storeGownDesign', error, { thread_id: args.threadId }, 'graceful_degrade');
    return null;
  }
  return (data as { design_id: string }).design_id;
}

/** Removes a stored design whose message never posted. Best effort. */
export async function dropGownDesign(admin: SupabaseClient, designId: string): Promise<void> {
  const { error } = await admin.from('gown_designs').delete().eq('design_id', designId);
  if (error) logQueryError('dropGownDesign', error, { design_id: designId }, 'graceful_degrade');
}

export type StoredGownDesign = {
  designId: string;
  vendorProfileId: string;
  config: unknown;
  body: GownBody | null;
  measures: GownMeasures;
  quantities: GownQuantities | null;
  estimateCentavos: number | null;
  createdAt: string;
};

/** One stored design, on the reader's own session (RLS: the chat's hosts and that shop). */
export async function readStoredGownDesign(supabase: SupabaseClient, args: { threadId: string; designId: string }): Promise<Read<StoredGownDesign>> {
  const { data, error } = await supabase
    .from('gown_designs')
    .select('design_id, vendor_profile_id, config, body, measures, quantities, estimate_centavos, created_at')
    .eq('design_id', args.designId)
    .eq('thread_id', args.threadId)
    .maybeSingle();
  if (error) {
    logQueryError('readStoredGownDesign', error, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  type Row = { design_id: string; vendor_profile_id: string; config: unknown; body: unknown; measures: unknown; quantities: unknown; estimate_centavos: number | string | null; created_at: string };
  const r = data as Row;
  const body = r.body == null ? null : sanitizeGownBody(r.body);
  const measures = sanitizeGownMeasures(r.measures ?? {});
  const quantities = r.quantities == null ? null : sanitizeGownQuantities(r.quantities);
  if ((body && !body.ok) || !measures.ok || (quantities && !quantities.ok)) {
    logQueryError('readStoredGownDesign.shape', { message: 'shape' }, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return {
    status: 'ok',
    data: {
      designId: r.design_id,
      vendorProfileId: r.vendor_profile_id,
      config: r.config,
      body: body && body.ok ? body.body : null,
      measures: measures.measures,
      quantities: quantities && quantities.ok ? quantities.quantities : null,
      estimateCentavos: r.estimate_centavos == null ? null : Number(r.estimate_centavos),
      createdAt: r.created_at,
    },
  };
}

const TAPE_MAX_CM = 250;

/** The designer's tape, checked: GownMeasures keys only, each a positive cm under the typo guard. Refuses, never repairs. */
export function sanitizeGownTape(input: unknown, keys: readonly string[]): { ok: true; tape: GownTape } | { ok: false } {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false };
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(input)) {
    if (!keys.includes(k) || typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > TAPE_MAX_CM) return { ok: false };
    out[k] = Math.round(v * 10) / 10;
  }
  return { ok: true, tape: out as GownTape };
}

/** Saves the designer's tape for one design (service role, after the caller proved it is that shop's). */
export async function saveGownFitting(admin: SupabaseClient, args: { designId: string; tape: GownTape; userId: string }): Promise<boolean> {
  const { error } = await admin
    .from('gown_fittings')
    .upsert({ design_id: args.designId, fit: args.tape, fit_at: new Date().toISOString(), updated_by: args.userId }, { onConflict: 'design_id' });
  if (error) {
    logQueryError('saveGownFitting', error, { design_id: args.designId }, 'graceful_degrade');
    return false;
  }
  return true;
}

/** The designer's tape for one design, on the shop's own session (RLS: the shop only). */
export async function readGownFitting(supabase: SupabaseClient, designId: string): Promise<Read<{ tape: GownTape; fitAt: string }>> {
  const { data, error } = await supabase.from('gown_fittings').select('fit, fit_at').eq('design_id', designId).maybeSingle();
  if (error) {
    logQueryError('readGownFitting', error, { design_id: designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const r = data as { fit: Record<string, number>; fit_at: string };
  return { status: 'ok', data: { tape: r.fit as GownTape, fitAt: r.fit_at } };
}

// ── B5 · the shop's own stock: every fabric, lace and look, hidden ones too, with prices (the shop only) ─────────────

export type { ShopGownStockFabric, ShopGownStockLook, GownFabricTypeOption } from '@/lib/gown-maker';

/** The public address of a photo in the media bucket (the shop's own gown folder), or null. */
function mediaUrlOf(ref: string | null): string | null {
  return ref ? publicUrlForStoredAsset(ref) : null;
}

export async function readGownFabricTypes(client: SupabaseClient): Promise<Read<GownFabricTypeOption[]>> {
  const { data, error } = await client.from('gown_fabric_types').select('type_id, name, sheen, sheer, stiff, verified, family, used_for').eq('active', true).order('sort');
  if (error) {
    logQueryError('readGownFabricTypes', error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  type Row = { type_id: string; name: string; sheen: number | string; sheer: number | string; stiff: number | string; verified: boolean; family: GownFabricTypeOption['family']; used_for: GownFabricTypeOption['usedFor'] | null };
  return {
    status: 'ok',
    data: ((data ?? []) as Row[]).map((r) => ({ id: r.type_id, name: r.name, sheen: Number(r.sheen), sheer: Number(r.sheer), stiff: Number(r.stiff), verified: r.verified, family: r.family, usedFor: r.used_for ?? [] })),
  };
}

export async function readShopGownStock(admin: SupabaseClient, vendorProfileId: string): Promise<Read<{ fabrics: ShopGownStockFabric[]; looks: ShopGownStockLook[] }>> {
  const [f, l] = await Promise.all([
    admin
      .from('vendor_gown_fabrics')
      .select('fabric_id, kind, name, code, type_id, colours, price_per_metre_centavos, tune, thumb_key, tile_key, active')
      .eq('vendor_profile_id', vendorProfileId)
      .order('kind')
      .order('sort')
      .order('created_at'),
    admin.from('vendor_gown_looks').select('look_id, name, photo_key, config, active').eq('vendor_profile_id', vendorProfileId).order('sort').order('created_at'),
  ]);
  if (f.error || l.error) {
    logQueryError('readShopGownStock', (f.error ?? l.error)!, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  type F = { fabric_id: string; kind: 'fabric' | 'lace'; name: string; code: string | null; type_id: string; colours: GownFabricColour[] | null; price_per_metre_centavos: number | string | null; tune: GownFabricTune | null; thumb_key: string | null; tile_key: string | null; active: boolean };
  type L = { look_id: string; name: string; photo_key: string | null; config: unknown; active: boolean };
  return {
    status: 'ok',
    data: {
      fabrics: ((f.data ?? []) as F[]).map((r) => ({
        id: r.fabric_id,
        kind: r.kind,
        name: r.name,
        code: r.code,
        typeId: r.type_id,
        colours: Array.isArray(r.colours) ? r.colours : [],
        pricePerMetreCentavos: r.price_per_metre_centavos == null ? null : Number(r.price_per_metre_centavos),
        tune: r.tune ?? {},
        thumbKey: r.thumb_key,
        tileKey: r.tile_key,
        thumbUrl: mediaUrlOf(r.thumb_key),
        tileUrl: mediaUrlOf(r.tile_key),
        active: r.active,
      })),
      looks: ((l.data ?? []) as L[]).map((r) => ({ id: r.look_id, name: r.name, photoKey: r.photo_key, photoUrl: mediaUrlOf(r.photo_key), config: r.config, active: r.active })),
    },
  };
}

/** Adds or changes one fabric or lace row of THIS shop (service role; an id from another shop matches nothing). */
export async function saveShopGownFabric(admin: SupabaseClient, args: { vendorProfileId: string; fabric: GownShopFabricInput; userId: string }): Promise<string | null> {
  const f = args.fabric;
  const row = {
    kind: f.kind,
    name: f.name,
    code: f.code,
    type_id: f.typeId,
    colours: f.colours,
    price_per_metre_centavos: f.pricePerMetreCentavos,
    tune: f.tune,
    thumb_key: f.thumbKey,
    tile_key: f.tileKey,
    active: f.active,
    updated_by: args.userId,
    updated_at: new Date().toISOString(),
  };
  const q = f.id
    ? admin.from('vendor_gown_fabrics').update(row).eq('fabric_id', f.id).eq('vendor_profile_id', args.vendorProfileId).select('fabric_id').maybeSingle()
    : admin.from('vendor_gown_fabrics').insert({ ...row, vendor_profile_id: args.vendorProfileId }).select('fabric_id').single();
  const { data, error } = await q;
  if (error || !data) {
    if (error) logQueryError('saveShopGownFabric', error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return (data as { fabric_id: string }).fabric_id;
}

/** Adds or changes one look of THIS shop (service role; the config is already checked by `sanitizeGownConfig`). */
export async function saveShopGownLook(admin: SupabaseClient, args: { vendorProfileId: string; look: GownShopLookInput; userId: string }): Promise<string | null> {
  const k = args.look;
  const row = { name: k.name, photo_key: k.photoKey, config: k.config, active: k.active, updated_by: args.userId, updated_at: new Date().toISOString() };
  const q = k.id
    ? admin.from('vendor_gown_looks').update(row).eq('look_id', k.id).eq('vendor_profile_id', args.vendorProfileId).select('look_id').maybeSingle()
    : admin.from('vendor_gown_looks').insert({ ...row, vendor_profile_id: args.vendorProfileId }).select('look_id').single();
  const { data, error } = await q;
  if (error || !data) {
    if (error) logQueryError('saveShopGownLook', error, { vendor_profile_id: args.vendorProfileId }, 'graceful_degrade');
    return null;
  }
  return (data as { look_id: string }).look_id;
}

// ── B5b · the registry, for the admin's editor (every row, hidden ones too) ──────────────────────────────────────

export async function readGownFabricTypeRows(admin: SupabaseClient): Promise<Read<GownFabricTypeRow[]>> {
  const { data, error } = await admin
    .from('gown_fabric_types')
    .select('type_id, name, aliases, family, gsm, stiff, sheen, sheer, stretch, used_for, render_as, active, sort, verified')
    .order('sort')
    .order('type_id');
  if (error) {
    logQueryError('readGownFabricTypeRows', error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  type Row = { type_id: string; name: string; aliases: string[] | null; family: GownFabricTypeRow['family']; gsm: number; stiff: number | string; sheen: number | string; sheer: number | string; stretch: GownFabricTypeRow['stretch']; used_for: GownFabricTypeRow['usedFor'] | null; render_as: string | null; active: boolean; sort: number; verified: boolean };
  return {
    status: 'ok',
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.type_id,
      name: r.name,
      aliases: r.aliases ?? [],
      family: r.family,
      gsm: r.gsm,
      stiff: Number(r.stiff),
      sheen: Number(r.sheen),
      sheer: Number(r.sheer),
      stretch: r.stretch,
      usedFor: r.used_for ?? [],
      renderAs: r.render_as,
      active: r.active,
      sort: r.sort,
      verified: r.verified,
    })),
  };
}

/** Adds or changes one registry row (service role; the caller has proved the admin). */
export async function saveGownFabricType(admin: SupabaseClient, args: { type: GownFabricTypeRow; userId: string }): Promise<boolean> {
  const t = args.type;
  const { error } = await admin.from('gown_fabric_types').upsert(
    {
      type_id: t.id,
      name: t.name,
      aliases: t.aliases,
      family: t.family,
      gsm: t.gsm,
      stiff: t.stiff,
      sheen: t.sheen,
      sheer: t.sheer,
      stretch: t.stretch,
      used_for: t.usedFor,
      render_as: t.renderAs,
      active: t.active,
      sort: t.sort,
      verified: t.verified,
      updated_by: args.userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'type_id' },
  );
  if (error) logQueryError('saveGownFabricType', error, { type_id: t.id }, 'graceful_degrade');
  return !error;
}
