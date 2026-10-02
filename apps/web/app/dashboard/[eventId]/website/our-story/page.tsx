import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { redirect } from 'next/navigation';
import { makerProUsable } from '@/lib/paid-mark';
import { CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { getCurrentUser } from '@/lib/auth';
import { updateOurStory, loveStoryMomentAction } from './actions';
import { StoryFields, type LoveStoryBlob } from './_components/story-fields';
import { LoveStoryBook, type LoveStoryBookProps } from './_components/love-story-book';
import { InMakerLiveBook } from './_components/in-maker-return-to';
import { HubDraftField } from '../_components/hub-draft-field';
import { PickFromOurEvents, type OtherEvent } from './_components/pick-from-our-events';
import { SubmitButton } from '@/app/_components/submit-button';
import { MiniTour } from '@/app/_components/mini-tour';
import { eventCoupleWebsiteProActive, eventOwnsCoupleWebsitePro } from '@/lib/couple-website-pro';
import { asViewed } from '@/lib/view-as-free.server';
import { formatV2Sku } from '@/lib/v2/sku-catalog-v2';
import { formatPhp } from '@/lib/php';
import { isStoreShellRequest } from '@/lib/request-platform';
import { formatEventDate } from '@/lib/events';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { siteMediaServeRef } from '@/lib/site-media-ref';
import { HUB_MOTION_PRESET_LABEL } from '@/lib/hub-canvas';
import { INVITE_THEMES } from '@/lib/invite-themes';
import { resolveHubTheme } from '@/app/[slug]/_lib/hub-look';
import { splitCoupleNames } from '@/app/[slug]/_components/pahina-masthead';
import { resolveMoments } from '@/lib/love-story-moments';
import { readOurEvents } from './_components/our-events-read';
import { readHubDraft } from '@/lib/hub-draft-store';
import { detailsIsTheDoor } from '@/lib/maker-details-door.server';
import { detailsDoorHref } from '@/lib/maker-details-items';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';

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
 * ⏭ P1 shell: the bar's "Love Story" tool opens this page. P2 (2026-09-25):
 * every save here goes into the couple's DRAFT, and the page shows the draft
 * laid over the live story — guests see it after Apply in the Event Hub Maker. P4: the upload pipeline + meter. P5: each
 * moment's scene renders through the template renderer (`loveStoryScenes` is
 * the seam).
 */
export default async function OurStoryEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{
    saved?: string;
    drafted?: string;
    error?: string;
    pro?: string;
    slotted?: string;
    /** `1` = drawn as Love Story's PAGE inside the Event Hub Maker (its body). */
    maker?: string;
  }>;
}) {
  const { eventId } = await params;
  const search = await searchParams;
  const inMaker = search.maker === '1';
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();
  const [
    { data: membership, error: membershipError },
    { data: event, error: eventError },
    { data: widget, error: widgetError },
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
  // Only a MEASURED hidden section is reported as hidden; a refused read says nothing.
  if (widgetError) {
    logQueryError('OurStoryPage.widget', widgetError, { event_id: eventId }, 'graceful_degrade');
  }

  if (!event) redirect(`/dashboard/${eventId}`);
  // Couple-only, like the website hub (moderators are read-only on events —
  // the form would silently no-op for them).
  if (membership?.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}/website`);
  }

  /* 📦 LOVE STORY MOVED INTO THE MAKER'S DETAILS, WHOLE (Details part 2b —
     Story & plans › Love Story: this scrapbook is its picture, the Story row's
     words its editor). Where Details draws it — the couple of an event with an
     Event Hub whose type has two named people (`detailsItemApplies`, the rule
     the guest page draws the story by) — this address lands there, carrying a
     save's flash. Anywhere else this page stays as it was. */
  if (!inMaker && (await eventWordsForEvent(eventId)).twoPeople && (await detailsIsTheDoor(supabase, eventId, user.id))) {
    redirect(
      detailsDoorHref(eventId, 'love-story', {
        saved: search.saved,
        drafted: search.drafted,
        error: search.error,
        pro: search.pro,
        slotted: search.slotted,
      }),
    );
  }

  /* 💾 THE SCRAPBOOK SHOWS THE DRAFT IT EDITS. Every form below posts
     `draft=1`, so the moments shown are the draft's when it holds the story —
     otherwise a drafted moment would vanish from the page that just saved it.
     A draft that cannot be read shows the live story and says so; a save then
     fails closed in the action (it re-reads the draft and refuses on error). */
  let draftReadFailed = false;
  let drafted: { value: unknown } | null = null;
  try {
    const d = await readHubDraft(supabase, eventId);
    if (d && 'love_story' in d.events) drafted = { value: d.events.love_story };
  } catch (e) {
    draftReadFailed = true;
    logQueryError('OurStoryPage.draft', { message: e instanceof Error ? e.message : String(e) }, { event_id: eventId }, 'graceful_degrade');
  }
  const storyRaw: unknown = drafted ? drafted.value : event.love_story;
  const story: LoveStoryBlob =
    storyRaw && typeof storyRaw === 'object' && !Array.isArray(storyRaw)
      ? (storyRaw as LoveStoryBlob)
      : {};
  const moments = resolveMoments(story);

  // The EVENT holds Pro, not the person who paid (owner 2026-10-02).
  const ent = await eventEntitlementClient(eventId);
  const [proActive, proOwned, proSku, storeShell, look, otherEvents] = await Promise.all([
    // 👁 As the viewer is shown it — the Maker's Love Story is this page.
    asViewed(eventCoupleWebsiteProActive(ent, eventId).catch(() => false)),
    asViewed(eventOwnsCoupleWebsitePro(ent, eventId).catch(() => false)),
    formatV2Sku('COUPLE_WEBSITE_PRO').catch(() => null),
    isStoreShellRequest(),
    resolveHubTheme(event).catch(() => null),
    readOtherEvents(user.id, eventId),
  ]);
  const theme = INVITE_THEMES[look?.theme ?? 'house'];

  // Every photo the page draws, signed in ONE pass.
  const refs = [...new Set(moments.flatMap((m) => m.media ?? []))];
  const signed = await Promise.all(refs.map((r) => displayUrlForStoredAsset(siteMediaServeRef(r)).catch(() => null)));
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
  /* 💎 Every save here drafts, so on the web more stories and photos are TRIED
     without Pro (◆ PRO) and Apply asks (owner 2026-09-28); the app-store shell
     keeps the free cap in the UI. */
  const proUsable = makerProUsable({ owns: proActive, storeShell });
  const refused = search.pro === 'photos' ? 'photos' : search.pro === 'stories' ? 'stories' : null;
  const p = theme.palette;
  const pickSlot = (
    <PickFromOurEvents
      events={otherEvents}
      moments={moments}
      ownsPro={proUsable}
      storeShell={storeShell}
      proHref={`${base}/studio/website-pro`}
      proPrice={proPrice}
      action={action}
    />
  );
  /* The scrapbook's props — the server-drawn book's and, in the Maker, the
     instant one's (`InMakerLiveBook`, which also takes the story itself). */
  const since = years.length ? Math.min(...years) : null;
  const bookProps: Omit<LoveStoryBookProps, 'moments' | 'since'> = {
    inMaker,
    eventId,
    names: event.display_name ?? '',
    partners,
    eyebrow: event.event_date ? formatEventDate(event.event_date) : 'Our Event Hub',
    daysToTheDay: daysToTheDay(event.event_date, event.timezone),
    themeName: theme.name,
    motionLabel: HUB_MOTION_PRESET_LABEL[theme.motion],
    makerHref: `${base}/launch`,
    guestHref: event.slug ? `/${event.slug}?phase=rsvp` : null,
    ownsPro: proUsable,
    tryingPro: proUsable && !proActive,
    storeShell,
    proHref: proOwned && !proActive ? `${base}/launch` : `${base}/studio/website-pro`,
    proPrice,
    refused,
    sectionHidden: !widgetError && widget?.mode === 'hidden',
    mediaUrls,
    action,
    pickSlot,
  };

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
      {/* Inside the Maker the Maker's own tour is the one that runs. */}
      {inMaker ? null : <MiniTour tourKey="customer_love_story_v1" storeShell={storeShell} />}
      {search.saved === '1' || search.error ? (
        <div className="space-y-3">
          {search.saved === '1' ? (
            <div
              role="status"
              className="inline-flex items-center gap-2 rounded-md border border-success-300/60 bg-success-50 px-3 py-2 text-sm text-success-800"
            >
              <CheckCircle2 aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {search.drafted === '1'
                ? search.slotted
                  ? `Slotted into ${search.slotted.slice(0, 80)} — in your draft. Guests see it after you press Apply in the Event Hub Maker.`
                  : 'Saved to your draft. Guests see it after you press Apply in the Event Hub Maker.'
                : search.slotted
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

      {drafted || draftReadFailed ? (
        <p role="status" data-love-story-draft="" className="text-sm text-ink/70">
          {draftReadFailed
            ? 'We could not read your draft, so this shows what guests see now.'
            : 'You are editing your draft — guests still see your live story.'}{' '}
          {inMaker ? (
            draftReadFailed ? null : 'Press Apply when it is ready.'
          ) : (
            <a href={`${base}/launch`} className="font-semibold text-ink underline underline-offset-4">
              {draftReadFailed ? 'Open the Event Hub Maker' : 'Apply it in the Event Hub Maker'}
            </a>
          )}
        </p>
      ) : null}
      {/* ⚡ In the Maker the scrapbook is drawn from the Maker's own copy of the
          story and every change is on it at the tap, saved behind it
          (`love-story-live.tsx`, loaded with Details — never the Maker's first load). */}
      {inMaker ? (
        <InMakerLiveBook book={{ ...bookProps, story }}>
          <LoveStoryBook {...bookProps} moments={moments} since={since} />
        </InMakerLiveBook>
      ) : (
        <LoveStoryBook {...bookProps} moments={moments} since={since} />
      )}

      {/* In the Maker these words sit BESIDE the page (the editor's Story row). */}
      {event.event_type === 'wedding' && !inMaker ? (
        <details className="mx-auto max-w-2xl border-t border-ink/10 pt-6">
          <summary className="cursor-pointer text-sm font-medium text-ink/70">
            The words your invitation weaves into its story paragraph
          </summary>
          <form action={updateAction} className="mt-6 space-y-8">
            <HubDraftField />
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

/**
 * The OTHER events both partners were at (owner 2026-09-27: "this should show
 * all events that they are both there") and, for the ones the pair hosts, the
 * public photos each already shows — or NULL when the read was refused, so the
 * block says it could not look rather than "no other events". The scope lives
 * in `readOurEvents` (admin read, fail-closed), shared with the pick action.
 */
async function readOtherEvents(userId: string, eventId: string): Promise<OtherEvent[] | null> {
  const events = await readOurEvents({ userId, eventId });
  if (events === null) return null;
  return Promise.all(
    events.map(async (e) => {
      const photos = (
        await Promise.all(
          e.refs.slice(0, 12).map(async (ref) => {
            const url = await displayUrlForStoredAsset(siteMediaServeRef(ref)).catch(() => null);
            return url ? { ref, url } : null;
          }),
        )
      ).filter((x): x is { ref: string; url: string } => x !== null);
      return { eventId: e.eventId, name: e.name, date: e.date, hosted: e.hosted, photos };
    }),
  );
}
