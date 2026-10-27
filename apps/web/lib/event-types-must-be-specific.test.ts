/**
 * event-types-must-be-specific.test.ts — the rules and the wiring behind the owner's 2026-10-28 ruling (DECISION_LOG
 * "EVENT TYPES MUST BE SPECIFIC — NO GENERIC 'CELEBRATION' / 'OTHER EVENT' FOR NEW EVENTS; 'WHO IS IT FOR?'
 * APPROVED"). The rendered picker is held by `who-is-it-for-renders.test.ts`; this file holds the halves no render
 * can see: the roster's sections, the Event settings line's choices, the ask's outcomes, and the four writers.
 *
 * SABOTAGES PERFORMED AND UNDONE (each turned the named test red):
 *   · `forMenuGroup` returning undefined for a group → "the dropdown's sections".
 *   · `eventKindChoices` keeping GENERIC_EVENT_TYPE in `offered` → "a generic event is offered every specific kind".
 *   · `askOutcome` mapping 23505 to 'failed' → "a double ask is 'already', never a failure".
 *   · `tellAsksTheTypeIsReady(` removed from setEventTypeStatus → "the host is told when the type is in the picker".
 *   · `.from('events')` in the switch door changed to `createAdminClient().from('events')` → "the switch writes …".
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  buildBusinessSubject,
  buildCreateRoster,
  buildGroupSubject,
  buildSelfSubject,
  forMenuGroup,
  forMenuHint,
  groupHiddenTypes,
  subjectCommunityId,
  subjectHonoreeDependentId,
  subjectHonoreeLabel,
  subjectMayShowAll,
} from '@/lib/create-subjects';
import { askOutcome, cleanAskLabel, eventKindChoices, maySwitchEventKind, GENERIC_EVENT_TYPE } from '@/lib/event-type-requests';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const code = (p: string) => stripComments(read(p));

const batch = buildGroupSubject({ communityId: 'c-1', name: 'Batch 2010 Samahan', memberCount: 42 });

test('the dropdown’s sections: You · Someone else · YOUR GROUPS · YOUR BUSINESS · (divider) passed away', () => {
  const roster = buildCreateRoster(buildSelfSubject('Ice'), [], 'Casasola Events', [batch]);
  assert.deepEqual(roster.map((s) => s.id), ['self', 'unspecified', 'group:c-1', 'business', 'memorial']);
  assert.deepEqual(roster.map(forMenuGroup), [undefined, undefined, 'Your groups', 'Your business', '']);
  assert.equal(forMenuHint(batch), 'Group · 42 members');
  assert.equal(forMenuHint(buildBusinessSubject('Casasola Events')), 'Business events only');
});

test('a group: its community is the event’s, it names no celebrant, it folds what a group may not hold', () => {
  assert.equal(subjectCommunityId(batch), 'c-1');
  assert.equal(subjectHonoreeLabel(batch), '');
  assert.equal(subjectHonoreeDependentId(batch), null);
  const types = [{ key: 'reunion' }, { key: 'wedding' }, { key: 'tournament' }];
  assert.deepEqual(groupHiddenTypes(types, batch, ['reunion', 'tournament']), ['wedding']);
  assert.deepEqual(groupHiddenTypes(types, buildSelfSubject('Ice'), ['reunion']), [], 'not a group → folds nothing');
  assert.deepEqual(groupHiddenTypes(types, batch, undefined), [], 'no list → fails open (the server still refuses)');
  assert.equal(subjectMayShowAll(batch), false);
  assert.equal(subjectMayShowAll(buildBusinessSubject(null)), false);
  assert.equal(subjectMayShowAll(buildSelfSubject('Ice')), true);
  assert.equal(buildGroupSubject({ communityId: 'c', name: 'X', memberCount: 0 }).subtitle, 'Group', 'an unread count is not "0 members"');
});

const CREATABLE = [
  { key: 'wedding', label: 'Wedding' },
  { key: 'reunion', label: 'Reunion' },
  { key: 'homecoming', label: 'Alumni homecoming' },
];

test('a generic event is offered every specific kind — never itself, never a wedding', () => {
  const c = eventKindChoices({ eventType: GENERIC_EVENT_TYPE, eventCreatedAt: '2026-10-01', creatable: CREATABLE, myAsks: [] });
  assert.deepEqual(c.map((x) => x.key), ['reunion', 'homecoming']);
  // Even if the generic type were back in the picker, and an ask had been linked to it, it is never a switch target.
  const back = eventKindChoices({
    eventType: 'reunion',
    eventCreatedAt: '2026-10-02',
    creatable: [...CREATABLE, { key: GENERIC_EVENT_TYPE, label: 'Generic' }],
    myAsks: [{ status: 'added', event_type: GENERIC_EVENT_TYPE, created_at: '2026-10-01', label: 'x' }],
  });
  assert.deepEqual(back, []);
});

test('a specific event is offered only a kind its host asked for BEFORE making it, once added', () => {
  const asked = [{ status: 'added', event_type: 'homecoming', created_at: '2026-10-01', label: 'Alumni homecoming' }];
  const args = { eventType: 'reunion', eventCreatedAt: '2026-10-02', creatable: CREATABLE, myAsks: asked };
  assert.deepEqual(eventKindChoices(args).map((x) => x.key), ['homecoming']);
  assert.equal(maySwitchEventKind(args, 'homecoming'), true);
  assert.equal(maySwitchEventKind(args, 'wedding'), false);
  assert.deepEqual(eventKindChoices({ ...args, eventCreatedAt: '2026-09-30' }), [], 'an event made before the ask: no line');
  assert.deepEqual(eventKindChoices({ ...args, myAsks: [{ ...asked[0]!, status: 'linked' }] }), [], 'not in the picker yet: no line');
});

test('a double ask is "already", never a failure; a blank ask is refused before it is sent', () => {
  assert.equal(askOutcome(null), 'sent');
  assert.equal(askOutcome({ code: '23505' }), 'already');
  assert.equal(askOutcome({ code: '42501' }), 'failed');
  assert.equal(cleanAskLabel('  Alumni   homecoming '), 'Alumni homecoming');
  assert.equal(cleanAskLabel(' a '), null);
});

test('the create page offers the account’s REAL groups it organizes, with the group types', () => {
  const page = code('app/dashboard/(account)/create-event/page.tsx');
  assert.match(page, /fetchUserCommunities\(supabase, user\.id\)\)\.filter\(\(c\) => c\.role === 'organizer'\)/);
  assert.match(page, /shopName,\s*groupSubjects,\s*\)/);
  assert.match(page, /groupTypeKeys=\{/);
});

test('the switch writes event_type through the viewer’s OWN session (RLS + the SEC-5 price-tier trigger still apply)', () => {
  const src = code('app/dashboard/[eventId]/actions.ts');
  const door = src.slice(src.indexOf("formData.has('event_type_switch')"), src.indexOf("return { ok: true };", src.indexOf("formData.has('event_type_switch')")));
  assert.match(door, /maySwitchEventKind\(/);
  assert.match(door, /await supabase\s*\.from\('events'\)\s*\.update\(\{ event_type: next \}\)/);
  assert.doesNotMatch(door, /createAdminClient\(\)\s*\.from\('events'\)/);
});

test('the host is told when the type is in the picker — in the app only, never by email', () => {
  const admin = code('app/admin/categories/actions.ts');
  const status = admin.slice(admin.indexOf('export async function setEventTypeStatus'), admin.indexOf('async function answerEventTypeAsk'));
  assert.match(status, /tellAsksTheTypeIsReady\(admin, key, before\.label_en, user\.id\)/);
  assert.match(status, /answerEventTypeAsk\(formData, user\.id\)/);
  assert.match(admin, /\.update\(\{ status: 'linked', event_type: res\.data\.key/, 'Add as new links the ask');
  const emit = code('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /event_type_added/);
});

test('the migration hides "Celebration" from couples and keeps every stored one', () => {
  const sql = read('../../supabase/migrations/20271294233183_event_types_must_be_specific.sql');
  assert.match(sql, /UPDATE public\.event_type_vocab\s+SET enabled = FALSE[\s\S]*WHERE event_type = 'celebration'/);
  assert.doesNotMatch(sql, /status = 'retired'|DELETE FROM public\.event_type_vocab|DROP TYPE|UPDATE public\.events\b/);
});
