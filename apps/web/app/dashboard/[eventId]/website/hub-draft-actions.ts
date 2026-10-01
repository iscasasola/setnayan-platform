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
 *           📖 Post Event's drafted story keys (show/hide, order, each scene's
 *           look — `lib/post-event-draft.ts`) are written into the story's
 *           own row, `event_editorial.draft_json`, and nothing else of it.
 *   reset   — write the page we wrote for one stage (`stage`) INTO THE DRAFT, so
 *             it can be undone until Apply. Its plan names `invitation_widgets`
 *             and one `events` look column only — never guests, replies,
 *             schedule, galleries, orders or the Post Event story
 *             (`hub-draft.test.ts` asserts that on the plan, not on prose).
 *   undo    — step the draft back one save.
 *   drop    — take ONE named Pro effect (`effect` = its id) off the draft —
 *             the Apply sheet's ×. Recomputed here from the stored draft.
 *
 * Address, who can view, what guests get and open browsing are NOT drafted —
 * they stay live (the build plan's rule), in `editor/actions.ts`. The NAMES
 * and the DATE typed in the Maker ARE (owner 2026-10-01, "wait for apply";
 * `HUB_DRAFT_FACT_COLUMNS`), and Apply asks the date's own gates.
 *
 * ⛔ A SAVE NEVER TOUCHES `events`: `intent === 'save'` writes the draft row
 * and nothing else (`tap-to-type-is-instant.test.ts` holds that on source,
 * `a-typed-name-and-date-wait-for-apply.db.test.ts` on the schema).
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
import { createAdminClient } from '@/lib/supabase/admin';
import { INVITE_THEMES, normalizeThemeId } from '@/lib/invite-themes';
import { resolveProfile } from '@/lib/event-type-profile';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { requireHostMembershipOrThrow } from '@/lib/host-gate';
import { lookProAllows } from '@/lib/hub-look-gate';
import { isStoreShellRequest } from '@/lib/request-platform';
import { revalidateGuestSite, revalidateWebsiteEditor } from '@/lib/revalidate-site';
import { siteMediaServeRef, siteMediaServeRefs } from '@/lib/site-media-ref';
import { PUBLIC_R2_BUCKET, eventMediaPolicy, parseClientRef } from '@/lib/r2-client-ref';
import { WIDGET_CATALOG_BY_TYPE, hasContent, type WidgetType } from '@/lib/invitation-widgets';
import {
  SECTION_CONTENT_EVENT_COLUMNS,
  computeSectionContentMap,
  type SectionContentEvent,
} from '@/lib/website-section-content';
import {
  HUB_DRAFT_SAVE_FAILED_MESSAGE,
  HUB_DRAFT_TOO_LARGE_MESSAGE,
  HubDraftTooLargeError,
  emptyHubDraft,
  hubDraftFactOf,
  hubDraftItemLabel,
  hubResetPatch,
  isHubDraftIntent,
  isHubResetScope,
  mergeHubDraft,
  planHubDraftApply,
  presetSceneOf,
  undoHubDraft,
  type HubDraftActionResult,
  type HubDraftItem,
  type HubDraftPatch,
  type HubDraftRefusal,
  type HubDraftState,
} from '@/lib/hub-draft';
import { hubDraftBarAfterSave, readHubDraft, readHubLiveState, writeHubDraft } from '@/lib/hub-draft-store';
import { HUB_DRAFT_BAR_FIELD } from '@/lib/maker-refresh';
import { hubDraftProEffects } from '@/lib/hub-pro-effects';
import { HUB_MAIN_GROUND_KEY, isHubMainOwn, sanitizeHubCanvas, type HubMainGround, type HubMainOwn, type HubSectionCanvas } from '@/lib/hub-canvas';
import { STAGE_ORDER_KEY, STD_LEAD_KEY } from '@/lib/stage-scenes';
import { SCENE_BACKGROUND_FOLDER, stdBackgroundUploadRef } from '@/lib/scene-media-choices';
import { isStdLibrarySrc } from '@/lib/std-backgrounds';
import { resolveRevealEffects } from '@/lib/std-reveal-effects';
import { resolveMoments, storableMoments } from '@/lib/love-story-moments';
import { screenNewPhotoRefs } from '@/lib/love-story-screen';
import type { CustomSectionContent } from '@/lib/custom-sections';
import { applyPostEventItems, postEventArrangementOf } from '@/lib/post-event-draft';
import { storyProExtrasOf } from '@/lib/story-pro-extras';
import { SCENE_STYLES_PREF_KEY, sceneStylesValueAfter, type FixedSceneStylesDraft } from '@/lib/fixed-scene-styles';
import { writeStylePreferenceKey } from '@/lib/style-preferences.server';
import { postEventPreset } from '@/lib/post-event-presets';
import { CONFIRMED_VENDOR_STATUSES, eventDateChangeIsGoverned, eventDatePrecisionOf, eventDateRefusal } from '@/lib/events';

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
      // No revalidatePath — see "ONE RENDER PER SAVE" below.
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
      /* ⚡ The bar is read BESIDE the write (from the same merge, which is pure),
         so asking for it adds no round trip after the save. */
      const wantsBar = formData.get(HUB_DRAFT_BAR_FIELD) === '1';
      const [, bar] = await Promise.all([
        writeHubDraft(supabase, eventId, mergeHubDraft(current, patch)),
        wantsBar ? hubDraftBarAfterSave(supabase, eventId, mergeHubDraft(current, patch)) : Promise.resolve(null),
      ]);
      /* ⚡ ONE RENDER PER SAVE, AND NOT THE WHOLE MAKER (owner 2026-09-28:
         *"picking something takes a lot of time before the website reacts"*).
         A draft write changes nothing a guest can see — guests meet the draft
         only after Apply — so there is no guest path to revalidate. And a
         `revalidatePath` here made this action's response carry a FULL render
         of the Maker route, which the caller then threw away and asked for
         again with its own `router.refresh()`: two whole-Maker renders per
         pick. The caller refreshes once, after its last save in flight
         (`lib/maker-refresh.ts`), and the canvas keeps its page for what the
         bridge already drew (`element-preview.ts`). The client router cache is
         cleared by that refresh, so nothing stale is served on a revisit.
         Held by `a-maker-pick-never-reloads-what-it-drew.test.ts`. */
      /* ⚡ A MAKER PICK ASKS FOR THE BAR (owner 2026-09-30, SPEED FIRST): a pick
         the bridge drew is followed by NO render of the Maker
         (`lib/maker-refresh.ts`), so the Apply · Undo · Restore count comes back
         in this same answer — the SAME summary the render counts with, for both
         answers to "owns Pro" (this action never asks — the view switch must
         not reach a save; the toolbar picks). */
      if (!bar) return done();
      return { ...done(), bar };
    }
    if (intent === 'reset') {
      const scope = formData.get('stage');
      if (!isHubResetScope(scope)) return { ok: false, intent, error: 'Choose which stage to reset.' };
      await writeHubDraft(supabase, eventId, mergeHubDraft(current, hubResetPatch(scope)));
      // Draft only — the draft bar refreshes once (see ONE RENDER PER SAVE).
      return done();
    }
    if (intent === 'undo') {
      await writeHubDraft(supabase, eventId, undoHubDraft(current));
      // Draft only — the draft bar refreshes once (see ONE RENDER PER SAVE).
      return done();
    }
    /* 💎 DROP ONE PRO EFFECT (the Apply sheet's ×, owner 2026-09-28). The list
       is recomputed HERE from the stored draft — the same one decision the
       sheet was drawn from (`hubDraftProEffects` over `planHubDraftApply`) —
       and only its id crosses from the client, so a sheet drawn before a later
       edit can never write its old canvas over the newer one. Draft only;
       Undo takes it back. */
    if (intent === 'drop') {
      const id = formData.get('effect');
      const live = await readHubLiveState(supabase, eventId);
      const effect = hubDraftProEffects(current, live, false).find((e) => e.id === id);
      if (!effect?.remove) return { ok: false, intent, error: 'That effect is no longer in your draft.' };
      await writeHubDraft(supabase, eventId, mergeHubDraft(current, effect.remove));
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
      .select(`slug, event_type, landing_page_hero_image_url, landing_page_hero_video_r2_key, std_background, ${SECTION_CONTENT_EVENT_COLUMNS}`)
      .eq('event_id', eventId)
      .maybeSingle();
    if (ownErr) return { ok: false, intent, error: 'Could not read your Event Hub. Nothing was applied.' };
    const ownRow = (own ?? {}) as Record<string, unknown>;
    const ownRefs = new Set(
      [
        siteMediaServeRef(ownRow.landing_page_hero_image_url),
        ...siteMediaServeRefs(ownRow.our_photos),
        siteMediaServeRef(ownRow.landing_page_hero_video_r2_key),
        // 🖼 The Save the Date's own uploaded background — one of the couple's
        // pictures the scene's Upload media offers (never a library scene).
        siteMediaServeRef(stdBackgroundUploadRef(ownRow.std_background)),
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
    /* …or one of the couple's pictures the Main background's Upload media
       offers — their own (`ownRefs`, which carries the Save the Date upload),
       a scene's own upload, or a ready-made Save the Date scene (owner
       2026-09-29, "THE MAIN BACKGROUND OFFERS EVERY CHOICE"). */
    const mainIsOwn = (ref: unknown) =>
      typeof ref === 'string' &&
      (ownRefs.has(ref) ||
        ref.startsWith(ownMainPrefix) ||
        ref.startsWith(`r2://${PUBLIC_R2_BUCKET}/events/${eventId}/${SCENE_BACKGROUND_FOLDER}/`) ||
        isStdLibrarySrc(ref));

    /* 🖼 A SCENE'S OWN UPLOAD ("Upload media", in place) — into THIS event's
       own scene-background folder, like the Main background's. */
    const ownScenePrefix = `r2://${PUBLIC_R2_BUCKET}/events/${eventId}/${SCENE_BACKGROUND_FOLDER}/`;
    /* 🖼 …or one of the ready-made Save the Date scenes (Setnayan's own public
       pictures, a closed list — owner 2026-09-29, answer 3). */
    const sceneIsOwn = (ref: string) => ownRefs.has(ref) || ref.startsWith(ownScenePrefix) || isStdLibrarySrc(ref);

    /* 🎨 A DRAFTED PRO THEME ASKS THE WEDDING FENCE (owner Q7 = A) — the
       reveal's own answer, `resolveWeddingOnlyParts(p).save_the_date_film`,
       asked only when a Pro theme is about to be written. The picker never
       offers one where the fence is shut; a draft is a public POST, so it is
       asked again here. An unreadable profile is not a wedding. */
    const draftedTheme = plan.apply.find(
      (i): i is Extract<HubDraftItem, { kind: 'event' }> => i.kind === 'event' && i.column === 'invite_theme',
    );
    const draftedThemeId = draftedTheme ? normalizeThemeId(draftedTheme.value) : null;
    const themeFenceOpen =
      draftedThemeId !== null && INVITE_THEMES[draftedThemeId].tier === 'pro'
        ? await resolveProfile(String(ownRow.event_type ?? ''))
            .then((p) => resolveWeddingOnlyParts(p).save_the_date_film)
            .catch(() => false)
        : true;

    /* 💎 THE LAST THREE PRO TOOLS (owner 2026-09-29, "yes to all 3"). A drafted
       song, hero video or gallery photo is a public POST like any other, so
       each NEW ref must be an upload into THIS event's own folder — the rule
       `updateSiteChrome` asks live (`eventMediaPolicy`). A ref the page already
       shows is kept as it is. */
    const newMediaIsOwn = (column: 'site_bg_music_r2_key' | 'landing_page_hero_video_r2_key' | 'our_photos', value: unknown) => {
      const liveRefs = new Set(
        column === 'our_photos' ? siteMediaServeRefs(live.events.our_photos) : [siteMediaServeRef(live.events[column])].filter(Boolean),
      );
      const refs = column === 'our_photos' ? siteMediaServeRefs(value) : [siteMediaServeRef(value)].filter((r): r is string => Boolean(r));
      return refs.every((r) => liveRefs.has(r) || parseClientRef(r, eventMediaPolicy(eventId)) !== null);
    };

    /* 🗓 A DRAFTED DATE ASKS `updateEventDate`'S OWN GATES (owner 2026-10-01,
       "wait for apply": a date typed in the Maker is drafted, so the rules its
       live writer asks are asked HERE, against live, at the moment it would go
       live) — never a day gone by; a booked supplier's date never moves. ONE
       rule (`eventDateRefusal`, lib/events.ts). A refused date STAYS in the
       draft and is said by name. The supplier count is read fail-CLOSED: an
       unread count is not "no suppliers". */
    const isDateItem = (i: HubDraftItem) => i.kind === 'event' && (i.column === 'event_date' || i.column === 'event_date_precision');
    let dateHeld: HubDraftRefusal | null = null;
    if (plan.apply.some(isDateItem)) {
      const priorDate = { date: (live.events.event_date as string | null | undefined) ?? null, precision: live.events.event_date_precision };
      const nextDate = {
        date: 'event_date' in current.events ? ((current.events.event_date as string | null) ?? null) : priorDate.date,
        precision:
          eventDatePrecisionOf('event_date_precision' in current.events ? current.events.event_date_precision : priorDate.precision) ?? 'day',
      };
      let confirmed = 0;
      if (eventDateChangeIsGoverned(priorDate, nextDate)) {
        const { count, error: countErr } = await supabase
          .from('event_vendors')
          .select('vendor_id', { count: 'exact', head: true })
          .eq('event_id', eventId)
          .in('status', CONFIRMED_VENDOR_STATUSES as unknown as string[]);
        if (countErr) return { ok: false, intent, error: 'Could not check your booked suppliers. Nothing was applied.' };
        confirmed = count ?? 0;
      }
      const refusal = eventDateRefusal(priorDate, nextDate, confirmed);
      dateHeld = refusal === 'in_past' ? 'date_in_past' : refusal ? 'date_locked' : null;
    }

    const toWrite: HubDraftItem[] = [];
    for (const item of plan.apply) {
      if (dateHeld && isDateItem(item)) {
        held.push({ item, reason: dateHeld });
        continue;
      }
      if (
        item.kind === 'event' &&
        (item.column === 'site_bg_music_r2_key' || item.column === 'landing_page_hero_video_r2_key' || item.column === 'our_photos') &&
        !newMediaIsOwn(item.column, item.value)
      ) {
        held.push({ item, reason: 'not_your_photo' });
        continue;
      }
      if (item.kind === 'event' && item.column === 'invite_theme' && !themeFenceOpen) {
        held.push({ item, reason: 'not_for_this_celebration' });
        continue;
      }
      if (item.kind === 'event' && item.column === 'landing_page_hero_image_url' && item.value !== null) {
        if (!heroIsOwn(item.value)) {
          held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      // Following the hero stores no media of its own (only a frame measured
      // off the hero, which the render uses only while it IS the hero) — so
      // only an override's clip, photo and still are held to this event.
      if (item.kind === 'widget' && item.field === 'main' && isHubMainOwn(item.value as HubMainGround | null)) {
        const main = item.value as HubMainOwn;
        if (![main.media, main.poster].every((r) => r === undefined || mainIsOwn(r))) {
          held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      if (item.kind === 'widget' && item.field === 'canvas') {
        const drafted = item.value as HubSectionCanvas | null;
        // The background (and a clip's still) — the couple's pictures or their
        // own scene upload — and every picture in a template scene's slots.
        const ground = [drafted?.media, drafted?.poster].filter((r): r is string => Boolean(r));
        const slotRefs = (drafted?.slots ?? []).map((s) => s.media).filter((r): r is string => Boolean(r));
        if (ground.some((r) => !sceneIsOwn(r)) || slotRefs.some((r) => !ownRefs.has(r))) {
          // A held scene's free part (`canvasFreePart`) is already reported,
          // and kept whole in the draft, by its refused twin — skip it quietly.
          if (!item.freePart) held.push({ item, reason: 'not_your_photo' });
          continue;
        }
      }
      // A held Post Event look's free part is reported, and kept whole, by its
      // refused twin — it is written below like any other applied item.
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
    /* 🎨 THE THEME LEAVES THE SESSION UPDATE. `invite_theme` has SELECT but no
       UPDATE grant for `authenticated` (20271219583821 — its one writer goes
       through the admin client after the host check and the Pro re-check), and
       an ungranted column in the patch would refuse EVERY column in it. It is
       written on its own below, after `requireHostMembershipOrThrow` (top of
       this action), the Pro gate (`planHubDraftApply` → `lookProAllows`) and
       the wedding fence above — the same order `setInviteTheme` kept. */
    const themeWrite = 'invite_theme' in eventsPatch ? eventsPatch.invite_theme : undefined;
    delete eventsPatch.invite_theme;
    /* 🔳 THE QR LOOK LEAVES THE SESSION UPDATE TOO. The draft holds `{ qr }`
       only; `style_preferences` also carries the couple's onboarding answers,
       so it is MERGED into the blob as it stands at write time — through the
       admin client, exactly as its live writer (`updateQrStyle`) always wrote
       it — after the host check (top) and the Pro gate (`planHubDraftApply`). */
    const qrWrite = 'style_preferences' in eventsPatch ? (eventsPatch.style_preferences as Record<string, unknown>) : undefined;
    delete eventsPatch.style_preferences;
    /* 🎵 The song's companions, as `updateSiteChrome` stamps them: where it came
       from, and off when there is no song to play. */
    if ('site_bg_music_r2_key' in eventsPatch) {
      eventsPatch.site_bg_music_source = eventsPatch.site_bg_music_r2_key ? 'upload' : null;
      if (!eventsPatch.site_bg_music_r2_key) eventsPatch.site_bg_music_enabled = false;
    }
    /* 🖼 NEW GALLERY PHOTOS ARE SCREENED BEFORE THEY GO LIVE — `updateOurPhotos`'
       own rule, fail-closed: `our_photos` has no moderation state, so a ref in
       it IS on the public page. A blocked photo is simply left out. */
    if (Array.isArray(eventsPatch.our_photos)) {
      const held = new Set(siteMediaServeRefs(live.events.our_photos));
      const fresh = (eventsPatch.our_photos as string[]).filter((r) => !held.has(r));
      if (fresh.length > 0) {
        const blocked = await screenNewPhotoRefs(fresh);
        if (blocked.length > 0) eventsPatch.our_photos = (eventsPatch.our_photos as string[]).filter((r) => !blocked.includes(r));
      }
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
    if (qrWrite !== undefined) {
      const admin = createAdminClient();
      const { data: prefRow, error: prefErr } = await admin
        .from('events')
        .select('style_preferences')
        .eq('event_id', eventId)
        .maybeSingle();
      const prefs =
        !prefErr && prefRow?.style_preferences && typeof prefRow.style_preferences === 'object'
          ? { ...(prefRow.style_preferences as Record<string, unknown>) }
          : null;
      if (!prefs && prefErr) {
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
      const { data: qrRows, error: qrErr } = await admin
        .from('events')
        .update({ style_preferences: { ...(prefs ?? {}), ...qrWrite } })
        .eq('event_id', eventId)
        .select('event_id');
      if (qrErr || !Array.isArray(qrRows) || qrRows.length === 0) {
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
    }
    if (themeWrite !== undefined) {
      /* 🔑 THE WRITE MUST PROVE A ROW CHANGED — a zero-row UPDATE returns no
         error, and "applied" over an untouched row is the failure that looks
         exactly like success. */
      const { data: themeRows, error: themeErr } = await createAdminClient()
        .from('events')
        .update({ invite_theme: themeWrite })
        .eq('event_id', eventId)
        .select('event_id');
      if (themeErr || !Array.isArray(themeRows) || themeRows.length === 0) {
        // Anything written above stays; the draft is untouched, so Apply again finishes it.
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
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
          /* ↕ The stage places and 🎞 the Save the Date's pick are two more
             `config_json` keys — the classifier hands the WHOLE merged key. */
          const key =
            item.field === 'main'
              ? HUB_MAIN_GROUND_KEY
              : item.field === 'stage_order'
                ? STAGE_ORDER_KEY
                : item.field === 'std_lead'
                  ? STD_LEAD_KEY
                  : item.field === 'custom'
                    ? 'custom'
                    : 'canvas';
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

    // 3 · 📖 Post Event's scenes — the story's OWN row, its `draft_json` and
    //     nothing else (`applyPostEventItems` touches three keys). Re-read right
    //     before the write so a save the story workroom or the lazy compile made
    //     a moment ago is built on, not reverted. Who may read the story is not
    //     in `draft_json` and is never named here: Apply changes WHAT the story
    //     shows, never WHO reads it.
    const storyItems = toWrite.flatMap((i) => (i.kind === 'editorial' ? [i.item] : []));
    if (storyItems.length > 0) {
      const { data: storyRow, error: storyErr } = await supabase
        .from('event_editorial')
        .select('draft_json')
        .eq('event_id', eventId)
        .maybeSingle();
      if (storyErr || !storyRow) {
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
      const liveStory = (storyRow as { draft_json?: unknown }).draft_json ?? {};
      snapshot.editorial = { ...postEventArrangementOf(liveStory), ...storyProExtrasOf(liveStory) };
      const { data: sRows, error: sErr } = await supabase
        .from('event_editorial')
        .update({ draft_json: applyPostEventItems(liveStory, storyItems) })
        .eq('event_id', eventId)
        .select('event_id');
      if (sErr || !Array.isArray(sRows) || sRows.length === 0) {
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
    }

    // 4 · 🎨 The fixed parts' style picks — ONE key of `events.style_preferences`,
    //     read-merge-written (every other key kept: the QR look, onboarding…)
    //     through the one writer the QR look uses. Admin client because
    //     `authenticated` holds no UPDATE grant on that column; the host check
    //     at the top of this action has already run. A pick is free — no Pro.
    const picks: FixedSceneStylesDraft = {};
    for (const item of toWrite) if (item.kind === 'fixed-style') picks[item.scene] = item.value;
    if (Object.keys(picks).length > 0) {
      const res = await writeStylePreferenceKey(createAdminClient(), eventId, SCENE_STYLES_PREF_KEY, (current) =>
        sceneStylesValueAfter(current, picks),
      );
      if (!res.ok) {
        return { ok: false, intent, error: 'Some changes could not be applied. Press Apply again to finish.' };
      }
      snapshot.sceneStyles = res.before ?? null;
    }

    // 5 · The draft keeps only what was held back (and a record of this apply).
    const remaining: HubDraftState = { events: {}, widgets: {} };
    for (const { item } of held) {
      if (item.kind === 'event') remaining.events[item.column] = item.value;
      else if (item.kind === 'editorial') {
        // A held look keeps the WHOLE drafted map — its free part is now live.
        if (item.item.field === 'sceneLooks') remaining.editorial = { ...(remaining.editorial ?? {}), sceneLooks: item.item.value };
        // 💎 A story extra held for Pro stays drafted whole, for the Apply after Pro.
        else if (item.item.field === 'chapterOverrides' || item.item.field === 'customColumns' || item.item.field === 'reviews') {
          remaining.editorial = { ...(remaining.editorial ?? {}), [item.item.field]: item.item.value };
        }
      } else if (item.kind === 'fixed-style') {
        // A style pick is free and never held; nothing to keep.
      } else if (item.field === 'canvas') {
        (remaining.widgets[item.widgetType] ??= {}).canvas = item.value as HubSectionCanvas | null;
      } else if (item.field === 'main') {
        (remaining.widgets[item.widgetType] ??= {}).main = item.value as HubMainGround | null;
      } else if (item.field === 'mode') {
        (remaining.widgets[item.widgetType] ??= {}).mode = item.value as 'auto' | 'shown' | 'hidden';
      } else if (item.field === 'is_visible') {
        // 🎬 A scene of their own, held for Pro, stays SHOWN in the draft.
        (remaining.widgets[item.widgetType] ??= {}).is_visible = item.value as boolean;
      } else if (item.field === 'custom') {
        // ✍ Its words, held for Pro, stay in the draft too.
        (remaining.widgets[item.widgetType] ??= {}).custom = item.value as CustomSectionContent | null;
      }
    }
    await writeHubDraft(supabase, eventId, { v: 1, ...remaining, history: [] }, snapshot);

    revalidateWebsiteEditor(eventId);
    revalidateGuestSite(typeof ownRow.slug === 'string' ? ownRow.slug : null);
    revalidatePath(`/dashboard/${eventId}/launch`);
    /* ✍ The names and the date are read by every dashboard page's chrome (and
       Home's countdown) — the same revalidation their live writers make. */
    if (toWrite.some((i) => i.kind === 'event' && hubDraftFactOf(i.column))) revalidatePath(`/dashboard/${eventId}`, 'layout');

    /* 🎞 A held Post Event preset scene is named by its preset, where it lives —
       "Post Event · your scene “The Toast”" — so the Apply sheet can say what
       Pro unlocks, by name and place. */
    const label = (t: WidgetType) => {
      const row = live.widgets.find((r) => r.widget_type === t);
      const drafted = current.widgets[t]?.canvas;
      const preset = postEventPreset(presetSceneOf(drafted !== undefined ? (drafted ?? {}) : sanitizeHubCanvas(row?.config_json)));
      return preset ? `Post Event · your scene “${preset.name}”` : (WIDGET_CATALOG_BY_TYPE[t]?.label ?? 'A section');
    };
    // A fact held across several columns (the date's day and precision) is said once.
    const heldSaid = held
      .map(({ item, reason }) => ({ label: hubDraftItemLabel(item, label), reason }))
      .filter((h, i, all) => all.findIndex((o) => o.label === h.label && o.reason === h.reason) === i);
    return done(
      toWrite.length,
      [...heldSaid, ...plan.orphans.map((t) => ({ label: label(t), reason: 'missing_section' as const }))],
    );
  } catch (e) {
    console.error('[hub-draft] action failed:', intent, e instanceof Error ? e.message : e);
    // 📏 The draft would not fit even with no Undo history: say WHAT to do,
    // not "try again" — trying again can never succeed (prod, 2026-09-27).
    if (e instanceof HubDraftTooLargeError) return { ok: false, intent, error: HUB_DRAFT_TOO_LARGE_MESSAGE };
    // Not "nothing changed": an apply can fail after some writes landed. The
    // draft is only trimmed on success, so trying again is always safe.
    return { ok: false, intent, error: HUB_DRAFT_SAVE_FAILED_MESSAGE };
  }
}
