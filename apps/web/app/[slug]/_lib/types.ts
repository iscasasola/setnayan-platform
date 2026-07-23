// Shared row/data types for the public event-website route (`app/[slug]`).
// Extracted verbatim from `app/[slug]/page.tsx` (OPEN-BROWSE PR1 — zero-
// behavior extraction) so the `_components/` split can share them without
// circular imports. OPEN-BROWSE PR2 adds the `_lib/loaders.ts` return types
// (EventMedia · LiveLayerData · GuestContext) — all type-only imports, so the
// module stays value-free for the client components that import from it.
import type { GuestRole } from '@/lib/guests';
import type { RoamManifest } from '@/lib/live-studio-roam';
import type { WallTile } from '@/lib/live-wall-logic';
import type { MonogramConfig } from '@/lib/monogram';
import type { MonogramMotionKey } from '@/lib/monogram-motion';
import type { StudioAnim } from '@/app/_components/studio-reveal-player';
import type { StdBackground } from '@/lib/std-backgrounds';
import type { ScheduleBlockRow } from '@/lib/schedule';
import type { RsvpBackdropConfig } from '@/lib/spatial-backdrop';
import type { GuestLiveGallery } from '@/lib/guest-live-gallery';
import type { VendorCard } from '@/lib/vendor-cards';
import type { PapicStyle } from '@/lib/papic-photo-styles';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import type { EventTableRow } from '@/lib/seating';
import type { EntrancePos } from '@/lib/indoor-blueprint';
import type { GuestHubData } from '../_components/guest-hub-card';

/** Panood Watch-Live data for the day-of page (shown whenever a watch URL is
 *  staged — single-cam Panood live is free for every host). */
export type WatchLiveData = { embedUrl: string; watchUrl: string; roam?: RoamManifest };
/** Live Photo Wall data threaded into the day-of page (LIVE_WALL owners only). */
export type LiveWallData = {
  tiles: WallTile[];
  count: number;
  caption: { text: string; author: string } | null;
};

export type EventRow = {
  event_id: string;
  public_id: string;
  display_name: string;
  event_date: string | null;
  venue_name: string | null;
  venue_address: string | null;
  venue_latitude: number | null;
  venue_longitude: number | null;
  slug: string;
  // Event type (events.event_type). Drives event-type-adaptive guest copy —
  // weddings keep "wedding", other types read "event" — now that non-wedding
  // types can enable the website surface.
  event_type?: string | null;
  // Ceremony faith (events.ceremony_type, iteration 0043). Read on the public
  // site so faith-specific guest guidance can fill an empty section — e.g. the
  // INC dress-code empty state surfaces the Church's modest-attire expectation
  // even when the host hasn't authored a dress code yet.
  ceremony_type?: string | null;
  // Secondary/overlay ceremony (events.secondary_ceremony_type, iteration 0043).
  // Read on the public site so the Chinese (Tsinoy) overlay fires on the common
  // church-primary + Chinese-secondary case — the guest-facing tea-ceremony card
  // gates on isChineseWedding(event), which unions primary + secondary.
  secondary_ceremony_type?: string | null;
  // Couple's mood-board palette (events.role_palette JSONB, iteration 0010).
  // Read here to skin the public site's --color-* tokens via buildSitePaletteVars
  // in InvitationShell. Shape is Partial<Record<PaletteKey, string[]>>; typed
  // unknown + sanitized at use so a thin/absent palette degrades to defaults.
  role_palette?: unknown;
  // Couple's love story (events.love_story JSONB, written at onboarding; also
  // feeds Pakanta). Rendered on the pre-event paths (Save the Date teaser ·
  // RSVP · Event) via <OurStory>; NOT on the post-event Editorial. Typed
  // unknown + tolerated at use (partial/absent → section hides).
  love_story?: unknown;
  // Chosen-lockup design columns — selected at the top of this route (line ~124)
  // and threaded into HeroMonogram so the public hero draws the couple's real
  // mark (bar/duo/script/infinity/framed), not just initials.
  monogram_style?: string | null;
  monogram_font_key?: string | null;
  monogram_frame_key?: string | null;
  // Accent colour for the lockup (events.monogram_color) — used by resolveMonogram
  // for the badge ring / initials and the STD film's onboarding-lockup fallback.
  monogram_color?: string | null;
  // Couple's explicit monogram-text override (events.monogram_text, already in
  // the SELECT) — the Save-the-Date film's monogram letters when set, else
  // derived from the display name. See lib/save-the-date-content.ts (P2).
  monogram_text?: string | null;
  // The couple's bespoke mark SVG (uploaded outranks AI/Cipher) — pressed into
  // the Save-the-Date reveal's wax seal (0024 §3). Sanitized at generation time.
  monogram_custom_svg?: string | null;
  monogram_uploaded_svg?: string | null;
  // The couple-minted wax-seal recipe (candle-stamp maker, 0024 §3) — deterministic
  // config rendered client-side by paintWaxSeal. Unknown + sanitized at use.
  wax_seal_config?: unknown;
  // The couple's chosen Save-the-Date opening reveal (events.std_reveal_template,
  // migration 20270113257561) — overrides the admin house default. (PR4 P4)
  std_reveal_template?: string | null;
  // Couple's reveal effect toggles {butterflies,petals} (events.std_reveal_effects).
  // NULL → app defaults (butterflies off, petals on).
  std_reveal_effects?: unknown;
  // When the full invitation goes live (events.std_invitation_launch_date) —
  // drives the STD film's close beat + the second add-to-calendar VEVENT. (PR4 P3)
  std_invitation_launch_date?: string | null;
  // Visual theme for the film (lib/std-themes · 2026-06-18). NULL = 'moodboard'.
  std_theme?: string | null;
  // Step-1 background choice {kind, value} (events.std_background · 2026-06-19).
  std_background?: unknown;
  // Step-3 media choice {type, videoKey?, posterKey?, nsfw?} (events.std_media · 2026-06-19).
  std_media?: unknown;
  // Manual STD venue override (reception fallback when no finalized booking).
  std_film_venue_name?: string | null;
  std_film_venue_city?: string | null;
  // Manual STD ceremony venue (fallback when no finalized ceremony booking).
  std_film_ceremony_name?: string | null;
  // Manual STD film accent hex override (null = follow Mood Board → mulberry).
  std_film_accent_hex?: string | null;
  // TRUE only for the Maria & Jose public-tour sample event. Used to suppress the
  // Save-the-Date view beacon so tour traffic never inflates the sample's stats.
  is_sample?: boolean | null;
  // JSONB column populated by the host via /dashboard/[eventId]/website/photo-moments.
  // Shape: { intro_copy: string, moments: [{ time_label, title, note, mode }] }.
  // Unknown / empty shapes degrade gracefully in PhotoMomentsWidget — the
  // widget renders polite fallback copy when no moments are curated.
  photo_moments_config: unknown;
  // Host-curated dress code (CLAUDE.md 2026-05-22 PR #382). Stored as JSONB so a
  // brand-new event gets `{}` and the renderer's empty-state branch fires.
  // Editor at /dashboard/[eventId]/website/dress-code stamps this shape.
  dress_code_config?: {
    title?: string;
    description?: string;
    dos?: string[];
    donts?: string[];
    palette?: { name: string; hex: string }[];
  } | null;
  // Landing page visibility lever from PR #381 — ‹public, unlisted, private›.
  // Private renders <PrivateLanding> for non-guest visitors.
  landing_page_visibility?: 'public' | 'unlisted' | 'private' | null;
  // r2://-tagged ref to the hero photo uploaded via
  // /dashboard/[eventId]/website/hero-photo (migration 20260605020000).
  // Null = render the monogram-only hero (legacy/default behavior).
  // Display URL resolved via displayUrlForStoredAsset() before render.
  landing_page_hero_image_url?: string | null;
  // Host-curated note to guests (Increment A.1). TEXT column shipped
  // 20260912000000; edited at /dashboard/[eventId]/website/special-message.
  // Blank → SpecialMessageWidget renders nothing (section hides).
  special_message?: string | null;
  // Host-curated gift / registry note (Increment A.3). TEXT column shipped
  // 20260918000000; edited at /dashboard/[eventId]/website/what-to-bring.
  // Blank → WhatToBringWidget renders nothing (section hides).
  what_to_bring?: string | null;
  // Couple-curated photo gallery (Increment A.4). JSONB array of r2:// refs
  // shipped 20260919000000; edited at /dashboard/[eventId]/website/our-photos.
  // Refs resolved to presigned display URLs (ourPhotoUrls) before render;
  // empty → OurPhotosWidget renders nothing (section hides). Distinct from the
  // guest-tagged your_photos widget.
  our_photos?: string[] | null;
  // Looping hero video + background music chrome (Increment B). r2:// refs
  // shipped in the lifecycle foundation (20260912000000); edited at
  // /dashboard/[eventId]/website/site-chrome. The hero video, when present,
  // replaces the still hero photo; bg music plays only when enabled + a track
  // is set (resolved to presigned URLs before render).
  landing_page_hero_video_r2_key?: string | null;
  site_bg_music_enabled?: boolean | null;
  site_bg_music_r2_key?: string | null;
};

// ---------------------------------------------------------------------------
// Loader return types (OPEN-BROWSE PR2 — `_lib/loaders.ts`). Shapes mirror the
// values page.tsx's inline data block produced; the components' own prop types
// are untouched (these must stay assignable to them).
// ---------------------------------------------------------------------------

/** Auto-filled ceremony + reception venue names (finalized bookings ?? manual
 *  ?? event) + reception city, for the STD film's venue beats. */
export type StdVenues = {
  ceremony: string | null;
  reception: string | null;
  receptionCity: string | null;
};

/** `loadMedia` — hero/photos/monogram/Save-the-Date media resolution, shared
 *  verbatim by every render branch (PrivateLanding included). */
export type EventMedia = {
  monogram: MonogramConfig;
  animatedMonogram: MonogramMotionKey | false;
  proWatermarkHidden: boolean;
  bespokeSvg: string | null;
  studioAnim: StudioAnim;
  heroPhotoUrl: string | null;
  heroVideoUrl: string | null;
  bgMusicUrl: string | null;
  stdBackground: StdBackground;
  stdBackgroundUrl: string | null;
  stdVideoUrl: string | null;
  stdVideoPosterUrl: string | null;
  stdVenues: StdVenues;
  ourPhotoUrls: string[];
  ownsStdReveal: boolean;
};

/** `loadLiveLayer` — public schedule + RSVP-era backdrop config + live-window
 *  Watch-Live / Live Photo Wall + the anonymous event-day chrome inputs. */
export type LiveLayerData = {
  scheduleBlocks: ScheduleBlockRow[];
  backdropConfig: RsvpBackdropConfig | null;
  liveWall: LiveWallData | null;
  watchLive: WatchLiveData | null;
  publicCandidCameraActive: boolean;
  publicAlbumHref: string | null;
};

/** Inline Papic guest camera mount data (mirrors the /papic/guest route). */
export type GuestPapicCamera = {
  initialRemaining: number;
  total: number;
  termsAccepted: boolean;
  guestUnlimited: boolean;
  eventStyle: PapicStyle;
  faceMode: PapicFaceMode;
};

/** Pabati video-guestbook quota display data. */
export type GuestPabatiQuota = { initialRemaining: number; total: number };

/** "Your seat" inline wayfinding map (free 2D seat plan). */
export type GuestSeatMap = {
  tables: EventTableRow[];
  entrance: EntrancePos;
  targetTableId: string;
};

/**
 * `loadGuestContext` — THE ONLY loader that may select guest columns; requires
 * a verified guest session as a parameter. Discriminated so the orchestrator
 * keeps its exact control flow: `not_found` → PublicLanding
 * reason="invalid_invite" · `unconfirmed_tba` → the /welcome redirect ·
 * `ready` → the full guest render context.
 */
export type GuestContext =
  | { kind: 'not_found' }
  | { kind: 'unconfirmed_tba' }
  | {
      kind: 'ready';
      guest: GuestRow;
      qrSvg: string;
      invitationUrl: string;
      papicGuestActive: boolean;
      guestRollCameraReady: boolean;
      seatPassActive: boolean;
      guestLiveGallery: GuestLiveGallery | null;
      needsFaceEnroll: boolean;
      papicGuest: GuestPapicCamera | null;
      pabati: GuestPabatiQuota | null;
      guestHubData: GuestHubData;
      seatMap: GuestSeatMap | null;
      rsvpFaceMode: PapicFaceMode;
      eventVendorCredits: VendorCard[];
    };

export type GuestRow = {
  guest_id: string;
  first_name: string;
  last_name: string;
  display_name: string | null;
  role: GuestRole;
  side: 'bride' | 'groom' | 'both';
  group_category: string;
  plus_one_of_guest_id: string | null;
  plus_one_mode: 'full' | 'limited' | null;
  rsvp_status: 'pending' | 'attending' | 'declined' | 'maybe';
  meal_preference: string | null;
  dietary_restrictions: string | null;
  notes: string | null;
  custom_tags: string[];
  qr_token: string;
  photo_url: string | null;
  photo_source: 'oauth_google' | 'selfie' | 'couple_upload' | null;
};
