/**
 * 🚪 EVERY ONE OF THE TWENTY TYPES COMPLETES ONBOARDING, END TO END (Level 1, owner 2026-10-08 —
 * DECISION_LOG "ROADMAP AMENDED: ONBOARDING FOR THE EVENT TYPES WE ALREADY HAVE MOVES INTO LEVEL 1").
 *
 * Per type, with the type's own starting needs, the commit's own pure path: the wire's answers re-read
 * (`sanitizeSetupAnswers`, `sanitizeNeeds`), merged (`applyNeedsToSetup`), and built into the events
 * row (`buildGenericEventInsert` + `needsColumns`) — then the row is held to what the needs promised:
 * the three columns, the one QR when there is no list, every wedding-only column empty.
 *
 * The screens each type walks are pinned in setup-engine.test.ts; the seed itself in
 * tests/db/onboarding-engine-seed.db.test.ts. Wedding commits through its own wizard (untouched).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toProfile, profileSetup, type ProfileRow } from '@/lib/event-type-profile';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { setupViewFor } from './flow-config';
import { sanitizeSetupAnswers, setupDefaults } from './setup-answers';
import { buildGenericEventInsert } from './event-insert';
import { readGuestsReply } from '../rsvp-ask';
import {
  DEFAULT_PRESET_BY_TYPE,
  applyNeedsToSetup,
  defaultNeedsFor,
  needsColumns,
  readEventNeeds,
  sanitizeNeeds,
} from '../event-needs';
import type { GenericOnboardingPayload } from './types';

const TYPES = Object.keys(DEFAULT_PRESET_BY_TYPE).filter((t) => t !== 'wedding');

function profileOf(t: string) {
  const row = {
    event_type: t,
    terminology: { register: t === 'wake' ? 'solemn' : 'celebratory' },
    enabled_surfaces: null,
    marketplace_enabled: t === 'simple_event' ? false : null,
    look_set: t === 'wake' ? ['vintage', 'galeriya', 'house'] : ['house', 'galeriya', 'cyber'],
    camera_default: t === 'wake' ? 'quiet' : 'on',
    gifts_mode: 'gifts',
    guest_word: 'guests',
  } as unknown as ProfileRow;
  return toProfile(row);
}

test('the generic commit + the Get-together commit, for each of the nineteen non-wedding types', () => {
  assert.equal(TYPES.length, 19);
  for (const t of TYPES) {
    const p = profileOf(t);
    assert.equal(p.onboardingEngine, true, t);
    const view = setupViewFor(p, profileSetup(p), pickableInviteThemes());
    const scope = { marketplace: p.marketplaceEnabled === true };
    const wireNeeds = defaultNeedsFor(t, scope);
    // What the client posts: the defaults, a place typed on "What do you need?".
    const wireSetup = { ...setupDefaults(view), where: 'place', whereText: 'Pasig · our place' };

    // ── the server's own re-read ──
    const needs = sanitizeNeeds(JSON.parse(JSON.stringify(wireNeeds)), defaultNeedsFor(t, scope), scope);
    const setup = applyNeedsToSetup(sanitizeSetupAnswers(wireSetup, view)!, needs);
    const payload: GenericOnboardingPayload = {
      eventType: t,
      displayName: `New ${t}`,
      region: null,
      venueLatitude: null,
      venueLongitude: null,
      pax: null,
      budgetBand: null,
      budgetAmountCentavos: null,
      dateMode: 'specific',
      dateCandidates: [],
      windowStart: null,
      windowEnd: null,
      moodFeelKey: null,
      experiencePersona: null,
      experienceForWhom: null,
      experienceAxes: {},
      picks: [],
      interestedServices: [],
      refinements: {},
      basicMoodboard: null,
      places: [],
      guidanceOptIn: true,
      sendTopInquiries: false,
      inquiriesPerCategory: 0,
      role: 'host',
    };
    const row = {
      ...buildGenericEventInsert(payload, {
        slug: `new-${t}`,
        now: '2026-10-18T00:00:00.000Z',
        userId: 'u1',
        isAnonymous: false,
        experienceEnabled: true,
        homeSignalsEnabled: true,
        setup,
      }),
      ...needsColumns(needs),
    } as Record<string, unknown>;

    assert.equal(row.event_type, t);
    assert.equal(row.venue_name, 'Pasig · our place', `${t}: the place typed on the needs screen is lost`);
    assert.equal(row.papic_on, true, `${t}: Papic is always on from "What do you need?"`);
    assert.equal(row.bride_name, null, t);
    assert.equal(row.ceremony_type, null, t);
    // The needs read back exactly as chosen.
    const read = readEventNeeds(row as never);
    assert.deepEqual(read, { guestList: needs.guestList, suppliers: needs.suppliers, hubDetails: needs.hubDetails }, t);
    // No guest list ⇒ guests do not reply and anyone with the link gets in (one QR).
    const rsvp = row.rsvp_ask_config as { guestsReply?: boolean; whoCanRsvp?: string } | undefined;
    if (!needs.guestList) {
      assert.equal(readGuestsReply(rsvp ?? null), false, `${t}: no list but guests are asked to reply`);
      assert.equal(rsvp?.whoCanRsvp, 'anyone', `${t}: no list and no one QR`);
    } else {
      assert.equal(readGuestsReply(rsvp ?? null), true, `${t}: a list but replies are off`);
    }
    if (t === 'simple_event') assert.equal(row.suppliers_on, false, 'a vendor-free type never has Suppliers on');
  }
});

test('both commits write the needs, re-read on the server — never the wire as sent', () => {
  for (const f of ['app/onboarding/_shared/commit-event.ts', 'app/onboarding/simple/actions.ts']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    assert.match(src, /sanitizeNeeds\(/, `${f} trusts the wire's needs`);
    assert.match(src, /applyNeedsToSetup\(sanitizedSetup, needs\)/, `${f} lets the setup disagree with the needs`);
    assert.match(src, /needsColumns\(needs\)/, `${f} never writes the needs`);
  }
});
