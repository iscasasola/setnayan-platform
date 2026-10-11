/**
 * home-shelf-tags.ts — what the home page remembers, for how long, and which
 * stored columns each remembered read depends on. Pure constants: the readers
 * (`lib/home-public-reads.ts`), the clear (`lib/home-shelf-clear.ts`) and the
 * guard (`lib/home-shelf-writes-clear.test.ts`) all read this one file.
 *
 * ─── THE TWO AGES ────────────────────────────────────────────────────────────
 * SOFT 60 s — inside it a view costs no database call for these rows.
 * HARD 300 s — past it the rows are never shown; they are asked again. 300 is
 * the staleness this page already ran under as an ISR page (`revalidate = 300`
 * in `app/page.tsx`, the 2026-07-02 perf sweep) — not a new number.
 * ⚠ Both sit far under the 24 h life of a signed picture address, and no signed
 * address is remembered in the first place: the readers keep ROWS, and every
 * picture is signed per request by the code that already did it.
 */
export const HOME_SHELF_SOFT_SECONDS = 60;
export const HOME_SHELF_HARD_SECONDS = 300;

export const HOME_SHELF_TAGS = {
  /** Listed public events: the candidate rows, their hosts, the cover rows. */
  events: 'home-shelf:events',
  /** Live shops on the shelf, and their count. */
  shops: 'home-shelf:shops',
  /** Featured storyteller chapters. */
  stories: 'home-shelf:stories',
  /** Public profiles: people to follow, a host's public name, a chapter's byline. */
  people: 'home-shelf:people',
} as const;

export type HomeShelfSubject = keyof typeof HOME_SHELF_TAGS;

/**
 * THE COLUMNS A REMEMBERED READ SELECTS OR FILTERS ON, per table.
 *
 * `clears` — a write to one of these takes something DOWN from the public page
 * or changes where a card points (visibility, archive, a public profile going
 * private, a shop losing its listing, a chapter leaving the shelf, a slug). The
 * writer must clear the tag, so the very next view is right.
 *
 * `waits` — a write to one of these changes how a card LOOKS (a name, a date, a
 * colour, a cover). It is not cleared: the page shows the old look for at most
 * the hard age above. Every such write site is counted in
 * `lib/home-shelf-writes.baseline.txt`, so a new one is a decision, not a drift.
 *
 * A DELETE of a row in any of these tables is a `clears` write.
 */
export const HOME_SHELF_DEPENDS: Record<
  string,
  { subject: HomeShelfSubject; clears: readonly string[]; waits: readonly string[] }
> = {
  events: {
    subject: 'events',
    clears: ['landing_page_visibility', 'archived', 'slug'],
    waits: [
      'display_name', 'event_date', 'event_end_date', 'event_date_precision', 'event_type', 'region',
      'scheduled_launch_at', 'monogram_text', 'rsvp_ask_config', 'venue_name', 'monogram_color',
      'invite_theme', 'std_background', 'landing_page_hero_image_url', 'landing_page_hero_video_r2_key',
      'monogram_custom_svg', 'monogram_uploaded_svg', 'role_palette', 'site_bg_color',
      'site_button_color', 'site_font_key', 'site_art_direction',
    ],
  },
  invitation_widgets: { subject: 'events', clears: [], waits: ['config_json', 'widget_type'] },
  vendor_profiles: {
    subject: 'shops',
    clears: ['public_visibility', 'verification_state', 'is_demo', 'business_slug'],
    waits: ['business_name', 'location_city', 'services', 'next_renewal_due_at', 'logo_url'],
  },
  creator_chapters: {
    subject: 'stories',
    clears: ['status', 'showcase_featured_at'],
    waits: ['showcase_feature_rank', 'title', 'kind', 'embed_url', 'body', 'view_count'],
  },
  users: {
    subject: 'people',
    clears: ['public_profile_enabled', 'deleted_at', 'slug'],
    waits: ['display_name', 'profile_photo_url', 'followers_count', 'public_id'],
  },
};
