import 'server-only';

import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { eventWordsForEvent } from '@/app/[slug]/_lib/event-words';
import { isCoordinatorPrepReleaseEnabled } from '@/lib/coordinator-prep-release';
import { isPlaceholderSeat } from '@/lib/extra-seats';
import { PASSED_AWAY, REQUEST_ENTRY_SOURCE } from '@/lib/guests';
import { CLASSIC_PRINT_THEME, isProPrint } from '@/lib/print-pieces';
import { layoutPassCard, type PrintPass } from '@/lib/print-layout';
import { loadPrintSet, printOwnsPro, type LoadedPrintSet } from '@/lib/print-set.server';
import { renderPassCardPng } from '@/lib/pass-card-render';
import { renderInvitationQrPng } from '@/lib/qr';
import { eventSeatingPublished } from '@/lib/seat-pass';
import { fetchPublicScheduleBlocks, formatBlockTimeRange } from '@/lib/schedule';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  DEFAULT_PASS_CARD_DESIGN,
  filterPassCardRows,
  passCardEligibility,
  passCardFileName,
  seatLabelsFrom,
  type PassCardDesign,
  type PassCardEligibility,
  type PassCardRow,
} from '@/lib/pass-card';

/**
 * lib/pass-card.server.ts — THE PASS CARD'S READS (lib/pass-card.ts decides,
 * lib/print-layout.ts draws, lib/pass-card-render.ts flattens).
 *
 * One kit per EVENT (the print set, its look, its words, the arrival time,
 * the published seats), then one card per GUEST — so the zip of 300 cards
 * reads the event once, and the single card and the zip cannot draw from
 * different facts.
 */

/** Everything a guest row must carry to be judged and drawn. */
export const PASS_CARD_GUEST_COLUMNS =
  'guest_id, event_id, deleted_at, entry_source, passed_away, rsvp_status, plus_one_of_guest_id, qr_token, ' +
  'name_prefix, first_name, last_name, name_suffix, display_name, plus_one_allowed, plus_one_name, plus_one_name_confirmed_at';

export type PassCardGuest = PassCardRow & {
  name_prefix: string | null;
  first_name: string | null;
  last_name: string | null;
  name_suffix: string | null;
  display_name: string | null;
  plus_one_allowed: boolean | null;
  plus_one_name: string | null;
  plus_one_name_confirmed_at: string | null;
};

/** The row as `passCardEligibility` reads it — a "+ TBA" seat has nobody to put on a card. */
export function asPassCardRow(g: PassCardGuest): PassCardRow {
  return {
    ...g,
    tba: Boolean(g.plus_one_of_guest_id) && isPlaceholderSeat({ guest_id: g.guest_id, first_name: g.first_name, confirmed_at: g.plus_one_name_confirmed_at }),
  };
}

/** The name the card prints — the same join the printed pass batch uses (`loadGuestPasses`). */
export function passCardGuestName(g: Pick<PassCardGuest, 'name_prefix' | 'first_name' | 'last_name' | 'name_suffix' | 'display_name'>): string {
  return (
    [g.name_prefix, g.first_name, g.last_name, g.name_suffix].filter((s) => s && s.trim()).join(' ').trim() ||
    g.display_name?.trim() ||
    'Guest'
  );
}

/** One guest row (and, for a plus-one, the row of whoever brought them). */
export async function readPassCardGuest(
  admin: SupabaseClient,
  guestId: string,
): Promise<{ target: PassCardGuest | null; bringer: PassCardGuest | null; failed: boolean }> {
  const { data, error } = await admin.from('guests').select(PASS_CARD_GUEST_COLUMNS).eq('guest_id', guestId).maybeSingle();
  if (error) {
    logQueryError('pass-card.readGuest', error, { guest_id: guestId }, 'graceful_degrade');
    return { target: null, bringer: null, failed: true };
  }
  const target = (data as PassCardGuest | null) ?? null;
  if (!target?.plus_one_of_guest_id) return { target, bringer: null, failed: false };
  const { data: b, error: bErr } = await admin
    .from('guests')
    .select(PASS_CARD_GUEST_COLUMNS)
    .eq('guest_id', target.plus_one_of_guest_id)
    .maybeSingle();
  if (bErr) {
    logQueryError('pass-card.readBringer', bErr, { guest_id: guestId }, 'graceful_degrade');
    return { target, bringer: null, failed: true };
  }
  return { target, bringer: (b as PassCardGuest | null) ?? null, failed: false };
}

/** The eligibility of a guest by id — for the page, which says the plain line instead. */
export async function passCardEligibilityFor(admin: SupabaseClient, guestId: string): Promise<PassCardEligibility> {
  const { target, bringer, failed } = await readPassCardGuest(admin, guestId);
  if (failed || !target) return 'none';
  return passCardEligibility(asPassCardRow(target), bringer ? asPassCardRow(bringer) : null);
}

/**
 * The plus-ones a guest brought who have a card — for "Save <name>'s pass"
 * and "Save all passes" on their Me. Each follows their own reply, else the
 * bringer's; a TBA seat has none. A failed read returns `{}` (no save buttons,
 * never a wrong one).
 */
export async function plusOnePassCardIds(
  admin: SupabaseClient,
  eventId: string,
  bringerGuestId: string,
): Promise<Set<string>> {
  const [{ data: rows, error }, { data: b, error: bErr }] = await Promise.all([
    admin
      .from('guests')
      .select(PASS_CARD_GUEST_COLUMNS)
      .eq('event_id', eventId)
      .eq('plus_one_of_guest_id', bringerGuestId)
      .is('deleted_at', null),
    admin.from('guests').select(PASS_CARD_GUEST_COLUMNS).eq('guest_id', bringerGuestId).maybeSingle(),
  ]);
  if (error || bErr) {
    logQueryError('pass-card.plusOnes', error ?? bErr, { event_id: eventId }, 'graceful_degrade');
    return new Set();
  }
  const bringer = b ? asPassCardRow(b as unknown as PassCardGuest) : null;
  return new Set(
    ((rows ?? []) as unknown as PassCardGuest[])
      .filter((r) => passCardEligibility(asPassCardRow(r), bringer) === 'pass')
      .map((r) => r.guest_id),
  );
}

// ─── The event's kit ────────────────────────────────────────────────────────

export type PassCardKit = {
  set: LoadedPrintSet;
  /** When the doors open — the FIRST public block, formatted like the programme. */
  arrive: string | null;
  /** guest_id → "Table 7", only once the couple has PUBLISHED seating. */
  seatOf: Map<string, string>;
  /** bringer guest_id → how many NAMED companions they bring who are coming. */
  party: Map<string, number>;
};

/**
 * The event's half of every card. The theme is the couple's own — unless it is
 * a Pro theme and the event does not hold Event Hub Pro, in which case the card
 * wears Classic (the same rule the print route applies, `mayServe`). The words
 * are the event type's own ("The debut of"), never "wedding" for everybody.
 */
export async function loadPassCardKit(
  admin: SupabaseClient,
  eventId: string,
  opts: { seatsFor?: string[] } = {},
): Promise<PassCardKit | null> {
  const [first, ownsPro] = await Promise.all([loadPrintSet(eventId, { mode: 'screen', withEventQr: false }), printOwnsPro(eventId)]);
  let set = first;
  if (!set) return null;
  if (isProPrint(set.theme) && !ownsPro) {
    set = await loadPrintSet(eventId, { mode: 'screen', withEventQr: false, previewTheme: CLASSIC_PRINT_THEME });
    if (!set) return null;
  }
  const [words, arrive, seatOf, party] = await Promise.all([
    eventWordsForEvent(eventId).catch(() => null),
    readArriveLabel(admin, eventId),
    readSeatLabels(admin, eventId, opts.seatsFor),
    readPartyCounts(admin, eventId, opts.seatsFor),
  ]);
  const eyebrow = words ? (words.solemn ? 'In memory of' : `The ${words.eventWord} of`) : set.data.eyebrow;
  const eventWord = words ? words.eventWord.charAt(0).toUpperCase() + words.eventWord.slice(1) : undefined;
  // A card a guest saves ALWAYS carries their name (the Guest list's "names on
  // passes" toggle is for the couple's printed batch); a free event's card
  // carries the small Setnayan mark, a Pro event's never does.
  set = {
    ...set,
    // The code is ALWAYS black on white, whatever the theme — it must scan.
    // The look's shape, pattern and centre (the Setnayan mark, or the couple's
    // own on Pro) stay.
    qrLook: { ...set.qrLook, dark: '#111111', light: '#FFFFFF' },
    data: { ...set.data, eyebrow, eventWord, details: { ...set.data.details, guestNames: true, setnayanMark: !ownsPro } },
  };
  return { set, arrive, seatOf, party };
}

async function readArriveLabel(admin: SupabaseClient, eventId: string): Promise<string | null> {
  try {
    const blocks = await fetchPublicScheduleBlocks(admin, eventId, await isCoordinatorPrepReleaseEnabled());
    const first = blocks[0];
    // The programme's own formatter — the schedule stores the event's
    // wall-clock parked in UTC (see site-body's pass for the 8-hour bug).
    return first?.start_at ? formatBlockTimeRange(first.start_at, null) || null : null;
  } catch (err) {
    // Omitted, never guessed: a card with no ARRIVE is true; a wrong one is not.
    logQueryError('pass-card.arrive', err, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
}

/**
 * "and 1 guest" — counted from the plus-one ROWS a bringer has: named (never a
 * "+ TBA" seat), not removed, and not "can't come" on their own reply. A guest
 * whose companion lives only as `plus_one_name` (no row yet) counts one.
 */
async function readPartyCounts(admin: SupabaseClient, eventId: string, bringerIds?: string[]): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let q = admin
    .from('guests')
    .select('guest_id, first_name, plus_one_of_guest_id, plus_one_name_confirmed_at, rsvp_status')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .not('plus_one_of_guest_id', 'is', null);
  if (bringerIds && bringerIds.length > 0 && bringerIds.length <= 50) q = q.in('plus_one_of_guest_id', bringerIds);
  const { data, error } = await q;
  if (error) {
    // Omitted, never guessed — a card without "and 1 guest" is true of nobody wrongly.
    logQueryError('pass-card.party', error, { event_id: eventId }, 'graceful_degrade');
    return out;
  }
  for (const r of (data ?? []) as Array<{ guest_id: string; first_name: string | null; plus_one_of_guest_id: string; plus_one_name_confirmed_at: string | null; rsvp_status: string | null }>) {
    // A bringer with seat ROWS is counted from the rows alone (zero included) —
    // the `plus_one_name` mirror only speaks for a bringer with no rows at all.
    if (!out.has(r.plus_one_of_guest_id)) out.set(r.plus_one_of_guest_id, 0);
    if (isPlaceholderSeat({ guest_id: r.guest_id, first_name: r.first_name, confirmed_at: r.plus_one_name_confirmed_at })) continue;
    if (r.rsvp_status === 'declined') continue;
    out.set(r.plus_one_of_guest_id, (out.get(r.plus_one_of_guest_id) ?? 0) + 1);
  }
  return out;
}

async function readSeatLabels(admin: SupabaseClient, eventId: string, guestIds?: string[]): Promise<Map<string, string>> {
  // Unpublished → no table on any card (`seatLabelsFrom`); the reads below are skipped.
  const published = await eventSeatingPublished(admin, eventId);
  if (!published) return seatLabelsFrom(false, [], []);
  let q = admin.from('event_seat_assignments').select('guest_id, table_id').eq('event_id', eventId);
  if (guestIds && guestIds.length > 0 && guestIds.length <= 50) q = q.in('guest_id', guestIds);
  const [{ data: seats, error }, { data: tables, error: tErr }] = await Promise.all([
    q,
    admin.from('event_tables').select('table_id, table_label, link_group_label').eq('event_id', eventId),
  ]);
  if (error || tErr) {
    logQueryError('pass-card.seats', error ?? tErr, { event_id: eventId }, 'graceful_degrade');
    return new Map();
  }
  return seatLabelsFrom(
    published,
    (seats ?? []) as Array<{ guest_id: string; table_id: string }>,
    (tables ?? []) as Array<{ table_id: string; table_label: string | null; link_group_label: string | null }>,
  );
}

// ─── One card ───────────────────────────────────────────────────────────────

/** The card's facts for one guest — the PrintPass both the picture and the print draw. */
export function passCardPass(kit: PassCardKit, g: PassCardGuest, qrRef: string | null): PrintPass {
  return {
    name: passCardGuestName(g),
    seat: kit.seatOf.get(g.guest_id) ?? null,
    qrRef,
    serial: null,
    arrive: kit.arrive,
    // BOTH halves: the couple's permission AND an actual person.
    bringing: g.plus_one_allowed ? g.plus_one_name : null,
    party: kit.party.get(g.guest_id) ?? (g.plus_one_allowed && g.plus_one_name?.trim() ? 1 : 0),
  };
}

export function passCardFileNameFor(kit: PassCardKit, g: PassCardGuest): string {
  return passCardFileName({ guestName: passCardGuestName(g), eventName: kit.set.event.display_name, eventDate: kit.set.event.event_date });
}

/**
 * THE VERSION a card is cached under: every input it is drawn from — the
 * guest's facts and code, the event's words and look, the design, the build.
 * A rotated code, a new table or a new logo is a new version.
 */
export function passCardVersion(kit: PassCardKit, g: PassCardGuest, design: PassCardDesign): string {
  const mark = kit.set.images.mark?.bytes;
  const h = createHash('sha256');
  h.update(
    JSON.stringify({
      p: passCardPass(kit, g, 'qr'),
      t: g.qr_token,
      d: design,
      theme: kit.set.theme,
      look: kit.set.look,
      qr: kit.set.qrLook,
      data: { n: kit.set.data.names, e: kit.set.data.eyebrow, dt: kit.set.data.dateLabel, m: kit.set.data.monogram, i: kit.set.data.initials },
      slug: kit.set.event.slug,
      owner: kit.set.ownerSlug,
      build: process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev',
    }),
  );
  if (mark) h.update(Buffer.from(mark));
  return h.digest('base64url').slice(0, 22);
}

export async function renderPassCardFor(
  kit: PassCardKit,
  g: PassCardGuest,
  design: PassCardDesign = DEFAULT_PASS_CARD_DESIGN,
): Promise<Uint8Array> {
  const { set } = kit;
  if (!g.qr_token || !set.event.slug) throw new Error('pass-card: no code to draw');
  const qr = await renderInvitationQrPng({
    appUrl: set.appUrl,
    slug: set.event.slug,
    qrToken: g.qr_token,
    look: set.qrLook,
    ownerSlug: set.ownerSlug,
    width: 720,
  });
  const ref = `qr-${g.guest_id}`;
  const doc = layoutPassCard({ look: set.look, data: set.data, mode: 'screen', foil: false }, passCardPass(kit, g, ref), design);
  return renderPassCardPng(doc, { ...set.images, [ref]: { bytes: new Uint8Array(qr), mime: 'image/png' } });
}

// ─── Every card of an event (the couple's zip) ─────────────────────────────

/**
 * Every guest who HAS a card: accepted, not "can't come", named (no TBA), not
 * removed, not passed away — the plus-ones judged against their own bringer.
 * `measured: false` when the list could not be read (never "no guests").
 */
export async function eligiblePassCardGuests(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ guests: PassCardGuest[]; measured: boolean }> {
  const { data, error } = await admin
    .from('guests')
    .select(PASS_CARD_GUEST_COLUMNS)
    .eq('event_id', eventId)
    .is('deleted_at', null)
    // Cheap pre-filter; `passCardEligibility` below is the rule.
    .neq('entry_source', REQUEST_ENTRY_SOURCE).eq(PASSED_AWAY, false)
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true });
  if (error) {
    logQueryError('pass-card.eligible', error, { event_id: eventId }, 'graceful_degrade');
    return { guests: [], measured: false };
  }
  return { guests: filterEligible((data ?? []) as unknown as PassCardGuest[]), measured: true };
}

/** The rule over a whole list — `filterPassCardRows` (pure, executed by its test). */
export function filterEligible(rows: readonly PassCardGuest[]): PassCardGuest[] {
  return filterPassCardRows(rows, asPassCardRow);
}
