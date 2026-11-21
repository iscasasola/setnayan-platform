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
import { readPortfolioPicks } from '@/lib/supplier-files.server';
import { signStoredRef } from '@/lib/supplier-file-sign.server';
import { sanitizeRolePalette } from '@/lib/mood-board';
import { moodCakeColours } from '@/lib/cake-mood-colours';
import {
  CAKE_MESSAGE_FORM_KEY,
  CAKE_MESSAGE_LETTERS,
  CAKE_MESSAGE_PROMPT,
  cakeDesignOf,
  cakeOptionsFromDraftItems,
  cakePhotoRefs,
  formatCakeDesignBlock,
  readCakeCard,
  type CakeCard,
  type CakeDesignState,
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

/** The Design photos as URLs the couple's sheet can draw (each ref signed the way the shop's files are). */
export async function cakeDesignPhotoUrls(card: CakeCard, vendorProfileId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    (card.design?.options ?? []).map(async (o) => {
      if (!o.photo_ref) return;
      const url = await signStoredRef(o.photo_ref, vendorProfileId);
      if (url) out[o.option_id] = url;
    }),
  );
  return out;
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
/* The design, as the inquiry's block                                       */
/* ──────────────────────────────────────────────────────────────────────── */

/** What the browser may send: ids and the couple's own words — never a label, never a price. */
export function sanitizeCakeDesignInput(raw: unknown): CakeDesignState | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const id = (v: unknown) => (typeof v === 'string' && v.length > 0 && v.length <= 64 ? v : null);
  const sizeOptionId = id(r.sizeOptionId);
  if (!sizeOptionId) return null;
  const flavours: Record<string, string> = {};
  if (r.flavours && typeof r.flavours === 'object') {
    for (const [k, v] of Object.entries(r.flavours as Record<string, unknown>).slice(0, 12)) {
      const kk = id(k);
      const vv = id(v);
      if (kk && vv) flavours[kk] = vv;
    }
  }
  const colours: CakeDesignState['colours'] = [];
  if (Array.isArray(r.colours)) {
    for (const c of r.colours.slice(0, 6)) {
      const cc = c as Record<string, unknown>;
      if (cc?.kind === 'shop' && id(cc.optionId)) colours.push({ kind: 'shop', optionId: id(cc.optionId)! });
      else if (cc?.kind === 'mood' && typeof cc.hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(cc.hex)) colours.push({ kind: 'mood', hex: cc.hex.toLowerCase(), name: '' });
    }
  }
  return {
    sizeOptionId,
    flavours,
    finishOptionId: id(r.finishOptionId),
    colours,
    designOptionId: id(r.designOptionId),
    topperOptionId: id(r.topperOptionId),
    message: typeof r.message === 'string' ? r.message.slice(0, 400) : '',
  };
}

/**
 * The design block for the inquiry, re-read from the card's own package and the couple's own board: labels from the
 * rows, colour names from the board, the estimate from the shipped pricer. Null when it cannot be built honestly (the
 * card is not a cake, a read failed, a pick is gone, or a colour is not one of theirs) — the caller then says so.
 */
export async function buildCakeDesignBlock(
  supabase: SupabaseClient,
  admin: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string; eventId: string; cardName: string; design: CakeDesignState; paxCount: number },
): Promise<string | null> {
  const [cake, mood] = await Promise.all([
    readCakePackage(supabase, { vendorProfileId: args.vendorProfileId, vendorServiceId: args.vendorServiceId }, admin),
    readMoodCakeColours(supabase, args.eventId),
  ]);
  if (cake.status !== 'ok') return null;
  const board = mood.status === 'ok' ? mood.data : [];
  const colours: CakeDesignState['colours'] = [];
  for (const c of args.design.colours) {
    if (c.kind === 'shop') colours.push(c);
    else {
      const own = board.find((b) => b.hex.toLowerCase() === c.hex.toLowerCase());
      // A colour that is not on their board is refused, never sent under a made-up name.
      if (!own) return null;
      colours.push({ kind: 'mood', hex: own.hex, name: own.name });
    }
  }
  const design = cakeDesignOf(cake.data.pkg, cake.data.card, { ...args.design, colours }, {
    cardName: args.cardName,
    messageMax: cake.data.messageMax,
    paxCount: args.paxCount,
  });
  return design ? formatCakeDesignBlock(design) : null;
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
  // The editor draws each Design photo; the ref stays the only thing saved.
  if (cake.design) {
    cake.design = await Promise.all(
      cake.design.map(async (d) => ({ ...d, photoUrl: d.photoRef ? await signStoredRef(d.photoRef, args.vendorProfileId) : null })),
    );
  }
  return { status: 'ok', data: { packageId, cake } };
}

/** The Design photos the supplier may pick from: their own portfolio and this card's own photos. */
export async function readCakePortfolio(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string | null },
): Promise<Read<{ ref: string; url: string }[]>> {
  const r = await readPortfolioPicks(supabase, { vendorProfileId: args.vendorProfileId, quotedIds: args.vendorServiceId ? [args.vendorServiceId] : [] });
  if (r.status !== 'ok') return { status: 'unread' };
  return { status: 'ok', data: r.picks.map((p) => ({ ref: p.ref, url: p.url })) };
}

/** Ruling 4: a Design photo must be one of the shop's own. Returns the first ref that is not, or null. */
export async function foreignCakePhoto(
  supabase: SupabaseClient,
  args: { vendorProfileId: string; vendorServiceId: string | null; cake: CakeOptions },
): Promise<string | 'unread' | null> {
  const refs = cakePhotoRefs(args.cake);
  if (refs.length === 0) return null;
  const own = await readCakePortfolio(supabase, args);
  if (own.status !== 'ok') return 'unread';
  const mine = new Set(own.data.map((p) => p.ref));
  return refs.find((r) => !mine.has(r)) ?? null;
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
