'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { REVEAL_TEMPLATE_IDS, type RevealTemplateId } from '@/lib/reveal-config';
import { STD_THEME_IDS } from '@/lib/std-themes';
import { resolveRevealEffects, type RevealEffects } from '@/lib/std-reveal-effects';
import { NO_REVEAL } from '@/app/[slug]/_components/reveal/reveal-templates';
import { resolveStdBackground, type StdBackground } from '@/lib/std-backgrounds';
import {
  resolveStdMedia,
  resolveStdNsfwVerdict,
  stdVideoNeedsScreen,
  type StdMedia,
} from '@/lib/std-media';
import { screenStdVideo } from '@/lib/nsfw-screen';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { presignClientRef } from '@/lib/r2-client-ref.server';
import {
  eventMediaPolicy,
  parseClientRef,
  stdMediaPolicy,
} from '@/lib/r2-client-ref';
import { fanOutSaveTheDateEmails } from '@/lib/save-the-date-emails';
import { publishSaveTheDate } from '@/lib/launch-save-the-date';

/**
 * Server actions for the Save-the-Date builder (0024 PR4 · P4).
 *
 * chooseRevealTemplate — persists the couple's chosen opening reveal
 *   (events.std_reveal_template). The live page (RevealOverlay) now prefers this
 *   over the admin house default. Validated against the 5 REVEAL_TEMPLATE_IDS.
 *   Called programmatically from the chooser (useTransition) → returns a result
 *   instead of redirecting, so the preview stays put.
 * saveInvitationLaunchDate — persists when the full invitation goes live
 *   (events.std_invitation_launch_date), driving the film's closing beat + the
 *   second add-to-calendar VEVENT (P3). A plain form action → redirects back.
 *
 * AuthZ mirrors the sibling wax-seal actions: gate on an explicit couple
 * membership, then write through the couple's authenticated client
 * (couple_can_update_event is the DB-level enforcement).
 */

async function requireCouple(eventId: string, opts?: { secured?: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  // Anon-draft boundary: launching / scheduling a Save-the-Date makes the event
  // public and emails guests — never allowed for a native anonymous principal.
  // They must "secure their plan" first. Design actions (reveal choice, dates)
  // stay open so drafting still works without an account.
  if (opts?.secured && user.is_anonymous) {
    redirect(`/signup?next=/dashboard/${eventId}/studio/save-the-date`);
  }
  const { data: membership } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .eq('member_type', 'couple')
    .maybeSingle();
  if (!membership) {
    redirect(`/dashboard/${eventId}/studio/save-the-date?std_error=not-found`);
  }
  return supabase;
}

function revalidate(eventId: string) {
  revalidatePath(`/dashboard/${eventId}`, 'layout');
  revalidatePath(`/dashboard/${eventId}/studio/save-the-date`);
}

function isRevealTemplateId(v: string): v is RevealTemplateId {
  return (REVEAL_TEMPLATE_IDS as readonly string[]).includes(v);
}

export async function chooseRevealTemplate(
  eventId: string,
  templateId: string,
): Promise<{ ok: boolean }> {
  // Accept the 5 openings + 'none' (No Reveal — the free, no-opening choice).
  if (!eventId || !(templateId === NO_REVEAL || isRevealTemplateId(templateId))) {
    return { ok: false };
  }
  const supabase = await requireCouple(eventId);
  const { error } = await supabase
    .from('events')
    .update({ std_reveal_template: templateId })
    .eq('event_id', eventId);
  if (error) return { ok: false };
  revalidate(eventId);
  return { ok: true };
}

/**
 * Presign a just-uploaded Step-1 background photo (r2:// ref) → a display URL,
 * so the builder preview can show it immediately. Gated to the event's couple.
 */
export async function presignStdBackground(
  eventId: string,
  ref: string,
): Promise<{ url: string | null }> {
  if (!eventId || !ref) return { url: null };
  await requireCouple(eventId);
  // SEC-1: `ref` is a raw server-action argument — any signed-in caller can put
  // ANY key in it. Membership on `eventId` says nothing about who owns the
  // object, so this used to sign another couple's payment proof or another
  // vendor's DTI permit (all five buckets) on request. Pin it to THIS event's
  // own Save-the-Date uploads in the public media bucket; anything else → null.
  const url = await presignClientRef(ref, stdMediaPolicy(eventId));
  return { url: url ?? null };
}

/**
 * saveAllStdContent — single-shot save for the live builder (2026-06-18).
 * Persists theme + invitation launch date + the four film-snapshot columns
 * (std_film_date / venue_name / venue_city / story) in one write.
 * Returns { ok: boolean } — no redirect; the builder shows an inline result.
 *
 * Snapshot fields store film-specific overrides so subsequent edits to the
 * core event (event_date, venue_name, love_story) don't change a finalized
 * film. Passing null/empty clears the override and falls back to live event
 * data on the next render.
 */
export async function saveAllStdContent(
  eventId: string,
  data: {
    theme?: string;
    launchDate?: string | null;
    filmDate?: string | null;
    filmVenueName?: string | null;
    filmVenueCity?: string | null;
    filmCeremonyName?: string | null;
    filmStory?: string | null;
    /** Film accent colour as a `#rrggbb` hex, or null to follow the Mood Board.
     *  Anything malformed degrades to null (never blocks a render). */
    filmAccentColor?: string | null;
    revealEffects?: RevealEffects | null;
    background?: StdBackground | null;
    media?: StdMedia | null;
    /** A newly-uploaded song r2 ref. Persists to the SINGLE-SOURCE site music
     *  (events.site_bg_music_*) — the STD film reuses the couple's site song.
     *  undefined = no change; a string = set + enable. */
    siteMusicKey?: string | null;
  },
): Promise<{ ok: boolean; error?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  const supabase = await requireCouple(eventId);

  const theme =
    data.theme && (STD_THEME_IDS as readonly string[]).includes(data.theme)
      ? data.theme
      : null;

  const rawDate = data.launchDate?.trim() ?? null;
  const launchDate =
    rawDate === '' || rawDate === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(rawDate)
        ? rawDate
        : undefined;
  if (launchDate === undefined) return { ok: false, error: 'bad-date' };

  const rawFilmDate = data.filmDate?.trim() ?? null;
  const filmDate =
    rawFilmDate === '' || rawFilmDate === null
      ? null
      : /^\d{4}-\d{2}-\d{2}$/.test(rawFilmDate)
        ? rawFilmDate
        : undefined;
  if (filmDate === undefined) return { ok: false, error: 'bad-film-date' };

  const patch: Record<string, unknown> = {};
  if (theme !== null) patch.std_theme = theme;
  patch.std_invitation_launch_date = launchDate;
  if (data.filmDate !== undefined) patch.std_film_date = filmDate;
  if (data.filmVenueName !== undefined) patch.std_film_venue_name = data.filmVenueName?.trim() || null;
  if (data.filmVenueCity !== undefined) patch.std_film_venue_city = data.filmVenueCity?.trim() || null;
  if (data.filmCeremonyName !== undefined) patch.std_film_ceremony_name = data.filmCeremonyName?.trim() || null;
  if (data.filmStory !== undefined) patch.std_film_story = data.filmStory?.trim() || null;
  // Film accent override — a #rrggbb hex (from the colour picker) or null to
  // follow the Mood Board. The only client sources are <input type=color>
  // (always valid) or a reset (null); anything malformed degrades to null
  // rather than failing the whole render. The live page resolves null →
  // Mood-Board accent → mulberry (stdAccentColor).
  if (data.filmAccentColor !== undefined) {
    const raw = data.filmAccentColor?.trim().toLowerCase() ?? '';
    patch.std_film_accent_hex = /^#[0-9a-f]{6}$/.test(raw) ? raw : null;
  }
  // Reveal effect toggles — sanitised to {butterflies,petals} booleans.
  if (data.revealEffects !== undefined && data.revealEffects !== null) {
    patch.std_reveal_effects = resolveRevealEffects(data.revealEffects);
  }
  // Step-1 background choice — validated to {kind, value}.
  if (data.background !== undefined && data.background !== null) {
    const bg = resolveStdBackground(data.background);
    // SEC-1: an 'upload' background carries a client-supplied r2:// ref that is
    // presigned LATER — by lib/std-bg-image.ts and by the PUBLIC wedding-site
    // loaders, which serve anonymous visitors. `resolveStdBackground` accepts
    // ANY non-empty string for kind==='upload', so an unvalidated ref turns
    // this write into a cross-tenant read oracle with an anonymous delivery
    // channel. Refuse a foreign ref rather than persisting it.
    //
    // Grandfather clause: a value IDENTICAL to what is already stored is
    // allowed through even if it fails today's policy. Re-saving the builder
    // must not brick on a row written before this rule existed — and echoing
    // back a ref we already serve introduces nothing new.
    if (bg.kind === 'upload' && !parseClientRef(bg.value, stdMediaPolicy(eventId))) {
      const { data: curBg } = await supabase
        .from('events')
        .select('std_background')
        .eq('event_id', eventId)
        .maybeSingle();
      const stored = resolveStdBackground(
        (curBg as Record<string, unknown> | null)?.std_background,
      );
      if (!(stored.kind === 'upload' && stored.value === bg.value)) {
        return { ok: false, error: 'bad-background-ref' };
      }
    }
    patch.std_background = bg;
  }
  // Step-3 media choice — validated to {type, videoKey?, posterKey?, fit?}.
  //
  // SECURITY (SEC-6 · 2026-07-26): the NSFW verdict is NOT in this object any
  // more. It used to be — and because `std_media` is a host-writable column and
  // RLS is row-level, a couple could bypass this whole action with a PostgREST
  // PATCH setting nsfw:'approved'. The verdict now lives in
  // events.std_media_nsfw, which `authenticated` holds no UPDATE/INSERT on, and
  // it is BOUND to the exact videoKey + posterKey + content fingerprints it was
  // computed for. So this action no longer decides anything about approval: it
  // just records the couple's media choice and schedules a screen when the
  // stored verdict does not (or no longer) covers it.
  //
  // The poster frame (the screening proxy) is taken from the upload, falling
  // back to the saved one when the video is unchanged.
  let screenAfterSave: { videoKey: string; posterR2Key: string } | null = null;
  if (data.media !== undefined && data.media !== null) {
    const incoming = resolveStdMedia(data.media, eventId);
    // SEC-1: videoKey / posterKey are client-supplied refs that get presigned
    // later on the PUBLIC wedding site (app/[slug]/_lib/loaders.ts) and read
    // server-side by screenStdVideo(). Pin both to this event's own uploads.
    const stdPolicy = stdMediaPolicy(eventId);
    if (incoming.type === 'video' && incoming.videoKey) {
      const { data: cur } = await supabase
        .from('events')
        .select('std_media, std_media_nsfw')
        .eq('event_id', eventId)
        .maybeSingle();
      const currentRow = (cur as Record<string, unknown> | null) ?? null;
      const current = resolveStdMedia(currentRow?.std_media, eventId);
      // Same grandfather clause as the background above: a ref identical to the
      // one already stored may be echoed back, anything NEW must pass policy.
      if (
        !parseClientRef(incoming.videoKey, stdPolicy) &&
        !(current.type === 'video' && current.videoKey === incoming.videoKey)
      ) {
        return { ok: false, error: 'bad-video-ref' };
      }
      if (
        incoming.posterKey &&
        !parseClientRef(incoming.posterKey, stdPolicy) &&
        !(current.type === 'video' && current.posterKey === incoming.posterKey)
      ) {
        return { ok: false, error: 'bad-poster-ref' };
      }
      const sameVideo =
        current.type === 'video' && current.videoKey === incoming.videoKey;
      const posterKey =
        incoming.posterKey ?? (sameVideo ? (current.posterKey ?? null) : null);
      const nextMedia = {
        type: 'video' as const,
        videoKey: incoming.videoKey,
        posterKey,
        fit: incoming.fit ?? 'fill',
      };
      patch.std_media = nextMedia;
      // Schedule a screen when the stored verdict does not bind to what we are
      // about to save. `stdVideoNeedsScreen` is the SAME predicate the screen
      // itself re-checks, so this is a hint, never an authorisation.
      if (
        stdVideoNeedsScreen(
          nextMedia,
          resolveStdNsfwVerdict(currentRow?.std_media_nsfw),
          eventId,
        ) &&
        posterKey
      ) {
        screenAfterSave = { videoKey: incoming.videoKey, posterR2Key: posterKey };
      }
    } else {
      patch.std_media = { type: 'gallery' };
    }
  }

  // Step-4 Music — a newly-uploaded song. SINGLE-SOURCE: the STD film reuses the
  // couple's site song, so this writes events.site_bg_music_* (the same column
  // the film + Event/RSVP paths read). Uploading a song enables it; removal /
  // disable stays on the dedicated site-chrome surface (we never clobber here).
  if (typeof data.siteMusicKey === 'string' && data.siteMusicKey.trim()) {
    // SEC-1: same laundering path — the song ref is presigned for anonymous
    // visitors by the public site loader. Must be this event's own upload.
    const musicKey = data.siteMusicKey.trim();
    if (!parseClientRef(musicKey, eventMediaPolicy(eventId))) {
      // Grandfather an unchanged value, as above.
      const { data: curMusic } = await supabase
        .from('events')
        .select('site_bg_music_r2_key')
        .eq('event_id', eventId)
        .maybeSingle();
      const stored = (curMusic as { site_bg_music_r2_key?: string | null } | null)
        ?.site_bg_music_r2_key;
      if (stored !== musicKey) return { ok: false, error: 'bad-music-ref' };
    }
    patch.site_bg_music_r2_key = musicKey;
    patch.site_bg_music_enabled = true;
  }

  const { error } = await supabase.from('events').update(patch).eq('event_id', eventId);
  if (error) return { ok: false, error: 'db-error' };

  // Backfill the canonical wedding date from the Save-the-Date date when the
  // event has none yet. The public page's lifecycle phase reads
  // events.event_date (NOT std_film_date) to decide whether to show the film —
  // so without this, a couple who only sets the date here would never see their
  // Save-the-Date appear (it'd sit in the RSVP phase). Guarded to event_date IS
  // NULL so an existing wedding date is never clobbered; std_film_date stays the
  // display-only override on top.
  //
  // ⚠ IT MUST ADVANCE THE PRECISION TOO (fixed 2026-07-30). Until this line
  // existed, the backfill wrote a real calendar day while leaving
  // `event_date_precision` at its creation default of 'year'
  // (create-event/actions.ts) — and countdown maths only runs at 'day'
  // (`lib/progress-stages.ts`), so the event a couple had just dated was
  // skipped by everything that counts down. BOTH prod events carried the
  // signature (`event_date = std_film_date`, precision 'year'); this was the
  // only `events.event_date` writer that didn't set precision alongside it.
  // `std_film_date` is a specific day, so 'day' is the honest precision — and
  // year → day is a NARROWING, which the refine-only ratchet in
  // `[eventId]/actions.ts` allows. This action still does not WRITE
  // `date_status` — but as of migration 20271033121603 it no longer leaves it
  // stale either: the `sync_event_date_status_trg` trigger on `events` promotes
  // an untouched `date_status` to 'locked' whenever a DAY-precise `event_date`
  // lands. That is deliberate. The previous note here claimed committing was
  // "date-selection/actions.ts's job, not a film's", but this writer puts the
  // day into `events.event_date` — the column every countdown, deadline and
  // vendor surface treats as THE date — so calling it uncommitted was a
  // distinction the rest of the app did not honour, and it was one of the four
  // paths that left `date_status` permanently 'undecided' in prod.
  if (filmDate) {
    await supabase
      .from('events')
      .update({ event_date: filmDate, event_date_precision: 'day' })
      .eq('event_id', eventId)
      .is('event_date', null);
  }

  // Screen the uploaded video by its poster frame (background). Only an
  // 'approved' verdict BOUND to this exact media ever lets the video play on the
  // public page — if this fire-and-forget drops, the video simply stays dark and
  // the builder page's opportunistic heal retries it.
  if (screenAfterSave) {
    const { videoKey, posterR2Key } = screenAfterSave;
    after(() => screenStdVideo({ eventId, videoKey, posterR2Key }).catch(() => {}));
  }

  revalidate(eventId);
  return { ok: true };
}

export async function saveInvitationLaunchDate(formData: FormData): Promise<void> {
  const eventId = String(formData.get('event_id') ?? '').trim();
  if (!eventId) throw new Error('Missing event_id');
  const supabase = await requireCouple(eventId);

  const raw = String(formData.get('launch_date') ?? '').trim();
  // Empty clears the date; otherwise require a YYYY-MM-DD calendar date.
  const value = raw === '' ? null : raw;
  if (value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    redirect(`/dashboard/${eventId}/studio/save-the-date?std_error=bad-date#touches`);
  }

  const { error } = await supabase
    .from('events')
    .update({ std_invitation_launch_date: value })
    .eq('event_id', eventId);
  if (error) {
    redirect(`/dashboard/${eventId}/studio/save-the-date?std_error=save#touches`);
  }

  revalidate(eventId);
  redirect(`/dashboard/${eventId}/studio/save-the-date?std=saved#touches`);
}

/**
 * launchSaveTheDate — the couple's deliberate "go live" action.
 *
 * Owner ruling 2026-06-20: the wedding's public /[slug] page is PRIVATE by
 * default (migration 20270206705422) and becomes public ONLY when the couple
 * launches their Save-the-Date. This is that moment: it flips
 * landing_page_visibility → 'public' and stamps std_launched_at. Before this,
 * strangers see the <PrivateLanding> lock screen; the couple (host) and invited
 * guests (personal-link cookie) could already view it. After this, it's the
 * full public page, indexable, with a rich share card.
 *
 * Returns a result (invoked from the studio launch button via a transition) so
 * the button can show the "launched" state without a navigation. Idempotent —
 * re-launching just re-stamps + re-publishes.
 */
export async function launchSaveTheDate(
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  const supabase = await requireCouple(eventId, { secured: true });
  // Shared go-public flip (lib/launch-save-the-date.ts) — also clears any
  // pending scheduled_launch_at, so "Launch now" cleanly overrides a schedule.
  const published = await publishSaveTheDate(supabase, eventId);
  if (!published) return { ok: false, error: 'db-error' };
  // Flip the PUBLIC page out of its cached private state — the dashboard-only
  // revalidate() helper below never touches /[slug], so without this the page
  // could keep serving the lock screen after launch.
  if (published.slug) revalidatePath(`/${published.slug}`);
  revalidate(eventId);
  // Augment the shared-link "pull" model with an opt-out-able PUSH: actively
  // email each guest who has an email address their save-the-date. Cron-free
  // (Next 15 after() — runs after the response), best-effort (never blocks the
  // launch or throws), and idempotent (per-guest guests.std_sent_at guards a
  // re-launch from re-spamming). Guests WITHOUT an email are simply skipped —
  // the shared join link stays their fallback.
  after(() => fanOutSaveTheDateEmails(eventId).catch(() => {}));
  return { ok: true };
}

/**
 * scheduleSaveTheDateLaunch — set a FUTURE go-live for the wedding website
 * (owner ask 2026-06-28). The page stays private until the moment arrives;
 * the cron-free read-time gate in app/[slug]/page.tsx flips it public + emails
 * guests on the first load past `scheduled_launch_at`. No timer, no cron.
 *
 * `localDateTime` is the couple's wall-clock pick from a <input type="datetime-
 * local"> — "YYYY-MM-DDTHH:mm". We interpret it as Asia/Manila (PH has no DST,
 * fixed +08:00) so the schedule is deterministic regardless of the couple's
 * device timezone, then store UTC. Returns the stored ISO so the UI can update
 * without a navigation (called via useTransition).
 */
export async function scheduleSaveTheDateLaunch(
  eventId: string,
  localDateTime: string,
): Promise<{ ok: boolean; error?: string; scheduledAtIso?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(localDateTime)) {
    return { ok: false, error: 'bad-datetime' };
  }
  // Interpret the wall-clock pick as Manila time (+08:00), store UTC.
  const when = new Date(`${localDateTime}:00+08:00`);
  if (Number.isNaN(when.getTime())) return { ok: false, error: 'bad-datetime' };
  if (when.getTime() <= Date.now()) return { ok: false, error: 'past' };

  const supabase = await requireCouple(eventId, { secured: true });
  const iso = when.toISOString();
  const { error } = await supabase
    .from('events')
    .update({ scheduled_launch_at: iso })
    .eq('event_id', eventId);
  if (error) return { ok: false, error: 'db-error' };
  revalidate(eventId);
  return { ok: true, scheduledAtIso: iso };
}

/**
 * cancelScheduledLaunch — clear a pending scheduled launch. The page stays
 * private; the couple can re-schedule or launch now. Idempotent.
 */
export async function cancelScheduledLaunch(
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!eventId) return { ok: false, error: 'missing-event' };
  const supabase = await requireCouple(eventId);
  const { error } = await supabase
    .from('events')
    .update({ scheduled_launch_at: null })
    .eq('event_id', eventId);
  if (error) return { ok: false, error: 'db-error' };
  revalidate(eventId);
  return { ok: true };
}

/*
  ─── `saveStdContent` DELETED (2026-09-03) ───────────────────────────────

  Superseded by `saveAllStdContent` above (2026-06-18), the single-shot save the
  live builder actually calls (`_components/StdBuilderClient.tsx`). That one
  writes a strict SUPERSET of what this wrote — the same std_film_* snapshot
  columns plus theme, launch date, accent hex, reveal effects, background, media
  and the site song — in one round trip.

  There was never a form to submit this: Step 3's fields are inline-editable and
  save through the builder. Zero callers on 2026-09-03.
*/
