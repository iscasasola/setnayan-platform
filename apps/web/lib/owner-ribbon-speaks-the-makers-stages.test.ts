/**
 * THE HOST'S PREVIEW ▾ SPEAKS THE MAKER'S STAGES — one stage vocabulary.
 *
 * Found live by the controller, 2026-10-05, on maria-and-jose: the public page's
 * Preview ▾ listed Save the Date · Invitation · The Day · **After** — no RSVP
 * stage, and "After" where the Maker (Page ▾, `MAKER_PAGE_STAGES`) and the setup
 * ("Which stage do you want ready?", `SETUP_STAGES`) say Save the Date · **RSVP**
 * · Invitation · The Day · **Post Event**.
 *
 * Holds the ribbon's stage list EQUAL to the Maker's (keys, order, words) — so a
 * stage renamed or added in one place shows up red here, not as a third
 * vocabulary — and the RSVP stage's link opening the reply page (the host-only
 * canvas door `?preview=draft`, as the Maker's RSVP canvas uses).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOwnerRibbon } from './owner-ribbon';
import { MAKER_PAGE_STAGES, makerStageLabel } from '@/app/dashboard/[eventId]/launch/_components/maker-bar';
import { SETUP_STAGES, setupStageLabel } from './stage-setup';
import type { OwnerCapability } from '@/app/[slug]/_lib/site-identity';

/** maria-and-jose, previewed by its host (shape read 2026-10-05). */
const MJ = { eventId: '947e7bab-893d-454d-b4c5-0a6e23f36009', slug: 'maria-and-jose' };
const HOST: OwnerCapability = { capability: 'owner', ownerUserId: 'host-1', ownerEventId: MJ.eventId, maySiteEdit: true };

const model = () => {
  const m = buildOwnerRibbon({ ownerCapability: HOST, eventId: MJ.eventId, slug: MJ.slug, phasesEnabled: true, lifecyclePhase: 'rsvp' });
  assert.ok(m, 'a verified host gets the ribbon');
  return m;
};

test('1 · the stages are the Maker’s five, in its order and its words', () => {
  const links = model().phaseLinks;
  assert.deepEqual(links.map((l) => l.phase), [...MAKER_PAGE_STAGES]);
  assert.deepEqual(links.map((l) => l.label), MAKER_PAGE_STAGES.map(makerStageLabel));
  assert.deepEqual(links.map((l) => l.label), SETUP_STAGES.map(setupStageLabel));
  assert.deepEqual(links.map((l) => l.label), ['Save the Date', 'RSVP', 'Invitation', 'The Day', 'Post Event']);
  assert.ok(!links.some((l) => l.label === 'After'), '"After" is not a stage name anywhere else in the app');
});

test('2 · the RSVP stage opens the reply page; the Invitation is the page on screen', () => {
  const links = model().phaseLinks;
  const rsvp = links.find((l) => l.label === 'RSVP');
  assert.equal(rsvp?.href, `/${MJ.slug}/invite/reply?preview=draft`);
  assert.equal(rsvp?.active, false);
  assert.deepEqual(links.filter((l) => l.active).map((l) => l.label), ['Invitation']);
});
