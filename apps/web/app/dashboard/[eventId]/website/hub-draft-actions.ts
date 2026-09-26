'use server';

/**
 * THE EVENT HUB DRAFT — the ONE server action (Maker Phase 2, +1 export).
 *
 * Owner, 2026-09-24: *"have a button to apply save. so they can restore to last
 * state or reset back to default."* 2026-09-25: *"Try then pay"* — a free couple
 * may try a Pro change in the draft and pays at Apply.
 *
 * `hubDraftAction(eventId, formData)` with `intent` =
 *   save    — merge `patch` (JSON, `HubDraftPatch`) into the draft. Guests see
 *             nothing. Also reached by the existing writers themselves: a form
 *             that carries `draft=1` (`HUB_DRAFT_FIELD`) sends its save here via
 *             `lib/hub-draft-store.ts`, after its own validation.
 *   apply   — write the draft to the live page. THE PRO GATE IS HERE: every key
 *             the one look rule calls Pro is refused without Event Hub Pro and
 *             STAYS in the draft, so the couple can pay and Apply again. In the
 *             iOS / Android store shell Pro keys are always held ("Apply on the
 *             web") — web-bought Pro is not usable in the app yet (owner
 *             2026-09-25). Nothing unpaid reaches a live column even when this
 *             action is called by hand.
 *   restore — throw the draft away. The live page is not touched.
 *   reset   — write the page we wrote for one stage (`stage`) INTO THE DRAFT, so
 *             it can be undone until Apply. Its plan names `invitation_widgets`
 *             and one `events` look column only — never guests, replies,
 *             schedule, galleries, orders or the Post Event story
 *             (`hub-draft.test.ts` asserts that on the plan, not on prose).
 *   undo    — step the draft back one save.
 *
 * Address, who can view, what guests get and open browsing are NOT drafted —
 * they stay live (the build plan's rule), in `editor/actions.ts`.
 *
 * 🔑 APPLY IS IDEMPOTENT. A key equal to live is not written, and the draft is
 * only trimmed after every write succeeded — so if a write fails half-way the
 * couple presses Apply again and only what is still different is written.
 *
 * 🔑 EVERY WRITE IS THE COUPLE'S OWN SESSION. `events` and `invitation_widgets`
 * RLS still apply underneath the host gate; only the Pro read uses the admin
 * client (inside `lookProAllows`, because orders RLS is purchaser-scoped).
 */
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { requireHostMembershipOrThrow } from '@/lib/host-gate';
import { lookProAllows } from '@/lib/hub-look-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { siteMediaServeRef, siteMediaServeRefs } from '@/lib/site-media-ref';
import { PUBLIC_R2_BUCKET } from '@/lib/r2-client-ref';
import { WIDGET_CATALOG_BY_TYPE, hasContent, type WidgetType } from '@/lib/invitation-widgets';
import {
  SECTION_CONTENT_EVENT_COLUMNS,
  computeSectionContentMap,
  type SectionContentEvent,
} from '@/lib/website-section-content';
import {
  emptyHubDraft,
  hubDraftItemLabel,
  hubResetPatch,
  isHubDraftIntent,
  isHubResetScope,
  mergeHubDraft,
  planHubDraftApply,
  undoHubDraft,
  type HubDraftActionResult,
  type HubDraftItem,
  type HubDraftPatch,
  type HubDraftRefusal,
  type HubDraftState,
} from '@/lib/hub-draft';
import { readHubDraft, readHubLiveState, writeHubDraft } from '@/lib/hub-draft-store';
import { HUB_MAIN_GROUND_KEY, isHubMainFollow, type HubMainGround, type HubMainOwn, type HubSectionCanvas } from '@/lib/hub-canvas';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { resolveMoments, storableMoments } from '@/lib/love-story-moments';
import { screenNewPhotoRefs } from '@/lib/love-story-screen';

const FORBIDDEN = 'Forbidden — only current hosts can edit this Event Hub.';

export async function hubDraftAction(
  eventId: string,
  formData: FormData,
): Promise<HubDraftActionResult> {
  const intentRaw = formData.get('intent');
  const intent = isHubDraftIntent(intentRaw) ? intentRaw : null;
  if (!intent || typeof eventId !== 'string' || eventId.length === 0) {
    return { ok: false, intent, error: 'That did not look like an Event Hub change.' };
  }

  await requireHostMembershipOrThrow(eventId, FORBIDDEN);
  const supabase = await createClient();
  const done = (applied = 0, held: Array<{ label: string; reason: HubDraftRefusal }> = []) =>
    ({ ok: true, intent, applied, held }) as const;

  try {
    /* ── RESTORE ─────────────────────────────────────────────────────────── */
    if (intent === 'restore') {
      const { error } = await supabase.from('event_site_drafts').delete().eq('event_id', eventId);
      if (error) return { ok: false, intent, error: 'Could not discard the draft. Please try again.' };
      revalidateWebsiteEditor(eventId);
      return done();
    }

    const current = (await readHubDraft(supabase, eventId)) ?? emptyHubDraft();

    /* ── SAVE · RESET · UNDO — the draft only, never the live page ──────── */
    if (intent === 'save') {
      let patch: HubDraftPatch;
      try {
        patch = JSON.parse(String(formData.get('patch') ?? '{}')) as HubDraftPatch;
      } catch {
        return { ok: false, intent, error: 'That change could not be read.' };
      }
      await writeHubDraft(supabase, eventId, mergeHubDraft(current, patch));
      revalidateWebsiteEditor(eventId);
      return done();
    }
    if (intent === 'reset') {
      const scope = formData.get('stage');
      if (!isHubResetScope(scope)) return { ok: false, intent, error: 'Choose which stage to reset.' };
      await writeHubDraft(supabase, eventId, mergeHubDraft(current, hubResetPatch(scope)));
      revalidateWebsiteEditor(eventId);
      return done();
    }
    if (intent === 'undo') {
      await writeHubDraft(supabase, eventId, undoHubDraft(current));
      revalidateWebsiteEditor(eventId);
      return done();
    }

    /* ── APPLY ───────────────────────────────────────────────────────────── */
    const live = await readHubLiveState(supabase, eventId);
    const storeShell = await isStoreShellRequest();
    /* ⛔ THE GATE. `lookProAllows(eventId, 'change')` is true only when the event
       owns ACTIVE Event Hub Pro — the same read, and the same rule, every live
       look writer uses. In the store shell a Pro key is never applied. */
    const ownsPro = storeShell ? false : await lookProAllows(eventId, 'change');
    const plan = planHubDraftApply(current, live, ownsPro);

    const held: Array<{ item: HubDraftItem; reason: HubDraftRefusal }> = plan.refused.map((item) => ({
      item,
      reason: storeShell ? 'apply_on_the_web' : 'needs_pro',
    }));

    /* 🔒 A DRAFTED BACKGROUND (or slot picture) MUST STILL BE THIS COUPLE'S OWN
       PHOTO — the same ownership set `setWidgetBackground` and the scene slot
       writer check, re-checked here because a
       `save` patch is a public POST like any other. */
    const { data: own, error: ownErr } = await supabase
      .from('events')
      // `our_photos` rides in SECTION_CONTENT_EVENT_COLUMNS — not named twice.
      .select(`slug, landing_page_hero_image_url, landing_page_hero_video_r2_key, ${SECTION_CONTENT_EVENT_COLUMNS}`)
      .eq('event_id', eventId)
      .maybeSingle();
    if (ownErr) return { ok: false, intent, error: 'Could not read your Event Hub. Nothing was applied.' };
    const ownRow = (own ?? {}) as Record<string, unknown>;
    const ownRefs = new Set(
      [
        siteMediaServeRef(ownRow.landing_page_hero_image_url),
        ...siteMediaServeRefs(ownRow.our_photos),
        siteMediaServeRef(ownRow.landing_page_hero_video_r2_key),
      ].filter((r): r is string => Boolean(r)),
    );
    const needsContent = plan.apply.some((i) => i.kind === 'widget' && i.field === 'mode' && i.value === 'shown');
    const contentMap = needsContent
      ? await computeSectionContentMap(supabase, eventId, ownRow as unknown as SectionContentEvent)
      : {};

    /* 🖼 THE ONE HERO, drafted — held to THIS event's own photos: an upload into
       its own hero folder, or a photo it already shows. The live writer checks
       only the `r2://` scheme; a draft is a public POST, so it is checked here. */
    const ownHeroPrefix = `r2://${PUBLIC_R2_BUCKET}/events/${eventId}/`;
    const heroIsOwn = (ref: unknown) =>
      typeof ref === 'string' && (ownRefs.has(ref) || ref.startsWith(ownHeroPrefix));
    /* 🎞 THE MAIN BACKGROUND (Maker Phase 10) — the clip or photo and its still
       must be uploads into THIS event's own Main-background folder, or a photo
       the page already shows. Same reason as the hero: a draft is a public POST. */
    const ownMainPrefix = `r2://${PUBLIC_R2_BUCKET}/events/${eventId}/main-background/`;
    const mainIsOwn = (ref: unknown) =>
      typeof ref === 'string' && (ownRefs.has(ref) || ref.startsWith(ownMainPrefix));

    const toWrite: HubDraftItem[] = [];
    for (const item of plan.apply) {
      if (item.kind === 'event' && item.column === 'landing_page_hero_image_url' && item.value !== null) {
        if (!heroIsOwn(item.value)) {
          held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      // Following the hero stores no media of its own (only a frame measured
      // off the hero, which the render uses only while it IS the hero) — so
      // only an override's clip, photo and still are held to this event.
      if (item.kind === 'widget' && item.field === 'main' && item.value !== null && !isHubMainFollow(item.value as HubMainGround)) {
        const main = item.value as HubMainOwn;
        if (![main.media, main.poster].every((r) => r === undefined || mainIsOwn(r))) {
          held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      if (item.kind === 'widget' && item.field === 'canvas') {
        const drafted = item.value as HubSectionCanvas | null;
        // The background AND every picture in a template scene's slots (Phase 5).
        const refs = [drafted?.media, ...(drafted?.slots ?? []).map((s) => s.media)].filter(
          (r): r is string => Boolean(r),
        );
        if (refs.some((r) => !ownRefs.has(r))) {
          held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      // "Shown" must never manufacture a blank section — `setSectionMode`'s rule.
      if (item.kind === 'widget' && item.field === 'mode' && item.value === 'shown' && !hasContent(item.widgetType, contentMap)) {
        held.push({ item, reason: 'empty_section' });
        continue;
      }
      toWrite.push(item);
    }

    // What the live page held for every key about to be written — the record.
    const snapshot: Record<string, unknown> = { at: new Date().toISOString(), events: {}, widgets: {} };

    // 1 · `events` columns, one UPDATE, asking for the row back.
    const eventsPatch: Record<string, unknown> = {};
    for (const item of toWrite) {
      if (item.kind !== 'event') continue;
      eventsPatch[item.column] = item.value;
      (snapshot.events as Record<string, unknown>)[item.column] = live.events[item.column] ?? null;
    }
    // The companions each live writer stamps beside its column, so an applied
    // draft leaves the row exactly as the writer would have.
    if ('landing_page_hero_image_url' in eventsPatch) {
      eventsPatch.landing_page_hero_image_uploaded_at = eventsPatch.landing_page_hero_image_url
        ? new Date().toISOString()
        : null;
    }
    if (typeof eventsPatch.monogram_custom_svg === 'string') {
      // `saveStudioAction`: one source owns the mark.
      eventsPatch.monogram_cipher_config = null;
    }
    if (eventsPatch.std_reveal_effects && typeof eventsPatch.std_reveal_effects === 'object') {
      // The reveal's effects are the Maker's; the film's "Play music" switch in
      // the same JSON is the Save-the-Date studio's — Apply keeps the live one.
      eventsPatch.std_reveal_effects = {
        ...(eventsPatch.std_reveal_effects as Record<string, unknown>),
        music: resolveRevealEffects(live.events.std_reveal_effects).music,
      };
    }
    /* 💌 A DRAFTED LOVE STORY'S NEW PHOTOS ARE SCREENED BEFORE THEY GO LIVE —
       `loveStoryMomentAction`'s own rule, fail-closed, asked again here because
       a draft `save` is a public POST that may carry a ref the moment action
       never saw. `love_story` has no moderation state: a ref in it IS on the
       public page. A blocked photo is taken off its moment (the words stay),
       exactly as the moment action does. */
    if (eventsPatch.love_story && typeof eventsPatch.love_story === 'object') {
      const story = eventsPatch.love_story as Record<string, unknown>;
      const held = new Set(resolveMoments(live.events.love_story ?? null).flatMap((m) => m.media ?? []));
      const drafted = resolveMoments(story);
      const fresh = [...new Set(drafted.flatMap((m) => m.media ?? []))].filter((r) => !held.has(r));
      if (fresh.length > 0) {
        const blocked = await screenNewPhotoRefs(fresh);
        if (blocked.length > 0) {
          eventsPatch.love_story = {
            ...story,
            moments: storableMoments(
              drafted.map((m) => (m.media ? { ...m, media: m.media.filter((r) => !blocked.includes(r)) } : m)),
            ),
          };
        }
      }
    }
    if (Object.keys(eventsPatch).length > 0) {
      const { data: evRows, error: evErr } = await supabase
        .from('events')
        .update(eventsPatch)
        .eq('event_id', eventId)
        .select('event_id');
      if (evErr || !Array.isArray(evRows) || evRows.length === 0) {
        return { ok: false, intent, error: 'Could not apply your changes. Nothing was changed.' };
      }
    }

    // 2 · Sections, in WIDGET_TYPES order; one UPDATE per section. The canvas
    //     is merged into the LIVE config_json, so every sibling key survives.
    const byWidget = new Map<string, HubDraftItem[]>();
    for (const item of toWrite) {
      if (item.kind !== 'widget') continue;
      byWidget.set(item.widgetId, [...(byWidget.get(item.widgetId) ?? []), item]);
    }
    for (const [widgetId, items] of byWidget) {
      const row = live.widgets.find((r) => r.widget_id === widgetId);
      if (!row) continue;
      const patch: Record<string, unknown> = {};
      const before: Record<string, unknown> = {};
      for (const item of items) {
        if (item.kind !== 'widget') continue;
        if (item.field === 'mode') {
          patch.mode = item.value;
          before.mode = row.mode ?? 'auto';
        } else if (item.field === 'is_visible') {
          patch.is_visible = item.value;
          before.is_visible = row.is_visible ?? true;
        } else if (item.field === 'display_order') {
          patch.display_order = item.value;
          before.display_order = row.display_order;
        } else {
          /* The canvas AND the Main background both live in `config_json`; a
             section may carry both (the hero row), so each merges into the
             patch built so far, never into a fresh copy of live — or the second
             would silently drop the first. */
          const from = patch.config_json ?? row.config_json;
          const base =
            from && typeof from === 'object' && !Array.isArray(from)
              ? { ...(from as Record<string, unknown>) }
              : {};
          const key = item.field === 'main' ? HUB_MAIN_GROUND_KEY : 'canvas';
          before[key] = base[key] ?? null;
          if (item.value === null) delete base[key];
          else base[key] = item.value;
          patch.config_json = base;
        }
      }
      (snapshot.widgets as Record<string, unknown>)[row.widget_type] = before;
      const { data: wRows, error: wErr } = await supabase
        .from('invitation_widgets')
        .update(patch)
        .eq('widget_id', widgetId)
        .eq('event_id', eventId)
        .select('widget_id');
      if (wErr || !Array.isArray(wRows) || wRows.length === 0) {
        // Earlier writes landed; the draft is untouched, so Apply again finishes it.
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
    }

    // 3 · The draft keeps only what was held back (and a record of this apply).
    const remaining: HubDraftState = { events: {}, widgets: {} };
    for (const { item } of held) {
      if (item.kind === 'event') remaining.events[item.column] = item.value;
      else if (item.field === 'canvas') {
        (remaining.widgets[item.widgetType] ??= {}).canvas = item.value as HubSectionCanvas | null;
      } else if (item.field === 'main') {
        (remaining.widgets[item.widgetType] ??= {}).main = item.value as HubMainGround | null;
      } else if (item.field === 'mode') {
        (remaining.widgets[item.widgetType] ??= {}).mode = item.value as 'auto' | 'shown' | 'hidden';
      }
    }
    await writeHubDraft(supabase, eventId, { v: 1, ...remaining, history: [] }, snapshot);

    revalidateWebsiteEditor(eventId);
    revalidateGuestSite(typeof ownRow.slug === 'string' ? ownRow.slug : null);
    revalidatePath(`/dashboard/${eventId}/launch`);

    const label = (t: WidgetType) => WIDGET_CATALOG_BY_TYPE[t]?.label ?? 'A section';
    return done(
      toWrite.length,
      [
        ...held.map(({ item, reason }) => ({ label: hubDraftItemLabel(item, label), reason })),
        ...plan.orphans.map((t) => ({ label: label(t), reason: 'missing_section' as const })),
      ],
    );
  } catch (e) {
    console.error('[hub-draft] action failed:', intent, e instanceof Error ? e.message : e);
    // Not "nothing changed": an apply can fail after some writes landed. The
    // draft is only trimmed on success, so trying again is always safe.
    return { ok: false, intent, error: 'Something went wrong. Please try again — your draft is kept.' };
  }
}
