/**
 * 🗺 EACH STAGE'S PAGES AND THEIR PARTS ARE THE PROTOTYPE'S `TABS` (owner 2026-10-07: "post event does not have the
 * appropriate scenes/elements" — the contract is `maker_two_dropdowns_owner_wireframe_2026-10-06_fable.html`, TABS).
 *
 * Pinned here as a COPY of the prototype's map, so a change to `MAKER_STAGE_PAGES` that drops or reorders a
 * prototype part goes red. What the code ADDS is named, with its reason, below; what it LACKS is named too, so a gap
 * stays visible instead of silently passing.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { makerPartCanvasOn } from './maker-part-groups';
import { MAKER_STAGE_PAGES, type MakerPartKey } from './maker-parts';
import { makerStagesPageOf, makerStagesPages, readerPageOf } from './maker-stage-filing';

/** The prototype's TABS (line ~1226), page label → [code page key, parts]. */
const PROTOTYPE: Record<string, ReadonlyArray<[label: string, page: string | null, parts: readonly string[]]>> = {
  save_the_date: [['Save the Date', 'home', ['reveal', 'logo', 'ename', 'names', 'date', 'place', 'countdown', 'message']]],
  rsvp_stage: [
    ['RSVP form', 'form', ['logo', 'ename', 'names', 'date', 'place', 'rsvp', 'greeting']],
    ['When yes', 'thanks', ['yesnote', 'pass']],
    ['When no', 'decline', ['nonote']],
  ],
  rsvp: [
    ['Welcome', 'home', ['reveal', 'logo', 'ename', 'names', 'date', 'place', 'rsvpcard', 'countdown', 'opening', 'greeting', 'message', 'reminders', 'gifts']],
    ['Details', 'details', ['schedule', 'venue', 'dress', 'march', 'bring']],
    ['Our Love Story', 'story', ['story']],
    ['Me', 'me', ['rsvpcard', 'myrole', 'mywear', 'myarrive', 'myguests', 'seats']],
  ],
  event: [
    ['Live', 'live', ['reveal', 'announce', 'logo', 'names', 'date', 'place', 'schedule']],
    ['Welcome', 'home', ['venue', 'dress', 'march', 'bring']],
    ['Camera', 'camera', ['camera']],
    ['Gallery', 'gallery', ['gallery', 'myphotos']],
    ['Me', 'me', ['seats', 'pass']],
  ],
  editorial: [
    ['Thank you', 'home', ['logo', 'ename', 'names', 'date', 'numbers', 'message', 'wishes', 'story', 'suppliers']],
    ['Gallery', 'gallery', ['film', 'gallery', 'myphotos']],
    /* ⚠ NOT BUILT: the shipped after-the-day guest bar has no Gifts tab (Recap · Film · Suppliers · Gallery,
       `app/[slug]/_lib/site-nav.ts`). Adding one is a change to the GUEST bar — an owner call, not a Maker one. */
    ['Gifts', null, ['gifts']],
  ],
};

/** What the code adds to a prototype page, and why. Anything else extra is red. */
const ADDED: Record<string, readonly string[]> = {
  /* "every visible piece of the page must be a pickable part" (owner 2026-10-07): the cover's invite line and link. */
  'save_the_date/home': ['heroline', 'herolink'],
  'rsvp/home': ['heroline', 'herolink'],
  /* …the Details page's "THE DETAILS · WHEN · WHERE" block. */
  'rsvp/details': ['details'],
  /* …the day's "Happening now" card, and the day's cover draws its Title too. */
  'event/live': ['spotlight', 'livehub', 'ename', 'heroline', 'herolink'],
  /* …and the RSVP stage's two after-screens draw the couple's mark, their names and their invitation line over the
     note (`invite/enter`'s masthead) — each a part there (`lib/the-rsvp-stage-is-parts.test.ts`). */
  'rsvp_stage/thanks': ['logo', 'names', 'heroline'],
  'rsvp_stage/decline': ['logo', 'names', 'heroline'],
};
/** Pages the code has that the prototype does not — each a tab the SHIPPED guest bar draws. */
const BAR_PAGES: Record<string, readonly string[]> = {
  save_the_date: ['story', 'me'],
  editorial: ['film', 'suppliers'],
};

const stagePages = (stage: string) => (MAKER_STAGE_PAGES as unknown as Record<string, Record<string, readonly string[]>>)[stage === 'rsvp_stage' ? Object.keys(MAKER_STAGE_PAGES).find((k) => 'form' in (MAKER_STAGE_PAGES as never as Record<string, object>)[k]!)! : stage]!;

test('every prototype page is a page of its stage, with the prototype’s parts in the prototype’s order', () => {
  const missing: string[] = [];
  for (const [stage, pages] of Object.entries(PROTOTYPE)) {
    const code = stagePages(stage);
    assert.ok(code, `${stage} is a stage`);
    for (const [label, page, parts] of pages) {
      if (page === null) {
        missing.push(`${stage} › ${label}`);
        continue;
      }
      const have = code[page];
      assert.ok(have, `${stage} › ${label} (${page}) is a page`);
      /* The prototype's parts, in order, with only the named additions between them. */
      const added = ADDED[`${stage}/${page}`] ?? [];
      assert.deepEqual(have!.filter((k) => !added.includes(k)), [...parts], `${stage} › ${label}: the prototype's parts, in order`);
      for (const k of added) assert.ok(have!.includes(k), `${stage} › ${label}: ${k} was named as added`);
    }
    const known = new Set([...pages.map(([, p]) => p).filter(Boolean), ...(BAR_PAGES[stage] ?? [])]);
    for (const p of Object.keys(code)) assert.ok(known.has(p), `${stage} › ${p}: a page the prototype does not have, and no guest-bar tab explains it`);
  }
  /* The one known gap, kept visible: */
  assert.deepEqual(missing, ['editorial › Gifts'], 'the pages not built are exactly these');
});

/**
 * 📱 …AND THE GUEST'S PHONE FILES THEM THE SAME (owner 2026-10-08, DECISION_LOG "EIGHT OWNER ANSWERS" answer 5 — asked
 * whether the guest page should change to match the Maker's filing: *"yes"*). For the two stages whose page is tabs,
 * every prototype part the canvas draws is on the PROTOTYPE's page for a guest too — copied here from the prototype,
 * so a change to either filing that parts them goes red.
 */
test('a guest meets every prototype part on the prototype’s page — the Invitation and The Day', () => {
  for (const stage of ['rsvp', 'event'] as const) {
    const pages = makerStagesPages(stage).map((p) => p.key);
    /* The fullest bar a guest holds: every page of the stage that is a tab of the page (the Camera is its own screen). */
    const guestTabs = pages.filter((p) => p !== 'camera');
    const seen = new Set<string>();
    let checked = 0;
    for (const [label, page, parts] of PROTOTYPE[stage]!) {
      assert.ok(page, `${stage} › ${label} is a page`);
      for (const part of parts) {
        const canvas = makerPartCanvasOn(stage, part as MakerPartKey);
        if (!canvas || seen.has(canvas)) continue; // not drawn by the canvas yet, or the first page that names it has it
        seen.add(canvas);
        checked += 1;
        assert.equal(makerStagesPageOf(stage, canvas, pages), page, `${stage} › ${label}: the Maker files ${part} elsewhere`);
        /* The tab the guest's page asked for before the ruling does not matter: the prototype's page wins. */
        for (const want of ['live', 'home', 'details', 'story', 'gallery', 'me']) {
          assert.equal(readerPageOf(stage, canvas, want, guestTabs, pages), page, `${stage} › ${label}: a guest meets ${part} on another page (asked ${want})`);
        }
      }
    }
    assert.ok(checked >= 7, `precondition: ${stage} draws several prototype parts (${checked})`);
  }
  // The owner's own example.
  const inv = makerStagesPages('rsvp').map((p) => p.key);
  assert.equal(readerPageOf('rsvp', 'w:countdown', 'details', ['home', 'details', 'story', 'me'], inv), 'home', 'Countdown: Welcome, for the couple and for the guest');
});
