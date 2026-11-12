import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  answeredCount,
  formSizeLine,
  liveItems,
  suggestionsForCategories,
  type FormItemRow,
} from '@/lib/vendor-forms';

/**
 * 📋 THE FORM MAKER — server reads (THE ONE BUILD · C3 Forms; B2 §2.7). One batched read per screen.
 *
 * 🔑 A refused read is SAID, never drawn as emptiness (the house disease: "a failure that renders identically to
 * success or to emptiness"). Each reader returns `{ status: 'unread' }` on any refused part, and the page says
 * "couldn't load" instead of "no forms yet".
 */

const ITEM_COLS =
  'question_id, form_id, item_kind, prompt, hint, answer_type, is_required, options, media_keys, video_url, display_order, is_asked';

export type ShopForm = {
  formId: string;
  title: string;
  items: FormItemRow[];
  serviceIds: string[];
  usedWith: number;
  sizeLine: string;
  updatedAt: string;
  /** 📋 Piece 3a: FALSE = kept with `forEventId` only (an edit made from a client's page). */
  inLibrary: boolean;
  forEventId: string | null;
};

export type ShopCard = { id: string; title: string; category: string; isActive: boolean };

export type ShopFormsRead =
  | {
      status: 'ok';
      /** The library: live forms with `in_library` (an event's own form joins only once "Save to my library"). */
      forms: ShopForm[];
      cards: ShopCard[];
      /** 📋 Piece 3a "This event's forms": live forms made for `eventId` (empty when no event was asked). */
      eventForms: ShopForm[];
    }
  | { status: 'unread' };

/** The shop's library — its live forms, their items, their card links and "used with N" — plus its cards. 5 reads, one batch. */
export async function readShopForms(supabase: SupabaseClient, vendorProfileId: string, forEvent?: string | null): Promise<ShopFormsRead> {
  // The id is spliced into a PostgREST `or=` filter, so only a UUID shape is ever let in.
  const eventId = forEvent && /^[0-9a-f-]{36}$/i.test(forEvent) ? forEvent : null;
  const formsQ = supabase
    .from('vendor_forms')
    .select('form_id, title, updated_at, in_library, for_event_id')
    .eq('vendor_profile_id', vendorProfileId)
    .is('retired_at', null);
  const [formsRes, itemsRes, linksRes, sendsRes, cardsRes] = await Promise.all([
    (eventId ? formsQ.or(`in_library.eq.true,for_event_id.eq.${eventId}`) : formsQ.eq('in_library', true)).order('updated_at', {
      ascending: false,
    }),
    supabase
      .from('vendor_questions')
      .select(ITEM_COLS)
      .eq('vendor_profile_id', vendorProfileId)
      .not('form_id', 'is', null)
      .eq('is_asked', true)
      .order('display_order', { ascending: true }),
    supabase.from('vendor_form_service_links').select('form_id, vendor_service_id'),
    supabase.from('event_form_sends').select('form_id').eq('vendor_profile_id', vendorProfileId),
    supabase
      .from('vendor_services')
      .select('vendor_service_id, title, category, is_active')
      .eq('vendor_profile_id', vendorProfileId)
      .order('created_at', { ascending: true }),
  ]);
  const err = formsRes.error ?? itemsRes.error ?? linksRes.error ?? sendsRes.error ?? cardsRes.error;
  if (err) {
    logQueryError('readShopForms', err, { vendor_profile_id: vendorProfileId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const items = (itemsRes.data ?? []) as FormItemRow[];
  const links = (linksRes.data ?? []) as { form_id: string; vendor_service_id: string }[];
  const used = new Map<string, number>();
  for (const s of (sendsRes.data ?? []) as { form_id: string }[]) used.set(s.form_id, (used.get(s.form_id) ?? 0) + 1);
  type FormRow = { form_id: string; title: string; updated_at: string; in_library: boolean | null; for_event_id: string | null };
  const all = ((formsRes.data ?? []) as FormRow[]).map((f): ShopForm => {
    const its = liveItems(items.filter((i) => i.form_id === f.form_id));
    return {
      formId: f.form_id,
      title: f.title,
      items: its,
      serviceIds: links.filter((l) => l.form_id === f.form_id).map((l) => l.vendor_service_id),
      usedWith: used.get(f.form_id) ?? 0,
      sizeLine: formSizeLine(its),
      updatedAt: f.updated_at,
      inLibrary: f.in_library !== false,
      forEventId: f.for_event_id ?? null,
    };
  });
  const forms = all.filter((f) => f.inLibrary);
  const eventForms = eventId ? all.filter((f) => f.forEventId === eventId) : [];
  const cards = (
    (cardsRes.data ?? []) as { vendor_service_id: string; title: string | null; category: string; is_active: boolean }[]
  ).map((c) => ({ id: c.vendor_service_id, title: c.title?.trim() || c.category, category: c.category, isActive: c.is_active }));
  return { status: 'ok', forms, cards, eventForms };
}

/**
 * The service cards this shop's booking on an event holds: the booked card (`event_vendors.service_id`), the cards
 * the couple asked about (`requested_service_ids`) and the accepted quote's cards (`vendor_proposals.service_card_ids`).
 *
 * `admin` must be the service role (a supplier has no SELECT on `event_vendors`). Scoped by BOTH the event and this
 * shop — it can only ever reveal this shop's own booking (never a confused deputy aimed at another).
 */
export async function readBookedCardIds(
  admin: SupabaseClient,
  eventId: string,
  vendorProfileId: string,
): Promise<{ status: 'ok'; cardIds: string[]; eventVendorIds: string[] } | { status: 'unread' }> {
  const [evRes, propRes] = await Promise.all([
    admin
      .from('event_vendors')
      .select('vendor_id, service_id, requested_service_ids')
      .eq('event_id', eventId)
      .eq('marketplace_vendor_id', vendorProfileId),
    admin
      .from('vendor_proposals')
      .select('service_card_ids')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', vendorProfileId)
      .eq('status', 'accepted'),
  ]);
  if (evRes.error || propRes.error) {
    logQueryError('readBookedCardIds', (evRes.error ?? propRes.error)!, { event_id: eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const ids = new Set<string>();
  const rows = (evRes.data ?? []) as { vendor_id: string; service_id: string | null; requested_service_ids: string[] | null }[];
  for (const r of rows) {
    if (r.service_id) ids.add(r.service_id);
    for (const s of r.requested_service_ids ?? []) ids.add(s);
  }
  for (const p of (propRes.data ?? []) as { service_card_ids: unknown }[]) {
    if (Array.isArray(p.service_card_ids)) for (const s of p.service_card_ids) if (typeof s === 'string') ids.add(s);
  }
  return { status: 'ok', cardIds: [...ids], eventVendorIds: rows.map((r) => r.vendor_id) };
}

export type SentForm = {
  formId: string;
  title: string;
  sentBy: 'supplier' | 'on_booking';
  sentAt: string;
  /** The supplier's lock on this send (20271329937802 `event_form_sends.locked`) — the couple reads it as "Final". */
  locked: boolean;
  items: FormItemRow[];
  answers: Record<string, string>;
  answered: number;
  total: number;
};

export type EventFormsRead =
  | {
      status: 'ok';
      sent: SentForm[];
      /** Live library forms linked to a card this booking holds (whether or not sent yet). */
      linkedToBooked: { formId: string; title: string; cardTitles: string[]; sent: boolean }[];
    }
  | { status: 'unread' };

/**
 * One event, one shop: the forms sent into it (with the couple's answers to their items — RLS lets the supplier read
 * only its own items of a form it sent here), and the library forms linked to the cards this booking holds.
 */
export async function readEventForms(
  supabase: SupabaseClient,
  args: { eventId: string; vendorProfileId: string; library: ShopForm[]; cards: ShopCard[]; bookedCardIds: string[] },
): Promise<EventFormsRead> {
  const { eventId, vendorProfileId } = args;
  const sendsRes = await supabase
    .from('event_form_sends')
    .select('form_id, sent_by, sent_at, locked')
    .eq('event_id', eventId)
    .eq('vendor_profile_id', vendorProfileId)
    .order('sent_at', { ascending: false });
  if (sendsRes.error) {
    logQueryError('readEventForms.sends', sendsRes.error, { event_id: eventId }, 'graceful_degrade');
    return { status: 'unread' };
  }
  const sends = (sendsRes.data ?? []) as { form_id: string; sent_by: 'supplier' | 'on_booking'; sent_at: string; locked: boolean | null }[];
  const sentIds = sends.map((s) => s.form_id);
  let sent: SentForm[] = [];
  if (sentIds.length > 0) {
    // A sent form may since have been retired from the library — its title and items still resolve.
    const [formsRes, itemsRes, answersRes] = await Promise.all([
      supabase.from('vendor_forms').select('form_id, title').in('form_id', sentIds),
      supabase
        .from('vendor_questions')
        .select(ITEM_COLS)
        .eq('vendor_profile_id', vendorProfileId)
        .in('form_id', sentIds)
        .order('display_order', { ascending: true }),
      supabase.from('event_question_answers').select('question_id, answer').eq('event_id', eventId),
    ]);
    const err = formsRes.error ?? itemsRes.error ?? answersRes.error;
    if (err) {
      logQueryError('readEventForms.sent', err, { event_id: eventId }, 'graceful_degrade');
      return { status: 'unread' };
    }
    const titles = new Map(((formsRes.data ?? []) as { form_id: string; title: string }[]).map((f) => [f.form_id, f.title]));
    const items = (itemsRes.data ?? []) as FormItemRow[];
    const answers = new Map(((answersRes.data ?? []) as { question_id: string; answer: string }[]).map((a) => [a.question_id, a.answer]));
    sent = sends.map((s) => {
      const its = liveItems(items.filter((i) => i.form_id === s.form_id));
      const a: Record<string, string> = {};
      for (const i of its) {
        const v = answers.get(i.question_id);
        if (v) a[i.question_id] = v;
      }
      const c = answeredCount(its, new Set(Object.keys(a)));
      return {
        formId: s.form_id,
        title: titles.get(s.form_id) ?? 'Form',
        sentBy: s.sent_by,
        sentAt: s.sent_at,
        locked: s.locked === true,
        items: its,
        answers: a,
        answered: c.answered,
        total: c.total,
      };
    });
  }
  const booked = new Set(args.bookedCardIds);
  const cardTitle = new Map(args.cards.map((c) => [c.id, c.title]));
  const linkedToBooked = args.library
    .filter((f) => f.serviceIds.some((id) => booked.has(id)))
    .map((f) => ({
      formId: f.formId,
      title: f.title,
      cardTitles: f.serviceIds.filter((id) => booked.has(id)).map((id) => cardTitle.get(id) ?? 'Service card'),
      sent: sentIds.includes(f.formId),
    }));
  return { status: 'ok', sent, linkedToBooked };
}

export type FormSuggestion = { templateKey: string; title: string; itemCount: number };
export type SuggestionsRead =
  | { status: 'ok'; serviceLabel: string | null; groupLabel: string | null; own: FormSuggestion[]; alsoUseful: FormSuggestion[] }
  | { status: 'unread' };

/**
 * "Suggested for <service>" then "Also useful for <group>" (DECISION_LOG 2026-10-28 "SUGGESTED FOR YOUR SERVICE").
 * The data lives in Admin › Categories (`category_form_suggestions` × `form_templates`) and SHIPS EMPTY (THE ONE
 * BUILD §9 #13) — the caller shows "No suggested forms for this service yet" rather than invented samples.
 */
export async function readFormSuggestions(supabase: SupabaseClient, serviceKeys: string[]): Promise<SuggestionsRead> {
  // A card's `vendor_services.category` is a canonical service key; suggestions are kept per TILE (the leaf
  // `service_categories` row Admin › Categories edits) — `canonical_service_taxonomy` maps one to the other.
  const keys0 = [...new Set(serviceKeys.filter(Boolean))];
  if (keys0.length === 0) return { status: 'ok', serviceLabel: null, groupLabel: null, own: [], alsoUseful: [] };
  const mapRes = await supabase.from('canonical_service_taxonomy').select('canonical_service, tile_id').in('canonical_service', keys0);
  if (mapRes.error) {
    logQueryError('readFormSuggestions.taxonomy', mapRes.error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  const own = [
    ...new Set(((mapRes.data ?? []) as { tile_id: string | null }[]).map((m) => m.tile_id).filter((t): t is string => !!t)),
  ];
  if (own.length === 0) return { status: 'ok', serviceLabel: null, groupLabel: null, own: [], alsoUseful: [] };
  const catRes = await supabase.from('service_categories').select('id, parent_id, label_en').in('id', own);
  if (catRes.error) {
    logQueryError('readFormSuggestions.categories', catRes.error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  const cats = (catRes.data ?? []) as { id: string; parent_id: string | null; label_en: string }[];
  const parents = [...new Set(cats.map((c) => c.parent_id).filter((p): p is string => !!p))];
  const [sibRes, parentRes] = await Promise.all([
    parents.length
      ? supabase.from('service_categories').select('id').in('parent_id', parents)
      : Promise.resolve({ data: [] as { id: string }[], error: null }),
    parents.length
      ? supabase.from('service_categories').select('id, label_en').in('id', parents)
      : Promise.resolve({ data: [] as { id: string; label_en: string }[], error: null }),
  ]);
  if (sibRes.error || parentRes.error) {
    logQueryError('readFormSuggestions.group', (sibRes.error ?? parentRes.error)!, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  const group = ((sibRes.data ?? []) as { id: string }[]).map((s) => s.id);
  const sugRes = await supabase
    .from('category_form_suggestions')
    .select('category_id, template_key, sort_order')
    .in('category_id', [...new Set([...own, ...group])]);
  if (sugRes.error) {
    logQueryError('readFormSuggestions.suggestions', sugRes.error, {}, 'graceful_degrade');
    return { status: 'unread' };
  }
  const picked = suggestionsForCategories(
    (sugRes.data ?? []) as { category_id: string; template_key: string; sort_order: number }[],
    own,
    group,
  );
  const keys = [...picked.own, ...picked.alsoUseful];
  let templates = new Map<string, FormSuggestion>();
  if (keys.length) {
    const tRes = await supabase.from('form_templates').select('template_key, title, items').in('template_key', keys).eq('is_active', true);
    if (tRes.error) {
      logQueryError('readFormSuggestions.templates', tRes.error, {}, 'graceful_degrade');
      return { status: 'unread' };
    }
    templates = new Map(
      ((tRes.data ?? []) as { template_key: string; title: string; items: unknown }[]).map((t) => [
        t.template_key,
        { templateKey: t.template_key, title: t.title, itemCount: Array.isArray(t.items) ? t.items.length : 0 },
      ]),
    );
  }
  const pick = (ks: string[]) => ks.map((k) => templates.get(k)).filter((t): t is FormSuggestion => !!t);
  return {
    status: 'ok',
    serviceLabel: cats[0]?.label_en ?? null,
    groupLabel: ((parentRes.data ?? []) as { label_en: string }[])[0]?.label_en ?? null,
    own: pick(picked.own),
    alsoUseful: pick(picked.alsoUseful),
  };
}
