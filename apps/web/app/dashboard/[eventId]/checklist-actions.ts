'use server';

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  buildChecklistSeed,
  buildSeedRows,
  isWeddingEvent,
  checklistItemAllowedForProfile,
  type ChecklistTemplateItem,
} from '@/lib/checklist';
import { checklistDefForEventType, GENERIC_EVENT_CHECKLIST_DEF } from '@/lib/checklist-event-type-defs';
import { resolveProfile } from '@/lib/event-type-profile';
import { specialtyRecommendations } from '@/lib/onboarding/specialty-recommendations';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import {
  computeSatisfiedChecklistKeys,
  AUTO_COMPLETABLE_KEYS,
  type ChecklistSignals,
} from '@/lib/checklist-autocomplete';
import { PASSED_AWAY, REPRESENTED_BY, REQUEST_ENTRY_SOURCE } from '@/lib/guests';
import { limitedHelperRefusal, refuseLimitedHelper } from '@/lib/host-gate';

/**
 * Idempotent TOP-UP seed for the couple planning checklist. Fires when the home
 * checklist card (or the full /checklist page) renders. Inserts any template
 * rows the event is MISSING — so a brand-new event gets the whole list, and an
 * event seeded under an older/shorter template gains the new tasks without
 * touching the couple's existing rows or their done-state.
 *
 * Tailoring: church-only steps are skipped for a non-church ceremony_type (the
 * free deterministic "Setnayan AI" personalization). Couple-completed and
 * custom (null-key) rows are always preserved — the diff is keyed on
 * template_key, which custom items don't have.
 *
 * AUTHORIZATION: both the seed INSERT and the auto-complete UPDATE go through the
 * admin client (RLS-bypassing), so we MUST gate them on the viewer being a couple
 * member — the table's `couple_writes_checklist` policy restricts writes to
 * member_type='couple'. Any event MEMBER (guest / vendor / coordinator) can READ
 * the checklist via RLS and render the card/page, but only a couple's render may
 * mutate it. Non-couple viewers short-circuit before any write.
 *
 * Returns the number of rows inserted · 0 when nothing was missing or the viewer
 * isn't a couple (or on any graceful-degrade path, e.g. the migration hasn't
 * reached this environment).
 */
export async function ensureChecklistSeeded(eventId: string): Promise<number> {
  await refuseLimitedHelper(eventId, null);
  if (!eventId) throw new Error('event_id required');

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Authorization gate: only a COUPLE member's render may seed/auto-complete
  // (mirrors couple_writes_checklist). member_reads_membership RLS lets a member
  // read their own row, so this is RLS-safe; a non-couple viewer fails closed and
  // never reaches the admin writes below.
  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if ((membership as { member_type?: string } | null)?.member_type !== 'couple') return 0;

  // Which template keys + statuses does this event already have? (RLS read.)
  const { data: existingRows, error: existingErr } = await supabase
    .from('event_checklist_items')
    .select('template_key, status')
    .eq('event_id', eventId);
  if (existingErr) console.error('[supabase-error] app/dashboard/[eventId]/checklist-actions.ts · from:event_checklist_items.select', existingErr);
  // Graceful skip if the table isn't here yet — the card simply won't render
  // rather than crashing home.
  if (existingErr) return 0;

  // Ceremony type drives the deterministic tailoring. A read error just means
  // no filtering (keep every task) — never block the seed on it. `event_type`
  // gates whether the (wedding-shaped) template applies at all.
  // events_host, not events: signature_details is SELECT-denied to
  // `authenticated` on the base table by 20271025120000. The view is the
  // couple/moderator-scoped read path — same columns, same shape, and this
  // seed only ever runs for a host. Reading the base table here would return
  // a permission error that the `const { data }` shape swallows, silently
  // dropping the ceremony tailoring back to the untailored template.
  const { data: eventRow } = await supabase
    .from('events_host')
    .select('ceremony_type, secondary_ceremony_type, event_type, signature_details')
    .eq('event_id', eventId)
    .maybeSingle();
  const ceremonyType = (eventRow?.ceremony_type as string | null | undefined) ?? null;
  // A mixed wedding's second rite (P6a): the checklist keeps both rites' steps.
  const secondaryCeremonyType = (eventRow?.secondary_ceremony_type as string | null | undefined) ?? null;
  const eventType = (eventRow?.event_type as string | null | undefined) ?? null;
  const signatureDetails =
    (eventRow?.signature_details as Record<string, unknown> | null | undefined) ?? null;

  // Resolve the template for this event type:
  //  - wedding / unset  → the canonical wedding CHECKLIST_TEMPLATE (unchanged,
  //    with ceremony_type tailoring). `checklistDefForEventType` returns null.
  //  - enabled non-wedding type with its own def (birthday, debut, christening, …)
  //    → its per-type performable-task template.
  //  - any OTHER non-wedding type with no dedicated def (anniversary, graduation,
  //    reunion, gala_night, simple_event, future admin types) → the GENERIC
  //    celebration checklist. Previously these `return 0`'d → a BLANK checklist,
  //    which shipped live to couples when all 14 event types were enabled. A real
  //    generic planning surface is always better than an empty one.
  const perTypeDef =
    checklistDefForEventType(eventType) ??
    (isWeddingEvent(eventType) ? null : GENERIC_EVENT_CHECKLIST_DEF);
  // Per-type SUGGESTED tasks derived from the captured signature signals — the
  // first consumer of the Brief's specialty layer (deterministic, Rule 1). A
  // suggestion only exists when a real signal backs it (a captured cotillion,
  // named 18 Candles, a godparent roster…). Non-wedding path only; appended to the
  // static template so they de-dupe by template_key and keep a sequential
  // sort_order. Empty → the seed is byte-identical to before. (Typeless fallback
  // events pass through too — `specialtyRecommendations` returns [] for types
  // with no rule, so the generic seed stays purely generic.)
  const specialtySuggestions: ChecklistTemplateItem[] = perTypeDef
    ? specialtyRecommendations(eventType, signatureDetails).map((r) => ({
        key: r.key,
        title: r.title,
        category: r.category,
        dueOffsetDays: r.dueOffsetDays,
      }))
    : [];
  // Vendor-free / budget-off gate (owner 2026-09-25 — "the simple event is
  // only for our own services"). Only spent on the per-type path: the
  // wedding/unset branch below never touches this def, and every type WITH
  // its own dedicated def in checklistDefForEventType is marketplace-enabled
  // today, so this only ever changes something for GENERIC_EVENT_CHECKLIST_DEF
  // types (Simple Event and any future vendor-free admin type) — gated on the
  // profile flag, never on the type's name.
  const profile = perTypeDef ? await resolveProfile(eventType ?? 'wedding') : null;
  const filteredTemplate =
    perTypeDef && profile
      ? perTypeDef.template.filter((t) => checklistItemAllowedForProfile(t.category, t.key, profile))
      : perTypeDef?.template ?? [];
  const filteredSuggestions =
    profile != null
      ? specialtySuggestions.filter((s) => checklistItemAllowedForProfile(s.category, s.key, profile))
      : specialtySuggestions;
  const seed = perTypeDef
    ? buildSeedRows(eventId, [...filteredTemplate, ...filteredSuggestions], null) // per-type + captured-signal suggestions
    : buildChecklistSeed(eventId, ceremonyType, secondaryCeremonyType); // wedding / unset path

  const rows = (existingRows ?? []) as { template_key: string | null; status: string }[];
  const existingKeys = new Set(
    rows.map((r) => r.template_key).filter((k): k is string => k != null),
  );
  // Tasks still open AND auto-completable — the only reason to run the reconcile.
  const candidateAutoKeys = new Set(
    rows
      .filter((r) => r.status === 'pending' && r.template_key != null)
      .map((r) => r.template_key as string)
      .filter((k) => AUTO_COMPLETABLE_KEYS.has(k)),
  );

  const missing = seed.filter(
    (row) => row.template_key != null && !existingKeys.has(row.template_key),
  );

  const admin = createAdminClient();

  let inserted = 0;
  if (missing.length > 0) {
    const { error: insertErr } = await admin.from('event_checklist_items').insert(missing);
    if (insertErr) console.error('[supabase-error] app/dashboard/[eventId]/checklist-actions.ts · from:event_checklist_items.insert', insertErr);
    // On a lost race (unique index on event_id+template_key) or a missing table,
    // don't crash — fall through to reconcile, which is independent of the insert.
    if (!insertErr) {
      inserted = missing.length;
      // Freshly-seeded auto-completable tasks (e.g. budget set at onboarding) are
      // also reconcile candidates this render.
      for (const r of missing) {
        if (r.template_key && AUTO_COMPLETABLE_KEYS.has(r.template_key)) {
          candidateAutoKeys.add(r.template_key);
        }
      }
    }
  }

  // Auto-complete: flip any open task the event's real state already satisfies
  // (a booked caterer, a set budget, a published seating chart, …). Skipped
  // entirely once nothing auto-completable is left open, so the 6 signal reads
  // don't fire on every steady-state render. Never un-checks, never blocks.
  let flipped = 0;
  if (candidateAutoKeys.size > 0) {
    flipped = await reconcileChecklistCompletion(eventId, admin, candidateAutoKeys);
  }

  // `ensureChecklistSeeded` runs DURING the render of the checklist page and the
  // home checklist card, and revalidatePath is unsupported during render. The
  // caller re-reads the rows in the same render (after this returns), so the seed
  // + auto-complete are already reflected on THIS surface without any revalidate.
  // We still want to bust the OTHER cached home-dashboard surfaces — so defer the
  // revalidate to `after()`, which runs after the response is sent, outside the
  // render pass. (JAVASCRIPT-NEXTJS-B)
  if (inserted > 0 || flipped > 0) {
    after(() => revalidatePath(`/dashboard/${eventId}`));
  }
  return inserted;
}

/**
 * Auto-complete reconcile: read the event's structural facts, compute which
 * checklist tasks they satisfy (lib/checklist-autocomplete), and flip those rows
 * pending → done. Deterministic, idempotent, never un-checks. Every read
 * graceful-degrades to "not satisfied" so a flaky query can never fake or hide
 * completion. Returns the number of rows flipped.
 *
 * Mirrors the home Wedding Roadmap's signal-fetch (wedding-roadmap-async): one
 * events read + lightweight count/lookup reads, all in parallel.
 *
 * `candidateKeys` are the still-open auto-completable tasks worth checking — the
 * UPDATE is narrowed to (satisfied ∩ candidates), so it never issues a no-op
 * write and the caller skips this whole pass once nothing is left to flip.
 */
async function reconcileChecklistCompletion(
  eventId: string,
  admin: SupabaseClient,
  candidateKeys: ReadonlySet<string>,
): Promise<number> {
  if (candidateKeys.size === 0) return 0;
  try {
    const [evRes, vendorsRes, guestRes, tableRes, scheduleRes, paperworkRes] = await Promise.all([
      admin
        .from('events')
        .select(
          'estimated_budget_centavos, estimated_pax, palette_finalized_at, monogram_custom_svg, monogram_uploaded_svg, date_status',
        )
        .eq('event_id', eventId)
        .maybeSingle(),
      admin.from('event_vendors').select('category, status').eq('event_id', eventId),
      admin.from('guests').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId).neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false).is(REPRESENTED_BY, null),
      admin
        .from('event_tables')
        .select('event_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      admin
        .from('event_schedule_blocks')
        .select('event_id', { count: 'exact', head: true })
        .eq('event_id', eventId),
      admin.from('event_paperwork').select('document_type, status').eq('event_id', eventId),
    ]);

    const ev = (evRes.data ?? {}) as {
      estimated_budget_centavos?: number | null;
      estimated_pax?: number | null;
      palette_finalized_at?: string | null;
      monogram_custom_svg?: string | null;
      monogram_uploaded_svg?: string | null;
      date_status?: string | null;
    };
    const vendors = (vendorsRes.data ?? []) as { category: string; status: string | null }[];
    const confirmed = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);
    const confirmedCategories = new Set<string>(
      vendors.filter((v) => v.status != null && confirmed.has(v.status)).map((v) => v.category),
    );
    const paperwork = (paperworkRes.data ?? []) as {
      document_type: string;
      status: string | null;
    }[];
    const isReceived = (pred: (t: string) => boolean) =>
      paperwork.some((p) => p.status === 'received' && pred(p.document_type));

    const guestCount = guestRes.count ?? 0;
    const signals: ChecklistSignals = {
      confirmedCategories,
      budgetSet: Number(ev.estimated_budget_centavos ?? 0) > 0,
      guestEstimateSet: Number(ev.estimated_pax ?? 0) > 0 || guestCount > 0,
      hasGuests: guestCount > 0,
      seatingStarted: (tableRes.count ?? 0) > 0,
      scheduleStarted: (scheduleRes.count ?? 0) > 0,
      paletteFinalized: ev.palette_finalized_at != null,
      monogramSet: !!ev.monogram_custom_svg || !!ev.monogram_uploaded_svg,
      marriageLicenseReceived: isReceived((t) => t === 'marriage_license'),
      psaReceived: isReceived((t) => t.startsWith('psa') || t.startsWith('cenomar')),
      dateStatusLocked: ev.date_status === 'locked',
    };

    // Only flip tasks that are BOTH satisfied by state AND still-open candidates,
    // so the write is never a no-op and is bounded to what can actually change.
    const satisfied = [...computeSatisfiedChecklistKeys(signals)].filter((k) =>
      candidateKeys.has(k),
    );
    if (satisfied.length === 0) return 0;

    // Flip only still-pending matching rows; the DB trigger stamps completed_at.
    const { data: updated, error } = await admin
      .from('event_checklist_items')
      .update({ status: 'done' })
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .in('template_key', satisfied)
      .select('item_id');
    if (error) console.error('[supabase-error] app/dashboard/[eventId]/checklist-actions.ts · from:event_checklist_items.update', error);
    if (error) return 0;
    return updated?.length ?? 0;
  } catch {
    return 0;
  }
}

/** What a Planning Stage row's save answers: saved (with the date it landed on and a note, for a move), or why not. */
export type PlanningRowResult =
  | { ok: true; dateIso?: string | null; note?: string | null }
  | { ok: false; error: string };

/**
 * ✅ ONE ACTION FOR A PLANNING STAGE ROW (owner 2026-11-01, DECISION_LOG "CHECKLIST MERGES INTO PLANNING STAGE").
 * One export, three ops — each export is a Vercel route and the budget is full (`lint-server-action-budget.mjs`; the
 * couple-photo share set the pattern), and this one REPLACES the Checklist's own `toggleChecklistItem`:
 *
 *   · `op=tick-task` — tick / untick a task (`event_checklist_items.status`; the trigger stamps `completed_at`).
 *   · `op=tick-step` — tick / untick a hand-added row (`event_preparation_items.completed_at`) — *"manual rows gain done"*.
 *   · `op=move-task` — move a task (`due_date_set`); an empty `date` puts it back on the plan's own date.
 *
 * Every write asks its row back: RLS answers a refused UPDATE with no error and no row, and a zero is said, never
 * shown as a save that did not happen.
 */
export async function planningRowAction(formData: FormData): Promise<PlanningRowResult> {
  // Hosts' writes (RLS: the couple) — a limited helper is refused whatever their areas (AREA_RULES: null).
  const helperRefusal = await limitedHelperRefusal(formData.get('event_id'), null);
  if (helperRefusal) return { ok: false, error: helperRefusal };
  const op = formData.get('op');
  const eventId = formData.get('event_id');
  const itemId = formData.get('item_id');
  if (typeof eventId !== 'string' || eventId.length === 0 || typeof itemId !== 'string' || itemId.length === 0) {
    return { ok: false, error: 'Something was missing — try again.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  let result: PlanningRowResult;
  if (op === 'tick-task' || op === 'tick-step') {
    const desired = formData.get('desired');
    if (desired !== 'done' && desired !== 'pending') return { ok: false, error: 'Something was missing — try again.' };
    const { data: moved, error } =
      op === 'tick-task'
        ? await supabase.from('event_checklist_items').update({ status: desired }).eq('item_id', itemId).eq('event_id', eventId).select('item_id')
        : await supabase
            .from('event_preparation_items')
            .update({ completed_at: desired === 'done' ? new Date().toISOString() : null })
            .eq('item_id', itemId)
            .eq('event_id', eventId)
            .select('item_id');
    if (error) return { ok: false, error: 'This did not save. Try again.' };
    if (!moved || moved.length === 0) return { ok: false, error: 'Only the hosts can tick this.' };
    result = { ok: true };
  } else if (op === 'move-task') {
    result = await moveTask(supabase, eventId, itemId, formData.get('date'));
  } else {
    return { ok: false, error: 'Something was missing — try again.' };
  }

  // The one list is drawn under Schedule, Suppliers › Booked and Home — the whole event's tree.
  if (result.ok) revalidatePath(`/dashboard/${eventId}`, 'layout');
  return result;
}

/**
 * 📅 MOVE A TASK (*"Each task gets a real date that starts at its offset and can be edited"*). `date` = yyyy-mm-dd
 * sets `due_date_set`; empty puts the task back on the plan's own date (NULL).
 *
 * DATES STOP AT THE EVENT DAY (plan §3, *"date must be until event day only"*): a task for before the day given a
 * later date is set back to the event day, and the answer says so. A task for after the day (a negative offset —
 * thank-you notes, the marriage certificate) is not capped.
 */
async function moveTask(
  supabase: SupabaseClient,
  eventId: string,
  itemId: string,
  rawDate: FormDataEntryValue | null,
): Promise<PlanningRowResult> {
  if (typeof rawDate !== 'string') return { ok: false, error: 'Pick a real date.' };
  const wanted = rawDate.trim();
  if (wanted !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(wanted) || Number.isNaN(new Date(`${wanted}T12:00:00`).getTime()))) {
    return { ok: false, error: 'Pick a real date.' };
  }
  let dateIso: string | null = wanted === '' ? null : wanted;
  let note: string | null = null;
  if (dateIso) {
    const [taskRes, eventRes] = await Promise.all([
      supabase.from('event_checklist_items').select('due_offset_days').eq('item_id', itemId).eq('event_id', eventId).maybeSingle(),
      supabase.from('events').select('event_date').eq('event_id', eventId).maybeSingle(),
    ]);
    if (taskRes.error || eventRes.error) return { ok: false, error: 'We could not check this task’s dates. Try again.' };
    const offset = (taskRes.data as { due_offset_days: number | null } | null)?.due_offset_days ?? null;
    const eventDay = (eventRes.data as { event_date: string | null } | null)?.event_date ?? null;
    if (eventDay && (offset ?? 0) >= 0 && dateIso > eventDay) {
      dateIso = eventDay;
      note = 'Set back to the event day — a task for before the day can’t go past it.';
    }
  }
  const { data: moved, error } = await supabase
    .from('event_checklist_items')
    .update({ due_date_set: dateIso })
    .eq('item_id', itemId)
    .eq('event_id', eventId)
    .select('item_id');
  if (error) return { ok: false, error: 'This date did not save. Try again.' };
  if (!moved || moved.length === 0) return { ok: false, error: 'Only the hosts can move this task.' };
  return { ok: true, dateIso, note };
}
