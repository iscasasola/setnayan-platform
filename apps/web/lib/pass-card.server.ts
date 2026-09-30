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
import { fetchPublicScheduleBlocks, formatBlockTimeRange } from '@/lib/schedule';
import { guestsMaySeeSeatsFor } from '@/lib/guests-may-see-seats';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  filterPassCardRows,
  passCardDesignFrom,
  passCardEligibility,
  passCardFileName,
  type PassCardDesign,
  type PassCardEligibility,
  type PassCardRow,
} from '@/lib/pass-card';

/**
 * lib/pass-card.server.ts — THE PASS CARD'S READS (lib/pass-card.ts decides,
 * lib/print-layout.ts draws, lib/pass-card-render.ts flattens).
 *
 * One kit per EVENT (the print set, its look, its words, the arrival time,
 * the party counts), then one card per GUEST — so the zip of 300 cards
 * reads the event once, and the single card and the zip cannot draw from
 * different facts.
 */

/**
 * Everything a guest row must carry to be judged and drawn — the pass card's
 * OWN read, used only in this file. FILE-LOCAL on purpose: an exported
 * `*_COLUMNS` is a SHARED canonical guest list to the dup-rule guard
 * (\`lib/security/select-column-scan.ts\` §2), and every narrower guest read in
 * the app would then read as a copy with a hole. It is not the guests' one
 * list — it is what a pass needs. (The phantom-column check still reads it.)
 */
const PASS_CARD_GUEST_COLUMNS =
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
  /** bringer guest_id → how many NAMED companions they bring who are coming. */
  party: Map<string, number>;
  /** 🎟 guest_id → their table and seat — filled ON THE DAY only (`readTicketSeats`). */
  seats: Map<string, TicketSeat>;
};

/** One guest's place, as a ticket prints it: "Table 7" (or the table's own name) and the seat number. */
export type TicketSeat = { seat: string | null; seatNumber: string | null };

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
  const [words, arrive, party, seats] = await Promise.all([
    eventWordsForEvent(eventId).catch(() => null),
    readArriveLabel(admin, eventId),
    readPartyCounts(admin, eventId, opts.seatsFor),
    readTicketSeats(admin, eventId),
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
  return { set, arrive, party, seats };
}

/**
 * 🎟 THE SEATS A TICKET CARRIES — ON THE DAY ONLY (owner 2026-09-30, verbatim:
 * *"their digital Ticket will also update on the date of the event with the
 * seat number"*). Before 00:00 Manila on the event's date this reads NOTHING —
 * the ticket's half of the one seat rule (`guestsMaySeeSeatsFor(…, { ticket:
 * true })` → `ticketShowsTable`), never the couple's "show early" switch. A
 * failed read is an empty map: a ticket with no table is true; a wrong one is not.
 */
export async function readTicketSeats(admin: SupabaseClient, eventId: string): Promise<Map<string, TicketSeat>> {
  const out = new Map<string, TicketSeat>();
  if (!(await guestsMaySeeSeatsFor(admin, eventId, { ticket: true }))) return out;
  const [{ data: seats, error }, { data: tables, error: tErr }] = await Promise.all([
    admin.from('event_seat_assignments').select('guest_id, table_id, seat_number').eq('event_id', eventId),
    admin.from('event_tables').select('table_id, table_label').eq('event_id', eventId),
  ]);
  if (error || tErr) {
    logQueryError('pass-card.seats', error ?? tErr, { event_id: eventId }, 'graceful_degrade');
    return out;
  }
  const label = new Map(((tables ?? []) as Array<{ table_id: string; table_label: string | null }>).map((t) => [t.table_id, t.table_label]));
  for (const s of (seats ?? []) as Array<{ guest_id: string; table_id: string; seat_number: number | null }>) {
    const l = label.get(s.table_id)?.trim() || null;
    out.set(s.guest_id, {
      seat: l ? (/^\d+$/.test(l) ? `Table ${l}` : l) : null,
      seatNumber: s.seat_number != null ? String(s.seat_number) : null,
    });
  }
  return out;
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

// ─── One card ───────────────────────────────────────────────────────────────

/** The card's facts for one guest — the PrintPass both the picture and the print draw. */
export function passCardPass(kit: PassCardKit, g: PassCardGuest, qrRef: string | null): PrintPass {
  return {
    name: passCardGuestName(g),
    // 🪑 THE TABLE ON THE DAY (owner 2026-09-30, "THE TICKET GAINS THE SEAT ON
    // THE DAY"): `kit.seats` is empty before 00:00 Manila on the event's date.
    seat: kit.seats.get(g.guest_id)?.seat ?? null,
    seatNumber: kit.seats.get(g.guest_id)?.seatNumber ?? null,
    qrRef,
    serial: null,
    arrive: kit.arrive,
    // BOTH halves: the couple's permission AND an actual person.
    bringing: g.plus_one_allowed ? g.plus_one_name : null,
    party: kit.party.get(g.guest_id) ?? (g.plus_one_allowed && g.plus_one_name?.trim() ? 1 : 0),
  };
}

/**
 * 🎨 THE COUPLE'S LOOK UNLESS ONE IS ASKED FOR. The Prints panel's own pick
 * (`print_details.pass_design`, Classic when unset) is what every guest's
 * ticket wears — on their Event Hub and in the file they save, one drawing. An
 * explicit `?design=` (the couple previewing a look) wins for that drawing only.
 * Before 2026-09-30 the routes defaulted to Classic and never read the pick.
 */
export function passCardDesignFor(kit: PassCardKit, asked?: string | null): PassCardDesign {
  return asked ? passCardDesignFrom(asked) : passCardDesignFrom(kit.set.data.details.passDesign);
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
  design: PassCardDesign = passCardDesignFor(kit),
  opts: { pending?: string | null } = {},
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
  // 🔓 A pending request's ticket (frame B): no facts, the band, and always the
  // Classic card — the one layout that draws the band.
  const pass = opts.pending
    ? { ...passCardPass(kit, g, ref), seat: null, seatNumber: null, arrive: null, party: 0, bringing: null, pending: opts.pending }
    : passCardPass(kit, g, ref);
  const doc = layoutPassCard({ look: set.look, data: set.data, mode: 'screen', foil: false }, pass, opts.pending ? 'classic' : design);
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
