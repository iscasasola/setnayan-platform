'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { buildChecklistSeed } from '@/lib/checklist';
import { CONFIRMED_VENDOR_STATUSES } from '@/lib/events';
import {
  computeSatisfiedChecklistKeys,
  AUTO_COMPLETABLE_KEYS,
  type ChecklistSignals,
} from '@/lib/checklist-autocomplete';

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
  // Graceful skip if the table isn't here yet — the card simply won't render
  // rather than crashing home.
  if (existingErr) return 0;

  // Ceremony type drives the deterministic tailoring. A read error just means
  // no filtering (keep every task) — never block the seed on it.
  const { data: eventRow } = await supabase
    .from('events')
    .select('ceremony_type')
    .eq('event_id', eventId)
    .maybeSingle();
  const ceremonyType = (eventRow?.ceremony_type as string | null | undefined) ?? null;

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

  const missing = buildChecklistSeed(eventId, ceremonyType).filter(
    (row) => row.template_key != null && !existingKeys.has(row.template_key),
  );

  const admin = createAdminClient();

  let inserted = 0;
  if (missing.length > 0) {
    const { error: insertErr } = await admin.from('event_checklist_items').insert(missing);
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

  if (inserted > 0 || flipped > 0) revalidatePath(`/dashboard/${eventId}`);
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
export async function reconcileChecklistCompletion(
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
      admin.from('guests').select('event_id', { count: 'exact', head: true }).eq('event_id', eventId),
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
    if (error) return 0;
    return updated?.length ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Flip one checklist item between pending and done. The DB trigger keeps
 * `completed_at` consistent; we only send the status. RLS couple-write policy
 * scopes this to the host's own event.
 */
export async function toggleChecklistItem(formData: FormData) {
  const eventId = formData.get('event_id');
  const itemId = formData.get('item_id');
  const desiredRaw = formData.get('desired'); // 'done' | 'pending'
  if (
    typeof eventId !== 'string' ||
    typeof itemId !== 'string' ||
    (desiredRaw !== 'done' && desiredRaw !== 'pending')
  ) {
    throw new Error('Invalid input');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { error } = await supabase
    .from('event_checklist_items')
    .update({ status: desiredRaw })
    .eq('item_id', itemId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/${eventId}`);
}
