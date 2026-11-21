import 'server-only';
/**
 * 🎂 THE CAKE MAKER — the reads and writes (rules in ./cake-maker.ts).
 *
 * Every read here is HONEST: a refused read is `{ status: 'unread' }`, never an empty cake and never a cake with fewer
 * options than the shop set (the 20 Aug disease — a failure that renders identically to emptiness).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  PACKAGE_ITEM_OPTION_SELECT,
  VENDOR_PACKAGE_ITEM_SELECT,
  VENDOR_PACKAGE_SELECT,
  type VendorPackageItemOptionRow,
  type VendorPackageItemRow,
  type VendorPackageWithItems,
} from '@/lib/vendor-packages';
import { loadPackageDraft } from '@/lib/package-draft-loader';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { moodCakeColours } from '@/lib/cake-mood-colours';
import { hexForColorName } from '@/lib/color-names';
import { specialToolsAllowed } from '@/lib/special-tools';
import { readSpecialToolsPaidFrom } from '@/lib/special-tools.server';
import { asVendorTier } from '@/lib/vendor-tier-caps';
import { CAKE_MESSAGE_MAX, fullCakeOffer, sanitizeCakeConfig, type CakeConfig, type CakeConfigRefusal } from '@/lib/cake-config';
import {
  CAKE_MESSAGE_FORM_KEY,
  CAKE_MESSAGE_LETTERS,
  CAKE_MESSAGE_PROMPT,
  cakeConfigTotalCentavos,
  cakeDesignOf,
  cakeOfferOf,
  cakeOptionsFromDraftItems,
  readCakeCard,
  type CakeCard,
  type CakeDesign,
  type CakeOptions,
  type MoodCakeColour,
} from '@/lib/cake-maker';

type Read<T> = { status: 'ok'; data: T } | { status: 'unread' } | { status: 'none' };

/* ──────────────────────────────────────────────────────────────────────── */
/* The card's own ★ Customization package, read as a cake                    */
/* ──────────────────────────────────────────────────────────────────────── */

export type CakePackage = { pkg: VendorPackageWithItems; card: CakeCard; messageMax: number };

/** The card's own package (`vendor_packages.vendor_service_id`), with every line and option. `none` = not a cake. */
export async function readCakePackage(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string },
  /**
   * The client the message question is read with. A shop's forms are owner-only under RLS, so a COUPLE-side caller
   * passes the server's admin client here (scoped by `vendorProfileId` + `vendorServiceId` in every filter) — read with
   * the couple's own client the question would silently vanish and the message box with it.
   */
  formsClient: SupabaseClient = supabase,
): Promise<Read<CakePackage>> {
  const { data: pkgRow, error: pkgErr } = await supabase
    .from('vendor_packages')
    .select(VENDOR_PACKAGE_SELECT)
    .eq('vendor_service_id', args.vendorServiceId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pkgErr) {
    logQueryError('readCakePackage.package', pkgErr, { vendor_service_id: args.vendorServiceId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!pkgRow) return { status: 'none' };
  const packageId = (pkgRow as { package_id: string }).package_id;
  const { data: items, error: itemsErr } = await supabase
    .from('vendor_package_items')
    .select(VENDOR_PACKAGE_ITEM_SELECT)
    .eq('package_id', packageId)
    .order('display_order', { ascending: true });
  if (itemsErr) {
    logQueryError('readCakePackage.items', itemsErr, { package_id: packageId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const ids = ((items ?? []) as VendorPackageItemRow[]).map((i) => i.item_id);
  const { data: options, error: optErr } = ids.length
    ? await supabase.from('vendor_package_item_options').select(PACKAGE_ITEM_OPTION_SELECT).in('item_id', ids).order('display_order', { ascending: true })
    : { data: [] as VendorPackageItemOptionRow[], error: null };
  if (optErr) {
    logQueryError('readCakePackage.options', optErr, { package_id: packageId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const byItem = new Map<string, VendorPackageItemOptionRow[]>();
  for (const o of (options ?? []) as VendorPackageItemOptionRow[]) byItem.set(o.item_id, [...(byItem.get(o.item_id) ?? []), o]);
  const pkg: VendorPackageWithItems = {
    ...(pkgRow as unknown as VendorPackageWithItems),
    items: ((items ?? []) as VendorPackageItemRow[]).map((i) => ({ ...i, options: byItem.get(i.item_id) ?? [] })),
  };
  const card = readCakeCard(pkg);
  if (!card) return { status: 'none' };
  const msg = await readCakeMessageQuestion(formsClient, args);
  if (msg.status === 'unread') return { status: 'unread' };
  return { status: 'ok', data: { pkg, card, messageMax: msg.status === 'ok' ? msg.data.maxLetters : 0 } };
}

/** The card's "Message on the cake" Form Maker question (ruling 5). `none` = the shop has no message on this card. */
export async function readCakeMessageQuestion(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string },
): Promise<Read<{ formId: string; questionId: string; maxLetters: number }>> {
  const { data: links, error: linkErr } = await supabase
    .from('vendor_form_service_links')
    .select('form_id, vendor_forms!inner(form_id, from_template_key, retired_at, vendor_profile_id)')
    .eq('vendor_service_id', args.vendorServiceId)
    .eq('vendor_forms.from_template_key', CAKE_MESSAGE_FORM_KEY)
    .eq('vendor_forms.vendor_profile_id', args.vendorProfileId)
    .is('vendor_forms.retired_at', null)
    .limit(1);
  if (linkErr) {
    logQueryError('readCakeMessageQuestion.link', linkErr, { vendor_service_id: args.vendorServiceId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const formId = (links?.[0] as { form_id?: string } | undefined)?.form_id;
  if (!formId) return { status: 'none' };
  const { data: q, error: qErr } = await supabase
    .from('vendor_questions')
    .select('question_id, max_letters')
    .eq('form_id', formId)
    .eq('is_asked', true)
    .order('display_order', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (qErr) {
    logQueryError('readCakeMessageQuestion.question', qErr, { form_id: formId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!q) return { status: 'none' };
  const row = q as { question_id: string; max_letters: number | null };
  return { status: 'ok', data: { formId, questionId: row.question_id, maxLetters: row.max_letters ?? CAKE_MESSAGE_LETTERS } };
}

/** The couple's own Mood Board colours for the cake (the Cake part, then the five main colours), from their event. */
export async function readMoodCakeColours(supabase: SupabaseClient, eventId: string): Promise<Read<MoodCakeColour[]>> {
  const { data, error } = await supabase.from('events').select('role_palette').eq('event_id', eventId).maybeSingle();
  if (error) {
    logQueryError('readMoodCakeColours', error, { event_id: eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  return { status: 'ok', data: moodCakeColours(sanitizeRolePalette((data as { role_palette: unknown }).role_palette)) };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The design a couple sends — checked, priced, stored                       */
/* ──────────────────────────────────────────────────────────────────────── */

export type BuiltCakeDesign = { config: CakeConfig; design: CakeDesign; estimateCentavos: number };

/**
 * A design the browser sent, re-checked on the server against the card's OWN package (lib/cake-config.ts
 * `sanitizeCakeConfig`, filtered to what this shop offers) and priced by the shipped pricer. Colours must be the
 * couple's own Mood Board colours or the shop's own colours; the inspiration photo must be a live library photo.
 * Refused — never thinned — when any of that fails; the caller says so and creates nothing.
 */
export async function buildCakeDesign(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string; eventId: string; cardName: string; config: unknown; paxCount: number },
): Promise<{ ok: true; built: BuiltCakeDesign } | { ok: false; reason: CakeConfigRefusal | 'unread' }> {
  const [cake, mood, paid, shopRes] = await Promise.all([
    // The package is the shop's public offer — read it the way the shop page does (admin, scoped by shop + card).
    readCakePackage(admin, { vendorProfileId: args.vendorProfileId, vendorServiceId: args.vendorServiceId }, admin),
    readMoodCakeColours(supabase, args.eventId),
    readSpecialToolsPaidFrom(admin),
    admin.from('vendor_profiles').select('tier_state').eq('vendor_profile_id', args.vendorProfileId).maybeSingle(),
  ]);
  if (cake.status !== 'ok' || mood.status === 'unread' || paid.status !== 'ok' || shopRes.error) return { ok: false, reason: 'unread' };
  // 🔒 The same plan rule the supplier's editor and save read: a shop below Pro after the start date takes no designs.
  const tier = asVendorTier((shopRes.data as { tier_state?: string | null } | null)?.tier_state ?? 'free');
  if (!specialToolsAllowed(tier, paid.paidFrom, Date.now())) return { ok: false, reason: 'not_offered' };
  const { pkg, card, messageMax } = cake.data;
  const checked = sanitizeCakeConfig(args.config, cakeOfferOf(card, messageMax));
  if (!checked.ok) return { ok: false, reason: checked.reason };
  const config = checked.config;

  const board = mood.status === 'ok' ? mood.data : [];
  const shopColours = (card.colours?.options ?? []).filter((o) => o.is_available).map((o) => o.option_label);
  for (const c of config.colours) {
    const own = board.some((b) => b.hex.toUpperCase() === c.hex && b.name === c.name);
    const shop = shopColours.some((n) => n === c.name && (hexForColorName(n) ?? '').toUpperCase() === c.hex);
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
  const estimate = cakeConfigTotalCentavos(pkg, card, config, args.paxCount);
  if (estimate === null) return { ok: false, reason: 'not_offered' };
  return {
    ok: true,
    built: {
      config,
      estimateCentavos: estimate,
      design: cakeDesignOf(card, config, { cardName: args.cardName, oneCentavos: pkg.total_price_centavos, estimateCentavos: estimate }),
    },
  };
}

/** Stores a checked design once (service role — no browser writes). Returns its id, or null when the write failed. */
export async function storeCakeDesign(
  admin: SupabaseClient,
  args: { threadId: string; vendorServiceId: string; built: BuiltCakeDesign; userId: string | null },
): Promise<string | null> {
  const { data, error } = await admin
    .from('cake_designs')
    .insert({
      thread_id: args.threadId,
      vendor_service_id: args.vendorServiceId,
      config: args.built.config,
      estimate_centavos: args.built.estimateCentavos,
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

export type StoredCakeDesign = {
  designId: string;
  vendorServiceId: string | null;
  config: CakeConfig;
  estimateCentavos: number;
  createdAt: string;
};

/**
 * One stored design, read with the CALLER's client (RLS: only that thread's couple and shop). The row is re-checked
 * through the sanitizer against the full catalog before it is drawn — a row that does not read is `unread`, never an
 * empty design.
 */
export async function readStoredCakeDesign(
  supabase: SupabaseClient,
  args: { threadId: string; designId: string },
): Promise<Read<StoredCakeDesign>> {
  const { data, error } = await supabase
    .from('cake_designs')
    .select('design_id, vendor_service_id, config, estimate_centavos, created_at')
    .eq('design_id', args.designId)
    .eq('thread_id', args.threadId)
    .maybeSingle();
  if (error) {
    logQueryError('readStoredCakeDesign', error, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!data) return { status: 'none' };
  const row = data as { design_id: string; vendor_service_id: string | null; config: unknown; estimate_centavos: number; created_at: string };
  // The shape is re-checked against the whole catalog (the shop's refs it carried are taken as they were stored —
  // the send already checked them against the card). A row that does not read is `unread`, never an empty cake.
  const c = (row.config ?? {}) as { tiers?: { flavourRef?: unknown }[]; cupcakes?: { packRef?: unknown; flavourRef?: unknown } | null };
  const refs = (c.tiers ?? []).map((t) => t?.flavourRef).filter((r): r is string => typeof r === 'string');
  const cup = c.cupcakes ?? null;
  const checked = sanitizeCakeConfig(row.config, {
    ...fullCakeOffer(),
    flavourRefs: refs,
    messageMax: CAKE_MESSAGE_MAX,
    cupcakes: cup && typeof cup.packRef === 'string' ? { packRefs: [cup.packRef], flavourRefs: typeof cup.flavourRef === 'string' ? [cup.flavourRef] : [], tower: true } : null,
  });
  if (!checked.ok) {
    logQueryError('readStoredCakeDesign.shape', { message: checked.reason }, { design_id: args.designId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return {
    status: 'ok',
    data: { designId: row.design_id, vendorServiceId: row.vendor_service_id, config: checked.config, estimateCentavos: Number(row.estimate_centavos), createdAt: row.created_at },
  };
}

/* ──────────────────────────────────────────────────────────────────────── */
/* The supplier's save — "Your cake options"                                 */
/* ──────────────────────────────────────────────────────────────────────── */

/** The card's saved cake options for the editor (ruling 9). `none` = the card has no cake options yet. */
export async function readCakeOptionsForEdit(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string },
): Promise<Read<{ packageId: string; cake: CakeOptions }>> {
  const { data: pkg, error } = await supabase
    .from('vendor_packages')
    .select('package_id')
    .eq('vendor_service_id', args.vendorServiceId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('readCakeOptionsForEdit', error, { vendor_service_id: args.vendorServiceId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  if (!pkg) return { status: 'none' };
  const packageId = (pkg as { package_id: string }).package_id;
  const [draft, msg] = await Promise.all([loadPackageDraft(supabase, args.vendorProfileId, packageId), readCakeMessageQuestion(supabase, args)]);
  if (!draft.ok) return draft.reason === 'not_found' ? { status: 'none' } : { status: 'unread' };
  if (msg.status === 'unread') return { status: 'unread' };
  const cake = cakeOptionsFromDraftItems(draft.loaded.draft.items, msg.status === 'ok' ? { maxLetters: msg.data.maxLetters } : null);
  if (!cake) return { status: 'none' };
  return { status: 'ok', data: { packageId, cake } };
}

/**
 * The message question (ruling 5): one Form Maker form per cake card, `from_template_key = 'cake_message'`, linked to
 * the card, holding one short-answer question with its letter cap. `message: null` retires it (retire, never delete —
 * an answer already given stays readable). Returns an error sentence, or null when it landed.
 */
export async function saveCakeMessageQuestion(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string; message: CakeOptions['message'] },
): Promise<string | null> {
  const NOT_SAVED = 'The message on the cake could not be saved — open Your cake options and save again.';
  const now = new Date().toISOString();
  const current = await readCakeMessageQuestion(supabase, args);
  if (current.status === 'unread') return NOT_SAVED;
  if (!args.message) {
    if (current.status !== 'ok') return null;
    const { error } = await supabase
      .from('vendor_forms')
      .update({ retired_at: now, updated_at: now })
      .eq('form_id', current.data.formId)
      .eq('vendor_profile_id', args.vendorProfileId);
    return error ? NOT_SAVED : null;
  }
  if (current.status === 'ok') {
    const { error } = await supabase
      .from('vendor_questions')
      .update({ max_letters: args.message.maxLetters, updated_at: now })
      .eq('question_id', current.data.questionId)
      .eq('vendor_profile_id', args.vendorProfileId);
    return error ? NOT_SAVED : null;
  }
  const { data: form, error: formErr } = await supabase
    .from('vendor_forms')
    .insert({ vendor_profile_id: args.vendorProfileId, title: CAKE_MESSAGE_PROMPT, from_template_key: CAKE_MESSAGE_FORM_KEY })
    .select('form_id')
    .single();
  if (formErr || !form) return NOT_SAVED;
  const formId = (form as { form_id: string }).form_id;
  const [{ error: qErr }, { error: linkErr }] = await Promise.all([
    supabase.from('vendor_questions').insert({
      vendor_profile_id: args.vendorProfileId,
      form_id: formId,
      item_kind: 'question',
      answer_type: 'short_answer',
      prompt: CAKE_MESSAGE_PROMPT,
      is_required: false,
      display_order: 0,
      max_letters: args.message.maxLetters,
    }),
    supabase.from('vendor_form_service_links').insert({ form_id: formId, vendor_service_id: args.vendorServiceId }),
  ]);
  return qErr || linkErr ? NOT_SAVED : null;
}

/** The card's own active ★ Customization package id — any kind, so a cake save replaces it instead of minting a second. */
export async function cardPackageId(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string },
): Promise<Read<string>> {
  const { data, error } = await supabase
    .from('vendor_packages')
    .select('package_id')
    .eq('vendor_service_id', args.vendorServiceId)
    .eq('vendor_profile_id', args.vendorProfileId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logQueryError('cardPackageId', error, { vendor_service_id: args.vendorServiceId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  return data ? { status: 'ok', data: (data as { package_id: string }).package_id } : { status: 'none' };
}
