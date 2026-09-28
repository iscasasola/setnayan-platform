import 'server-only';

/**
 * THE LAZY COMPILE — Post Event is written on the couple's first open of it
 * after the day (Event Hub Maker Phase 8).
 *
 * 🔑 THE REPO HAS NO SCHEDULER, BY DESIGN (`this-repo-has-no-scheduler-deliberately`).
 * So "the morning after, the Maker compiles every scene" is honoured the only
 * way it can be here: the first time the COUPLE opens the Maker after the day,
 * the scenes are compiled from what happened and stamped (`scenesGeneratedAt`),
 * and again only when a skipped scene's source has gained something
 * (`postEventNeedsCompile`). A guest's read never writes.
 *
 * The facts come from the story's OWN loader (`loadEditorialData`) — the same
 * object the guest page draws — so a scene is marked filled exactly when the
 * page has something to draw for it, and skipped exactly when it has nothing.
 *
 * ⚖ IT WRITES TWO KEYS AND NOTHING ELSE. The draft is re-read immediately
 * before the write and only `scenes` + `scenesGeneratedAt` are laid over it
 * (`withCompiledScenes`), so a save the couple makes in the same second is not
 * reverted. The couple's words, switches, order and chapter curation are never
 * touched — the golden test in `post-event-scenes.test.ts` holds it.
 *
 * Never throws: a refused read or write costs the couple the navigator's list
 * (the Maker then says the list could not be read) and nothing else.
 *
 * 🕰 BEFORE THE DAY (owner 2026-09-25, "POST EVENT IS MANY SMALL SCENES") the
 * SAME scenes are listed, each `waiting` and saying what will fill it — and
 * nothing is written. That read is deliberately LIGHT: the day's sources are
 * empty by definition, so the story's heavy loader is not run on every Maker
 * open; the event row and the story's own row answer everything a waiting
 * scene says (its Love Story, its closing words, its song).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadEditorialData } from '@/app/[slug]/_components/editorial/data';
import { resolveHero } from '@/lib/event-hero';
import { sanitizeStoryCover } from '@/lib/story-cover';
import { loadBackCover } from '@/app/[slug]/_lib/back-cover.server';
import { STRANGER } from '@/lib/who-can-see-your-story';
import {
  compilePostEventScenes,
  postEventNeedsCompile,
  postEventSceneList,
  readStoredScenes,
  withCompiledScenes,
  type PostEventMakerRead,
  type PostEventSources,
} from '@/lib/post-event-scenes';
import { overlayPostEventDraftJson, postEventArrangementOf, type PostEventDraft } from '@/lib/post-event-draft';

export type { PostEventMakerRead };

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export async function readPostEventForMaker(input: {
  eventId: string;
  /** Has the day happened? Before it the scenes wait, and nothing is written. */
  eventEnded: boolean;
  isCouple: boolean;
  /**
   * 💾 Post Event's drafted story keys (`HubDraft.editorial`) — laid over the
   * live story, so the navigator lists what the canvas shows. Never written here.
   */
  draftEditorial?: PostEventDraft | null;
}): Promise<PostEventMakerRead> {
  const { eventId } = input;
  if (!input.eventEnded) return readPostEventBeforeTheDay(input);
  try {
    const admin = createAdminClient();
    const [editorialRes, eventRes, data] = await Promise.all([
      admin.from('event_editorial').select('draft_json, hero_photo_id').eq('event_id', eventId).maybeSingle(),
      admin
        .from('events')
        .select('landing_page_hero_image_url, landing_page_hero_video_r2_key, story_cover_kind, story_cover_ref')
        .eq('event_id', eventId)
        .maybeSingle(),
      loadEditorialData(eventId).catch(() => null),
    ]);
    if (editorialRes.error) {
      logQueryError('PostEventCompile.editorial', editorialRes.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false };
    }
    if (eventRes.error) {
      logQueryError('PostEventCompile.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false };
    }
    if (!data) return { ok: false };

    const draft =
      editorialRes.data?.draft_json && typeof editorialRes.data.draft_json === 'object' && !Array.isArray(editorialRes.data.draft_json)
        ? (editorialRes.data.draft_json as Record<string, unknown>)
        : {};
    const event = (eventRes.data ?? {}) as Record<string, unknown>;

    /* Where the cover's picture comes from — the page's own ladder, in order:
       a post-event picture the couple chose (their upload, a curated capture,
       a chosen story cover other than the hero), then THE hero, then a photo
       the day supplied, then the written names. */
    const storyCover = sanitizeStoryCover(event.story_cover_kind, event.story_cover_ref);
    const chosen =
      Boolean(str(draft.heroUpload)) ||
      Boolean(str((editorialRes.data as { hero_photo_id?: unknown } | null)?.hero_photo_id)) ||
      (storyCover !== null && storyCover.kind !== 'hero');
    const hero = resolveHero(event);
    const cover: PostEventSources['cover'] = chosen
      ? 'chosen'
      : hero.photoRef
        ? 'hero'
        : data.heroPhotoUrl
          ? 'day'
          : 'card';

    /* What comes next — the back cover the couple announced, read by its own
       loader (the same one the page draws it with). */
    const backCover = await loadBackCover({
      eventId,
      eventDateISO: data.eventDate,
      // Only the announcement's TITLE is read here, and the title is the same
      // for every reader — the viewer decides the door, which this never draws.
      viewer: STRANGER,
    }).catch(() => null);
    const whatsNext = backCover ? backCover.title : null;

    const sources: PostEventSources = {
      cover,
      milestones: Array.isArray(data.loveStory?.milestones) ? data.loveStory.milestones.length : 0,
      metrics: { photos: data.metrics.photos, guests: data.metrics.guests },
      chapters: data.dayChapters.map((c) => ({
        time: c.time,
        title: c.title,
        leadId: c.leadId,
        isClip: c.media[0]?.type === 'clip',
        media: c.media.length,
      })),
      galleryPhotos: data.galleryPhotos.length,
      broadcast: Boolean(data.watchFilmEmbedUrl),
      films: data.films?.length ?? 0,
      kwento: data.kwentoQuotes.length,
      challengeAnswers: data.challengeAnswers.length,
      guestColumns: data.guestColumns?.length ?? 0,
      vendorMedia: data.vendorMedia.length,
      team: data.vendors.length,
      liveWall: { active: data.photoWallActive, photos: data.photoWallPhotos.length },
      reviews: data.reviews.length,
      services: data.servicesAvailed.length,
      vendorsWeLoved: data.vendorsWeLoved.length,
      specialMessage: Boolean(str(data.specialMessage)),
      song: data.song.label ?? (data.song.url ? 'Their song' : null),
      whatsNext,
    };

    const stored = readStoredScenes(draft);
    const fresh = compilePostEventScenes(sources, new Date().toISOString(), { dayHappened: true });
    let current = stored ?? fresh;
    let wrote = false;

    if (postEventNeedsCompile({ eventEnded: input.eventEnded, isCouple: input.isCouple, stored, fresh })) {
      // Re-read, then lay ONLY the two keys over the latest draft.
      const again = await admin.from('event_editorial').select('draft_json').eq('event_id', eventId).maybeSingle();
      if (!again.error && again.data) {
        const latest =
          again.data.draft_json && typeof again.data.draft_json === 'object' && !Array.isArray(again.data.draft_json)
            ? (again.data.draft_json as Record<string, unknown>)
            : {};
        // 🪤 A zero-row UPDATE is success-shaped — ask for the row back and
        // count it, so "wrote" is never claimed for a write that hit nothing.
        const { data: hit, error } = await admin
          .from('event_editorial')
          .update({ draft_json: withCompiledScenes(latest, fresh) })
          .eq('event_id', eventId)
          .select('event_id');
        if (error) {
          logQueryError('PostEventCompile.write', error, { event_id: eventId }, 'graceful_degrade');
        } else if ((hit?.length ?? 0) > 0) {
          current = fresh;
          wrote = true;
        }
      } else if (again.error) {
        logQueryError('PostEventCompile.reread', again.error, { event_id: eventId }, 'graceful_degrade');
      }
    }

    /* The list always shows what the sources say NOW — a stored record older
       than a new review must not keep it "skipped" on screen. The stamp shown
       is the record's own. */
    const drafted = overlayPostEventDraftJson(draft, input.draftEditorial ?? null);
    return {
      ok: true,
      rows: postEventSceneList({ ...fresh, generatedAt: current.generatedAt }, drafted),
      generatedAt: current.generatedAt,
      coverPhotoUrl: data.heroPhotoUrl,
      wrote,
      dayHappened: true,
      arrangement: postEventArrangementOf(drafted),
    };
  } catch {
    return { ok: false };
  }
}

/**
 * 🕰 BEFORE THE DAY — the same scenes, waiting, from two light reads (the event
 * row and the story's row). The day's own counts are empty by definition, so
 * each such scene says what will fill it (`POST_EVENT_WAITING`); what is already
 * true — their Love Story, their closing words, their song — is said as filled.
 * Writes nothing.
 */
async function readPostEventBeforeTheDay(input: {
  eventId: string;
  draftEditorial?: PostEventDraft | null;
}): Promise<PostEventMakerRead> {
  const { eventId } = input;
  try {
    const admin = createAdminClient();
    const [editorialRes, eventRes] = await Promise.all([
      admin.from('event_editorial').select('draft_json').eq('event_id', eventId).maybeSingle(),
      admin
        .from('events')
        .select('love_story, special_message, pakanta_song_r2_key, landing_page_hero_image_url, landing_page_hero_video_r2_key, story_cover_kind, story_cover_ref')
        .eq('event_id', eventId)
        .maybeSingle(),
    ]);
    if (editorialRes.error) {
      logQueryError('PostEventCompile.before.editorial', editorialRes.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false };
    }
    if (eventRes.error) {
      logQueryError('PostEventCompile.before.event', eventRes.error, { event_id: eventId }, 'graceful_degrade');
      return { ok: false };
    }
    const draft =
      editorialRes.data?.draft_json && typeof editorialRes.data.draft_json === 'object' && !Array.isArray(editorialRes.data.draft_json)
        ? (editorialRes.data.draft_json as Record<string, unknown>)
        : {};
    const event = (eventRes.data ?? {}) as Record<string, unknown>;
    const love = event.love_story && typeof event.love_story === 'object' ? (event.love_story as Record<string, unknown>) : {};
    const anchors = love.anchors && typeof love.anchors === 'object' ? (love.anchors as Record<string, unknown>) : {};
    const hero = resolveHero(event);
    const sources: PostEventSources = {
      cover: hero.photoRef ? 'hero' : 'card',
      milestones: Array.isArray(love.milestones) ? love.milestones.length : 0,
      metrics: { photos: null, guests: 0 },
      chapters: [],
      galleryPhotos: 0,
      broadcast: false,
      films: 0,
      kwento: 0,
      challengeAnswers: 0,
      guestColumns: 0,
      vendorMedia: 0,
      liveWall: { active: false, photos: 0 },
      reviews: 0,
      services: 0,
      vendorsWeLoved: 0,
      specialMessage: Boolean(str(event.special_message)),
      song: str(anchors.song) ?? (str(event.pakanta_song_r2_key) ? 'Their song' : null),
      whatsNext: null,
    };
    const fresh = compilePostEventScenes(sources, new Date().toISOString(), { dayHappened: false });
    const drafted = overlayPostEventDraftJson(draft, input.draftEditorial ?? null);
    return {
      ok: true,
      rows: postEventSceneList(fresh, drafted),
      generatedAt: fresh.generatedAt,
      coverPhotoUrl: null,
      wrote: false,
      dayHappened: false,
      arrangement: postEventArrangementOf(drafted),
    };
  } catch {
    return { ok: false };
  }
}
