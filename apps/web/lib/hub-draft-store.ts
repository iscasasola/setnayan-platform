import 'server-only';
import { fixedSceneStylesFromPreferences } from '@/lib/fixed-scene-styles';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { landAfterWrite } from '@/lib/maker-land.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { eventCoupleWebsiteProActive } from '@/lib/couple-website-pro';
import { asViewed } from '@/lib/view-as-free.server';
import { isStoreShellRequest } from '@/lib/request-platform';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/orders';
import { hubDraftProEffects, hubProEffectView, type HubProEffectView } from '@/lib/hub-pro-effects';
import {
  HUB_DRAFT_EVENT_COLUMNS,
  HUB_DRAFT_FIELD,
  emptyHubDraft,
  hubDraftBounceHref,
  hubDraftForWrite,
  hubDraftSaveFailure,
  mergeHubDraft,
  sanitizeHubDraft,
  summarizeHubDraft,
  type HubDraft,
  type HubDraftEventColumn,
  type HubDraftEvents,
  type HubDraftPatch,
  type HubDraftBarLive,
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

/**
 * Write a whole draft. UPDATE first, INSERT only when there is no row yet.
 *
 * NOT an upsert: PostgREST's `upsert(…, { onConflict: 'event_id' })` compiles to
 * `ON CONFLICT (event_id) DO UPDATE SET event_id = excluded.event_id, …`, and
 * `authenticated` holds UPDATE only on (draft_json, applied_snapshot) — the
 * column grants in 20271246169682 keep `event_id` and the timestamps
 * server-owned. So the upsert worked for the FIRST save (a plain INSERT) and
 * failed every save after it with 42501 "permission denied for table
 * event_site_drafts" (prod, 2026-09-25, digest 456793547 — the owner pressing
 * Hide). Keep the grant tight; write the columns the grant allows.
 *
 * Asks for the row back each time: zero rows is a refusal, never a success.
 *
 * 📏 THE ONE DOOR EVERY DRAFT WRITE PASSES, so the size rule lives here too:
 * the oldest Undo states are dropped until the draft fits
 * `HUB_DRAFT_BYTE_BUDGET`, and a draft that does not fit even with no history
 * is NOT written — `hubDraftForWrite` throws `HubDraftTooLargeError`, which the
 * callers turn into "Your Event Hub is too large to save". Before this, the
 * row's 200 KB CHECK refused the write and every later save with it (prod,
 * 2026-09-27).
 */
export async function writeHubDraft(
  supabase: SessionClient,
  eventId: string,
  draftIn: HubDraft,
  appliedSnapshot?: Record<string, unknown>,
): Promise<void> {
  const draft = hubDraftForWrite(draftIn);
  const fields = {
    draft_json: draft,
    ...(appliedSnapshot ? { applied_snapshot: appliedSnapshot } : {}),
  };
  const updated = await supabase
    .from('event_site_drafts')
    .update(fields)
    .eq('event_id', eventId)
    .select('event_id');
  if (updated.error) {
    throw new Error(`Could not save the Event Hub draft: ${updated.error.message}`);
  }
  if (Array.isArray(updated.data) && updated.data.length > 0) return;

  const inserted = await supabase
    .from('event_site_drafts')
    .insert({ event_id: eventId, ...fields })
    .select('event_id');
  if (inserted.error) {
    // Two first saves raced and the other one created the row: update it.
    if (inserted.error.code === '23505') {
      const retry = await supabase
        .from('event_site_drafts')
        .update(fields)
        .eq('event_id', eventId)
        .select('event_id');
      if (retry.error) throw new Error(`Could not save the Event Hub draft: ${retry.error.message}`);
      if (Array.isArray(retry.data) && retry.data.length > 0) return;
      throw new Error('Could not save the Event Hub draft: the write was refused.');
    }
    throw new Error(`Could not save the Event Hub draft: ${inserted.error.message}`);
  }
  if (!Array.isArray(inserted.data) || inserted.data.length === 0) {
    throw new Error('Could not save the Event Hub draft: the write was refused.');
  }
}

/** Where a form's draft save goes back to when it did NOT land. */
export type HubDraftBounce = { formData: FormData; fallback: string };

/**
 * Merge one save into the event's draft (creating it when there is none).
 *
 * 🧯 A FAILED SAVE NEVER CRASHES THE PAGE. Given `back` (every form action that
 * redirects afterwards), a failure is logged and the couple is sent back where
 * they were with `?draft_error=`, which the Maker toolbar puts into words —
 * before this, the thrown error reached the Maker's POST as a full 500 page
 * (prod, 2026-09-27, digest 1691351420). Without `back` (a caller that RETURNS
 * a result, `updatePhotoMoments`) it throws, for that caller's own catch.
 */
export async function saveHubDraftPatch(eventId: string, patch: HubDraftPatch, back?: HubDraftBounce): Promise<void> {
  try {
    const supabase = await createClient();
    const current = (await readHubDraft(supabase, eventId)) ?? emptyHubDraft();
    await writeHubDraft(supabase, eventId, mergeHubDraft(current, patch));
  } catch (e) {
    if (!back) throw e;
    console.error('[hub-draft] save failed:', e instanceof Error ? e.message : e);
    redirect(hubDraftBounceHref(back.formData, back.fallback, hubDraftSaveFailure(e)));
  }
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

/**
 * THE WORDS-AND-COLOURS DOOR — one writer's validated `events` values into the
 * draft, then back to where the form came from (its `return_to`, the same
 * field every Maker panel already posts). Never returns.
 *
 * Called by `updateSiteColors`, `updateSpecialMessage`, `updateWhatToBring`,
 * `updateOurStory`, `updateDressCode` and `loveStoryMomentAction` on `draft=1`,
 * AFTER their own validation and BEFORE their live `.update(` (held per
 * function by `hub-draft-wiring.test.ts`). Guests see nothing until Apply.
 */
export async function draftEventsAndReturn(
  eventId: string,
  events: HubDraftEvents,
  formData: FormData,
  fallback: string,
): Promise<void> {
  await saveHubDraftPatch(eventId, { events }, { formData, fallback });
  /* ⚡ NO `revalidatePath` — and never the Maker's whole LAYOUT. A draft write
     changes nothing a guest can see (guests meet the draft only at Apply), and
     the redirect below already carries a fresh render of where it lands in
     this same response; revalidating `/website` as a 'layout' re-rendered and
     invalidated every Maker route under it on every keystroke-save (owner
     2026-09-28: *"picking something takes a lot of time before the website
     reacts"*). Held by `a-maker-pick-never-reloads-what-it-drew.test.ts`.
     From the Maker it RETURNS (`lib/maker-land.server.ts`): only the Maker's
     own page is re-rendered, in place — callers `return` this. */
  return landAfterWrite(formData, fallback);
}

/**
 * The drafted value of one `events` column, for a writer about to MERGE into it
 * (`love_story`: a moment edit must build on the moments already drafted, or a
 * second drafted moment would silently drop the first). `{ drafted: false }`
 * when the draft does not hold the column — the writer then builds on live.
 * A failed read THROWS (`readHubDraft`): building on live after a refused read
 * would overwrite the couple's drafted work.
 */
export async function draftedEventColumn(
  eventId: string,
  column: HubDraftEventColumn,
): Promise<{ drafted: true; value: unknown } | { drafted: false }> {
  const supabase = await createClient();
  const draft = await readHubDraft(supabase, eventId);
  if (!draft || !(column in draft.events)) return { drafted: false };
  return { drafted: true, value: draft.events[column] };
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

/**
 * ↕ The drafted stage places, per section — what a stage move builds on in
 * draft mode, so the couple's preview order is the order a drag swaps in.
 */
export async function draftedStageOrders(
  eventId: string,
): Promise<Record<string, NonNullable<HubDraft['widgets'][keyof HubDraft['widgets']]>['stage_order']>> {
  const supabase = await createClient();
  const draft = await readHubDraft(supabase, eventId);
  const out: Record<string, NonNullable<HubDraft['widgets'][keyof HubDraft['widgets']]>['stage_order']> = {};
  for (const [type, w] of Object.entries(draft?.widgets ?? {})) {
    if (w?.stage_order !== undefined) out[type] = w.stage_order;
  }
  return out;
}

const WIDGET_LIVE_SELECT ='widget_id, widget_type, is_always_on, is_visible, display_order, config_json, mode';

/**
 * What the live page holds for everything a draft can touch — read through the
 * SESSION client (RLS: the host reads their own event). Throws on a failed read:
 * Apply must never classify against a guessed "live".
 */
export async function readHubLiveState(supabase: SessionClient, eventId: string): Promise<HubLiveState> {
  const [
    { data: ev, error: evErr },
    { data: rows, error: rowsErr },
    { data: story, error: storyErr },
    { data: prefs, error: prefsErr },
  ] = await Promise.all([
    supabase.from('events').select(HUB_DRAFT_EVENT_COLUMNS.join(', ')).eq('event_id', eventId).maybeSingle(),
    supabase.from('invitation_widgets').select(WIDGET_LIVE_SELECT).eq('event_id', eventId),
    // 📖 Post Event's live arrangement — the story's own row (RLS: the couple's own).
    supabase.from('event_editorial').select('draft_json').eq('event_id', eventId).maybeSingle(),
    // 🎨 The fixed parts' live style picks — `events_host`, the couple-scoped read
    // of `events` (the dashboard reads `style_preferences` through it already).
    supabase.from('events_host').select('style_preferences').eq('event_id', eventId).maybeSingle(),
  ]);
  if (evErr) throw new Error(`Could not read the live Event Hub: ${evErr.message}`);
  if (rowsErr) throw new Error(`Could not read the live sections: ${rowsErr.message}`);
  // ⚠ Unread is NOT "the default arrangement": Apply would classify against a
  // guessed live story and could write a key it never compared. Refuse instead.
  if (storyErr) throw new Error(`Could not read the live Post Event story: ${storyErr.message}`);
  // Unread is not "no picks" either — Apply would compare against a guess.
  if (prefsErr) throw new Error(`Could not read the live scene styles: ${prefsErr.message}`);
  return {
    events: (ev ?? {}) as HubLiveState['events'],
    widgets: (rows ?? []) as unknown as HubLiveState['widgets'],
    editorial: (story as { draft_json?: unknown } | null)?.draft_json ?? null,
    fixedStyles: fixedSceneStylesFromPreferences((prefs as { style_preferences?: unknown } | null)?.style_preferences),
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
  /**
   * 💎 The Pro effects this draft holds, by name and place — what the Apply
   * sheet lists (owner 2026-09-28). Derived from the SAME plan as `proCount`
   * (`hubDraftProEffects` over `planHubDraftApply`), never a second list.
   * Empty in the store shell, where there is no sheet, no price and no pitch.
   */
  proEffects: HubProEffectView[];
  /**
   * 👁 Does this viewer own Pro, AS SHOWN (the view switch applied) and outside
   * the store shell — the toolbar's pick between the two halves of a save's
   * answer (`hubDraftBarAfterSave`).
   */
  ownsPro: boolean;
};

/**
 * Resolve the bar for one event. A failed draft read renders the bar in an
 * explicit "could not read" state rather than as "no changes" — the Maker must
 * never tell a couple their draft is empty when it simply could not be read.
 *
 * 🔑 `cache()`d (Phase 3, "top-right actions"): the Maker toolbar mounts
 * `HubDraftDock` twice — once for the phone top bar, once for the desktop
 * row — because CSS, not a conditional render, decides which one is visible
 * at a given width (`maker-shell.tsx`, the mobile and desktop groups). React
 * `cache()` collapses the two calls with the same `eventId` into ONE read for
 * the request, the same idiom `lib/dashboard-shell.ts` and `lib/events.ts`
 * already use — without it this function's Supabase reads would double on
 * every Maker page load.
 */
export const loadHubDraftBarData = cache(async function loadHubDraftBarData(
  eventId: string,
): Promise<HubDraftBarData & { readError: boolean }> {
  const storeShell = await isStoreShellRequest();
  const supabase = await createClient();
  let summary: HubDraftSummary = { hasChanges: false, changeCount: 0, proCount: 0, canUndo: false };
  let proEffects: HubProEffectView[] = [];
  let readError = false;
  /* ⚡ Read even with no draft yet: the toolbar needs it to pick which half of a
     save's answer (`hubDraftBarAfterSave`) is this viewer's — owner 2026-09-30,
     SPEED FIRST (a drawn pick brings no render any more). */
  let ownsProViewed = false;
  try {
    const [draft, ownsPro] = await Promise.all([
      readHubDraft(supabase, eventId),
      // Admin client: orders RLS is purchaser-scoped (see lib/hub-look-gate.ts).
      // 👁 As the viewer is shown it: the bar is a render (its Apply is not —
      // `hubDraftAction` asks `lookProAllows`, which never reads the switch).
      asViewed(eventCoupleWebsiteProActive(createAdminClient(), eventId).catch(() => false)),
    ]);
    ownsProViewed = ownsPro;
    if (draft) {
      const live = await readHubLiveState(supabase, eventId);
      // 📵 In the store shell web-bought Pro is not usable yet (owner 2026-09-25),
      // so a Pro key reads as needing the web even for an owning couple.
      summary = summarizeHubDraft(draft, live, ownsPro && !storeShell);
      if (!storeShell) proEffects = hubDraftProEffects(draft, live, ownsPro).map(hubProEffectView);
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
    // `from=maker`: the buy page's way back is the Maker, where the draft waits.
    proHref: storeShell ? null : `/dashboard/${eventId}/studio/website-pro?from=maker`,
    proEffects,
    readError,
    ownsPro: ownsProViewed && !storeShell,
  };
});

/**
 * ⚡ THE BAR AFTER ONE MAKER SAVE — answered by the save itself (owner
 * 2026-09-30, SPEED FIRST: a pick the bridge drew brings no render of the
 * Maker, `lib/maker-refresh.ts`).
 *
 * 👁 It asks NOBODY whether the event owns Pro: a server action must never see
 * the "view as a free couple" switch (`view-as-free-never-changes-a-save.test.ts`),
 * and the real answer could differ from what the owner is being shown. So it
 * returns BOTH answers — the summary for a couple without Pro and for one with
 * it — and the toolbar picks with the render's own `ownsPro` (as viewed, from
 * `loadHubDraftBarData`). The same `summarizeHubDraft` / `hubDraftProEffects`
 * the render uses; never a second count. Null when it cannot be read — the
 * toolbar then keeps what it shows.
 */
export async function hubDraftBarAfterSave(
  supabase: SessionClient,
  eventId: string,
  draft: HubDraft,
): Promise<HubDraftBarLive | null> {
  try {
    const live = await readHubLiveState(supabase, eventId);
    const free = summarizeHubDraft(draft, live, false);
    const owned = summarizeHubDraft(draft, live, true);
    const proEffects = hubDraftProEffects(draft, live, false).map(hubProEffectView);
    let priceLabel: string | null = null;
    if (free.proCount > 0) {
      const sku = await formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null);
      priceLabel = sku?.price_php != null ? formatPhp(sku.price_php) : null;
    }
    return { free, owned, proEffects, priceLabel };
  } catch (e) {
    console.error('[hub-draft] could not read the bar after a save:', e instanceof Error ? e.message : e);
    return null;
  }
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
