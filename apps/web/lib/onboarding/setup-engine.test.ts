/**
 * The event onboarding engine (G1) — the per-type step lists and the four
 * owner rules, pinned (DECISION_LOG 2026-09-30 "THE SETUP LIVES AT THE END OF
 * CREATING THE EVENT…", "EVERY SETUP CARD NEEDS AN ANSWER", "THE RSVP IS
 * OPTIONAL…"; 2026-10-01 "THE ONBOARDING PHONE DESIGN — APPROVED", "ELEVEN
 * OWNER ANSWERS" #4 #5).
 *
 *   1. per type, the EXACT screens the wizard draws (birthday · hangout · date ·
 *      get-together on /onboarding/[type] and /onboarding/simple; wedding on its
 *      own shell)
 *   2. NEVER ASKS TWICE — an essential a creation flow already collected never
 *      comes back as a setup card
 *   3. a wake has no guest-list step (the guest list is optional for a wake)
 *   4. every card offers at least one quick answer
 *
 * Profiles come through `toProfile` (the real reader), never hand-built, so a
 * regression in the column read is caught here too. The SEED itself is pinned
 * against the replayed migrations in tests/db/onboarding-engine-seed.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  WAKE_PROFILE,
  profileSetup,
  toProfile,
  type EventTypeProfile,
  type ProfileRow,
} from '@/lib/event-type-profile';
import { pickableInviteThemes } from '@/lib/invite-themes';
import { eventTypeAcceptsHonoreeLink } from '@/lib/honoree-dependent-link';
import { canToggleRecur } from '@/lib/event-anchor';
import { getSpecialtyFields } from './specialty-catalog';
import {
  CREATION_ASKS,
  SETUP_ESSENTIALS,
  WEDDING_SETUP_INSERT_BEFORE,
  genericFlowScreens,
  resolveSetupSteps,
  setupViewFor,
  type CreationFlow,
} from './flow-config';
import {
  SETUP_CARD_IDS,
  sanitizeSetupAnswers,
  setupCardAnswered,
  setupDefaults,
  setupLanding,
  setupQuickAnswers,
  type SetupView,
} from './setup-answers';
import { setupColumns } from './event-insert';
import { readGuestsReply, sanitizeRsvpAskConfig } from '../rsvp-ask';
import { rsvpGate } from '../guest-one-path';
import { guestGroupsFor, resolveRoleSet } from '../role-sets';

/** The seed of migration 20271258536791, as rows. Base columns as prod carries them. */
function row(eventType: string, extra: Partial<ProfileRow>): ProfileRow {
  return {
    event_type: eventType,
    terminology: { register: 'celebratory' },
    enabled_surfaces: null,
    marketplace_enabled: null,
    event_class: null,
    layer_mode: null,
    multi_day: null,
    onboarding_flow_key: eventType,
    role_set_key: null,
    template_pack_key: null,
    monogram_set_key: null,
    reveal_pack_key: null,
    budget_taxonomy_key: null,
    schedule_seed_key: null,
    statutory_pack_key: null,
    ...extra,
  };
}

const SEEDED: Record<string, EventTypeProfile> = {
  wedding: toProfile(row('wedding', { role_set_key: 'wedding', guest_word: 'guests', gifts_mode: 'gifts', look_set: ['velvet', 'vintage', 'regency', 'cinderella'], camera_default: 'on' })),
  birthday: toProfile(row('birthday', { role_set_key: 'birthday', guest_word: 'guests', gifts_mode: 'gifts', look_set: ['whimsical', 'abaca', 'house', 'galeriya'], camera_default: 'on' })),
  hangout: toProfile(row('hangout', { role_set_key: 'hangout', guest_word: 'guests', gifts_mode: 'none', look_set: ['house', 'galeriya', 'cyber'], camera_default: 'on' })),
  date: toProfile(row('date', { role_set_key: 'hangout', guest_word: 'guests', gifts_mode: 'none', look_set: ['house', 'galeriya', 'cyber'], camera_default: 'on' })),
  simple_event: toProfile(row('simple_event', { guest_word: 'guests', gifts_mode: 'none', look_set: ['house', 'galeriya', 'cyber'], camera_default: 'on' })),
};

function viewOf(p: EventTypeProfile): SetupView {
  // The same composition as lib/onboarding/setup-view.ts: the wedding fence
  // lets a wedding wear Pro looks; nobody else.
  return setupViewFor(p, profileSetup(p), pickableInviteThemes());
}

/** The generic wizard's screens for a type with the engine on — the inputs exactly as generic-onboarding.tsx derives them. */
function genericScreens(eventType: string): string[] {
  const p = SEEDED[eventType]!;
  return genericFlowScreens({
    engine: true,
    asksHonoree: eventTypeAcceptsHonoreeLink(eventType),
    isAnniversary: eventType === 'anniversary',
    showRecurToggle: canToggleRecur(eventType),
    typeQuestionIds: ['should_not_appear'],
    hasSpecialty: getSpecialtyFields(eventType).length > 0,
    axisIds: ['exp_for_whom', 'exp_feel', 'exp_energy', 'exp_roots', 'exp_effort'],
    services: false,
    setupSteps: resolveSetupSteps(viewOf(p), CREATION_ASKS.generic),
  });
}

const CARDS = ['setup_where', 'setup_photo', 'setup_look', 'setup_entry', 'setup_guests', 'setup_more'];

// ── 1 · per type, the exact step list ─────────────────────────────────────

test('the seed admits exactly the five types; a code fallback never does', () => {
  for (const [type, p] of Object.entries(SEEDED)) assert.equal(p.onboardingEngine, true, type);
  assert.equal(WAKE_PROFILE.onboardingEngine ?? false, false);
  // A row without a look set (wake · corporate · the rest, until G5) stays on yesterday's onboarding.
  assert.equal(toProfile(row('corporate', {})).onboardingEngine, false);
  assert.equal(toProfile(row('corporate', { look_set: [] })).onboardingEngine, false);
});

test('birthday — exact screens (honoree is its type step; the quiz is gone)', () => {
  assert.deepEqual(genericScreens('birthday'), [
    'welcome', 'name', 'honoree', 'date',
    ...(getSpecialtyFields('birthday').length > 0 ? ['specialty'] : []),
    ...CARDS, 'congrats',
  ]);
});

test('hangout — exact screens', () => {
  assert.deepEqual(genericScreens('hangout'), [
    'welcome', 'name', 'date',
    ...(canToggleRecur('hangout') ? ['recurs'] : []),
    ...(getSpecialtyFields('hangout').length > 0 ? ['specialty'] : []),
    ...CARDS, 'congrats',
  ]);
});

test('date — exact screens', () => {
  assert.deepEqual(genericScreens('date'), [
    'welcome', 'name', 'date',
    ...(canToggleRecur('date') ? ['recurs'] : []),
    ...(getSpecialtyFields('date').length > 0 ? ['specialty'] : []),
    ...CARDS, 'congrats',
  ]);
});

test('get-together (simple_event) — its one form asks name + date, then the same six cards', () => {
  assert.deepEqual(resolveSetupSteps(viewOf(SEEDED.simple_event!), CREATION_ASKS.simple), CARDS);
});

test('wedding — the six cards, slotted into its own shell before the services step', () => {
  assert.deepEqual(resolveSetupSteps(viewOf(SEEDED.wedding!), CREATION_ASKS.wedding), CARDS);
  assert.equal(WEDDING_SETUP_INSERT_BEFORE, 'services_step');
});

test('with the engine on the long quiz has left onboarding (pax · region · tq_ · axes · reveal)', () => {
  for (const type of ['birthday', 'hangout', 'date']) {
    const s = genericScreens(type);
    for (const gone of ['pax', 'region', 'reveal', 'tq_should_not_appear', 'exp_for_whom', 'exp_effort']) {
      assert.ok(!s.includes(gone), `${type} still asks ${gone}`);
    }
  }
});

test('the defaults by type: wedding replies, the casual types come in on one QR', () => {
  assert.equal(viewOf(SEEDED.wedding!).replyDefault, 'yes');
  for (const t of ['birthday', 'hangout', 'date', 'simple_event']) {
    const v = viewOf(SEEDED[t]!);
    assert.equal(v.replyDefault, 'no', t);
    assert.equal(setupDefaults(v).entry, 'one_qr', t);
  }
});

test('every type may be offered a Pro look (◆) — still Pro, never blocking (2026-10-01)', () => {
  for (const t of ['birthday', 'hangout', 'date', 'simple_event']) {
    const v = viewOf(SEEDED[t]!);
    assert.ok(v.looks.length > 0, t);
    assert.ok(v.looks.some((l) => l.pro), `${t} is shut out of the ◆ looks`);
  }
  assert.ok(viewOf(SEEDED.wedding!).looks.some((l) => l.pro), 'a wedding sees its ◆ looks');
});

// ── 2 · never asks twice ──────────────────────────────────────────────────

test('🔁 NEVER ASKS TWICE — what a creation flow collected never comes back as a card', () => {
  const ESSENTIAL_OF: Record<string, string> = {
    setup_where: 'where',
    setup_photo: 'photo',
    setup_look: 'look',
    setup_entry: 'entry',
    setup_guests: 'guests',
  };
  for (const flow of Object.keys(CREATION_ASKS) as CreationFlow[]) {
    const asked: readonly string[] = CREATION_ASKS[flow];
    for (const p of [...Object.values(SEEDED), { ...WAKE_PROFILE, onboardingEngine: true }]) {
      for (const card of resolveSetupSteps(viewOf(p), CREATION_ASKS[flow])) {
        const essential = ESSENTIAL_OF[card];
        assert.ok(!essential || !asked.includes(essential), `${flow} asks ${essential} and the engine asks it again (${p.eventType})`);
      }
    }
    // The same rule against the whole wizard: a creation screen that asks an
    // essential is never followed by the card that asks it again.
    if (flow === 'generic') {
      for (const t of ['birthday', 'hangout', 'date']) {
        const s = genericScreens(t);
        assert.equal(s.filter((x) => x === 'name').length, 1, `${t} asks the name twice`);
        assert.equal(s.filter((x) => x === 'date').length, 1, `${t} asks the date twice`);
      }
    }
  }
  // And the rule holds in the other direction too: asking an essential
  // during creation REMOVES its card.
  const view = viewOf(SEEDED.birthday!);
  assert.ok(!resolveSetupSteps(view, ['name', 'when', 'where']).includes('setup_where'));
  assert.ok(SETUP_ESSENTIALS.includes('where'));
});

// ── 3 · a wake has no guest-list step ─────────────────────────────────────

test('a wake has no guest-list step, and its guests default to "later"', () => {
  const view = viewOf({ ...WAKE_PROFILE, onboardingEngine: true });
  assert.equal(view.solemn, true);
  assert.equal(view.guestList, false);
  for (const flow of Object.keys(CREATION_ASKS) as CreationFlow[]) {
    assert.ok(!resolveSetupSteps(view, CREATION_ASKS[flow]).includes('setup_guests'), flow);
  }
  assert.equal(setupDefaults(view).guests, 'later');
  assert.equal(view.replyDefault, 'no');
  assert.equal(setupDefaults(view).entry, 'one_qr');
  // The wire cannot put a guest-list step back.
  assert.equal(sanitizeSetupAnswers({ guests: 'type' }, view)?.guests, 'later');
});

// ── 4 · every card answered ───────────────────────────────────────────────

test('every card offers at least one quick answer (celebratory and solemn)', () => {
  for (const card of SETUP_CARD_IDS) {
    for (const solemn of [false, true]) {
      assert.ok(setupQuickAnswers(card, solemn).length >= 1, `${card} (solemn=${solemn}) has no quick answer`);
    }
  }
});

test('a card the type defaults is answered from the first render; where and guests wait for a tap', () => {
  const view = viewOf(SEEDED.birthday!);
  const d = setupDefaults(view);
  assert.equal(setupCardAnswered('setup_where', d), false);
  assert.equal(setupCardAnswered('setup_guests', d), false);
  for (const c of ['setup_photo', 'setup_look', 'setup_entry', 'setup_more'] as const) assert.equal(setupCardAnswered(c, d), true);
  assert.equal(setupCardAnswered('setup_where', { ...d, where: 'place', whereText: '  ' }), false);
  assert.equal(setupCardAnswered('setup_where', { ...d, where: 'undecided' }), true);
});

// ── the answers' homes ────────────────────────────────────────────────────

test('the wire is never trusted: unknown keys and values fall back to the type default', () => {
  const view = viewOf(SEEDED.hangout!);
  assert.equal(sanitizeSetupAnswers(undefined, view), null);
  assert.equal(sanitizeSetupAnswers([], view), null);
  const a = sanitizeSetupAnswers({ look: 'no-such-look', reply: 'maybe', entry: 'door', gifts: 'yes', logo: 'yes' }, view)!;
  assert.notEqual(a.look, 'no-such-look');
  assert.equal(a.reply, 'no');
  assert.equal(a.entry, 'one_qr');
  assert.equal(a.gifts, 'no', 'a gift-free type cannot be given a gifts row');
  assert.equal(a.logo, view.logoRow ? 'yes' : 'no');
});

test('"How do guests get in?" lands in rsvp_ask_config, read back by the key gate', () => {
  const view = viewOf(SEEDED.birthday!);
  const d = setupDefaults(view);
  const oneQr = setupColumns({ ...d, reply: 'no', entry: 'one_qr' });
  assert.deepEqual(oneQr.rsvp_ask_config, sanitizeRsvpAskConfig({ guestsReply: false, whoCanRsvp: 'anyone' }));
  assert.equal(readGuestsReply(oneQr.rsvp_ask_config), false);
  assert.equal(setupColumns({ ...d, reply: 'no', entry: 'personal' }).rsvp_ask_config?.whoCanRsvp, 'guest_list');
  assert.equal(setupColumns({ ...d, reply: 'yes' }).rsvp_ask_config, null);
  assert.equal(readGuestsReply(null), true, 'an event that never ran the engine still replies');
  assert.equal(setupColumns({ ...d, where: 'place', whereText: ' Cafe Uno ' }).venue_name, 'Cafe Uno');
  assert.equal(setupColumns({ ...d, where: 'undecided' }).venue_name, null);

  const base = { rsvpStatus: null, mealPreference: null, mobile: null, askMeal: false, askMobile: false, locked: false };
  assert.equal(rsvpGate({ ...base, guestsReply: false }).kind, 'inside');
  assert.notEqual(rsvpGate(base).kind, 'inside', 'an unanswered guest is still asked when guests reply');
});

test('the guests card picks the landing; "later" lands on Home', () => {
  const d = setupDefaults(viewOf(SEEDED.birthday!));
  assert.equal(setupLanding('E1', { ...d, guests: 'type' }), '/dashboard/E1/guests/new');
  assert.equal(setupLanding('E1', { ...d, guests: 'import' }), '/dashboard/E1/guests/import');
  assert.equal(setupLanding('E1', { ...d, guests: 'later' }), '/dashboard/E1');
  assert.equal(setupLanding('E1', null), '/dashboard/E1');
});

test('roles and groups follow the type; Officiant is wedding-only', () => {
  assert.deepEqual([...resolveRoleSet('birthday').offeredRoles].sort(), ['celebrant', 'family', 'guest', 'host']);
  assert.deepEqual([...resolveRoleSet('hangout').offeredRoles].sort(), ['guest', 'host']);
  assert.ok(guestGroupsFor('wedding').includes('officiant'));
  for (const k of ['birthday', 'hangout', 'generic', null]) assert.ok(!guestGroupsFor(k).includes('officiant'), String(k));
});
