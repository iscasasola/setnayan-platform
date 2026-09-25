import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { updateOurStory, loveStoryMomentAction } from './actions';
import { StoryFields, type LoveStoryBlob } from './_components/story-fields';
import { LoveStoryBook } from './_components/love-story-book';
import { PickFromOurEvents, type OtherEvent } from './_components/pick-from-our-events';
import { SubmitButton } from '@/app/_components/submit-button';
import { MiniTour } from '@/app/_components/mini-tour';
import { eventCoupleWebsiteProActive, eventOwnsCoupleWebsitePro } from '@/lib/couple-website-pro';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/php';
import { isStoreShellRequest } from '@/lib/request-platform';
import { formatEventDate } from '@/lib/events';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { HUB_MOTION_PRESET_LABEL } from '@/lib/hub-canvas';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { resolveHubTheme } from '@/app/[slug]/_lib/hub-look';
import { splitCoupleNames } from '@/app/[slug]/_components/pahina-masthead';
import { readMomentMedia, resolveMoments } from '@/lib/love-story-moments';

export const metadata = { title: 'Our Love Story' };

/**
 * /dashboard/[eventId]/website/our-story — OUR LOVE STORY, the scrapbook
 * (Event Hub Maker Phase 7 · owner 2026-09-25 · prototype
 * `our_love_story_scrapbook_2026-09-25.html`).
 *
 * 🔑 THE SAME PAGE, EXTENDED — NOT A NEW ONE. This address has been the
 * couple's love-story editor since 2026-07-23 and every door to it (the
 * Event Hub Maker bar's "Love Story" item, the editor's Story row, the
 * Controller) already points here; the plan's route budget is +0 pages.
 * What changed is what it shows: the moments, sorted into chapters, each one a
 * scene on the Invitation. The old form stays below for the words the
 * invitation's prose paragraph weaves (`composeOurStory`) — `updateOurStory`
 * and every legacy key keep working.
 *
 * Open to every event type (build plan D5 default — "a birthday's Before us is
 * still a story"); the legacy wedding form shows only for weddings.
 *
 * ⏭ P1 shell: the bar's "Love Story" tool opens this page. P2: writes are
 * live until the draft path lands. P4: the upload pipeline + meter. P5: each
 * moment's scene renders through the template renderer (`loveStoryScenes` is
 * the seam).
 */
export default async function OurStoryEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ saved?: string; error?: string; pro?: string; slotted?: string }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [
    { data: membership, error: membershipError },
    { data: event, error: eventError },
    { data: widget },
  ] = await Promise.all([
    supabase
      .from('event_members')
      .select('member_type')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('events')
      .select(
        'event_id, display_name, slug, event_type, event_date, timezone, love_story, invite_theme, monogram_text, monogram_color',
      )
      .eq('event_id', eventId)
      .maybeSingle(),
    supabase
      .from('invitation_widgets')
      .select('mode')
      .eq('event_id', eventId)
      .eq('widget_type', 'our_love_story')
      .maybeSingle(),
  ]);
  if (membershipError) {
    logQueryError('OurStoryPage.membership', membershipError, { event_id: eventId }, 'graceful_degrade');
  }
  if (eventError) {
    logQueryError('OurStoryPage.event', eventError, { event_id: eventId }, 'graceful_degrade');
  }

  if (!event) redirect(`/dashboard/${eventId}`);
  // Couple-only, like the website hub (moderators are read-only on events —
  // the form would silently no-op for them).
  if (membership?.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}/website`);
  }

  const story: LoveStoryBlob =
    event.love_story && typeof event.love_story === 'object'
      ? (event.love_story as LoveStoryBlob)
      : {};
  const moments = resolveMoments(story);

  const [proActive, proOwned, proSku, storeShell, look, otherEvents] = await Promise.all([
    eventCoupleWebsiteProActive(supabase, eventId).catch(() => false),
    eventOwnsCoupleWebsitePro(supabase, eventId).catch(() => false),
    formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null),
    isStoreShellRequest(),
    resolveHubTheme(event).catch(() => null),
    readOtherEvents(supabase, user.id, eventId),
  ]);
  const theme = INVITE_THEMES[look?.theme ?? 'house'];

  // Every photo the page draws, signed in ONE pass.
  const refs = [...new Set(moments.flatMap((m) => m.media ?? []))];
  const signed = await Promise.all(refs.map((r) => displayUrlForStoredAsset(r).catch(() => null)));
  const mediaUrls: Record<string, string> = {};
  refs.forEach((r, i) => {
    const url = signed[i];
    if (url) mediaUrls[r] = url;
  });

  const { first, second } = splitCoupleNames(event.display_name ?? '', event.event_type === 'wedding');
  const partners = [first, second].filter((n): n is string => Boolean(n && n.trim())).map((n) => n.trim());
  const years = moments.map((m) => m.date?.y).filter((y): y is number => typeof y === 'number');

  const base = `/dashboard/${eventId}`;
  const action = loveStoryMomentAction.bind(null, eventId);
  const updateAction = updateOurStory.bind(null, eventId);
  const proPrice = !storeShell && proSku?.price_php != null ? formatPhp(proSku.price_php) : null;
  const refused = search.pro === 'photos' ? 'photos' : search.pro === 'stories' ? 'stories' : null;
  const p = theme.palette;

  return (
    <section
      className="space-y-6"
      style={
        {
          '--ls-canvas': p.canvas,
          '--ls-surface': p.surface,
          '--ls-ink': p.ink,
          '--ls-muted': p.muted,
          '--ls-heading': p.heading,
          '--ls-accent': p.accent,
          '--ls-accent-ink': p.accentInk,
          '--ls-rule': `color-mix(in srgb, ${p.ink} 16%, transparent)`,
        } as React.CSSProperties
      }
    >
      <MiniTour tourKey="customer_love_story_v1" storeShell={storeShell} />
      {search.saved === '1' || search.error ? (
        <div className="space-y-3">
          {search.saved === '1' ? (
            <div
              role="status"
              className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {search.slotted
                ? `Slotted into ${search.slotted.slice(0, 80)} — live on your Event Hub.`
                : 'Saved — your story is live on your Event Hub.'}
            </div>
          ) : null}
          {search.error ? (
            <div role="alert" className="rounded-md border border-red-300/60 bg-red-50 px-3 py-2 text-sm text-red-800">
              {search.error}
            </div>
          ) : null}
        </div>
      ) : null}

      <LoveStoryBook
        eventId={eventId}
        names={event.display_name ?? ''}
        partners={partners}
        eyebrow={event.event_date ? formatEventDate(event.event_date) : 'Our Event Hub'}
        moments={moments}
        since={years.length ? Math.min(...years) : null}
        daysToTheDay={daysToTheDay(event.event_date, event.timezone)}
        themeName={theme.name}
        motionLabel={HUB_MOTION_PRESET_LABEL[theme.motion]}
        makerHref={`${base}/launch`}
        guestHref={event.slug ? `/${event.slug}?phase=rsvp` : null}
        ownsPro={proActive}
        storeShell={storeShell}
        proHref={proOwned && !proActive ? `${base}/launch` : `${base}/studio/website-pro`}
        proPrice={proPrice}
        refused={refused}
        sectionHidden={widget?.mode === 'hidden'}
        mediaUrls={mediaUrls}
        action={action}
        pickSlot={
          <PickFromOurEvents
            events={otherEvents}
            moments={moments}
            ownsPro={proActive}
            storeShell={storeShell}
            proHref={`${base}/studio/website-pro`}
            proPrice={proPrice}
            action={action}
          />
        }
      />

      {event.event_type === 'wedding' ? (
        <details className="mx-auto max-w-2xl border-t border-ink/10 pt-6">
          <summary className="cursor-pointer text-sm font-medium text-ink/70">
            The words your invitation weaves into its story paragraph
          </summary>
          <form action={updateAction} className="mt-6 space-y-8">
            <StoryFields story={story} />
            <SubmitButton pendingLabel="Saving…" className="button-primary">
              Save our story
            </SubmitButton>
          </form>
        </details>
      ) : null}
    </section>
  );
}

/** Whole days from the venue's today to the event date; null when unknown. */
function daysToTheDay(eventDate: string | null, timezone: string | null): number | null {
  if (!eventDate || !/^\d{4}-\d{2}-\d{2}/.test(eventDate)) return null;
  let today: string;
  try {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: timezone || 'Asia/Manila' }).format(new Date());
  } catch {
    today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(new Date());
  }
  const a = Date.parse(`${today}T00:00:00Z`);
  const b = Date.parse(`${eventDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return Math.round((b - a) / 86_400_000);
}

/** The couple's OTHER events and the public photos each already shows. */
async function readOtherEvents(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventId: string,
): Promise<OtherEvent[]> {
  const { data: rows, error } = await supabase
    .from('event_members')
    .select('event_id')
    .eq('user_id', userId)
    .eq('member_type', 'couple');
  if (error) {
    logQueryError('OurStoryPage.otherEvents', error, { event_id: eventId }, 'graceful_degrade');
    return [];
  }
  const ids = (rows ?? []).map((r) => r.event_id as string).filter((id) => id !== eventId);
  if (ids.length === 0) return [];
  const { data: events } = await supabase
    .from('events')
    .select('event_id, display_name, event_date, our_photos, landing_page_hero_image_url')
    .in('event_id', ids);
  return Promise.all(
    (events ?? []).map(async (e) => {
      // One ref at a time — `readMomentMedia` caps a LIST at a moment's four.
      const all: unknown[] = [e.landing_page_hero_image_url, ...(Array.isArray(e.our_photos) ? e.our_photos : [])];
      const pool = [...new Set(all.flatMap((v) => readMomentMedia([v])))].slice(0, 12);
      const photos = (
        await Promise.all(
          pool.map(async (ref) => {
            const url = await displayUrlForStoredAsset(ref).catch(() => null);
            return url ? { ref, url } : null;
          }),
        )
      ).filter((x): x is { ref: string; url: string } => x !== null);
      return {
        eventId: e.event_id as string,
        name: (e.display_name as string | null) ?? 'Our event',
        date: (e.event_date as string | null) ?? null,
        photos,
      };
    }),
  );
}
