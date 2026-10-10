/**
 * the-link-down-names-what-it-opens.test.ts — THE COVER'S LINK NEVER PROMISES A PART THE VIEWER'S PAGE DOES NOT HOLD.
 *
 * Measured on the live sample event as a stranger (2026-10-11): under the date
 * the cover read "the day, the place, the story ↓". It opens Details — which,
 * for that visitor, held the date, a one-row programme, the dress code and the
 * entourage. No venue (a stranger is not told where, on purpose) and no story.
 * The page withheld the place and the link went on promising it.
 *
 * 🔑 THE PROPERTY, measured on the REAL page (`SiteBody`, drawn with no
 * database — `lib/site-body-fixture-render.ts`), never on a phrase: for every
 * viewer and every page tried here, the link's words name "the place" only when
 * a venue is drawn on that viewer's page, and "the story" only when there is a
 * story to land on. Everything there → the words the card has always worn.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
/* FIRST, before anything that draws the guest page: this import installs the seam. */
import { renderSiteBodyFixture } from './site-body-fixture-render';
import { fixtureWidgets, FIXTURE_EVENT, FIXTURE_WORDS } from './site-body-fixture';
import { anonymousIdentity } from '@/app/[slug]/_lib/site-identity';
import { hubLinkWords } from '@/app/[slug]/_lib/invitation-card';
import { withheldVenue } from '@/lib/venue-disclosure';
import { HUB_LINK_DEFAULT_WORDS } from '@/lib/element-style';

/** The words of the cover's link down, as the page draws them (the ↓ is its own span). */
function linkWords(html: string): string | null {
  const m = /<a href="[^"]*#site-details"[^>]*class="inline-flex min-h-\[44px\][^"]*"[^>]*><span[^>]*>([^<]*)<\/span><span aria-hidden="true">↓<\/span><\/a>/.exec(html);
  return m ? m[1]!.replace(/&#x27;/g, '’') : null;
}
/**
 * Is the PLACE told on this page as a part of its own — the venues scene (its map and its named venues)? A
 * programme row's location line is not that: it says where one moment happens, not where to come.
 */
const drawsThePlace = (html: string) => /aria-label="Map showing [^"]*"/.test(html) && html.includes(`>${FIXTURE_WORDS.venue}</h3>`);
/** Is the couple's story on this page — its own words, as drawn (the page sets them into its own sentence)? */
const drawsAStory = (html: string) => /jeepney in Cubao/i.test(html);
const STORY = { how_we_met: 'On a jeepney in Cubao.', the_proposal: 'At the top of Mt. Pulag.' };

const stranger = anonymousIdentity({ reason: null, publicCandidCameraActive: false, publicAlbumHref: null });
test('the rule: the words name only what is there', () => {
  assert.equal(hubLinkWords({ place: true, story: true }), HUB_LINK_DEFAULT_WORDS, 'everything there — the card’s own words, byte for byte');
  for (const place of [true, false]) {
    for (const story of [true, false]) {
      const words = hubLinkWords({ place, story });
      assert.equal(/\bplace\b/.test(words), place, `place=${place} story=${story}: "${words}"`);
      assert.equal(/\bstory\b/.test(words), story, `place=${place} story=${story}: "${words}"`);
      assert.ok(/^the day\b/.test(words), `"${words}" no longer leads with the day — the date and the programme are always there`);
      assert.ok(words.length <= 60 && !/celebration|website|\bsite\b/i.test(words));
    }
  }
});

test('the real page, for six viewers: the link promises the place only where a venue is drawn, the story only where there is one', async () => {
  const cases: Array<{ who: string; props: Parameters<typeof renderSiteBodyFixture>[0] }> = [
    { who: 'a listed guest — the fixture as it is', props: {} },
    { who: 'a listed guest, with a love story', props: { event: { ...FIXTURE_EVENT, love_story: STORY } as never } },
    { who: 'a stranger — the venue withheld (the measured case)', props: { identity: stranger, event: withheldVenue(FIXTURE_EVENT) as never, widgets: fixtureWidgets().filter((w) => w.widget_type !== 'venue_map') } },
    { who: 'a stranger of an event with no venue yet', props: { identity: stranger, event: { ...FIXTURE_EVENT, venue_name: null, venue_address: null, venue_latitude: null, venue_longitude: null, venues: [] } as never } },
    { who: 'a listed guest of an event with no venue scene', props: { widgets: fixtureWidgets().filter((w) => w.widget_type !== 'venue_map') } },
    { who: 'a stranger, with a love story and no venue scene', props: { identity: stranger, event: { ...withheldVenue(FIXTURE_EVENT), love_story: STORY } as never, widgets: fixtureWidgets().filter((w) => w.widget_type !== 'venue_map') } },
  ];
  const seen = new Set<string>();
  const met: string[] = [];
  for (const { who, props } of cases) {
    const html = await renderSiteBodyFixture(props);
    const words = linkWords(html);
    assert.ok(words, `${who}: the cover’s link down was not found on the page — update linkWords(), do not delete this`);
    seen.add(words!);
    const place = drawsThePlace(html);
    const story = drawsAStory(html);
    assert.equal(/\bplace\b/.test(words!), place, `${who}: the link says "${words}" and the venues ${place ? 'ARE' : 'are NOT'} on the page it opens`);
    assert.equal(/\bstory\b/.test(words!), story, `${who}: the link says "${words}" and the story ${story ? 'IS' : 'is NOT'} on the page it opens`);
    if (place && story) assert.equal(words, HUB_LINK_DEFAULT_WORDS, `${who}: everything is there and the card’s own words changed`);
    met.push(`${place ? 'place' : '-'}/${story ? 'story' : '-'}`);
  }
  // Not vacuous: all four kinds of page were met — everything, the place alone, the story alone, neither.
  assert.deepEqual([...new Set(met)].sort(), ['-/-', '-/story', 'place/-', 'place/story'], `the cases no longer cover every kind of page (${met.join(' · ')})`);
  assert.equal(seen.size, 4, `four kinds of page, ${seen.size} wordings (${[...seen].join(' · ')})`);
});
