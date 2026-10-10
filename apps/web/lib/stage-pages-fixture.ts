/**
 * 🧪 THE GUEST PAGE ON EVERY STAGE, AS DATA — test tooling for "WHAT GUESTS SEE" (DECISION_LOG 2026-10-10).
 * Nothing under `app/` imports this file; it draws nothing itself.
 *
 * `lib/site-body-fixture.ts` is one invitation on one stage (the Invitation, a listed guest). The per-stage work has
 * to show two things about the REAL page (`SiteBody`, drawn by `lib/site-body-fixture-render.ts`):
 *   · with nothing stored per stage, every stage's page is the page it was — to the byte;
 *   · a stored per-stage value reaches every place that draws a scene, the ones that do not read the stage's list
 *     included (the Day's Welcome, the Day's schedule and directions, the love story's fall-back, the film).
 * So this file is the SAME couple with every scene filled — a love story, reminders, their own photos, a scene of
 * their own — and the list of pages to draw: stage × reader × a few arrangements.
 *
 * WHAT A "CASE" PINS. `identity` is the reader (a listed guest, or someone with no key). `arrangement`:
 *   · `plain`     — every scene switched on (the couple touched nothing);
 *   · `hidden`    — the love story, the dress code, the reminders, the schedule and the map switched OFF for the whole
 *                   event (today's eye). This is the page that shows which readers follow the eye today and which do
 *                   not: the prose love story stands in for the hidden scene, the Day's schedule and directions stay;
 *   · `browse`    — open browsing on (`events.website_open_browse`), one scene set to Hidden and one to Shown;
 *   · `film`      — the Save the Date led by its film (the film draws its own gallery and love story);
 *   · `photos`    — the Save the Date led by the couple's photos (`config_json.std_lead = 'photos'` on the gallery row).
 * On the Save the Date, `plain` / `hidden` / `browse` are the film-led page with the film itself switched off by the
 * link (`?film=0` → `stdFilm: false`): the film's plain stand-in, which draws a countdown and a love story of its own.
 */
/* FIRST, before any other module of the app: the renderer installs its seam as it loads (see its docblock), and a
   module loaded before the seam keeps the real database client. A test imports THIS file first. */
import { renderSiteBodyFixtureFull } from './site-body-fixture-render';
import type { InvitationWidgetRow, LifecyclePhase, WidgetType } from './invitation-widgets';
import { WIDGET_CATALOG_BY_TYPE } from './invitation-widgets';
import type { SiteBodyFixtureProps } from './site-body-fixture';

/* The fixture's VALUES are required when a page is drawn, as the renderer itself does. */
const base = () => require('./site-body-fixture') as typeof import('./site-body-fixture');

export const STAGES: readonly LifecyclePhase[] = ['save_the_date', 'rsvp', 'event', 'editorial'];
export type StageReader = 'guest' | 'anonymous';
export type StageArrangement = 'plain' | 'hidden' | 'browse' | 'film' | 'photos';

/** Words this file puts on the page — the guards look for them, so "it is not drawn" is never an empty shell. */
export const STAGE_WORDS = {
  /** The love story's first line, as the couple wrote it at onboarding (the scene AND the prose both carry it). */
  howWeMet: 'we shared an umbrella outside the old library',
  /** The prose fall-back's own opening (`composeOurStory`) — the scene never prints this. */
  proseOpening: 'It began back in 2016, as the best stories do',
  reminder: 'Bring your printed ticket',
  ownSceneTitle: 'A note from our parents',
  photo: 'https://fixture.invalid/our-photos/one.jpg',
} as const;

/** Every hideable scene the table covers, plus one scene of the couple's own — after the always-on rows. */
const ROW_ORDER: readonly WidgetType[] = [
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
  'what_to_bring',
  'our_love_story',
  'our_photos',
  'photo_moments',
  'your_photos',
  'tier_comparison',
  'custom_1',
];

export type RowPatch = Partial<Pick<InvitationWidgetRow, 'is_visible' | 'mode' | 'audience'>> & { config?: Record<string, unknown> };

/** The rows of `invitation_widgets` for the full invitation. `patch` lays a change over a row, by type. */
export function stageWidgets(patch: Partial<Record<WidgetType, RowPatch>> = {}): InvitationWidgetRow[] {
  return ROW_ORDER.map((type, i) => {
    const p = patch[type] ?? {};
    const own = type === 'custom_1' ? { custom: { title: STAGE_WORDS.ownSceneTitle, body: 'Thank you for coming all this way.' } } : {};
    return {
      widget_id: `stage-${type}`,
      event_id: base().FIXTURE_EVENT_ID,
      widget_type: type,
      display_order: i,
      is_visible: p.is_visible ?? true,
      is_always_on: WIDGET_CATALOG_BY_TYPE[type].is_always_on,
      tier: 'basic',
      config_json: { ...own, ...(p.config ?? {}) },
      created_at: '2026-10-01T00:00:00Z',
      updated_at: '2026-10-01T00:00:00Z',
      ...(p.mode ? { mode: p.mode } : {}),
      ...(p.audience ? { audience: p.audience } : {}),
    };
  });
}

/** The scenes today's eye is switched off on, in the `hidden` arrangement. */
export const HIDDEN_SCENES: readonly WidgetType[] = ['our_love_story', 'dress_code', 'what_to_bring', 'schedule', 'venue_map'];

const ARRANGED: Record<StageArrangement, () => Partial<Record<WidgetType, RowPatch>>> = {
  plain: () => ({}),
  hidden: () => Object.fromEntries(HIDDEN_SCENES.map((t) => [t, { is_visible: false }])),
  browse: () => ({ special_message: { mode: 'hidden' }, dress_code: { mode: 'shown', is_visible: false }, venue_map: { audience: 'guests_only' } }),
  film: () => ({}),
  photos: () => ({ our_photos: { config: { std_lead: 'photos' } } }),
};

/** How a host's `?phase=` preview forces the day's own clock for each stage (`app/[slug]/page.tsx`). */
const DAY_OF: Record<LifecyclePhase, SiteBodyFixtureProps['dayOfPhase']> = {
  save_the_date: 'inactive',
  rsvp: 'inactive',
  event: 'live',
  editorial: 'post',
};

export type StageCase = { stage: LifecyclePhase; reader: StageReader; arrangement: StageArrangement };

/** Every page the record holds: 4 stages × 2 readers × 3 arrangements, and the Save the Date's two leads for each reader. */
export const STAGE_CASES: readonly StageCase[] = [
  ...STAGES.flatMap((stage) =>
    (['guest', 'anonymous'] as const).flatMap((reader) => (['plain', 'hidden', 'browse'] as const).map((arrangement) => ({ stage, reader, arrangement }))),
  ),
  ...(['guest', 'anonymous'] as const).flatMap((reader) => (['film', 'photos'] as const).map((arrangement) => ({ stage: 'save_the_date' as const, reader, arrangement }))),
];

export const caseName = (c: StageCase) => `${c.stage} · ${c.reader} · ${c.arrangement}`;

/** The props of `SiteBody` for one case; `rows` overrides the arrangement's own rows (a stored per-stage value). */
export function stageProps(c: StageCase, rows?: InvitationWidgetRow[], more: Partial<SiteBodyFixtureProps> = {}): Partial<SiteBodyFixtureProps> {
  const f = base();
  const event = {
    ...f.FIXTURE_EVENT,
    love_story: { how_we_met: STAGE_WORDS.howWeMet, met_year: '2016', proposal: 'he asked on the same steps, ten years on' },
    what_to_bring: `${STAGE_WORDS.reminder}\nArrive by 2:30`,
    website_open_browse: c.arrangement === 'browse',
  };
  const film = c.arrangement === 'film';
  return {
    event,
    widgets: rows ?? stageWidgets(ARRANGED[c.arrangement]()),
    lifecyclePhase: c.stage,
    dayOfPhase: DAY_OF[c.stage],
    ourPhotoUrls: [STAGE_WORDS.photo, 'https://fixture.invalid/our-photos/two.jpg'],
    stdFilm: film,
    ownsStdReveal: film,
    ...(c.reader === 'anonymous'
      ? { identity: { kind: 'anonymous', reason: null, publicCandidCameraActive: false, publicAlbumHref: null, signedInNotListed: false } as SiteBodyFixtureProps['identity'] }
      : {}),
    ...more,
  };
}

/**
 * 👗 A GUEST WITH A LOOK OF HER OWN. The fixture's guest has no role, and the guest's look (the dress code's "you"
 * half, which the Welcome draws) says only what is this reader's own — so for her it draws nothing. These props make
 * her a bridesmaid the couple dressed: the look then prints `data-dress-code="you"` and `LOOK_NOTE`.
 */
export const LOOK_NOTE = 'Olive, floor length';
export function withALook(c: StageCase): Partial<SiteBodyFixtureProps> {
  const f = base();
  const props = stageProps(c);
  const identity = f.siteBodyFixtureProps().identity;
  if (identity.kind !== 'guest') throw new Error('the fixture reader is not a guest');
  return {
    event: {
      ...props.event!,
      dress_code_config: { ...(props.event!.dress_code_config as Record<string, unknown>), roles: { bridesmaid: { style: 'long_gown', note: LOOK_NOTE } } },
    },
    identity: { ...identity, guest: { ...identity.guest, role: 'bridesmaid' } },
  };
}

export type StagePage = { html: string; complaints: string[] };

/** The REAL guest page for one case. */
export async function renderStagePage(c: StageCase, rows?: InvitationWidgetRow[], more: Partial<SiteBodyFixtureProps> = {}): Promise<StagePage> {
  const page = await renderSiteBodyFixtureFull(stageProps(c, rows, more));
  return { html: page.html, complaints: page.complaints };
}
