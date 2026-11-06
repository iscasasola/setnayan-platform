/**
 * the-details-tab-repeats-nothing.test.ts — NO "EVENT DETAILS" CARD ON ANY PAGE (owner 2026-10-24, live on cale-ice ›
 * Details as a guest: *"why do we have this details. it doesn't look as beautiful as the rest of the event hub. and
 * isn't this a dupe?"*).
 *
 * The boxed card (EVENT DETAILS · DATE · CEREMONY · RECEPTION · YOUR ROLE · SIDE) repeated facts that each have ONE
 * home: the guest's role and side are Me's (its greeting), the date and the venues are the Venues scene's and Me's
 * greeting. It is dropped from the one list every page is drawn from (`OFF_THE_PAGE`, `lib/what-guests-see.ts`).
 *
 * Held, on the REAL page (`SiteBody` through `lib/site-body-fixture-render.ts`):
 *   (1) every stage × every reader × every arrangement (`lib/stage-pages-fixture.ts`) draws no Event Details card, no
 *       "Your role" / "Side" row or footnote, and no anonymous "THE DETAILS · WHEN" plate;
 *   (2) no style the couple can pick brings it back (list · big-date · card), and the guest's Details tab still draws
 *       the Venues scene — the venues' one home (anti-vacuity: the page is not simply empty);
 *   (3) the guest's role word is said on Me and nowhere on Details.
 *
 * Sabotage seen red (restored): `OFF_THE_PAGE` emptied — (1) (2) (3) all red.
 */
/* FIRST: this import brings in the renderer, which installs its seam before anything draws the guest page. */
import { STAGE_CASES, caseName, renderStagePage } from './stage-pages-fixture';
import { renderSiteBodyFixtureFull } from './site-body-fixture-render';
import { siteBodyFixtureProps } from './site-body-fixture';
import { OFF_THE_PAGE } from './what-guests-see';
import { test } from 'node:test';
import assert from 'node:assert/strict';

/** What the card drew, in any of its looks. */
const CARD_INK: readonly [string, RegExp][] = [
  ['the "Event details" eyebrow', />\s*Event details\s*</],
  ['a "Your role" row', />\s*Your role\s*</],
  ['a "Side" row', /<dt[^>]*>\s*Side\s*</],
  ['the role · side footnote', /Your role: |Side: /],
  ['the anonymous "The details · When" plate', /<span>The details<\/span>[\s\S]{0,400}>When</],
];

const noCard = (html: string, where: string) => {
  for (const [what, ink] of CARD_INK) assert.doesNotMatch(html, ink, `${where} draws ${what}`);
};

/** The guest's Details tab, alone. */
const detailsTab = (html: string): string => {
  const at = html.indexOf('data-hub-tab="details"');
  assert.ok(at > -1, 'anti-vacuity: the tabbed page has no Details tab');
  const next = html.indexOf('data-hub-tab=', at + 30);
  return html.slice(at, next > -1 ? next : undefined);
};

test('(1) every stage, every reader, every arrangement: no Event Details card', async () => {
  assert.ok(OFF_THE_PAGE.has('event_details'));
  assert.ok(STAGE_CASES.length >= 8, 'anti-vacuity: the stage cases are gone');
  for (const c of STAGE_CASES) noCard((await renderStagePage(c)).html, caseName(c));
});

test('(2) no style brings it back, and Details still has the venues’ own scene', async () => {
  const base = siteBodyFixtureProps();
  assert.ok(base.widgets.some((w) => w.widget_type === 'event_details'), 'anti-vacuity: the fixture no longer stores the scene');
  for (const style of [null, 'big-date', 'card']) {
    const widgets = base.widgets.map((w) =>
      w.widget_type === 'event_details' ? { ...w, config_json: { ...((w.config_json as object) ?? {}), ...(style ? { style } : {}) } } : w,
    );
    const { html } = await renderSiteBodyFixtureFull({ widgets } as never);
    noCard(html, `the guest page (style ${style ?? 'list'})`);
    const tab = detailsTab(html);
    assert.doesNotMatch(tab, /data-scene-style="(big-date|card)"[\s\S]{0,600}data-venue-role/, `a styled details card on Details (${style})`);
    assert.match(tab, /data-venue-map-pins|data-venue-directions/, 'anti-vacuity: Details lost the Venues scene');
  }
});

test('(3) the guest’s role is said on Me, never on Details', async () => {
  const base = siteBodyFixtureProps();
  const id = base.identity as { kind: string; guest: Record<string, unknown> };
  const identity = { ...id, guest: { ...id.guest, role: 'best_woman', side: 'groom', gender: 'woman' } } as never;
  const { html } = await renderSiteBodyFixtureFull({ identity } as never);
  const me = html.slice(html.indexOf('data-me-stage=""'));
  assert.match(me, /Best Woman/, 'anti-vacuity: Me no longer says the role');
  assert.doesNotMatch(detailsTab(html), /Best Woman/, 'Details repeats the role Me already says');
});
