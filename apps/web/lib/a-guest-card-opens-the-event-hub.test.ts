/**
 * 🎟 AN INVITED GUEST'S EVENT OPENS THE EVENT HUB — NEVER THE DASHBOARD.
 *
 * Owner, 2026-10-02, before the live guest-flow test: *"when invited guests see
 * the event on their account and opens it. it does not go to the dashboard but
 * instead it goes to the event hub."* — and *"make sure all data will be
 * complete even how guests create their account."*
 *
 * Three things are held here:
 *   1. the board card's door (`eventBoardHref`) — EXECUTED: guest → `/{slug}`,
 *      host and helper → `/dashboard/{id}`, host-and-guest → host;
 *   2. every OTHER way a guest reaches `/dashboard/{id}` (bookmark, notification,
 *      typed URL) is sent to the hub by the event layout instead of a 404;
 *   3. the reply's fields land on the guest row, and the account made from the
 *      invitation keeps them (mobile · meal · dietary) — the carry is EXECUTED
 *      against a fake client.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventWithRole } from './events';
import { eventBoardHref, landingJumpTarget, mergeBoardMemberships } from './event-board';
import { carrySeatDetailsToAccount } from './seat-details-carry';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const row = (over: Partial<EventWithRole>): EventWithRole =>
  ({
    event_id: 'ev-1',
    slug: 'ana-and-ben',
    event_date: '2099-01-01',
    archived: false,
    member_type: 'guest',
    ...over,
  }) as EventWithRole;

// ── 1. the card's door, executed ────────────────────────────────────────────

test('a GUEST card opens the Event Hub at /{slug}', () => {
  assert.equal(eventBoardHref(row({ member_type: 'guest' })), '/ana-and-ben');
});

test('a HOST card opens the event dashboard', () => {
  assert.equal(eventBoardHref(row({ member_type: 'couple' })), '/dashboard/ev-1');
});

test('a co-host / helper card opens the event dashboard', () => {
  assert.equal(eventBoardHref(row({ member_type: 'coordinator' })), '/dashboard/ev-1');
});

test('a guest card on an event with no address yet opens nothing — never the dashboard', () => {
  assert.equal(eventBoardHref(row({ member_type: 'guest', slug: null })), null);
  assert.equal(eventBoardHref(row({ member_type: 'guest', slug: '   ' })), null);
});

test('someone who is BOTH host and guest of one event is treated as host', () => {
  const merged = mergeBoardMemberships(
    [row({ member_type: 'couple' })],
    [row({ member_type: 'guest' })],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0]!.member_type, 'couple');
  assert.equal(eventBoardHref(merged[0]!), '/dashboard/ev-1');
});

test('a guest with ONE invited event is never auto-jumped into a dashboard', () => {
  assert.equal(landingJumpTarget([row({ member_type: 'guest' })], '2026-10-02'), null);
});

test('🔒 the board card takes its door from eventBoardHref, never a hand-built /dashboard path', () => {
  const page = read('app/dashboard/(launcher)/page.tsx');
  assert.match(page, /const href = eventBoardHref\(event\);/, 'the card stopped asking the one resolver');
  assert.match(page, /const resolvedHref = storyHref \?\? href;/);
});

// ── 2. a guest who reaches a host address is sent to the hub ───────────────

test('🔒 the event layout sends a guest member to the hub (eventBoardHref) BEFORE it 404s', () => {
  const layout = read('app/dashboard/[eventId]/layout.tsx');
  const at = layout.indexOf("if (!moderator && membership?.member_type === 'guest') {");
  assert.ok(at > -1, 'a guest is not told apart from a stranger — they meet "not found"');
  const refusal = layout.search(/if \(!moderator\) \{\s*notFound\(\);/);
  assert.ok(refusal > at, 'the 404 fires before the guest is sent to the hub');
  const branch = layout.slice(at, refusal);
  assert.match(branch, /eventBoardHref\(seat\)/, 'the hub address is built by hand, not by the one resolver');
  assert.match(branch, /fetchUserEvents(?:OrReconnect)?\(supabase, user\.id, 'guest'\)/, 'the address is not read from the person’s own invited events');
  assert.doesNotMatch(branch, /from\('events'\)/, 'the event row is read before a non-member is refused');
  assert.match(branch, /if \(hub\) redirect\(hub\);/, 'a guest still lands on "not found"');
  // and it sits AFTER the host + co-host admission, so neither is ever redirected
  assert.ok(at > layout.indexOf("membership.member_type !== 'couple'"), 'the guest redirect runs before the host check');
  assert.ok(at > layout.indexOf(".from('event_moderators')"), 'the guest redirect runs before the co-host check');
});

// ── 3a. the reply's fields land on the guest row ────────────────────────────

test('🔒 every field the guest fills on the reply is read AND written by submitRsvp', () => {
  const action = read('app/[slug]/actions.ts');
  const fn = action.slice(action.indexOf('export async function submitRsvp('));
  // form name → the variable it is read into → the column it is written to
  const pairs: Array<[string, RegExp]> = [
    ["formData.get('rsvp_status')", /rsvp_status: status,/],
    ["formData.get('guest_note')", /guest_note: guestNoteToWrite,/],
    ["formData.get('contact_mobile')", /mobile: mobileToWrite,/],
    ["formData.get('contact_display_name')", /display_name: contactName,/],
    ["formData.get('meal_preference')", /meal_preference: mealToWrite,/],
    ["formData.get('dietary_restrictions')", /dietary_restrictions: dietaryToWrite,/],
  ];
  for (const [readIt, writeIt] of pairs) {
    assert.ok(fn.includes(readIt), `submitRsvp no longer reads ${readIt}`);
    assert.match(fn, writeIt, `submitRsvp reads ${readIt} but no longer saves it`);
  }
  assert.match(fn, /face_tagging_wanted: taggingWish/, 'the tagging answer is dropped');
  assert.match(fn, /await nameTheSeats\(admin, eventId, guestId, formData, ask\);/, 'the plus-ones are dropped');
  assert.match(fn, /guest_submit_song_request/, 'the song is dropped');
});

test('🔒 the reply form posts the names submitRsvp reads', () => {
  const widget = read('app/[slug]/_components/rsvp-widget.tsx');
  for (const name of ['name="rsvp_status"', 'name="guest_note"', 'id="contact_display_name"', 'id="meal_preference"', 'id="dietary_restrictions"']) {
    assert.ok(widget.includes(name), `the reply form no longer posts ${name}`);
  }
});

// ── 3b. the account keeps what the guest typed ──────────────────────────────

type Write = { table: string; patch: Record<string, unknown>; eq: [string, unknown][]; is: [string, unknown][] };

function fakeAdmin(seat: Record<string, unknown> | null) {
  const writes: Write[] = [];
  const client = {
    from(table: string) {
      if (table === 'guests') {
        const q = {
          select: () => q,
          eq: () => q,
          maybeSingle: async () => ({ data: seat, error: null }),
        };
        return q;
      }
      return {
        update(patch: Record<string, unknown>) {
          const w: Write = { table, patch, eq: [], is: [] };
          writes.push(w);
          const chain = {
            eq(col: string, v: unknown) {
              w.eq.push([col, v]);
              return chain;
            },
            is(col: string, v: unknown) {
              w.is.push([col, v]);
              return chain;
            },
            then(resolve: (r: { error: null }) => void) {
              resolve({ error: null });
            },
          };
          return chain;
        },
      };
    },
  };
  return { client: client as unknown as SupabaseClient, writes };
}

test('the account made from an invitation keeps the mobile, meal and dietary — each only into a blank', async () => {
  const { client, writes } = fakeAdmin({
    mobile: ' 0917 555 0101 ',
    meal_preference: 'fish',
    dietary_restrictions: ' nut allergy ',
  });
  await carrySeatDetailsToAccount(client, 'user-1', 'guest-1');
  const byCol = (c: string) => writes.find((w) => c in w.patch);
  assert.equal(byCol('phone')?.patch.phone, '0917 555 0101', 'the mobile the guest typed is lost');
  assert.equal(byCol('meal_preference')?.patch.meal_preference, 'fish');
  assert.equal(byCol('dietary_restrictions')?.patch.dietary_restrictions, 'nut allergy');
  assert.ok(byCol('dietary_restrictions')?.patch.dietary_restrictions_consent_at, 'health data lost its consent stamp');
  for (const w of writes) {
    assert.equal(w.table, 'users');
    assert.deepEqual(w.eq, [['user_id', 'user-1']]);
    const col = Object.keys(w.patch).find((k) => k !== 'dietary_restrictions_consent_at')!;
    assert.deepEqual(w.is, [[col, null]], `${col} can overwrite what the person typed on their profile`);
  }
});

test('a seat with nothing to carry writes nothing', async () => {
  const empty = fakeAdmin({ mobile: '  ', meal_preference: null, dietary_restrictions: null });
  await carrySeatDetailsToAccount(empty.client, 'u', 'g');
  assert.equal(empty.writes.length, 0);
  const none = fakeAdmin(null);
  await carrySeatDetailsToAccount(none.client, 'u', 'g');
  assert.equal(none.writes.length, 0);
});

test('🔒 BOTH on-purpose doors carry it: the name fill runs the carry before any early return', () => {
  const lib = read('lib/link-guest-account.ts');
  const fn = lib.slice(lib.indexOf('export async function fillAccountNameFromSeat('), lib.indexOf('export async function isCoupleMember('));
  const carry = fn.indexOf('await carrySeatDetailsToAccount(admin, userId, guestId);');
  assert.ok(carry > -1, 'the name fill no longer carries mobile / meal / dietary');
  assert.ok(carry < fn.indexOf('return;'), 'a seat with no name skips the carry');
  // the cookie door and the cross-device email door both reach the name fill
  assert.match(lib, /await fillAccountNameFromSeat\(admin, userId, guest_id\);/);
  assert.match(read('lib/event-account-link.ts'), /await fillAccountNameFromSeat\(admin, userId, guest\.guest_id as string\)/);
});
