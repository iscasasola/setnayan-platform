/**
 * 🧪 ONE INVITATION, AS DATA — the sample the guest page (`app/[slug]/_components/site-body.tsx` `SiteBody`) is drawn
 * from on a machine with NO database. TEST TOOLING ONLY: nothing under `app/` imports this file, and it draws nothing
 * itself — `lib/site-body-fixture-render.ts` hands it to the REAL component.
 *
 * THE COUPLE IS THE LAB'S (`app/dev/maker-lab/guest/page.tsx`, read-only from production 2026-10-05): "Maria & Jose",
 * 12 December 2026, Santuario de San Antonio → Seda Vertis North, the same four-moment run of show. The lab keeps its
 * copies as unexported constants inside a Next page (a page may export nothing but its own handlers), so the VALUES
 * are repeated here, one for one; the Scrub canvases are imported from the lab's own module (`lab-scrub.ts`).
 *
 * TYPED AGAINST THE REAL PROPS (`Parameters<typeof SiteBody>[0]`): a prop that is renamed, removed or changes shape
 * breaks THIS file at compile time, before any snapshot is read.
 *
 * WHAT IT IS: a guest on the list who has not replied yet, opening their own invitation 63 days before the day —
 * the Invitation stage (`lifecyclePhase: 'rsvp'`), the ordinary body (`plan.body === 'normal'`), the cover drawn
 * (`plan.heroShouldRender`), no hero photo or film (the monogram masthead), a free event (House theme, the
 * "Powered by Setnayan" mark on). See the render helper's docblock for what that leaves OUT.
 */
import type { SiteBody } from '@/app/[slug]/_components/site-body';
import type { EventRow } from '@/app/[slug]/_lib/types';
import type { InvitationWidgetRow, WidgetType } from './invitation-widgets';
import { WIDGET_CATALOG_BY_TYPE } from './invitation-widgets';
import type { ScheduleBlockRow } from './schedule';
import { resolveMonogram } from './monogram';
import { DEFAULT_STUDIO_ANIM } from './hero-monogram-data';
import { buildSimulatedGuestIdentity } from './simulated-guest-preview';
import { LAB_SCRUB_SAMPLE } from '@/app/dev/maker-lab/lab-scrub';

export type SiteBodyFixtureProps = Parameters<typeof SiteBody>[0];

/** The instant every fixture render happens at (the helper pins the clock here): 10 October 2026, noon in Manila. */
export const FIXTURE_NOW = '2026-10-10T04:00:00.000Z';

export const FIXTURE_EVENT_ID = '00000000-0000-4000-8000-0000000000f1';
const STAMP = '2026-10-01T00:00:00Z';

/** What the fixture PUT on the page — the guards look for these in the HTML, so an empty shell cannot pass. */
export const FIXTURE_WORDS = {
  names: 'Maria & Jose',
  eventDate: '2026-12-12',
  /** The date as the page prints it (`formatEventDate`). */
  dateWords: 'December 12, 2026',
  ceremony: 'Santuario de San Antonio',
  venue: 'Seda Vertis North',
  message: 'We cannot wait to celebrate with you.',
  dressTitle: 'Formal — oxblood and olive',
  guestFirst: 'Lucia',
  guestLast: 'Reyes',
} as const;

export const FIXTURE_EVENT: EventRow = {
  event_id: FIXTURE_EVENT_ID,
  public_id: 'S89E-FXTR0000MJ',
  display_name: FIXTURE_WORDS.names,
  event_date: FIXTURE_WORDS.eventDate,
  venue_name: FIXTURE_WORDS.venue,
  venue_address: '1 Astra Way, Vertis North, Quezon City',
  venue_latitude: 14.6537,
  venue_longitude: 121.0367,
  venues: [
    { role: 'ceremony', name: FIXTURE_WORDS.ceremony, address: 'McKinley Rd, Forbes Park, Makati', latitude: 14.5476, longitude: 121.0335 },
    { role: 'reception', name: FIXTURE_WORDS.venue, address: '1 Astra Way, Vertis North, Quezon City', latitude: 14.6537, longitude: 121.0367 },
  ],
  slug: 'maria-and-jose',
  event_type: 'wedding',
  photo_moments_config: null,
  special_message: FIXTURE_WORDS.message,
  dress_code_config: {
    title: FIXTURE_WORDS.dressTitle,
    description: 'Long gowns and dark suits. Please leave white to the bride.',
    dos: ['Deep reds, olive, gold'],
    donts: ['White or ivory'],
    /* maria-and-jose's board stand-in in the lab (`LAB_BOARD`) — Oxblood & olive. */
    palette: [
      { name: 'Oxblood', hex: '#5B1A22' },
      { name: 'Olive', hex: '#6B7A3A' },
      { name: 'Gold', hex: '#E0A52B' },
    ],
  },
};

const block = (i: number, label: string, at: string, location: string, type: ScheduleBlockRow['block_type']): ScheduleBlockRow => ({
  block_id: `fixture-${i}`,
  public_id: `fixture-${i}`,
  event_id: FIXTURE_EVENT_ID,
  label,
  block_type: type,
  /* The schedule stores the event's own wall-clock, parked in UTC (`site-body.tsx`, "THE SCHEDULE STORES…"). */
  start_at: `${FIXTURE_WORDS.eventDate}T${at}:00Z`,
  end_at: null,
  location,
  notes: null,
  is_public: true,
  sort_order: i,
  parent_block_id: null,
  created_at: STAMP,
  run_state: 'upcoming',
  actual_start_at: null,
  actual_end_at: null,
  audience: null,
});

/** The lab's run of show (`LAB_BLOCKS`). */
export const FIXTURE_BLOCKS: ScheduleBlockRow[] = [
  block(1, 'Guests arrive', '14:30', FIXTURE_WORDS.ceremony, 'pre_ceremony'),
  block(2, 'Ceremony', '15:00', FIXTURE_WORDS.ceremony, 'ceremony'),
  block(3, 'Cocktails', '17:30', FIXTURE_WORDS.venue, 'cocktails'),
  block(4, 'Dinner & dancing', '19:00', FIXTURE_WORDS.venue, 'reception'),
];

/** The rows of `invitation_widgets` for this event, in page order. Nothing arranged on any of them (`config_json` {}). */
const WIDGET_ORDER: readonly WidgetType[] = [
  'hero',
  'greeting',
  'qr_card',
  'event_details',
  'rsvp',
  'countdown',
  'schedule',
  'special_message',
  'dress_code',
  'venue_map',
];

export function fixtureWidgets(canvases: Partial<Record<WidgetType, unknown>> = {}): InvitationWidgetRow[] {
  return WIDGET_ORDER.map((type, i) => ({
    widget_id: `fixture-${type}`,
    event_id: FIXTURE_EVENT_ID,
    widget_type: type,
    display_order: i,
    is_visible: true,
    is_always_on: WIDGET_CATALOG_BY_TYPE[type].is_always_on,
    tier: 'basic',
    config_json: type in canvases ? { canvas: canvases[type] } : {},
    created_at: STAMP,
    updated_at: STAMP,
  }));
}

/**
 * 🎚 THE SECOND PAGE: the same invitation with ONE scene stored to leave by Scrub — by default the Schedule, with the
 * lab's own canvas for it (`LAB_SCRUB_SAMPLE.schedule`: rows From the right + Fade, one by one · Blur + Fade out ·
 * Leaves: Scrub out).
 *
 * WHY THE SCHEDULE AND NOT THE COUNTDOWN. A scene hands over only to the NEXT scene of its own scenes block, and the
 * Invitation is a page a tab: the Countdown and the note are drawn on Welcome each in a block of its own, so there a
 * stored Scrub has nothing to hand over to. The Schedule is on Details with the scenes after it in one block.
 */
export const FIXTURE_SCRUB_SCENE = 'schedule' as const;
export const fixtureWidgetsWithAScrubScene = (scene: keyof typeof LAB_SCRUB_SAMPLE = FIXTURE_SCRUB_SCENE): InvitationWidgetRow[] =>
  fixtureWidgets({ [scene]: LAB_SCRUB_SAMPLE[scene] });

/** Every prop `SiteBody` takes, for the fixture invitation. A fresh object each call — a render cannot dirty the next. */
export function siteBodyFixtureProps(overrides: Partial<SiteBodyFixtureProps> = {}): SiteBodyFixtureProps {
  const identity = buildSimulatedGuestIdentity({
    slug: FIXTURE_EVENT.slug,
    person: {
      first_name: FIXTURE_WORDS.guestFirst,
      last_name: FIXTURE_WORDS.guestLast,
      display_name: `${FIXTURE_WORDS.guestFirst} ${FIXTURE_WORDS.guestLast}`,
      plus_one_allowed: false,
      plus_one_count: null,
    },
    /* On the list, not replied yet: the invitation as it is first met. */
    seeAs: 'pending',
  });
  return {
    event: FIXTURE_EVENT,
    identity,
    monogram: resolveMonogram({ display_name: FIXTURE_EVENT.display_name, monogram_text: null, monogram_color: null }),
    animatedMonogram: false,
    studioAnim: DEFAULT_STUDIO_ANIM,
    bespokeSvg: null,
    dayOfPhase: 'inactive',
    phasesEnabled: true,
    lifecyclePhase: 'rsvp',
    stdFilm: false,
    heroPhotoUrl: null,
    heroVideoUrl: null,
    bgMusicUrl: null,
    ownsStdReveal: false,
    ourPhotoUrls: [],
    widgets: fixtureWidgets(),
    scheduleBlocks: FIXTURE_BLOCKS,
    /* A free event: Scrub is a Pro arrangement (`scrubAllowed={proWatermarkHidden}`), and the mark stays on. */
    proWatermarkHidden: false,
    ...overrides,
  };
}
