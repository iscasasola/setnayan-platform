import { guestsArriveTime } from '@/lib/guests-arrive';
import { OurLoveStoryWidget } from '@/app/[slug]/_components/our-love-story-widget';
import { LAB_LOVE_STORY, LAB_PHOTOS } from '../../details-lab/love-story-fixture';
import { artKitView, sanitizeSceneAccents, type SceneAccents } from '@/lib/art-kits';
import { KitClosing, KitSlot, KitStyle } from '@/app/[slug]/_components/kit-piece';
import { sceneWidgetIsBare } from '@/lib/scene-ground';
import { ClosingLine } from '@/app/[slug]/_components/closing-line';
import { formatEventDate } from '@/lib/events';
import { Fragment, type ReactNode } from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { WishLab, labGiftContent } from './wish-lab';
import { WelcomeGiftsContent } from '@/app/[slug]/_components/welcome-gifts-content';
import { wishListShape } from '@/lib/wish-list-guest';
import { cookies, headers } from 'next/headers';
import { TicketPicture } from '@/app/[slug]/_components/ticket-picture';
import { TicketPopup } from '@/app/[slug]/_components/ticket-popup';
import { SavePassCardButton } from '@/app/_components/save-pass-card-button';
import { ShortcutLine } from '@/app/[slug]/invite/_components/shortcut-line';
import { shortcutLineShows } from '@/lib/home-screen-shortcut';
import { isStoreShellRequest } from '@/lib/request-platform';
import { mainGroundLayerFor } from '@/app/[slug]/_lib/main-ground-layer';
import { LAB_SIGNED } from '../lab-own-media';
import { CountdownWidget } from '@/app/[slug]/_components/countdown';
import { EditorBridge } from '@/app/[slug]/_components/editor-bridge';
import { PahinaMotionObserver, PahinaMotionRootFlag } from '@/app/[slug]/_components/pahina-motion';
import { HUB_STAGES, type HubStage } from '@/lib/hub-canvas';
import { sceneStyleOfRow, paletteLookOfRow, dosLookOfRow } from '@/lib/scene-style-of-row';
import { renderCustomSection } from '@/app/[slug]/_components/custom-section-widget';
import { customSectionHasContent } from '@/lib/custom-sections';
import { NO_SCENE_FACTS } from '@/app/[slug]/_components/scene-template';
import { SpecialMessageWidget } from '@/app/[slug]/_components/special-message-widget';
import { MakerGuestScenes, MakerWelcomeGiftsEmpty, MakerWelcomeLook } from '@/app/[slug]/_components/maker-guest-scenes';
import { WelcomeGifts } from '@/app/[slug]/_components/guest-doorway-strip';
import { PahinaMasthead } from '@/app/[slug]/_components/pahina-masthead';
import { HeroBackgroundMedia } from '@/app/[slug]/_components/hero-background-media';
import { ScheduleWidget } from '@/app/[slug]/_components/schedule-widget';
import { VenueWidget } from '@/app/[slug]/_components/venue-widget';
import { HubCanvasFrame } from '@/app/[slug]/_components/hub-canvas-frame';
import { HubCoverHold, HubPageHold, HubScenes, hubCoverLeaves, hubScrubHoldsAtMost } from '@/app/[slug]/_components/hub-scenes';
import { EDITOR_CANVAS_HIDES_APP_CHROME, canvasOnlyCss, canvasOnlyScene, canvasStylePreview } from '@/app/[slug]/_lib/editor-canvas';
import { withStylePreview } from '@/app/[slug]/_lib/style-preview';
import { OurPhotosWidget } from '@/app/[slug]/_components/our-photos-widget';
import { OpenUpScene } from '@/app/[slug]/_components/editorial/open-up-layer';
import { GalleryPreview } from '@/app/[slug]/_components/editorial/post-event-scene-views';
import { eventWordsFor } from '@/app/[slug]/_lib/event-words';
import { fixedSceneStyleOf } from '@/lib/fixed-scene-style-of';
import type { StyledScene } from '@/lib/fixed-scene-styles';
import { HERO_PART_LOOK, partLookAttr } from '@/lib/scene-styles-parts';
import { MakerEmptyScene, makerOwnSlots, makerWordsLook } from '@/app/[slug]/_components/maker-empty-scene';
import { SceneSample } from '@/app/[slug]/_components/maker-scene-samples';
import { WhenYesCelebration } from '@/app/[slug]/_components/when-yes-celebration';
import { celebrationColours, isRsvpCelebration } from '@/lib/rsvp-celebration';
import { RsvpCanvasBridge } from '@/app/[slug]/_components/rsvp-canvas-bridge';
import { BLOCK_LOOKS_STYLE_ATTR, BLOCK_MARK_ATTR, blockLooksCss, blockOfCanvas, readBlockLooks } from '@/lib/block-looks';
import { RsvpLookStyle } from '@/app/[slug]/_components/rsvp-look-style';
import { RsvpWidget } from '@/app/[slug]/_components/rsvp-widget';
import { submitInviteReply } from '@/app/[slug]/invite/actions';
import { RsvpSheet } from '@/app/[slug]/_components/rsvp-sheet';
import { LabReplyDoor, labWindow } from './lab-reply-door';
import { ReplyPanel } from '@/app/[slug]/_components/reply-panel';
import { GUEST_HUB_DESKTOP_CSS } from '@/lib/guest-hub-desktop';
import { replyCardOf } from '@/lib/guest-me-parts';
import { COVER_RSVP_PART, coverRsvpOf } from '@/lib/cover-rsvp';
import { coverEntranceIsStill, resolveCoverEntrance } from '@/lib/cover-entrance';
import { resolveArrivalAction } from '@/lib/arrival-action';
import { ReplyCardRow } from '@/app/[slug]/_components/guest-me-parts';
import { RsvpNoteLines } from '@/app/[slug]/_components/rsvp-note-lines';
import type { GuestRow } from '@/app/[slug]/_lib/types';
import { LANDING_WORDS, landingHeadline } from '@/lib/guest-landing';
import { readRsvpLook, rsvpScreenLayout } from '@/lib/rsvp-look';
import { postEventSceneDrawn } from '@/lib/post-event-scenes';
import { postEventLookOf } from '@/lib/post-event-draft';
import { resolvePostEventStyle } from '@/lib/post-event-style-resolve';
import { LAB_EDITORIAL_COOKIE, labEditorialDraft, labPostEventRead } from '../lab-post-event';
import { LAB_SCRUB_CHAIN, LAB_SCRUB_NAME, labScrubCanvases, labScrubLabel, labWidgetsCookie, type LabScrubScene } from '../lab-scrub';
import { LabScrubBadge } from './scrub-badge';
import { LabDayPages } from './lab-day';
import { LAB_SAMPLE, labEntourage, labDressConfig, labRolePalette, labCaleDressConfig, labCaleRolePalette, labCaleRoleDressConfig, labCaleRoleRolePalette, labSharedAttireDressConfig, labRolesDressConfig, labRolesRolePalette, labCaleIceDressConfig, labCaleIceRolePalette, LAB_CALE_ICE_ROLE_NAMES } from './lab-sample';
import { previewRoleOf } from '@/lib/preview-role';
import { WEDDING_ROLE_SET } from '@/lib/role-sets';
import { LabStagePages } from './lab-stage';
import { LAB_FONTS_COOKIE, LAB_FONTS_LIVE_COOKIE, LAB_NAMES_COOKIE, LAB_OWN_COOKIE, LAB_OWN_SCENE, LAB_ROWS_COOKIE, LAB_SECTIONS_COOKIE, labDraftedRows, labFontsFrom, labNamesFrom, labOwnKind, labSectionsFrom } from '../lab-draft';
import { siteFontLook } from '@/lib/site-role-look';
import { labSeen, labStageTiles } from '../lab-navigator';
import { sceneOnStage } from '@/lib/what-guests-see';
import type { WidgetType } from '@/lib/invitation-widgets';
import { heroCanvasOf } from '@/app/[slug]/_lib/hero-design-of';
import { coverSceneLayer } from '@/app/[slug]/_lib/cover-scene-layer';
import { hubMovingBackgroundIds, type HubCoverGround } from '@/lib/hub-canvas';
import { heroDesignOf } from '@/lib/hero-design';
import { DressCodeWidget } from '@/app/[slug]/_components/dress-code-widget';
import { EntourageSection } from '@/app/[slug]/_components/entourage-section';
import { marchPlaceOf } from '@/lib/march-place';
import { HeldPassLine } from '@/app/[slug]/_components/held-pass-line';
import { NotYouSwitch } from '@/app/[slug]/_components/not-you-switch';
import { passIsHonoured, passStanding, type PassAccountFacts } from '@/lib/pass-account-rule';
import { labPhotoUrls } from './lab-photos';
import { CoverSceneMenuWaits } from '@/app/[slug]/_components/cover-scene-menu';
import { RevealMount } from '@/app/[slug]/_components/reveal/reveal-mount';
import { revealOnlyOnTheFirstPage } from '@/lib/reveal-stages';
import type { LifecyclePhase } from '@/lib/invitation-widgets';
import { CoverPlayOpening } from '@/app/[slug]/_components/reveal/cover-play-opening';
import { DEFAULT_REVEAL_CONFIG } from '@/lib/reveal-config-pure';
import { DEFAULT_REVEAL_EFFECTS, type RevealEffects } from '@/lib/std-reveal-effects';
import { withVeilFold, withVeilWeave, withVeilWind } from '@/lib/veil-style';

/** maria-and-jose's run of show and venues (read-only shape, 2026-10-05) — the lab has no database. */
const LAB_BLOCK = (i: number, label: string, at: string, location: string | null, type = 'pre_ceremony') => ({
  block_id: `lab-${i}`, public_id: `lab-${i}`, event_id: 'lab', label, block_type: type, start_at: `2026-12-12T${at}:00Z`, end_at: null,
  location, notes: null, is_public: true, sort_order: i, parent_block_id: null, created_at: '2026-10-01T00:00:00Z',
  run_state: 'upcoming', actual_start_at: null, actual_end_at: null, audience: null,
});
const LAB_BLOCKS = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(4, 'Dinner & dancing', '19:00', 'Seda Vertis North', 'reception'),
];
/** 🎚 The Scrub chain's run of show (`?scrub=1`): eight moments — a list long enough to be scrolled THROUGH, row by row. */
const LAB_BLOCKS_LONG = [
  LAB_BLOCK(1, 'Guests arrive', '14:30', 'Santuario de San Antonio'),
  LAB_BLOCK(2, 'Ceremony', '15:00', 'Santuario de San Antonio', 'ceremony'),
  LAB_BLOCK(3, 'Photos with the families', '16:00', 'Santuario de San Antonio'),
  LAB_BLOCK(4, 'Cocktails', '17:30', 'Seda Vertis North', 'cocktails'),
  LAB_BLOCK(5, 'Grand entrance', '18:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(6, 'Dinner', '19:00', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(7, 'First dance', '20:30', 'Seda Vertis North', 'reception'),
  LAB_BLOCK(8, 'Send-off', '22:00', 'Seda Vertis North', 'reception'),
];
const LAB_VENUE_EVENT = {
  event_date: '2026-12-12',
  venues: [
    { role: 'ceremony', name: 'Santuario de San Antonio', address: 'McKinley Rd, Forbes Park, Makati', latitude: 14.5476, longitude: 121.0335 },
    { role: 'reception', name: 'Seda Vertis North', address: '1 Astra Way, Vertis North, Quezon City', latitude: 14.6537, longitude: 121.0367 },
  ],
};
/** 🖼 …with a picture on each (`lab_pictures=1`): Setnayan's own ready-made stills, never anybody's photo. */
const LAB_VENUE_EVENT_PICTURED = {
  ...LAB_VENUE_EVENT,
  venues: LAB_VENUE_EVENT.venues.map((v, i) => ({ ...v, photoUrl: i === 0 ? '/std/backgrounds/rose-archway.webp' : '/std/backgrounds/ballroom.webp' })),
};

/** The canvas keys whose node draws its own marker (the guest stand-ins), or has none (the March — `#site-entourage`). */
const STAGE_SELF_MARKED = ['f:greeting', 'f:pass', 'f:rsvp', 'f:entourage'] as const;

/** The public ready-made scene photo the lab's scene backgrounds use, as its own URL (a legacy ref is served verbatim). */
const LAB_MEDIA = { '/std/backgrounds/golden-hour.webp': '/std/backgrounds/golden-hour.webp' };

/**
 * 🧑 THE LAB'S SAMPLE GUEST — nobody's row: the reply pages are drawn by their REAL components here (the reply card,
 * the note after a reply), and those are drawn for a guest.
 */
const LAB_GUEST = {
  guest_id: 'lab-guest',
  first_name: 'Teresita',
  last_name: 'Aquino',
  display_name: null,
  rsvp_status: 'pending',
  meal_preference: null,
  dietary_restrictions: null,
  guest_note: null,
  email: null,
  mobile: null,
  plus_one_allowed: false,
  plus_one_count: 0,
  qr_token: 'lab',
  photo_source: null,
  photo_url: null,
} as unknown as GuestRow;

/**
 * The Reply door's own save, as `invite/reply` hands it to the card — for nobody's event and nobody's guest. On the
 * Maker's canvas the bridge stops every send before it is one; this is here so the card is drawn as the DOOR draws it
 * (a card inside a door: no letterpress head of its own). A save of the lab's own that read nothing was a real
 * finding of the Root map ("sends rsvp_status, but labReply never reads it") — so it is the real one, not a stand-in.
 */
const labReply = submitInviteReply.bind(null, 'lab', 'lab-guest');

/**
 * `?look=<json>` — a stored `rsvp_ask_config.look` to draw the lab's reply screens with, as the SERVER draws a guest's
 * (the Maker lays its own changes on the page live; this is how the lab is asked for a page that was saved). Read by
 * the same one strict reader as everything else, so a bad value is simply the page's own.
 */
function labRsvpConfig(raw: string | string[] | undefined): { look: unknown } | null {
  if (typeof raw !== 'string') return null;
  try {
    return { look: JSON.parse(raw) };
  } catch {
    return null;
  }
}

/**
 * 🏷 THE TAB'S TITLE, AS A REAL GUEST PAGE WORDS IT (`app/[slug]/page.tsx` `generateMetadata`, the title a page that
 * does not name the couple wears: the event type's own word + "invitation" — "Wedding invitation"). The lab's guest
 * page had no title of its own, so its tab read the SITE's default line (the walk of 2026-10-11, M16). That line —
 * the brand's — is not this file's to change.
 */
/** 🧪 The lab's loop stand-ins (the Maker lab's own, `../page.tsx`): files this repo ships, by the loop's place. */
const LAB_STILLS = ['ballroom', 'starlit', 'fairy-lights', 'rose-archway', 'seascape', 'sunrise', 'aurora', 'peonies', 'bridgerton'];
const LAB_CLIPS = ['jack-jill-vclip', 'jack-rose-vclip', 'maria-juan-vclip', 'john-jane-vclip', 'peter-mary-vclip'];
function labLoopMedia(loop: string): { still: string; clip: string } | null {
  const i = hubMovingBackgroundIds().indexOf(loop as never);
  return i < 0 ? null : { still: `/std/backgrounds/${LAB_STILLS[i % LAB_STILLS.length]}.webp`, clip: `/realstories/${LAB_CLIPS[i % LAB_CLIPS.length]}.mp4` };
}
/**
 * 🖼 The lab's HERO PHOTO for a Cover Scene "Your photo" pick — the real page draws the hero photo it resolved
 * (`coverSceneLayer`'s `heroPhotoUrl`), which the lab has none of, so a photo ground drew nothing and a Style card
 * over a photo could not be seen here (2026-10-16, "small caps shows a weird photo"). The picked ref's local file
 * (`../lab-own-media.ts`), else a stand-in of fabric on sand — never anybody's own photo, nothing signed.
 */
const LAB_COVER_PHOTO = '/realstories/jack-jill-g3.jpg';
/** 🖼 The cover plate's stand-in (`lab_plate=1`) — the ready-made ballroom still the Scene ◆ backgrounds ship. */
const LAB_PLATE_PHOTO = '/std/backgrounds/ballroom.webp';
function labCoverPhoto(g: { kind: string; media?: string } | null | undefined): string | null {
  if (!g || g.kind !== 'photo') return null;
  return (g.media && LAB_SIGNED[g.media]) || LAB_COVER_PHOTO;
}

/**
 * 🖼 The Cover Scene's layer as the real page lays it (`coverSceneLayer`) — and, for the couple's own CLIP, its still
 * and its file from the lab's local stand-ins (`LAB_SIGNED`: the lab has no public media host, so the real resolver
 * finds neither and the cover would fall back to The theme's own). The veil, scrim and tone are the real resolver's,
 * worked out for the same ground as a photo (a clip and a photo are measured alike, `coverGroundSamples`).
 */
function labCoverLayer(g: HubCoverGround | undefined) {
  const layer = coverSceneLayer(g, { heroPhotoUrl: labCoverPhoto(g), loopMedia: labLoopMedia });
  if (g?.kind !== 'snippet') return layer;
  const still = (g.poster && LAB_SIGNED[g.poster]) || null;
  const clip = LAB_SIGNED[g.media] ?? null;
  if (!still && !clip) return layer;
  const asPhoto = coverSceneLayer({ kind: 'photo', media: g.media, ...(g.shade !== undefined ? { shade: g.shade } : {}) }, { heroPhotoUrl: still ?? clip });
  return asPhoto ? { ...asPhoto, still, clip, parallax: false } : layer;
}

export async function generateMetadata(): Promise<Metadata> {
  const words = await eventWordsFor('wedding').catch(() => null);
  return { title: `${(words?.eventWord ?? 'event').replace(/^./, (c) => c.toUpperCase())} invitation`, robots: { index: false, follow: false } };
}

/** maria-and-jose's board stand-in — Oxblood & olive, the prototype's first palette. */
const LAB_BOARD = ['#5B1A22', '#6B7A3A', '#E0A52B', '#8E2E3C', '#F2C8C2'];

/**
 * /dev/maker-lab/guest — the Maker lab's CANVAS stand-in: maria-and-jose's
 * page, same words and shape (read-only from production, 2026-10-05), drawn
 * here because the real guest page needs the database the lab does not have.
 * DEV-ONLY: production builds 404 it.
 */
function labVeil(sp: Record<string, string | string[] | undefined>): RevealEffects | undefined {
  const fold = sp.fold === 'light' || sp.fold === 'full' ? sp.fold : null;
  const weave = sp.weave === 'fine' || sp.weave === 'dense' ? sp.weave : null;
  const wind = sp.wind === 'still' || sp.wind === 'gusty' ? sp.wind : null;
  const colour = typeof sp.veilcolour === 'string' && /^[0-9a-fA-F]{6}$/.test(sp.veilcolour) ? `#${sp.veilcolour}` : null;
  if (!fold && !weave && !wind && !colour) return undefined;
  let e: RevealEffects = { ...DEFAULT_REVEAL_EFFECTS, veilColor: colour };
  if (fold) e = withVeilFold(e, fold);
  if (weave) e = withVeilWeave(e, weave);
  if (wind) e = withVeilWind(e, wind);
  return e;
}

export default async function MakerLabGuestPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const sp = await searchParams;
  /* 🧵 `&fold=light|full · &weave=fine|dense · &wind=still|gusty · &veilcolour=RRGGBB` — the couple's Sheer veil choices
     (Cover Scene › Style, `lib/veil-style.ts`) laid into the effects the veil plays, exactly as the event's
     `std_reveal_effects` carries them, so each can be walked without a database. None given → today's veil. */
  const labVeilEffects = labVeil(sp);
  /* 🎁 `?wish=…` — the guest's wish list on fixtures (`wish-lab.tsx`), instead of the canvas. */
  if (typeof sp.wish === 'string') {
    return <WishLab state={sp.wish} look={typeof sp.look === 'string' ? sp.look : undefined} known={sp.known !== '0'} named={sp.name !== '0'} mine={sp.mine === '1'} blocked={sp.blocked === '1'} />;
  }
  /* 📬 `?replycard=open|going|not_yet|closed` — the Event Hub's Welcome Reply card (`ReplyCardRow` from
     `replyCardOf`, the page's own two) in each state of the couple's reply window, on the lab's house ground. */
  if (typeof sp.replycard === 'string') {
    /* 🖥 `&desk=1` — the guest page's desk gate on (`guestDesk`): the desk style and the Reply side panel
       (`reply-panel.tsx`) as the page mounts them, the panel framing the lab's reply page (`?rsvp=form&door=1`, never
       pressed Send — its save is the real one). `&rsvp=ok|details|refused` — the invitation the panel hands back after
       a saved reply: the replied card, under the Event Hub's own words for it. */
    const desk = sp.desk === '1';
    const replied = sp.rsvp === 'ok' || sp.rsvp === 'details' || sp.rsvp === 'refused';
    const state = replied ? 'going' : sp.replycard;
    const card = replyCardOf({
      action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: state === 'going' ? 'attending' : 'pending', eventDate: '2026-12-12', today: '2026-10-14', hasPass: true }),
      replyBy: 'Saturday, December 5, 2026',
      seats: 1,
      window: labWindow(state) ?? undefined,
      organizer: 'the couple',
    });
    return (
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-[480px] flex-col items-center gap-6 bg-cream px-4 pt-24 text-center" data-lab-replycard={state}>
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        <p className="text-xs uppercase tracking-[0.28em] text-ink/60">Together with their families</p>
        <h1 className="font-pahina text-5xl font-light leading-tight text-ink">Maria &amp; Jose</h1>
        <p className="text-sm text-ink/70">Saturday, December 12, 2026 · Seda Vertis North</p>
        {replied ? (
          <p role="status" data-lab-replied={String(sp.rsvp)} className="text-sm text-ink/70">
            Your reply is in — thank you.
          </p>
        ) : null}
        {card ? <ReplyCardRow card={card} /> : null}
        {desk ? (
          <>
            <style data-guest-desk="">{GUEST_HUB_DESKTOP_CSS}</style>
            <ReplyPanel replyPath="/maria-and-jose/invite/reply" thanksPath="/maria-and-jose/invite/enter" frameHref="/dev/maker-lab/guest?rsvp=form&door=1" />
          </>
        ) : null}
      </main>
    );
  }
  /* 🎞 `?photos=<n>` — the couple's Photos scene with n stand-in pictures (our own drawn gradients, never anybody's
     photo), in `&gstyle=` (mosaic · grid · film-strip · glimpse) with `&heading=` (and `&pe=1` for Post Event's gallery preview) — the REAL `OurPhotosWidget`, so the
     Glimpse rail, its drift and the shipped full-screen viewer are walked with no database. */
  if (typeof sp.photos === 'string') {
    const n = Math.max(1, Math.min(24, Number(sp.photos) || 5));
    const urls = labPhotoUrls(n);
    const gstyle = typeof sp.gstyle === 'string' ? sp.gstyle : 'glimpse';
    const heading = typeof sp.heading === 'string' && sp.heading.trim() ? sp.heading.trim() : null;
    /* `&pe=1` — the SAME pictures as Post Event's gallery PREVIEW inside the real open-up (the preview is the open-up's
       button, so Glimpse draws its non-interactive form): `GalleryPreview` + `OpenUpScene`, the page's own pair. */
    if (sp.pe === '1') {
      return (
        <main className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[860px] bg-cream py-10 text-ink" data-lab-photos={n} data-lab-pe="">
          <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
          <div className="px-5 sm:px-10">
            <OpenUpScene
              kind="gallery"
              title="From the Day"
              eyebrow="Maria · the gallery"
              openLabel={`Open the gallery · ${n} ${n === 1 ? 'photo' : 'photos'}`}
              preview={<GalleryPreview style={gstyle} photos={urls} total={n} names="Maria" words={{}} />}
            >
              <p className="py-20 text-center text-sm text-ink/70">The whole gallery opens here.</p>
            </OpenUpScene>
          </div>
          <div className="h-[120vh]" aria-hidden />
        </main>
      );
    }
    return (
      <main className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[860px] bg-cream px-4 py-10 text-ink" data-lab-photos={n}>
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        <OurPhotosWidget urls={urls} sceneStyle={gstyle} heading={heading} />
        <p className="mt-16 text-center text-xs text-ink/60">Below the photos — scroll past to take the rail off screen.</p>
        <div className="h-[120vh]" aria-hidden />
      </main>
    );
  }
  /* ⛪ `?venues=<style>` (default · photo-card · full-photo · journey) — the REAL `VenueWidget` with cale-ice's two venue
     NAMES (the names only — no address, no pin, no photo of theirs), as a guest who has not replied sees them.
     `&parish=0` swaps the ceremony for a church with no drawing; `&photo=1` gives both cards a stand-in photo (a file
     this repo ships); `&drawing=1` is the couple having PICKED "Our drawing ◆" on the ceremony card (owner 2026-10-16 —
     without it the drawing never shows); `&art=candlelight` draws it on the dark Look.
     📍 `&map=1` — a guest who HAS replied, with the Map on: the lab's two far-apart stand-in pins (`LAB_VENUE_EVENT` —
     Makati and Vertis North, not anybody's stored pins); `&unpinned=ceremony|reception` takes that venue's pin away
     (owner 2026-10-21, cale-ice's ceremony had none — `every-venue-is-on-the-map-or-says-so.test.ts`). */
  if (typeof sp.venues === 'string') {
    const style = sp.venues === 'default' ? null : sp.venues;
    const photo = sp.photo === '1' ? LAB_COVER_PHOTO : null;
    const mapped = sp.map === '1';
    const pinOf = (i: 0 | 1, role: string) => {
      const v = LAB_VENUE_EVENT.venues[i]!;
      return mapped && sp.unpinned !== role
        ? { address: v.address, latitude: v.latitude, longitude: v.longitude }
        : { address: mapped ? v.address : null, latitude: null, longitude: null };
    };
    const event = {
      event_date: '2026-12-18',
      venue_withheld: !mapped,
      venues: [
        { role: 'ceremony', name: sp.parish === '0' ? 'Santuario de San Antonio' : 'Santuario de San Vicente de Paul Parish', ...pinOf(0, 'ceremony'), photoUrl: photo, ...(sp.drawing === '1' ? { drawingChosen: true } : {}) },
        { role: 'reception', name: 'Seda Hotel Vertis North', ...pinOf(1, 'reception'), photoUrl: photo },
      ],
    };
    return (
      <main
        className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[860px] bg-cream px-4 py-10 text-ink"
        data-art={sp.art === 'candlelight' ? 'candlelight' : undefined}
        data-lab-venues={sp.venues}
      >
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        <VenueWidget event={event as never} sceneStyle={style} map={mapped ? 'one' : 'none'} />
      </main>
    );
  }
  /* 🗣 `?love=<style>` (chapters · essay · years · conversation · timeline · cards) — the REAL `OurLoveStoryWidget` on the
     lab's own Love Story (`love-story-fixture.ts`: both voices · one voice · none; three photos · one photo), partners
     Maria · Jose, the lab's stand-in photos. `&entrance=1` gives the scene an Animate entrance (◆ Pro), so the look's choreography plays;
     `&dark=1` draws it on the dark Look. Invented words and names only. */
  if (typeof sp.love === 'string') {
    const style = sp.love === 'default' ? null : sp.love;
    return (
      <main
        className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[860px] bg-cream px-5 py-10 text-ink"
        data-art={sp.dark === '1' ? 'candlelight' : undefined}
        data-lab-love={sp.love}
      >
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🔲 `&empty=1` — this look's SAMPLE SHAPES, the arrangement the Maker's canvas draws for the scene while it is
            empty (the `data-maker-section` marker is what lets a sample show at all). The shapes alone, not the
            empty-scene stand-in: that one is mounted only behind `makerCanvas` (P11). */}
        {sp.empty === '1' ? (
          <div data-maker-section="our_love_story" data-maker-empty="our_love_story">
            <SceneSample sceneType="our_love_story" styleId={style} className="py-2" />
          </div>
        ) : (
          <OurLoveStoryWidget config={LAB_LOVE_STORY} mediaUrls={LAB_PHOTOS} sceneStyle={style} partners={['Maria', 'Jose']} entrance={sp.entrance === '1'} />
        )}
        <div className="h-[40vh]" aria-hidden />
      </main>
    );
  }
  /* 🧍 `?entourage=<style>` (default · roll-call · lines · march) — the REAL `EntourageSection` on the lone-person cast
     (`labEntourage('lone')`: a lone Ninang, Coin sponsor, Bridesmaid, Ring Bearer and Flower Girl beside the pairs),
     in a phone column; `&art=candlelight` draws it on the dark Look; `&cast=cale` swaps in cale-ice's parents' shape
     (`labEntourage('cale')`); `&titles=1` the parents' titles picked with woman / man (`labEntourage('titles')`).
     Stand-in names only. */
  /* 🫵 `&me=<lab guest id>` (owner 2026-10-17, "so they can see where they are"): read as THAT guest — Me's real
     "Your role" block (with its "See where you are ↓") above, and their own name marked in the entourage below
     (`entourage-you.tsx`). No `me` = a stranger. Stand-in names only. */
  /* 🪪 `?heldpass=<case>` (owner bug 2026-10-19 — "why was milagros highlighted when i was not logged in on her?"):
     this browser holds the pass of the groom's MOTHER (the cale cast's `gp2`, in Milagros's shape — she walks 2nd,
     beside her husband), and the REAL rule (`passStanding`, lib/pass-account-rule.ts) decides who is looking, from
     lab facts (no database): `host` (signed in as the groom, a host) · `seat` (signed in as a bridesmaid, bound to her
     own row) · `held` (signed in, her row bound to another account) · `signedout` · `hostpreview` (the host pressed
     "Open as …"). Drawn: Me's line, the reply's "Not you? Switch" row, and the entourage with whoever is marked.
     Stand-in names only. The forms are the real ones — the lab is never pressed. */
  if (typeof sp.heldpass === 'string') {
    const groups = labEntourage('cale');
    const PASS = 'gp2';
    const people = groups.flatMap((g) => g.rows.flat());
    const nameOf = (id: string | null) => {
      const p = people.find((x) => x?.id === id);
      return p ? p.name : null;
    };
    const kase = sp.heldpass;
    const facts: Record<string, PassAccountFacts> = {
      host: { ownGuestIds: ['groom-row'], isHost: true, passRowHolders: [] },
      hostpreview: { ownGuestIds: ['groom-row'], isHost: true, passRowHolders: [] },
      seat: { ownGuestIds: ['bmaid1'], isHost: false, passRowHolders: [] },
      held: { ownGuestIds: [], isHost: false, passRowHolders: ['another-account'] },
    };
    const standing = passStanding({
      userId: kase === 'signedout' ? null : 'lab-account',
      passGuestId: PASS,
      facts: facts[kase] ?? null,
      hostPreviewGuestId: kase === 'hostpreview' ? PASS : null,
    });
    const viewerId = passIsHonoured(standing) ? PASS : standing === 'set_aside_seat' ? 'bmaid1' : null;
    const viewerName = kase === 'host' ? 'Jose (the groom, host)' : nameOf(viewerId) ?? 'Signed in, not on the list';
    const line =
      standing === 'host_preview' ? (
        <HeldPassLine slug="maria-and-jose" firstName="Eufemia" mode="host_preview" />
      ) : passIsHonoured(standing) ? null : (
        <HeldPassLine slug="maria-and-jose" firstName="Eufemia" mode={standing === 'set_aside_host' ? 'set_aside_host' : 'set_aside'} />
      );
    return (
      <main className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[480px] bg-cream px-4 py-10 text-ink" data-lab-heldpass={kase} data-lab-standing={standing}>
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        <section className="mb-10" data-lab-part="me">
          <p className="text-xs uppercase tracking-[0.16em] text-ink/60">Me</p>
          <p className="mt-1 font-serif text-lg">{viewerName}</p>
          {line ? <div className="mt-3">{line}</div> : null}
        </section>
        {viewerId ? (
          <section className="mb-10 border-t border-ink/10 pt-6" data-lab-part="reply">
            <p className="text-xs uppercase tracking-[0.16em] text-ink/60">Reply</p>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="font-serif text-lg text-ink" data-reply-for="">{nameOf(viewerId)}</p>
              <NotYouSwitch slug="maria-and-jose" />
            </div>
            {line ? <div className="mt-2">{line}</div> : null}
          </section>
        ) : null}
        <EntourageSection groups={groups} id="site-entourage" sceneStyle="march" myGuestId={viewerId} />
        <div className="h-[30vh]" aria-hidden />
      </main>
    );
  }
  if (typeof sp.entourage === 'string') {
    const style = sp.entourage === 'default' ? null : sp.entourage;
    /* 🏷 `&sections=vip` — Immediate Family renamed "VIP" (owner 2026-10-19); `&sections=usual` — the same cast, no word. */
    const groups = labEntourage(sp.sections === 'vip' ? 'vip' : sp.sections === 'usual' ? 'vip-usual' : sp.cast === 'cale' ? 'cale' : sp.cast === 'man' ? 'man' : sp.titles === '1' ? 'titles' : 'lone');
    const me = typeof sp.me === 'string' && sp.me ? sp.me : null;
    const meRole = me ? (groups.flatMap((g) => g.rows.flat()).find((p) => p?.id === me)?.role ?? null) : null;
    return (
      <main
        className="sn-editorial pahina-in mx-auto min-h-[100dvh] w-full max-w-[480px] bg-cream px-4 py-10 text-ink"
        data-art={sp.art === 'candlelight' ? 'candlelight' : undefined}
        data-lab-entourage={sp.entourage}
      >
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {meRole ? (
          <div className="mb-10">
            <DressCodeWidget
              words={await eventWordsFor('wedding').catch(() => null) as never}
              config={null}
              ceremonyType={null}
              genderSeparation={null}
              part="role"
              guestRole={meRole}
              march={marchPlaceOf(groups, me)}
              hideWhenEmpty
            />
          </div>
        ) : null}
        <EntourageSection groups={groups} id="site-entourage" sceneStyle={style} myGuestId={me} />
        <div className="h-[60vh]" aria-hidden />
      </main>
    );
  }
  const rsvp = typeof sp.rsvp === 'string' ? sp.rsvp : null;
  /* 🎉 `?play=<pick>` plays the When yes celebration as a guest who just said
     yes (`&freeze=<s>` holds one still frame for a screenshot); without it the
     thank-you listens to the Maker, as the real one does on the stage. */
  const play = typeof sp.play === 'string' && isRsvpCelebration(sp.play) ? sp.play : null;
  const freeze = typeof sp.freeze === 'string' && Number.isFinite(Number(sp.freeze)) ? Number(sp.freeze) : undefined;
  const phase = typeof sp.phase === 'string' ? sp.phase : 'rsvp';
  /* 🎞 The lab's drafted Main background (a cookie the lab's draft stand-in
     sets), drawn by the REAL guest layer — `mainGroundLayerFor`, on the host's
     canvas (`tryOn`), Classic like maria-and-jose. A moving background needs no
     database on this path. */
  let main: unknown = null;
  try {
    main = JSON.parse(decodeURIComponent((await cookies()).get('lab_main')?.value ?? 'null'));
  } catch {
    main = null;
  }
  const ground = main
    ? await mainGroundLayerFor({
        theme: 'house',
        heroConfig: { main },
        event: { event_id: '00000000-0000-4000-8000-000000000000' },
        viewerIsHost: true,
        tryOn: true,
        /* 🖼🎬 The lab's own photo and hero video (`../lab-own-media.ts`) — local addresses, nothing signed. */
        signed: { ...LAB_SIGNED },
      })
    : null;
  /* 🎨 The lab's drafted scene canvases (`lab_widgets`, the lab's save
     stand-in) — each scene drawn below wears its drafted Style through the
     REAL resolver (`sceneStyleOfRow`) and the REAL widget, as the guest page does. */
  /* 🎚 `?scrub=1` (the Maker reaches it as `./scrub`): the lab's scenes as the Scrub chain (`../lab-scrub.ts`),
     drawn through the guest page's own renderer — see the chain below. */
  const scrub = sp.scrub === '1';
  let drafted: Record<string, unknown> = {};
  try {
    drafted = JSON.parse(decodeURIComponent((await cookies()).get(labWidgetsCookie(scrub))?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    drafted = {};
  }
  drafted = labScrubCanvases(scrub, drafted);
  /* ⏱ A `lab_slow` cookie: the canvas page takes as long as production's to arrive. */
  if ((await cookies()).get('lab_slow')?.value === '1') await new Promise((r) => setTimeout(r, 2500));
  /* 👂 A `lab_nobridge=1` cookie: the canvas draws WITHOUT its bridge — the page the owner's Safari got on 2026-10-18
     ("cannot select again"), so the Maker's silent-canvas watch (`canvas-bridge-watch.ts`) can be walked. */
  const labNoBridge = (await cookies()).get('lab_nobridge')?.value === '1';
  const labPhoto = (await cookies()).get('lab_photo')?.value === '1';
  const labCast = (await cookies()).get('lab_cast')?.value === 'standin' ? 'standin' : 'sample';
  const stage: HubStage | null = (HUB_STAGES as readonly string[]).includes(phase) ? (phase as HubStage) : null;
  /* 🖼 A style's true miniature (`?only=` + `?style=`), as the real canvas honours them — the lab is a host canvas. */
  const only = canvasOnlyScene({ only: typeof sp.only === 'string' ? sp.only : undefined }, true);
  const preview = canvasStylePreview({ style: typeof sp.style === 'string' ? sp.style : undefined }, true);
  /* 🎨 The lab's drafted part styles (`lab_styles`, the lab's `fixedStyles` stand-in), the preview's laid on top. */
  /* 🧱 The lab's drafted block looks (`lab_blocks`, the stand-in for `style_preferences.block_looks`). */
  let labBlocks: unknown = {};
  try {
    labBlocks = JSON.parse(decodeURIComponent((await cookies()).get('lab_blocks')?.value ?? '{}')) as unknown;
  } catch {
    labBlocks = {};
  }
  let labStyles: Record<string, unknown> = {};
  try {
    labStyles = JSON.parse(decodeURIComponent((await cookies()).get('lab_styles')?.value ?? '{}')) as Record<string, unknown>;
  } catch {
    labStyles = {};
  }
  const { event: labEvent, widgets: labRows } = withStylePreview(
    { style_preferences: { scene_styles: labStyles } },
    Object.keys({ ...drafted, countdown: 1, special_message: 1, schedule: 1, venue_map: 1, dress_code: 1, our_love_story: 1 }).map((t) => ({ widget_type: t, config_json: { canvas: drafted[t] ?? {} } })),
    preview,
  );
  const rowOf = (type: string) => labRows.find((r) => r.widget_type === type) ?? { widget_type: type, config_json: { canvas: {} } };
  const look = (type: StyledScene) => partLookAttr(type, fixedSceneStyleOf(labEvent.style_preferences, type, stage, 'wedding'));
  const heroLooks = Object.fromEntries(
    (Object.entries(HERO_PART_LOOK) as Array<[keyof typeof HERO_PART_LOOK, StyledScene]>).flatMap(([part, type]) => {
      const v = look(type);
      return v ? [[part, v]] : [];
    }),
  );
  const words = await eventWordsFor('wedding').catch(() => null);
  /* 🎞 The lab's Post Event story as guests would meet it: the scenes drawn, in the run's order, each with the marker
     its tile scrolls to, the style it is drawn in and the couple's own words where they wrote some. */
  const labStory = phase === 'editorial' ? labPostEventRead(labEditorialDraft((await cookies()).get(LAB_EDITORIAL_COOKIE)?.value)) : null;
  let chaptersMarked = false;
  const postEventScenes = (labStory?.rows ?? [])
    .filter((r) => postEventSceneDrawn(r.status, r.hidden))
    .map((r) => {
      const chapter = r.block === 'chapters';
      const marker = chapter ? (chaptersMarked ? null : 'ch-1') : r.key;
      if (chapter) chaptersMarked = true;
      const look = postEventLookOf(labStory!.arrangement, r.key);
      return { key: r.key, name: r.name, source: r.source, marker, style: resolvePostEventStyle(r.key, look.style, 'wedding'), words: look.words ?? null };
    });
  /* On the chain the markers are drawn as the REAL page draws them — on the Maker's canvas only (`site-body.tsx`
     `makerMark`). The Scrub island reads them: a page that has one is being edited, and holds nothing until ▶ is
     held (`hub-scrub.tsx`); the same address opened plainly is a guest's page, and its hand-overs run. */
  const mark = (key: string) => (scrub && sp.editor !== '1' ? null : <span hidden data-maker-section={key} />);
  /** The Maker's canvas (`?editor=1`) — the only reader the canvas's own stand-ins are drawn for. */
  const makerCanvas = sp.editor === '1';
  /* 🗂 THE STAGE'S OWN PARTS, IN THE MAKER'S ORDER (`../lab-navigator.ts` — the real `makerStageLists` on the sample's
     rows with the lab's draft over them): a stage draws what the Maker lists for it and nothing else, a scene moved
     Earlier · Later is drawn where it now stands, and one taken off is not drawn (P02 · P12). */
  const stageNow: HubStage = stage ?? 'rsvp';
  const labRowsNow = labDraftedRows((await cookies()).get(LAB_ROWS_COOKIE)?.value, labOwnKind((await cookies()).get(LAB_OWN_COOKIE)?.value));
  const stageTiles = labStageTiles(labRowsNow, stageNow, labStory);
  /* 🗓 DOES THE DAY DRAW THIS SCENE? — its own list, or one of the two places off it (the Welcome's dress code and
     reminders, a guest's own schedule and directions): the page's one answer (`sceneOnStage`), on the lab's rows
     with its draft over them. The lab's Day drew a fixed set — the gallery always, whatever the table said (the walk
     of 2026-10-11, M08: "Our photos × The Day EMPTY but drawn"). */
  /* 🖼 `lab_pictures=1`: The Day draws the lab's gallery (its pictures' effects are tried there). */
  const dayGallery = (await cookies()).get('lab_pictures')?.value === '1';
  const dayDraws = (type: WidgetType): boolean =>
    (dayGallery && type === 'our_photos') ||
    stageTiles.includes(`w:${type}`) || (sceneOnStage({ ...labSeen(labRowsNow), stage: 'event', reader: 'guest' }, type)?.offList ?? null) !== null;
  /* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) — ONE mount for every page of the lab's canvas, wearing
     the hero row's drafted canvas as the real page does (`site-body.tsx` `heroElements`): a typed Title, a part's
     colour, size and motion, the design picked. The lab's masthead read none of it, so a typed Title was gone at the
     next reload — and an Undo of it could not be seen (the walk of 2026-10-11, P01 · P05). */
  const heroCanvas = heroCanvasOf([rowOf('hero')] as never);
  /* ✍ The cover draws the DRAFTED names, as the real canvas does — so a cover drawn for one name can be typed into. */
  const labNames = labNamesFrom((await cookies()).get(LAB_NAMES_COOKIE)?.value, LAB_SAMPLE.names);
  /* 🔤 The drafted fonts, worn as the real canvas wears them (`HostDraftLook` → the scope's `data-hub-roles` and its inline
     bag): the guest page's own `siteFontLook`, so the Names font reaches every `[data-hub-names]` here too. */
  const fontScopeOf = (value: string | undefined) => {
    const f = labFontsFrom(value);
    const look = siteFontLook(f.site_font_key, f.site_roles);
    return { 'data-guest-look': '', 'data-hub-roles': look.marks ?? undefined, style: Object.keys(look.vars).length > 0 ? look.vars : undefined };
  };
  /* The published fonts (the layout's scope, outside) and — only while the draft holds a font — the drafted ones (the
     canvas's `HostDraftLook`, inside): the real canvas's two layers, so what the inner one leaves unsaid is inherited. */
  const labFontLive = fontScopeOf((await cookies()).get(LAB_FONTS_LIVE_COOKIE)?.value);
  const labFontsCookie = (await cookies()).get(LAB_FONTS_COOKIE)?.value;
  const labFontScope = labFontsCookie ? fontScopeOf(labFontsCookie) : {};
  /* 🕯 The closing's kit — the lab's look (`lab_kit`) and its drafted Accent picks (`lab_accents`), through the page's
     one decision (`artKitView`), tried on as the host's canvas does. Drawn when the look brings a kit or the Closing's
     Accent is on, exactly as `site-body.tsx` decides. */
  let labAccents: SceneAccents = {};
  try {
    labAccents = sanitizeSceneAccents(JSON.parse(decodeURIComponent((await cookies()).get('lab_accents')?.value ?? '{}')));
  } catch {
    labAccents = {};
  }
  const labKitView = artKitView({ theme: (await cookies()).get('lab_kit')?.value === 'vintage' ? 'vintage' : 'house', accents: labAccents, ownsPro: false, tryOn: true });
  const labKit = labKitView && (labKitView.look || labKitView.pieces.closing?.length) ? labKitView : null;
  /* 🔘 THE COVER'S RSVP BUTTON (owner 2026-10-16), on the Invitation: `&rsvpstate=going|declined|closed|not_yet` draws
     it as that guest would meet it (the real `coverRsvpOf` on the real Reply card); none — a guest who has not replied. */
  const rsvpStateAsked = typeof sp.rsvpstate === 'string' ? sp.rsvpstate : 'ask';
  /* ✉️ `&rsvpstate=more` / `more1` — coming, with 2 / 1 of the couple's switched-on answers still owed (owner 2026-10-20,
     "You're coming ✓ · N more answers"): the same guest as `going`, its N handed in as the page hands it (`moreAnswers`). */
  const labMore = rsvpStateAsked === 'more' ? 2 : rsvpStateAsked === 'more1' ? 1 : 0;
  const rsvpState = labMore > 0 ? 'going' : rsvpStateAsked;
  /* 🧭 …and, as on the page, the button TAKES the guest to the RSVP part — the Reply card under the cover (owner
     2026-10-17, *"it is not going to the RSVP part?"*); the Maker's own canvas keeps the doorway it always drew. */
  const labReplyCard =
    stageNow === 'rsvp'
      ? replyCardOf({
          action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: rsvpState === 'going' ? 'attending' : rsvpState === 'declined' ? 'declined' : 'pending', eventDate: '2026-12-12', today: '2026-10-14', hasPass: true }),
          replyBy: null,
          seats: 1,
          window: rsvpState === 'closed' || rsvpState === 'not_yet' ? (labWindow(rsvpState) ?? undefined) : undefined,
          organizer: 'the couple',
          moreAnswers: labMore,
        })
      : null;
  const labRsvp =
    stageNow === 'rsvp'
      ? coverRsvpOf({
          toPart: !makerCanvas,
          card: replyCardOf({
            action: resolveArrivalAction({ slug: 'maria-and-jose', rsvpStatus: rsvpState === 'going' ? 'attending' : rsvpState === 'declined' ? 'declined' : 'pending', eventDate: '2026-12-12', today: '2026-10-14', hasPass: true }),
            replyBy: null,
            seats: 1,
            window: rsvpState === 'closed' || rsvpState === 'not_yet' ? (labWindow(rsvpState) ?? undefined) : undefined,
            organizer: 'the couple',
            moreAnswers: labMore,
          }),
        })
      : null;
  const labPlate = (await cookies()).get('lab_plate')?.value === '1';
  const masthead = (
    <PahinaMasthead
      rsvp={labRsvp}
      /* 📐 The guest's view fits its foot as the page does (owner 2026-10-20); the Maker's own canvas does not. */
      fitFoot={!makerCanvas}
      displayName={labNames}
      eventDate={LAB_SAMPLE.date}
      venueName={LAB_SAMPLE.venueLine}
      eyebrow={LAB_SAMPLE.openingLine}
      elements={resolveCoverEntrance(heroCanvas.entrance, heroCanvas.elements)}
      still={coverEntranceIsStill(heroCanvas.entrance)}
      design={heroDesignOf(heroCanvas)}
      /* 🖼 The Cover Scene's background, as the real page lays it (`site-body.tsx` `heroElements.ground`) — the lab's
         loops wear the stand-in files the Maker lab's Look rows use. */
      ground={labCoverLayer(heroCanvas.ground)}
      stampElements
      looks={Object.keys(heroLooks).length > 0 ? heroLooks : null}
      monogramSlot={
        <span className="flex h-20 w-20 items-center justify-center rounded-full border border-gild font-serif text-2xl italic text-terracotta-700">
          M &amp; J
        </span>
      }
      /* 🖼 `lab_plate=1` (a cookie, so the Maker's own canvas reloads keep it) — the cover's photo PLATE under the words,
         as a couple with a cover photo and no Cover Scene background has it: the `photo` part the six new effects'
         pictures play on (owner-approved 2026-10-16). Setnayan's own ready-made ballroom, never anybody's photo. */
      mediaSlot={labPlate ? <HeroBackgroundMedia photoUrl={LAB_PLATE_PHOTO} /> : undefined}
    />
  );
  /* 👗 The REAL dress code, fed the sample (`./lab-sample.ts`) — the palette look it wears is the one picked in the Maker.
     `?board=cale` feeds it the palette prototype's real eleven colours instead (`&you=1`: as a Principal Sponsor). */
  const cale = sp.board === 'cale';
  /* `?attire=shared` — the sponsors saved with ONE shared, women's Wear before the split (`labSharedAttireDressConfig`); `&you=ninong`: read by a ninong. */
  const sharedAttire = sp.attire === 'shared';
  /* 👔 `?attire=roles` — the per-role designs in cale-ice's colours (`labRolesDressConfig`); `&you=<guest-list role>` reads it as them. */
  const rolesAttire = sp.attire === 'roles';
  /* 🪞 `?attire=cale` — cale-ice's dress code exactly as production held it 2026-10-17 (`labCaleIceDressConfig`);
     `?attire=cale-now` — after the owner's Apply. `&you=<guest-list role>` reads it as them. */
  /* 👯 `?attire=cale-honour` — cale-now with the two honour rows dressed (2026-10-19); with `?as=1&asrole=maid_of_honor`
     the Me › What to wear below reads cale-ice's dress code too (`cale-now`: her own row unset → the Bridesmaids'). */
  /* 🤵‍♂️ `?attire=man-honour` — cale-honour with the man of honor's FOR MEN column dressed (2026-10-19); with
     `?as=1&asrole=man_of_honor-m`, his Me › What to wear. */
  const manHonour = sp.attire === 'man-honour';
  const caleIce = sp.attire === 'cale' || sp.attire === 'cale-now' || sp.attire === 'cale-honour' || manHonour;
  const caleIceHonour = sp.attire === 'cale-honour' || manHonour;
  const caleIceAfter = sp.attire === 'cale-now' || caleIceHonour;
  const one = (k: string) => (typeof sp[k] === 'string' ? (sp[k] as string) : undefined);
  const caleGuestMan = one('gm') === 'barong_tagalog' || one('gm') === 'smart_casual' ? one('gm')! : null;
  const rolesPick = Object.fromEntries(['groom', 'bride', 'men', 'women', 'boys', 'girls', 'gm', 'gw'].map((k) => [k, one(k)]).filter(([, v]) => v));
  /* 🎭 See as · Role ▾ (owner 2026-10-17): the canvas drawn as a sample guest in one role — `?as=` + `?asrole=`, read
     strictly by the page's own reader (`previewRoleOf`). The scene stays the general dress code (as the real page draws
     it for an identified guest); under it, that role's Me › What to wear. */
  const labRole = typeof sp.as === 'string' ? previewRoleOf(one('asrole'), WEDDING_ROLE_SET.offeredRoles) : null;
  const roleDress = caleIce ? (labCaleIceDressConfig(caleIceAfter, caleIceHonour, manHonour, caleGuestMan) as never) : labCaleRoleDressConfig();
  const rolePal = caleIce ? labCaleIceRolePalette(caleIceAfter) : labCaleRoleRolePalette();
  const roleNames = caleIce ? LAB_CALE_ICE_ROLE_NAMES : null;
  const roleWear = words && labRole ? (
    <div data-lab-scene="me-wear" data-lab-role={labRole.key} className="mt-8 border-t border-ink/10 pt-6">
      <p className="mb-3 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-ink/50">Me · {labRole.name}</p>
      <DressCodeWidget words={words} config={roleDress} rolePalette={rolePal} guestRole={labRole.role} guestAttire={labRole.attire} roleNames={roleNames} part="wear" />
      {/* ⏰ Arrive by — the role's call time, the Me part after What to wear (`GUEST_ME_PARTS`), set per row in Studio › Attire;
          anyone without one arrives when GUESTS arrive (the run of show's arrival moment, `guestsArriveTime`, 2026-10-19). */}
      <DressCodeWidget words={words} config={roleDress} rolePalette={rolePal} guestRole={labRole.role} guestAttire={labRole.attire} roleNames={roleNames} part="arrive" guestsArriveBy={guestsArriveTime(LAB_BLOCKS)} />
    </div>
  ) : null;
  /* 👗 DRESS WITH US IS THE READER'S OWN (owner 2026-10-19): the scene drawn as the real page draws it for that reader —
     `&gender=woman|man` is their `guests.gender` (`&gender=unknown`: nothing on their row says it — no attire either); `&reader=host` is the couple on their own Event Hub (every role);
     `?reader=visitor` (no `as`) a visitor not on the list (the Guests card). */
  const dressReader = one('reader');
  const labGender = one('gender') === 'woman' || one('gender') === 'man' ? (one('gender') as 'woman' | 'man') : null;
  const dressCode = words && labRole ? (
    <>
      <DressCodeWidget words={words} config={roleDress} ceremonyType={null} genderSeparation={null} rolePalette={rolePal} guestRole={dressReader === 'host' ? null : labRole.role} guestAttire={dressReader === 'host' || one('gender') === 'unknown' ? null : labRole.attire} guestNameParts={dressReader === 'host' ? null : { gender: labGender }} readerOnly={dressReader !== 'host'} roleNames={roleNames} sceneStyle={sceneStyleOfRow(rowOf('dress_code'), stage, 'wedding')} paletteLook={paletteLookOfRow(rowOf('dress_code'))} dosLook={dosLookOfRow(rowOf('dress_code'))} hideWhenEmpty />
      {roleWear}
    </>
  ) : words ? (
    <DressCodeWidget
      words={words}
      config={caleIce ? (labCaleIceDressConfig(caleIceAfter, caleIceHonour, manHonour, caleGuestMan) as never) : cale ? labCaleDressConfig() : rolesAttire ? labRolesDressConfig(rolesPick as never) : sharedAttire ? labSharedAttireDressConfig(LAB_BOARD) : labDressConfig(LAB_BOARD)}
      ceremonyType={null}
      genderSeparation={null}
      rolePalette={caleIce ? labCaleIceRolePalette(caleIceAfter) : cale ? labCaleRolePalette() : rolesAttire ? labRolesRolePalette() : labRolePalette(LAB_BOARD)}
      guestRole={cale && sp.you === '1' ? 'principal_sponsor_ninang' : sharedAttire && sp.you === 'ninong' ? 'principal_sponsor_ninong' : (rolesAttire || caleIce) && one('you') ? (one('you') as never) : null}
      readerOnly={dressReader === 'visitor'}
      roleNames={caleIce ? LAB_CALE_ICE_ROLE_NAMES : null}
      sceneStyle={sceneStyleOfRow(rowOf('dress_code'), stage, 'wedding')}
      paletteLook={paletteLookOfRow(rowOf('dress_code'))}
      dosLook={dosLookOfRow(rowOf('dress_code'))}
      makerSample={dressReader !== 'visitor'}
      hideWhenEmpty={dressReader === 'visitor'}
    />
  ) : null;
  /* 🚶 The REAL Wedding March (`EntourageSection`, as `site-body.tsx` mounts it): the sample entourage, in its picked Style. */
  const marchBlock = (
    <div data-lab-scene="entourage" className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 The March's own mark, right BEFORE the real block as the real page puts it (`lib/block-looks.ts`) — inside
          the lab's wrapper, so a look lands on the block a guest sees and not on the lab's own padding. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'entourage' }} />
      <EntourageSection groups={labEntourage(labCast, labSectionsFrom((await cookies()).get(LAB_SECTIONS_COOKIE)?.value))} id="site-entourage" sceneStyle={fixedSceneStyleOf(labEvent.style_preferences, 'entourage', stage, 'wedding')} />
    </div>
  );
  const labPictures = (await cookies()).get('lab_pictures')?.value === '1';
  /* 🧩 THE LAB'S SCENES, each drawn ONCE — placed by the ordinary sample below, or (`?scrub=1`) by the Scrub chain. */
  const scene: Record<LabScrubScene | 'our_love_story', ReactNode> = {
    countdown: (
      /* 🌗 In the REAL scene frame, as every scene of the guest page is (`hideable-widget-render.tsx` wraps each in
         `HubCanvasFrame`). The lab drew the Countdown bare, so its Background picked a tile, raised ✓ and drew
         nothing (the walk of 2026-10-11, M11) — the lab's fault alone: the real page has always framed it. */
      <HubCanvasFrame widget={{ ...rowOf('countdown'), widget_id: 'lab-countdown' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <section data-lab-scene="countdown" className="border-t border-ink/10 px-4 py-8">
          {/* 🕯 …with the Countdown's Accent and its own-background rule, as the real mount draws it (`hideable-widget-render.tsx`):
             a scene with a background of its own draws its card bare, and the accent still stands (owner 17 Oct). */}
          <CountdownWidget
            targetIso="2026-12-12"
            timeZone="Asia/Manila"
            sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')}
            bare={sceneWidgetIsBare(rowOf('countdown') as never, LAB_MEDIA, { ownClipPlays: true })}
            kit={labKitView ? <KitSlot kit={labKitView} slot="countdown" /> : null}
          />
        </section>
      </HubCanvasFrame>
    ),
    /* 🧩 AN EMPTY SCENE IS THE MAKER'S CANVAS ALONE (`makerCanvas`), as on the real page (`site-body.tsx`
       `isMakerCanvas`; `maker-empty-scene.tsx`: "A guest never receives this markup"). The lab drew "Only you see this"
       on its guest page whoever asked (the walk of 2026-10-11, P11). */
    /* 🖼 `lab_pictures=1` (a cookie, so the Maker's canvas reloads keep it): the REAL Love Story with the lab's two
       photos, in the REAL scene frame — where its pictures' Reveal ▾ and Light leak ◆ (owner 2026-10-17) are tried. */
    our_love_story: makerCanvas ? (
      labPictures ? (
        <HubCanvasFrame widget={{ ...rowOf('our_love_story'), widget_id: 'lab-love-story' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <section data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8 text-left">
          <OurLoveStoryWidget config={LAB_LOVE_STORY} mediaUrls={LAB_PHOTOS} sceneStyle={sceneStyleOfRow(rowOf('our_love_story'), stage, 'wedding')} partners={['Maria', 'Jose']} />
        </section>
      </HubCanvasFrame>
      ) : (
        <div data-lab-scene="our_love_story" className="border-t border-ink/10 px-4 py-8">
          <MakerEmptyScene type="our_love_story" />
        </div>
      )
    ) : null,
    special_message: (
      /* 🌗 The REAL scene frame (`HubCanvasFrame`): its drafted background, Darker ↔ Lighter and Spacing, as guests see them. */
      <HubCanvasFrame widget={{ ...rowOf('special_message'), widget_id: 'lab-special-message' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <div data-lab-scene="special_message" className="border-t border-ink/10 px-4 py-8 text-left">
          <SpecialMessageWidget
            text="We cannot wait to celebrate with you."
            signedBy="Maria & Jose"
            sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')}
          />
        </div>
      </HubCanvasFrame>
    ),
    schedule: (
      /* 🗓 The day's moments — the REAL Schedule widget on maria-and-jose's run of show, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('schedule'), widget_id: 'lab-schedule' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="schedule" className="border-t border-ink/10 px-4 py-8 text-left">
          <ScheduleWidget blocks={LAB_BLOCKS as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />
        </section>
      </HubCanvasFrame>
    ),
    venue_map: (
      /* 🏛 The REAL Venue widget — the church and the hotel, in its drafted (or previewed) Style. */
      <HubCanvasFrame widget={{ ...rowOf('venue_map'), widget_id: 'lab-venue' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="venue_map" className="border-t border-ink/10 px-4 py-8 text-left">
          <VenueWidget event={(labPictures ? LAB_VENUE_EVENT_PICTURED : LAB_VENUE_EVENT) as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />
        </section>
      </HubCanvasFrame>
    ),
    dress_code: (
      /* 👗 The REAL Dress code (`DressCodeWidget`, as `hideable-widget-render.tsx` draws it for the Maker's canvas) on a
         sample dress code and Mood Board, in its drafted Style, palette look and do's look. */
      <HubCanvasFrame widget={{ ...rowOf('dress_code'), widget_id: 'lab-dress-code' } as never} hubTheme="house" ownClipPlays>
        <section data-lab-scene="dress_code" className="border-t border-ink/10 px-4 py-8 text-left">
          {dressCode}
        </section>
      </HubCanvasFrame>
    ),
  };
  /* 🎁 `lab_gifts=none`: the event has no way to give yet — the Maker's empty E-Gifts, dressed in the picked accent
     (`lab_kit` · `lab_accents`) as `guest-welcome.tsx` draws it on the host's canvas (owner 2026-10-18). */
  const noGifts = (await cookies()).get('lab_gifts')?.value === 'none';
  const giftsBlock = noGifts ? (
    <div data-lab-scene="gifts" className="border-t border-ink/10 px-4 py-8 text-left">
      {labKitView ? <KitSlot kit={labKitView} slot="gifts-divider" /> : null}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'gifts' }} />
      <MakerWelcomeGiftsEmpty look={look('gifts')} kit={labKitView ? <KitSlot kit={labKitView} slot="gifts-card" /> : null} />
    </div>
  ) : (
    /* The lab wraps the gift card; the Maker asks the block's root whether it is the real card (`data-welcome-gifts`),
       so the wrapper says so when the real card is what it holds — else Animate is grey here and cannot be tried. */
    <div data-lab-scene="gifts" {...(words ? { 'data-welcome-gifts': '' } : {})} className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 E-Gifts' own mark, right BEFORE the real block (`lib/block-looks.ts`) — inside the lab's wrapper. 🎁 The block
          is E-Gifts drawn in place, as a guest reads it on Welcome (2026-10-14): the lab's two ways to give and four wishes. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'gifts' }} />
      {words ? <WelcomeGifts href="#gifts" words={words} look={look('gifts')}>
          <WelcomeGiftsContent content={Promise.resolve({ ...labGiftContent(words), wishShape: wishListShape(look('gifts')) })} href="#gifts" words={words} />
        </WelcomeGifts> : <MakerWelcomeGiftsEmpty look={look('gifts')} />}
    </div>
  );
  /* 👤 The Invitation's "Guest's look" — the guest page's own stand-in (the Maker's What to wear part). THE MAKER'S
     CANVAS ONLY, as on the real page (`guest-welcome.tsx`: `maker ? <MakerWelcomeLook/> : null` — "a guest never
     receives this markup"). The lab drew it whoever asked, so its guest preview read "Each guest sees their own look,
     from your Mood Board" to a guest (the walk of 2026-10-11, M15). */
  const lookBlock = makerCanvas ? (
    <div data-lab-scene="look" className="border-t border-ink/10 px-4 py-8 text-left">
      {/* 🧱 What to wear's own mark, right BEFORE the sample (`lib/block-looks.ts`) — inside the lab's wrapper. */}
      <span hidden {...{ [BLOCK_MARK_ATTR]: 'look' }} />
      <MakerWelcomeLook look={look('my_wear')} />
    </div>
  ) : null;
  /* 👤 WHAT EACH GUEST GETS — the greeting, the pass, the reply — as the REAL canvas stands in for them
     (`MakerGuestScenes`: "Each guest sees their own"), each behind its own marker so it can be picked. The Maker's
     canvas only: a page opened plainly has no guest to draw them for. (They were two bare headings of the lab's own —
     "Personal greeting", "Guest's ticket" — that no part could pick and the whole-page preview showed; P10.) */
  const guestScene = (which: 'greeting' | 'pass' | 'rsvp') =>
    makerCanvas ? (
      <div className="border-t border-ink/10 px-4 pb-8 text-left">
        <MakerGuestScenes
          show={{ greeting: which === 'greeting', pass: which === 'pass', rsvp: which === 'rsvp' }}
          eventDate={LAB_SAMPLE.date}
          solemn={false}
          mark={(key) => <>{blockOfCanvas(key) ? <span hidden {...{ [BLOCK_MARK_ATTR]: blockOfCanvas(key) }} /> : null}{mark(key)}</>}
        />
      </div>
    ) : which === 'rsvp' && labReplyCard ? (
      /* 🧭 A guest's RSVP part — the Reply card the cover's button takes them to (`COVER_RSVP_PART`), as on the page. */
      <section className="px-4 pb-8">
        <ReplyCardRow card={labReplyCard} partId={COVER_RSVP_PART} />
      </section>
    ) : null;
  /** A scene the sample has nothing in yet: its place on the Maker's canvas (`MakerEmptyScene`), nothing for a guest. */
  const emptyScene = (type: 'what_to_bring' | 'our_photos') =>
    makerCanvas ? (
      /* 🖼 `lab_pictures=1`: the REAL gallery with the lab's own drawn pictures, in the REAL scene frame. */
      type === 'our_photos' && labPictures ? (
        <HubCanvasFrame widget={{ ...rowOf('our_photos'), widget_id: 'lab-photos' } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
        <section data-lab-scene="our_photos" className="border-t border-ink/10 px-4 py-8 text-left">
          <OurPhotosWidget urls={labPhotoUrls(5)} sceneStyle={sceneStyleOfRow(rowOf('our_photos'), stage, 'wedding')} heading={null} />
        </section>
      </HubCanvasFrame>
      ) : (
        <div data-lab-scene={type} className="border-t border-ink/10 px-4 py-8">
        <MakerEmptyScene type={type} />
      </div>
      )
    ) : null;
  /* ✍ A SCENE OF THEIR OWN, drawn as the real page draws it (`public-hideable-widget.tsx`): its row with the lab's draft
     over it (its words — `custom` — and its canvas), the guest's renderer once it has something in it
     (`customSectionHasContent` → `renderCustomSection`), else — on the Maker's canvas only — its placeholder with the
     look Edit types into (`MakerEmptyScene` + `makerWordsLook`). A guest never sees an empty one. It was a fixed
     widget on fixed words, so nothing typed in the lab could ever reach it. */
  const ownSceneNode = (type: string) => {
    const row = labRowsNow.find((r) => r.widget_type === type);
    if (!row) return null;
    const base = (row.config_json ?? {}) as Record<string, unknown>;
    const config = drafted[type] !== undefined ? { ...base, canvas: drafted[type] } : base;
    if (customSectionHasContent(config)) {
      return (
        <div data-lab-scene={type} className="border-t border-ink/10 px-4 py-8 text-left">
          {renderCustomSection({ config, facts: NO_SCENE_FACTS, mediaUrls: { ...LAB_MEDIA, ...LAB_SIGNED }, ownClipPlays: makerCanvas, makerSlots: makerCanvas })}
        </div>
      );
    }
    return makerCanvas ? (
      <div data-lab-scene={type} className="border-t border-ink/10 px-4 py-8">
        <MakerEmptyScene type={type as never} look={makerWordsLook(type, config)} ownSlots={makerOwnSlots(type, config)} />
      </div>
    ) : null;
  };
  /* 🧩 THE LAB'S NODE FOR EACH CANVAS KEY — a stage draws the ones its own list names (`./lab-stage.tsx`). */
  const stageGiven: Record<string, ReactNode> = {
    'f:hero': <section data-page-column="" className="px-4 pb-10 pt-6">{masthead}</section>,
    'f:greeting': guestScene('greeting'),
    'f:pass': guestScene('pass'),
    'f:rsvp': guestScene('rsvp'),
    'f:look': lookBlock,
    'f:gifts': giftsBlock,
    'w:countdown': scene.countdown,
    'w:special_message': scene.special_message,
    'w:our_love_story': scene.our_love_story,
    'w:schedule': scene.schedule,
    'w:venue_map': scene.venue_map,
    'w:dress_code': scene.dress_code,
    'w:what_to_bring': emptyScene('what_to_bring'),
    'w:our_photos': emptyScene('our_photos'),
    /* ✍ The lab's one scene of the couple's own (`LAB_OWN_COOKIE`) — the guest page's own widget for it. Listed by
       the Maker only when the walk asked for it, so it is drawn only then (a stage draws what its list names). */
    [`w:${LAB_OWN_SCENE.type}`]: ownSceneNode(LAB_OWN_SCENE.type),
    'f:entourage': marchBlock,
  };
  /* 🎚 THE CHAIN'S CARDS (`?scrub=1`). Each scene of the chain is drawn as the prototype drew it, so a hold can be
     READ (2026-10-09 — a hold was "mostly a blank white screen with one faint element in the middle and nothing
     saying anything is happening"): a card (the hub's card look: paper, hairline, radius, shadow) in a phone-wide
     column, labelled with what it is set to — read from the canvas it is drawn with (`labScrubLabel`), never written
     by hand. The card sits INSIDE the real frame (`HubCanvasFrame`), so the scene's Build in and Build out move the
     card itself, as they move a scene on the guest page. The first card says the cover is not in the chain.
     🖼 THE CARD IS THE HUB'S OWN RULE (`globals.css` "THE HUB IS CARDS", its last arm — a section inside a frame that
     paints nothing): the lab draws none of its own, so what is seen here is what a guest's page draws. A scene given
     a background of its own in the Maker wears THAT as its box, by the same rule. (Until 2026-10-09 the rule did
     not reach a framed scene and each card here was a stand-in, written out in classes.) */
  const chainBody: Record<LabScrubScene, ReactNode> = {
    countdown: <CountdownWidget targetIso="2026-12-12" timeZone="Asia/Manila" sceneStyle={sceneStyleOfRow(rowOf('countdown'), stage, 'wedding')} />,
    schedule: <ScheduleWidget blocks={LAB_BLOCKS_LONG as never} eventTz="Asia/Manila" eventType="wedding" sceneStyle={sceneStyleOfRow(rowOf('schedule'), stage, 'wedding')} />,
    special_message: <SpecialMessageWidget text="We cannot wait to celebrate with you." signedBy="Maria & Jose" sceneStyle={sceneStyleOfRow(rowOf('special_message'), stage, 'wedding')} />,
    dress_code: <>{dressCode}</>,
    venue_map: <VenueWidget event={LAB_VENUE_EVENT as never} sceneStyle={sceneStyleOfRow(rowOf('venue_map'), stage, 'wedding')} map="none" blocks={LAB_BLOCKS as never} />,
  };
  /* 🎬 THE COVER AS HAND-OVER ZERO (`hub-scenes.tsx` `HubCoverHold`): on the chain the lab's cover is the hero row, and
     it hands over when that row Leaves by Scrub — the chain's start (`LAB_SCRUB_COVER`), or whatever "Scene leaves ◆"
     on one of the cover's parts saved here. Asked through the real question, with the lab's door open. */
  const coverLeaves = scrub && hubCoverLeaves([rowOf('hero')] as never, true, true);
  const chainCard = (type: LabScrubScene, i: number) => (
    <HubCanvasFrame widget={{ ...rowOf(type), widget_id: `lab-${type}` } as never} hubTheme="house" ownClipPlays mediaUrls={LAB_MEDIA}>
      <section
        data-lab-scene={type}
        data-lab-name={LAB_SCRUB_NAME[type]}
        className="text-left"
      >
        <p data-lab-card-label="" className="mb-3 text-[10.5px] font-bold uppercase leading-snug tracking-[0.08em] text-gild">
          {labScrubLabel(rowOf(type).config_json, { last: i === LAB_SCRUB_CHAIN.length - 1 }).map((l, n) => (
            <span key={l.name}>
              {n > 0 ? ' · ' : ''}
              {l.name} <b className="font-bold text-terracotta-700">{l.value}</b>
            </span>
          ))}
          {i === 0 && !coverLeaves ? <span className="mt-1 block normal-case tracking-normal text-ink/60">The cover above does not leave by Scrub.</span> : null}
        </p>
        {chainBody[type]}
      </section>
    </HubCanvasFrame>
  );
  /* 🧭 THE DAY, AS PAGES (`./lab-day.tsx`) — the Stages canvas's own shape for The Day (`&tabs=1`, as the Maker asks
     for it): one page per tab, the day's own parts on the page the one filing puts them on, the Camera a page. */
  if (phase === 'event' && sp.tabs === '1' && !scrub && !rsvp) {
    return (
      <div className="contents" {...labFontLive}>
      <main className="min-h-dvh bg-cream text-center text-ink" data-lab-phase={phase} {...labFontScope}>
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />
        <LabDayPages
          tab={typeof sp.tab === 'string' ? sp.tab : undefined}
          paged={!only}
          draws={dayDraws}
          maker={makerCanvas}
          tiles={stageTiles}
          mark={mark}
          styleOf={(part) => fixedSceneStyleOf(labEvent.style_preferences, part, stage, 'wedding')}
          galleryStyle={sceneStyleOfRow(rowOf('our_photos'), stage, 'wedding')}
          gallery={labPictures ? stageGiven['w:our_photos'] : undefined}
          /* Every node the lab has (`stageGiven`): the day's own five, and any scene ticked onto The Day. */
          given={stageGiven}
        />
        {sp.editor === '1' && !preview && !labNoBridge ? <EditorBridge /> : null}
        {/* 🎬 ▶ on the Cover Scene: the guests' own veil, as the real canvas mounts it (`site-body.tsx`). */}
        {sp.editor === '1' && !preview ? <CoverPlayOpening monogram="M&J" config={DEFAULT_REVEAL_CONFIG} eventEffects={labVeilEffects} petalsColor={DEFAULT_REVEAL_CONFIG.petalsColor} /> : null}
        {/* 👁 THE REAL PAGE'S ONE OBSERVER (`pahina-motion.tsx`, as `invitation-shell.tsx` mounts it): it marks each
            scene \`.pahina-in\` as a guest reaches it — what every "On arrival" Build in waits for. Without it the lab
            showed every On-arrival scene, row and part standing still, and walks reported a working feature as broken
            (the 2026-10-15 Animate walk, S3). Never in a miniature. */}
        {!preview ? <PahinaMotionRootFlag /> : null}
        {!preview ? <PahinaMotionObserver /> : null}
        {only ? <style>{canvasOnlyCss(only)}</style> : null}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🧱 The fixed blocks' own looks on The Day's pages too, as the real page carries them — this branch had the
            March's mark and no style, so a look picked on The Day › Welcome drew nothing here (seen 2026-10-10). */}
        <style {...{ [BLOCK_LOOKS_STYLE_ATTR]: '' }}>{blockLooksCss(readBlockLooks({ block_looks: labBlocks }))}</style>
      </main>
      </div>
    );
  }
  if (rsvp) {
    const labConfig = labRsvpConfig(sp.look);
    const labLook = readRsvpLook(labConfig);
    if (rsvp === 'form' && sp.door === '1') {
      /* 🚪 The reply page as a guest walks it — `./lab-reply-door.tsx`. */
      return <LabReplyDoor sp={sp} words={await eventWordsFor('wedding')} look={labLook} config={labConfig} board={celebrationColours(LAB_BOARD)} guest={LAB_GUEST} reply={labReply} />;
    }
    if (rsvp === 'thanks' && sp.guest === '1') {
      /* 🎟 `?rsvp=thanks&guest=1` — THE THANK-YOU AS A GUEST WHO JUST SAID YES SEES IT (owner 2026-10-21, "save their QR
         code after they reply … add a shortcut icon"): `invite/enter`'s own pieces, live — the note (`RsvpNoteLines`),
         the pass (`TicketPicture`) and its pop-up (`TicketPopup`), "Save my ticket" (`SavePassCardButton`: the phone's
         share sheet, else a download) on the me-lab's real pass drawing, and the shortcut line under its one decision
         (`shortcutLineShows`, for THIS request's phone). No canvas bridge and no part marks: a tap presses, as a guest's does. */
      const labPass = '/dev/me-lab/ticket?who=guest&couple=mj';
      const userAgent = (await headers()).get('user-agent');
      const shortcut = shortcutLineShows({ reply: 'yes', userAgent, storeShell: await isStoreShellRequest() });
      return (
        <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }} data-lab-guest-thanks="">
          <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
          <RsvpLookStyle config={labConfig} board={celebrationColours(LAB_BOARD)} parts={['yesnote', 'pass']} />
          <div className="space-y-6 rounded-3xl bg-white px-5 py-6 shadow-sm">
            <header data-door-header="">
              <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
              <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
              <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">Saturday, December 12, 2026</p>
            </header>
            <div data-landing="message" className="space-y-3">
              <RsvpNoteLines
                reply="yes"
                canvas={false}
                wordKeys={{ heading: 'thanksHeading', message: 'thanksMessage' }}
                headline={landingHeadline('attending')}
                ownHeadline={landingHeadline('attending')}
                ownMessage={null}
                firstName="Ana"
                lines={rsvpScreenLayout(labLook, 'yesnote')}
              />
            </div>
            <section className="space-y-4 text-center" data-lab-guest-pass="">
              <TicketPopup guestId="lab-ana" fingerprint="lab-1" src={labPass} name="Ana Reyes" />
              <div className="mx-auto w-[min(260px,100%)] overflow-hidden rounded-2xl shadow-[0_24px_48px_-26px_rgba(30,34,41,0.45)]">
                <TicketPicture src={labPass} alt="Ana Reyes’s Digital ticket" fallback={null} />
              </div>
              <SavePassCardButton hrefs={[labPass]} label={LANDING_WORDS.saveTicket} variant="primary" />
            </section>
            {shortcut ? <ShortcutLine userAgent={userAgent} /> : null}
          </div>
        </main>
      );
    }
    if (rsvp === 'form' && sp.sheet === '1') {
      /* 🧾 `?rsvp=form&sheet=1#your-details` — THE EVENT HUB'S OWN REPLY SHEET (`rsvp-sheet.tsx`), the second place a
         guest replies: the real sheet, the real card inside it and the look's one `<style>` exactly as `site-body.tsx`
         mounts them (`surface="sheet"`), over a page to judge its paper against. A guest's view: no canvas bridge. */
      return (
        <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }} data-lab-reply-sheet="">
          <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
          <div className="space-y-3 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em]">You&rsquo;re invited</p>
            <h1 className="font-serif text-4xl">Maria &amp; Jose</h1>
            <p className="font-mono text-[11px] uppercase tracking-[0.14em]">Saturday, December 12, 2026 · Seda Vertis North</p>
            {Array.from({ length: 8 }, (_, i) => (
              <p key={i} className="text-base leading-relaxed">
                Together with their families, Maria and Jose invite you to celebrate their wedding.
              </p>
            ))}
            <a href="#your-details" className="button-primary inline-flex">
              Reply
            </a>
          </div>
          <RsvpSheet heading="Your reply" privacyLine="Only the couple sees your reply." flash={null}>
            <div data-rsvp-form>
              <RsvpWidget
                words={await eventWordsFor('wedding')}
                guest={LAB_GUEST}
                eventId="lab"
                eventPublicId="lab"
                faceMode="mode_b"
                oneAtATime={sp.one === '1'}
                lines={rsvpScreenLayout(labLook, 'rsvp')}
              />
              <RsvpLookStyle config={labConfig} board={celebrationColours(LAB_BOARD)} parts={['rsvp']} surface="sheet" />
            </div>
          </RsvpSheet>
        </main>
      );
    }
    return (
      /* 🖼 A GROUND TO JUDGE THE CARD AGAINST (controller 2026-10-10): on plain cream, Frosted and None looked the
         same as Plain. A stand-in for the Look's background, made of the lab's own colours — the lab only. */
      <main className="min-h-dvh px-5 py-6 text-ink" style={{ background: `linear-gradient(160deg, ${LAB_BOARD[4]} 0%, ${LAB_BOARD[2]} 52%, ${LAB_BOARD[1]} 100%)` }}>
        {/* 🧩 THE REAL RSVP PAGES' PART MARKS, AND THEIR BRIDGE (2026-10-09 — the owner could not reach the RSVP
            stage's tools by hand in the lab: these screens had no marks, so a tap picked nothing and ticked an
            answer). As `invite/reply` and `invite/enter` draw them on the Maker's canvas: the masthead inside the
            door's header (`stampRsvpCanvas` names its parts and marks it `f:hero`), a hidden section marker before
            each part, and each word's own key. `RsvpCanvasBridge` then makes a tap PICK the part under it — never
            the form's own. In the Maker's frame only (`play` is the lab's own celebration preview, a plain page). */}
        {play === null ? <RsvpCanvasBridge /> : null}
        {/* The app's own chrome (the cookie card) stays off the lab's RSVP screens, as it does off the lab's other
            guest pages below: it sat over "Sadly, no", the hint and the Save button. The lab only. */}
        <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
        {/* 🎨 Each line's look, as the real pages carry it — drawn at the tap in the Maker (`rsvp-look-style.tsx`). */}
        <RsvpLookStyle config={labConfig} board={celebrationColours(LAB_BOARD)} parts={rsvp === 'form' ? ['rsvp'] : rsvp === 'thanks' ? ['yesnote', 'pass'] : ['nonote']} canvas />
        {/* 🃏 The door's CARD, as `DoorShell` draws it: the masthead and every section inside ONE card — on the Maker's
            canvas the card is the screen's group of lines, picked from its edge (`RSVP_CARD_GROUPS`). */}
        <div className="rounded-3xl bg-white px-5 py-6 shadow-sm">
          <header data-door-header="">
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-gild">You&rsquo;re invited</p>
            <h1 className="mt-1 text-xl font-semibold">Maria &amp; Jose</h1>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/60">
              <span data-el="date">Saturday, December 12, 2026</span>
            </p>
          </header>
        {rsvp === 'form' ? mark('f:greeting') : null}
        {rsvp === 'form' ? <p className="mt-4 text-sm">Teresita Aquino</p> : null}
        {rsvp === 'form' ? mark('f:rsvp') : null}
        {rsvp === 'form' ? (
          /* 🃏 THE REAL REPLY CARD (`RsvpWidget`), as `invite/reply` draws it on the Maker's canvas: the invitation's
             Reply door, the SAMPLE guest, every question drawn. It was a hand-made copy of the card's answers — which
             could not show a line the couple added, an order or a group, and had drifted from the card before
             (2026-10-10; the hand-over's own trap: "the lab's stand-ins hide things from the owner"). One element
             after the marker, as the page's `CanvasSection` is. `?one=1`: one question at a time, on the server. */
          <div className="mt-4 space-y-4">
            <RsvpWidget
              words={await eventWordsFor('wedding')}
              guest={LAB_GUEST}
              eventId="lab"
              eventPublicId="lab"
              faceMode="mode_b"
              doorAction={labReply}
              termsOnSend
              previewEveryQuestion
              oneAtATime={sp.one === '1'}
              lines={rsvpScreenLayout(labLook, 'rsvp')}
            />
          </div>
        ) : rsvp === 'thanks' ? (
          <>
            {mark('f:yesnote')}
            {/* 💌 THE REAL NOTE AFTER A YES (`RsvpNoteLines`, as `invite/enter` draws it): the "✓ You replied" pill
                and the couple's message, in the block the marker stands before. */}
            <div data-landing="message" className="mt-6 space-y-3">
              <RsvpNoteLines
                reply="yes"
                canvas
                wordKeys={{ heading: 'thanksHeading', message: 'thanksMessage' }}
                headline={landingHeadline('attending')}
                ownHeadline={landingHeadline('attending')}
                ownMessage={null}
                firstName="Teresita"
                lines={rsvpScreenLayout(labLook, 'yesnote')}
              />
            </div>
            <WhenYesCelebration
              kind={play ?? 'none'}
              colours={celebrationColours(LAB_BOARD)}
              play={play !== null}
              name="Teresita"
              listen={play === null}
              freezeAt={freeze}
            />
            {/* The pass and its Save button — a line of the pass, named on a box around the (inert) button, as
                `invite/enter` does. */}
            {play === null ? mark('f:pass') : null}
            {play === null ? (
              <section className="mt-6 space-y-4 text-center">
                <div className="mx-auto h-40 w-[min(260px,100%)] rounded-2xl bg-ink/10" />
                <div data-rsvp-line="save">
                  <button type="button" className="button-primary w-full">
                    Save my ticket
                  </button>
                </div>
              </section>
            ) : null}
          </>
        ) : (
          <>
            {mark('f:nonote')}
            {/* 💌 THE REAL NOTE AFTER A NO (`RsvpNoteLines`): the note's OWN card inside the door's card
                (`data-landing-missed`) — with a ground chosen for the door's card it gives up its paper, so ONE card
                shows (`RSVP_INNER_CARD_SELECTOR`). */}
            <div data-landing="message" className="mt-6 space-y-3">
              <RsvpNoteLines
                reply="no"
                canvas
                wordKeys={{ heading: 'declineHeading', message: 'declineMessage' }}
                headline={landingHeadline('declined')}
                ownHeadline={landingHeadline('declined')}
                ownMessage={null}
                firstName="Teresita"
                lines={rsvpScreenLayout(labLook, 'nonote')}
              />
            </div>
          </>
        )}
        </div>
      </main>
    );
  }
  return (
    <div className="contents" {...labFontLive}>
    <main className={`min-h-dvh text-center text-ink [--cover-scene-above:calc(35px_+_1.5rem)] [--cover-scene-pad:1.5rem] ${ground || labPhoto ? 'relative' : 'bg-cream'}`} data-lab-phase={phase} {...labFontScope}>
      {/* 📐 `--cover-scene-above`: the lab's bar (35px) + its section's pt-6 — the shell's rule (`lib/cover-scene-screen.ts`), lab-sized. */}
      {/* The page's paper is a LAYER under everything, as the real page's is (`GuestGround`) — never the box's own
          fill, which would hide a background laid behind the page (the main background, and its instant preview). */}
      {labPhoto && !ground ? null : <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-[#FBF9F5]" />}
      {ground}
      {/* 🖼 a `lab_photo=1` cookie: a photo behind the page (the side-by-side's real-looking content) — a public ready-made scene. */}
      {!ground && labPhoto ? (
        <div data-guest-ground="" aria-hidden className="pointer-events-none fixed inset-0 -z-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/std/backgrounds/golden-hour.webp" alt="" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[#FBF9F5]/60" />
        </div>
      ) : null}
      {/* 🧍 THE PAGE'S OWN HOLD, as `site-body.tsx` wraps its article: on the chain, everything this page draws — the
          cover, the greeting, the ticket — stands still while a hand-over plays. (`holds` 0 off the chain: nothing is
          wrapped.) */}
      <HubPageHold holds={scrub ? hubScrubHoldsAtMost(LAB_SCRUB_CHAIN.map((t) => rowOf(t)) as never, true, true) + (coverLeaves ? 1 : 0) : 0}>
      <CoverSceneMenuWaits />
      {/* 🎭 `&veil=1` — the REAL opening over the lab's cover (`RevealMount`, the guest page's own: its hold script, then the
          Sheer veil), as an owned Pro page mounts it, so "behind the veil none of the cover's words show" (owner
          2026-10-16) can be walked without a database. Never in the Maker's canvas, as on the page. Told the page's own
          `firstPageOnly` (`site-body.tsx`), so the drape that stays with the cover (owner 2026-10-17) walks here too. */}
      {sp.veil === '1' && !makerCanvas ? (
        <RevealMount enabled monogram="M&J" config={DEFAULT_REVEAL_CONFIG} eventEffects={labVeilEffects} ownsPro isStaffPreview={false} eventTemplate="veil-sheer" eventId="lab-veil" firstPageOnly={revealOnlyOnTheFirstPage(phase as LifecyclePhase)} />
      ) : null}
      <div data-sticky-top="" style={{ background: "var(--sn-page, #FBF9F5)" }} className="z-20 border-b border-ink/10 text-[9.5px] font-semibold uppercase tracking-[0.3em] text-gild">
        <div className="flex justify-between px-4 py-2.5">
          <span>Setnayan</span>
          <span>{phase === 'save_the_date' ? 'Save the Date' : phase === 'event' ? 'The Day' : phase === 'editorial' ? 'Post Event' : 'Invitation'}</span>
        </div>
      </div>
      {/* 🧭 THE REAL HERO (`PahinaMasthead`, the guest page's own) on maria-and-jose's words — its parts carry their
          `data-el` and, when picked, their own style (`data-part-look`), exactly as the guest page draws them. */}
      {/* 🎚 The chain's badge (lab only): is Scrub on, which hand-over, how far — or WHY it is off. Before the first
          marker, so the Maker's bridge never counts it as part of a scene. Never in a miniature. */}
      {/* 🎬 THE COVER, AND THE REST OF THE PAGE AFTER IT — as the page hands its cover over (`HubCoverHold`). With a
          cover that does not leave (the ordinary lab; a chain whose cover was set back to "As it scrolls away") both
          are returned as given: nothing is wrapped. The cover's marker goes IN with it, so the Maker's bridge still
          finds the cover right after its marker. */}
      {scrub ? (
      <>
      {scrub && !only && !preview ? <LabScrubBadge /> : null}
      <HubCoverHold
        leaves={coverLeaves}
        cover={
          <>
      {mark('f:hero')}
      <section data-page-column="" className="px-4 pb-10 pt-6">
        {masthead}
      </section>
          </>
        }
      >
      {labReplyCard && !makerCanvas ? (
        <section className="px-4 pb-8">
          <ReplyCardRow card={labReplyCard} partId={COVER_RSVP_PART} />
        </section>
      ) : null}
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Personal greeting</p>
        <p className="mt-1 text-sm text-ink/70">Dear Teresita, we would love you there.</p>
      </section>
      <section className="border-t border-ink/10 px-4 py-8">
        <p className="font-serif text-lg">Guest&rsquo;s ticket</p>
      </section>
        {/* 🎚 THE SCRUB CHAIN (`../lab-scrub.ts`) — the lab's scenes through the guest page's OWN renderer (`HubScenes`),
           one node a scene with its marker, exactly as `site-body.tsx` hands them over: the hand-overs, the holds and
           the engine are the real ones, and what the owner arranges on a scene in the Maker is what plays here. The
           fixed blocks, and the one scene that is not in the chain, follow it as the ordinary lab draws them. */}
        <>
          <div className="sn-editorial mx-auto max-w-[430px] px-4 pb-6" data-lab-scrub="">
            <HubScenes widgets={LAB_SCRUB_CHAIN.map((t) => ({ ...rowOf(t), widget_id: `lab-${t}` })) as never} scrubAllowed scrubOut>
              {LAB_SCRUB_CHAIN.map((t, i) => (
                <Fragment key={t}>
                  {mark(`w:${t}`)}
                  {chainCard(t, i)}
                </Fragment>
              ))}
            </HubScenes>
          </div>
          <div className="sn-editorial">
            {mark('f:gifts')}
            {giftsBlock}
            {mark('f:look')}
            {lookBlock}
            {mark('w:our_love_story')}
            {scene.our_love_story}
          </div>
        </>
      </HubCoverHold>
      </>
      ) : (
        /* 🗂 EVERY OTHER PAGE OF THE LAB'S CANVAS — the stage's own parts, in the Maker's order, each tab its own page
           where the real canvas has tabs (`./lab-stage.tsx`). The cover is the stage's first part (`f:hero`), filed
           on its page like any other, as on The Day. */
        <LabStagePages
          stage={stageNow}
          tiles={stageTiles}
          tab={typeof sp.tab === 'string' ? sp.tab : undefined}
          paged={sp.tabs === '1' && !only}
          mark={mark}
          given={stageGiven}
          selfMarked={STAGE_SELF_MARKED}
        />
      )}
      {/* 🎞 POST EVENT'S OWN SCENES (the Post Event stage only) — a stand-in for each scene guests would meet, in the
          run's order, behind the marker the real story page puts before it (`p:<scene>`; the day's chapters share
          one, as they move together). The SAME rows the lab hands the Maker (`../lab-post-event.ts`), with the lab's
          drafted story keys laid over — so a scene hidden, moved, restyled or reworded in the panel is seen here. */}
      {phase === 'editorial' ? (
        <div className="sn-editorial" data-lab-post-event="">
          {postEventScenes.map((r) => (
            <div key={r.key} className="contents">
              {r.marker ? mark(`p:${r.marker}`) : null}
              <section data-lab-post-event-scene={r.key} data-lab-post-event-style={r.style ?? undefined} className="border-t border-ink/10 px-4 py-10 text-left">
                <p className="pahina-eyebrow">
                  <span data-el="label">{r.words?.label ?? r.name}</span>
                </p>
                <p className="mt-3 font-serif text-2xl" data-el="heading">
                  {r.words?.heading ?? r.source}
                </p>
                {r.words?.body ? (
                  <p className="mt-2 text-sm text-ink/70" data-el="body">
                    {r.words.body}
                  </p>
                ) : null}
                {r.style ? <p className="mt-3 text-[11px] uppercase tracking-[0.14em] text-ink/45">Style · {r.style}</p> : null}
              </section>
            </div>
          ))}
        </div>
      ) : null}
      </HubPageHold>
      {/* 🕯 THE CLOSING (owner 2026-10-17: "Make the closing (See you soon) its own scene in the Maker"), as the real
          shell draws it under every page (`invitation-shell.tsx`): the Maker's marker right before the footer, then the
          kit's closing — the oval only while the Closing's Accent is on — or the plain sign-off. The lab's look is
          House unless `lab_kit=vintage`; its picks are the drafted `lab_accents`. The oval's picture is Setnayan's own. */}
      {mark('f:closing')}
      {labKit ? (
        <footer className="relative z-10 text-center">
          <KitStyle kit={labKit} />
          <KitClosing kit={labKit} names={labNames} date={formatEventDate(LAB_SAMPLE.date) || null} photoUrl="/std/backgrounds/ballroom.webp" mark="M & J" twoPeople hideWatermark={false} line={heroCanvas.elements?.closing ?? null} stamp={sp.editor === '1'} />
        </footer>
      ) : (
        <footer className="relative z-10 border-t border-ink/10 px-4 py-8 text-center">
          {/* 🕯 The closing's line — the drafted hero row's `elements.closing`, as the real shell draws it. */}
          <ClosingLine line={heroCanvas.elements?.closing ?? null} stamp={sp.editor === '1'} className="font-pahina text-lg italic text-terracotta-700" />
          <p className="mt-3 text-xs text-ink/70">Powered by Setnayan · setnayan.com</p>
        </footer>
      )}
      {/* The Maker's two-way bridge, as the real canvas mounts it — its `ready` swaps a buffered frame in. Never in a miniature. */}
      {sp.editor === '1' && !preview && !labNoBridge ? <EditorBridge /> : null}
        {/* 🎬 ▶ on the Cover Scene: the guests' own veil, as the real canvas mounts it (`site-body.tsx`). */}
        {sp.editor === '1' && !preview ? <CoverPlayOpening monogram="M&J" config={DEFAULT_REVEAL_CONFIG} eventEffects={labVeilEffects} petalsColor={DEFAULT_REVEAL_CONFIG.petalsColor} /> : null}
        {/* 👁 THE REAL PAGE'S ONE OBSERVER (`pahina-motion.tsx`, as `invitation-shell.tsx` mounts it): it marks each
            scene \`.pahina-in\` as a guest reaches it — what every "On arrival" Build in waits for. Without it the lab
            showed every On-arrival scene, row and part standing still, and walks reported a working feature as broken
            (the 2026-10-15 Animate walk, S3). Never in a miniature. */}
        {!preview ? <PahinaMotionRootFlag /> : null}
        {!preview ? <PahinaMotionObserver /> : null}
      {only ? <style>{canvasOnlyCss(only)}</style> : null}
      {/* 🍪 As the REAL canvas does (`site-body.tsx`, `isEditorCanvas`): the app's floating notices — the cookie consent
          among them — are not drawn inside the Maker's sample; the host answers them on the Maker's own page. The lab
          drew the banner over the foot of the sample, which the real Maker never does (seen on the review copy, 2026-10-09). */}
      <style>{EDITOR_CANVAS_HIDES_APP_CHROME}</style>
      {/* 🧱 The fixed blocks' own motion, as the real page carries it — redrawn at the tap in the Maker (`editor-bridge.tsx`). */}
      <style {...{ [BLOCK_LOOKS_STYLE_ATTR]: '' }}>{blockLooksCss(readBlockLooks({ block_looks: labBlocks }))}</style>
    </main>
    </div>
  );
}
