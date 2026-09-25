import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { isStoreShellRequest } from '@/lib/request-platform';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_FIELD,
  emptyHubDraft,
  mergeHubDraft,
  sanitizeHubDraft,
  summarizeHubDraft,
  type HubDraft,
  type HubDraftPatch,
  type HubDraftSummary,
  type HubLiveState,
} from '@/lib/hub-draft';

/**
 * apps/web/lib/hub-draft-store.ts
 *
 * THE DRAFT ROW — reading and writing `event_site_drafts` (Maker Phase 2). The
 * decisions live in `lib/hub-draft.ts` (pure); this file only moves rows.
 *
 * NOT a `'use server'` module and it exports no actions: the one new action is
 * `website/hub-draft-actions.ts`, and the existing writers call these helpers, so
 * the server-action count moves by exactly one.
 *
 * 🔑 THE COUPLE'S OWN SESSION, NOT THE ADMIN CLIENT, for every draft write. The
 * table's RLS (hosts of the event, never a guest — see the migration) is then the
 * real fence, under the writers' own `requireHostMembership*` gate.
 */

type SessionClient = Awaited<ReturnType<typeof createClient>>;

/** Did this form ask for its save to go to the draft? */
export function isHubDraftWrite(formData: FormData): boolean {
  return formData.get(HUB_DRAFT_FIELD) === '1';
}

/**
 * The event's draft, or null when there is none. A read that FAILED is thrown,
 * never returned as "no draft": a writer that took an error for an empty draft
 * would overwrite the couple's work with a one-key draft.
 */
export async function readHubDraft(supabase: SessionClient, eventId: string): Promise<HubDraft | null> {
  const { data, error } = await supabase
    .from('event_site_drafts')
    .select('draft_json')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the Event Hub draft: ${error.message}`);
  if (!data) return null;
  return sanitizeHubDraft((data as { draft_json: unknown }).draft_json);
}

/** Write a whole draft (upsert). Asks for the row back: zero rows is a refusal. */
export async function writeHubDraft(
  supabase: SessionClient,
  eventId: string,
  draft: HubDraft,
  appliedSnapshot?: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await supabase
    .from('event_site_drafts')
    .upsert(
      {
        event_id: eventId,
        draft_json: draft,
        ...(appliedSnapshot ? { applied_snapshot: appliedSnapshot } : {}),
      },
      { onConflict: 'event_id' },
    )
    .select('event_id');
  if (error) throw new Error(`Could not save the Event Hub draft: ${error.message}`);
  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('Could not save the Event Hub draft: the write was refused.');
  }
}

/** Merge one save into the event's draft (creating it when there is none). */
export async function saveHubDraftPatch(eventId: string, patch: HubDraftPatch): Promise<void> {
  const supabase = await createClient();
  const current = (await readHubDraft(supabase, eventId)) ?? emptyHubDraft();
  await writeHubDraft(supabase, eventId, mergeHubDraft(current, patch));
}

/**
 * The drafted canvas for one section, for a writer about to MERGE into it. A
 * writer in draft mode must build on what the couple already drafted, not on the
 * live canvas — otherwise a second drafted change (crop after background) would
 * silently drop the first. Returns the live config with the drafted canvas laid
 * over it; the live config itself when nothing is drafted for that section.
 */
export async function draftedWidgetConfig(
  eventId: string,
  widgetType: string,
  liveConfig: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const draft = await readHubDraft(supabase, eventId);
  const w = draft?.widgets[widgetType as keyof HubDraft['widgets']];
  if (!w || w.canvas === undefined) return liveConfig;
  const next = { ...liveConfig };
  if (w.canvas === null) delete next.canvas;
  else next.canvas = w.canvas;
  return next;
}

/** The drafted display orders, by widget type (for a draft-mode reorder). */
export async function draftedDisplayOrders(eventId: string): Promise<Record<string, number>> {
  const supabase = await createClient();
  const draft = await readHubDraft(supabase, eventId);
  const out: Record<string, number> = {};
  for (const [type, w] of Object.entries(draft?.widgets ?? {})) {
    if (w?.display_order !== undefined) out[type] = w.display_order;
  }
  return out;
}

const WIDGET_LIVE_SELECT = 'widget_id, widget_type, is_always_on, is_visible, display_order, config_json, mode';

/**
 * What the live page holds for everything a draft can touch — read through the
 * SESSION client (RLS: the host reads their own event). Throws on a failed read:
 * Apply must never classify against a guessed "live".
 */
export async function readHubLiveState(supabase: SessionClient, eventId: string): Promise<HubLiveState> {
  const [{ data: ev, error: evErr }, { data: rows, error: rowsErr }] = await Promise.all([
    supabase.from('events').select(HUB_DRAFT_EVENT_COLUMNS.join(', ')).eq('event_id', eventId).maybeSingle(),
    supabase.from('invitation_widgets').select(WIDGET_LIVE_SELECT).eq('event_id', eventId),
  ]);
  if (evErr) throw new Error(`Could not read the live Event Hub: ${evErr.message}`);
  if (rowsErr) throw new Error(`Could not read the live sections: ${rowsErr.message}`);
  return {
    events: (ev ?? {}) as HubLiveState['events'],
    widgets: (rows ?? []) as unknown as HubLiveState['widgets'],
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE BAR — everything `HubDraftBar` needs, resolved server-side in one call
   ═══════════════════════════════════════════════════════════════════════════ */

export type HubDraftBarData = {
  eventId: string;
  summary: HubDraftSummary;
  /** Inside the iOS / Android store shell: no price, no CTA, "Apply on the web". */
  storeShell: boolean;
  /** `formatPhp` over the live catalogue row, or null (unreadable, or the shell). */
  priceLabel: string | null;
  /** The one Event Hub Pro buy surface (null in the shell). */
  proHref: string | null;
};

/**
 * Resolve the bar for one event. A failed draft read renders the bar in an
 * explicit "could not read" state rather than as "no changes" — the Maker must
 * never tell a couple their draft is empty when it simply could not be read.
 */
export async function loadHubDraftBarData(
  eventId: string,
): Promise<HubDraftBarData & { readError: boolean }> {
  const storeShell = await isStoreShellRequest();
  const supabase = await createClient();
  let summary: HubDraftSummary = { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
  let readError = false;
  try {
    const draft = await readHubDraft(supabase, eventId);
    if (draft) {
      const [live, ownsPro] = await Promise.all([
        readHubLiveState(supabase, eventId),
        // Admin client: orders RLS is purchaser-scoped (see lib/hub-look-gate.ts).
        eventCoupleWebsiteProActive(createAdminClient(), eventId).catch(() => false),
      ]);
      // 📵 In the store shell web-bought Pro is not usable yet (owner 2026-09-25),
      // so a Pro key reads as needing the web even for an owning couple.
      summary = summarizeHubDraft(draft, live, ownsPro && !storeShell);
    }
  } catch (e) {
    console.error('[hub-draft] could not load the draft bar:', e instanceof Error ? e.message : e);
    readError = true;
  }
  let priceLabel: string | null = null;
  if (!storeShell && summary.proCount > 0) {
    const sku = await formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null);
    priceLabel = sku?.price_php != null ? formatPhp(sku.price_php) : null;
  }
  return {
    eventId,
    summary,
    storeShell,
    priceLabel,
    proHref: storeShell ? null : `/dashboard/${eventId}/studio/website-pro`,
    readError,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   THE GUEST LOADER'S HALF — host-only, inside the editor frame
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * The draft for the HOST's preview, read with the admin client the guest page
 * already holds. The caller must have confirmed host membership first (the
 * `?editor=1` gate in `app/[slug]/page.tsx`); this function never decides who
 * may see a draft. A failed read returns null — the host then sees the live page,
 * which is what guests see, and is logged.
 */
export async function readHubDraftForHostPreview(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
): Promise<HubDraft | null> {
  const { data, error } = await admin
    .from('event_site_drafts')
    .select('draft_json')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] lib/hub-draft-store.ts · from:event_site_drafts.select', error);
    return null;
  }
  return data ? sanitizeHubDraft((data as { draft_json: unknown }).draft_json) : null;
}
