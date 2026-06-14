/**
 * Unit suite for the emcee script compiler. Load-bearing invariants: the
 * program renders in time order with parents nesting children, the wedding
 * party roster names party roles (not plain guests), and private blocks are
 * excluded unless asked for. Time formatting is injected for determinism.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildEmceeScript } from './emcee-script';
import type { ScheduleBlockRow } from './schedule';
import type { GuestRow } from './guests';

// Deterministic time formatter — no tz dependence in assertions.
const fmt = (s: string) => s.slice(11, 16); // "HH:MM" from ISO

function block(p: Partial<ScheduleBlockRow>): ScheduleBlockRow {
  return {
    block_id: p.block_id ?? 'b',
    public_id: 'S89H-x',
    event_id: 'e',
    label: p.label ?? 'Block',
    block_type: p.block_type ?? 'custom',
    start_at: p.start_at ?? '2026-08-12T14:00:00',
    end_at: p.end_at ?? null,
    location: p.location ?? null,
    notes: p.notes ?? null,
    is_public: p.is_public ?? true,
    sort_order: p.sort_order ?? 0,
    parent_block_id: p.parent_block_id ?? null,
    created_at: '2026-01-01',
    ...p,
  };
}

function guest(p: Partial<GuestRow>): GuestRow {
  return {
    guest_id: p.guest_id ?? 'g',
    public_id: 'S89G-x',
    event_id: 'e',
    first_name: p.first_name ?? 'A',
    last_name: p.last_name ?? 'B',
    display_name: p.display_name ?? null,
    side: 'both',
    group_category: 'family',
    role: p.role ?? 'guest',
    extra_roles: [],
    plus_one_allowed: false,
    plus_one_name: null,
    plus_one_of_guest_id: null,
    plus_one_mode: null,
    email: null,
    mobile: null,
    meal_preference: null,
    dietary_restrictions: null,
    photo_consent: false,
    faceblock_enabled: false,
    photo_url: null,
    photo_source: null,
    photo_updated_at: null,
    invited_to_blocks: [],
    rsvp_status: 'attending',
    notes: null,
    qr_token: 'q',
    custom_tags: [],
    seating_priority: null,
    created_at: '2026-01-01',
    ...p,
  };
}

const event = { displayName: 'Maria & Jose', eventDate: '2026-08-12' };

test('header carries couple name + date', () => {
  const s = buildEmceeScript({ event, blocks: [], guests: [], options: { formatTime: fmt } });
  assert.match(s, /Maria & Jose/);
  assert.match(s, /2026-08-12/);
});

test('program renders blocks in time order with cues', () => {
  const blocks = [
    block({ block_id: 'rec', label: 'Reception', block_type: 'reception', start_at: '2026-08-12T17:00:00' }),
    block({ block_id: 'cer', label: 'Ceremony', block_type: 'ceremony', start_at: '2026-08-12T14:00:00' }),
  ];
  const s = buildEmceeScript({ event, blocks, guests: [], options: { formatTime: fmt } });
  assert.ok(s.indexOf('CEREMONY') < s.indexOf('RECEPTION'), 'ceremony before reception');
  assert.match(s, /All rise/); // ceremony cue
});

test('children nest under their parent', () => {
  const blocks = [
    block({ block_id: 'cer', label: 'Ceremony', block_type: 'ceremony', start_at: '2026-08-12T14:00:00' }),
    block({ block_id: 'vows', label: 'Vows', parent_block_id: 'cer', start_at: '2026-08-12T14:20:00', sort_order: 20 }),
    block({ block_id: 'proc', label: 'Procession', parent_block_id: 'cer', start_at: '2026-08-12T14:05:00', sort_order: 10 }),
  ];
  const s = buildEmceeScript({ event, blocks, guests: [], options: { formatTime: fmt } });
  assert.ok(s.indexOf('Procession') < s.indexOf('Vows'), 'children ordered by sort_order');
  assert.ok(s.indexOf('CEREMONY') < s.indexOf('Procession'), 'parent before its children');
});

test('roster names party roles, skips plain guests', () => {
  const guests = [
    guest({ guest_id: 'b', first_name: 'Maria', last_name: 'Cruz', role: 'bride' }),
    guest({ guest_id: 'g1', first_name: 'Plain', last_name: 'Guest', role: 'guest' }),
    guest({ guest_id: 'm1', first_name: 'Ana', last_name: 'Lopez', role: 'bridesmaid' }),
    guest({ guest_id: 'm2', first_name: 'Bea', last_name: 'Reyes', role: 'bridesmaid' }),
  ];
  const s = buildEmceeScript({ event, blocks: [], guests, options: { formatTime: fmt } });
  assert.match(s, /THE WEDDING PARTY/);
  assert.match(s, /Bride: Maria Cruz/);
  assert.match(s, /Bridesmaid/);
  assert.match(s, /Ana Lopez/);
  assert.doesNotMatch(s, /Plain Guest/);
});

test('private blocks excluded by default, included on request', () => {
  const blocks = [
    block({ block_id: 'pub', label: 'Public Block', is_public: true }),
    block({ block_id: 'priv', label: 'Secret Block', is_public: false, start_at: '2026-08-12T15:00:00' }),
  ];
  // Top-level labels render upper-cased, so match case-insensitively.
  const def = buildEmceeScript({ event, blocks, guests: [], options: { formatTime: fmt } });
  assert.doesNotMatch(def, /secret block/i);
  const all = buildEmceeScript({
    event,
    blocks,
    guests: [],
    options: { formatTime: fmt, includePrivateBlocks: true },
  });
  assert.match(all, /secret block/i);
});
