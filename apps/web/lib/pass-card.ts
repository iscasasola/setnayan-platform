/**
 * apps/web/lib/pass-card.ts — THE PASS CARD A GUEST SAVES, the pure half.
 *
 * Owner, verbatim 2026-09-29, pointing at the guest's Me screen: *"make sure
 * the file they save the QR Card with the information of the guest. so when
 * they save multiple QR Codes, it is easy. this should be a 4:3 portrait
 * digital image. which can also be added on the prints"* — and, the same
 * thread: *"only accepted accounts get their images"* · *"no pass for those
 * who cannot come"* · *"can we also create a zip file to download all? (PRO
 * feature)"* · *"downloading them individually is free"*.
 *
 * So "Save" hands over a CARD, not a bare QR: 1080 × 1440 px (3 wide × 4 tall),
 * the couple's mark and names, the event and date, the guest's name big, their
 * facts (`lib/guest-pass.ts` — never an invented table), the QR large, "Scans
 * once at the door". The SAME drawing is a print format (`PRINT_FORMATS
 * ['phone-card']`) — one layout, two outputs (`layoutPassCard` in
 * lib/print-layout.ts), never two drawings.
 *
 * This file decides, and draws nothing:
 *   · WHO GETS A CARD (`passCardEligibility`) — accepted, and coming;
 *   · WHO MAY FETCH ONE (`decidePassCardAccess`) — that guest, or the guest who
 *     brought them;
 *   · WHAT THE FILE IS CALLED (`passCardFileName`, `passCardsZipFileName`).
 *
 * Pure: no I/O, no clock — the Node test runner executes every branch.
 */

/** Where a guest's (or a host's) card is fetched — `?guest=<id>` for a plus-one. */
export const PASS_CARD_ROUTE = '/api/guest/pass-card';
/** The couple's zip of every card (Event Hub Pro) — `?event=<id>`. */
export const PASS_CARDS_ZIP_ROUTE = '/api/guest/pass-card/all';

/**
 * 🔤 EVERY USER-FACING WORD FOR THE CARD, IN ONE PLACE. The owner has floated
 * "Digital tickets" for it (controller 2026-09-29); a rename is a change to
 * this object and nothing else — the buttons, the lines, the filenames and the
 * zip's name all read it.
 */
export const PASS_CARD_WORDS = {
  /** The thing, singular / plural ("pass" / "passes"). */
  noun: 'pass',
  plural: 'passes',
  /** The ticket design's corner label. */
  kind: 'Guest pass',
  saveOwn: 'Save to Photos',
  saveAll: 'Save all passes',
  saveOf: (first: string) => `Save ${first}’s pass`,
  /** The couple's per-guest download (free). */
  downloadOne: 'Download pass (PNG)',
  /** The couple's zip of every card (Event Hub Pro). */
  downloadAll: 'Download all passes (.zip)',
  /** The Prints panel's block and its two outputs (owner: "print outs are PDF. digital versions are png"). */
  section: 'The pass guests save',
  style: 'Pass style',
  digital: 'Digital (PNG)',
  print: 'Print (PDF)',
} as const;

/** The three looks, as the couple reads them in the one dropdown. */
export const PASS_CARD_DESIGN_LABEL: Record<PassCardDesignKey, string> = {
  classic: 'Classic',
  ticket: 'Ticket',
  poster: 'Photo poster',
};

/** The saved picture, in pixels. 3 : 4 portrait. */
export const PASS_CARD_PX = { w: 1080, h: 1440 } as const;

/** The print format the card is (lib/print-pieces.ts `PRINT_FORMATS`). */
export const PASS_CARD_FORMAT_ID = 'phone-card' as const;

/**
 * THE CARD'S LOOK IS ONE SWAPPABLE KEY (controller 2026-09-29: the owner is
 * choosing between three drawn designs — classic card, ticket stub,
 * photo-poster). Every caller passes a key; the layout dispatches on it
 * (`PASS_CARD_LAYOUTS` in lib/print-layout.ts). Adding a design is adding a
 * key here and a row there — the route, the filename, the access rule and the
 * print format do not change.
 */
export const PASS_CARD_DESIGNS = ['classic', 'ticket', 'poster'] as const;
export type PassCardDesign = (typeof PASS_CARD_DESIGNS)[number];
type PassCardDesignKey = PassCardDesign;
export const DEFAULT_PASS_CARD_DESIGN: PassCardDesign = 'classic';

export function passCardDesignFrom(v: unknown): PassCardDesign {
  return typeof v === 'string' && (PASS_CARD_DESIGNS as readonly string[]).includes(v)
    ? (v as PassCardDesign)
    : DEFAULT_PASS_CARD_DESIGN;
}

// ─── Who gets a card ─────────────────────────────────────────────────────────

/** The `entry_source` of a guest who asked to join and is not yet accepted
 *  (mirrors `REQUEST_ENTRY_SOURCE` in lib/guests.ts, which is server-shaped). */
const REQUEST = 'self_added_unlisted';

export type PassCardRow = {
  guest_id: string;
  event_id: string;
  deleted_at?: string | null;
  entry_source?: string | null;
  passed_away?: boolean | null;
  rsvp_status?: string | null;
  plus_one_of_guest_id?: string | null;
  qr_token?: string | null;
  /** A plus-one seat still waiting for its name ("+ TBA") — nobody to put on a card. */
  tba?: boolean;
};

/**
 *   pass       — accepted, and not "can't come": the card, the Save button.
 *   awaiting   — waiting in the couple's Requests (Keep or Link not pressed yet),
 *                or brought by someone who is.
 *   cannotCome — replied "can't come" (a plus-one: their own reply, else the
 *                reply of the guest who brought them). Nothing is stored or
 *                deleted — change the reply and the card comes back.
 *   none       — no such seat any more (removed, declined by the couple, passed
 *                away) or no code to put on it.
 */
export type PassCardEligibility = 'pass' | 'awaiting' | 'cannotCome' | 'none';

/** What a guest sees in the card's place. */
export const PASS_CARD_AWAITING_LINE = `Your ${PASS_CARD_WORDS.noun} appears once the couple confirms you.`;
export const PASS_CARD_CANNOT_COME_LINE = `Changed your plans? Update your reply and your ${PASS_CARD_WORDS.noun} will appear.`;

export function passCardLine(e: PassCardEligibility): string | null {
  return e === 'awaiting' ? PASS_CARD_AWAITING_LINE : e === 'cannotCome' ? PASS_CARD_CANNOT_COME_LINE : null;
}

/**
 * 🛂 ONLY AN ACCEPTED GUEST WHO IS COMING GETS A CARD.
 *
 * `bringer` is the row of the guest who brought a plus-one — required for a
 * plus-one (a plus-one whose bringer is gone or unread has no card: we cannot
 * say they were accepted). Ignored for everybody else.
 */
export function passCardEligibility(
  row: PassCardRow | null | undefined,
  bringer?: PassCardRow | null,
): PassCardEligibility {
  if (!row || row.deleted_at || row.passed_away === true || !row.qr_token || row.tba === true) return 'none';
  if (row.entry_source === REQUEST) return 'awaiting';
  let reply = row.rsvp_status ?? 'pending';
  if (row.plus_one_of_guest_id) {
    if (!bringer || bringer.guest_id !== row.plus_one_of_guest_id || bringer.event_id !== row.event_id) return 'none';
    if (bringer.deleted_at || bringer.passed_away === true) return 'none';
    // Plus-ones minted by an ACCEPTED bringer count as accepted; a pending
    // bringer's plus-ones wait with them.
    if (bringer.entry_source === REQUEST) return 'awaiting';
    // A plus-one follows their OWN reply when they gave one; a seat the bringer
    // named was minted `pending` — that is no reply, so the bringer's stands.
    if (reply === 'pending') reply = bringer.rsvp_status ?? 'pending';
  }
  if (reply === 'declined') return 'cannotCome';
  return 'pass';
}

/**
 * THE ZIP'S SET — every row of a list that HAS a card, each plus-one judged
 * against its own bringer found in the same list (a bringer missing from it —
 * removed, or a pending request the read left out — means no card).
 * `toRow` supplies what the raw row cannot say by itself (a "+ TBA" seat).
 */
export function filterPassCardRows<T extends PassCardRow>(rows: readonly T[], toRow: (r: T) => PassCardRow = (r) => r): T[] {
  const byId = new Map(rows.map((r) => [r.guest_id, r]));
  return rows.filter((r) => {
    const b = r.plus_one_of_guest_id ? byId.get(r.plus_one_of_guest_id) : undefined;
    return passCardEligibility(toRow(r), b ? toRow(b) : null) === 'pass';
  });
}

/**
 * 🪑 THE TABLE ON A CARD — only once the couple has PUBLISHED the seat plan to
 * guests (`event_floor_plan.published_at`: the one flag Find your seat and the
 * seat pass read, set by `publishSeating`, cleared by `unpublishSeating`).
 * Unpublished, every card omits the table exactly as it omits an unknown one.
 * A numeric table reads "Table 7"; a named one (a linked group) keeps its name.
 */
export function seatLabelsFrom(
  published: boolean,
  seats: ReadonlyArray<{ guest_id: string; table_id: string }>,
  tables: ReadonlyArray<{ table_id: string; table_label: string | null; link_group_label?: string | null }>,
): Map<string, string> {
  const out = new Map<string, string>();
  if (!published) return out;
  const label = new Map(tables.map((t) => [t.table_id, t.link_group_label ?? t.table_label]));
  for (const s of seats) {
    const l = label.get(s.table_id)?.trim();
    if (l) out.set(s.guest_id, /^\d+$/.test(l) ? `Table ${l}` : l);
  }
  return out;
}

// ─── Who may fetch one ──────────────────────────────────────────────────────

export type PassCardVerdict =
  | { allow: true; as: 'guest' | 'host' }
  | { allow: false; status: 401 | 404 | 503; message: string };

/**
 * 🔒 THE WHOLE GATE of the card route, as a pure function.
 *
 *   · a guest session may fetch ITS OWN card, and the card of a plus-one it
 *     brought (the owner's ruling: "the guest who brings plus-ones hands each
 *     one their own key") — nobody else's;
 *   · a host of the event may fetch any of its guests' cards (owner: "downloading
 *     them individually is free");
 *   · and in every case only a card that EXISTS (`passCardEligibility === 'pass'`).
 *
 * ⚖ EVERY REFUSAL AFTER SIGN-IN IS THE SAME 404 WITH THE SAME WORDS — "not
 * yours", "pending", "can't come" and "no such guest" are indistinguishable, so
 * the route cannot be used to learn whether a name is on a list or what they
 * replied (the `/api/og` existence-oracle lesson). The page, which already
 * knows who is asking, says the plain line.
 */
export const PASS_CARD_REFUSED = 'No pass here.';

export function decidePassCardAccess(input: {
  session: { guest_id: string; event_id: string } | null;
  /** The caller is a host of `target.event_id` (asked by the route, never assumed). */
  isHost: boolean;
  target: PassCardRow | null;
  bringer: PassCardRow | null;
  readFailed: boolean;
}): PassCardVerdict {
  const { session, isHost, target, bringer, readFailed } = input;
  if (!session && !isHost) return { allow: false, status: 401, message: 'Open your invitation link first.' };
  if (readFailed) return { allow: false, status: 503, message: 'Could not reach your invitation. Try again.' };
  if (!target) return { allow: false, status: 404, message: PASS_CARD_REFUSED };
  let as: 'guest' | 'host' | null = null;
  if (
    session &&
    session.event_id === target.event_id &&
    (target.guest_id === session.guest_id || target.plus_one_of_guest_id === session.guest_id)
  ) {
    as = 'guest';
  } else if (isHost) {
    as = 'host';
  }
  if (!as) return { allow: false, status: 404, message: PASS_CARD_REFUSED };
  if (passCardEligibility(target, bringer) !== 'pass') return { allow: false, status: 404, message: PASS_CARD_REFUSED };
  return { allow: true, as };
}

// ─── What the file is called ────────────────────────────────────────────────

/**
 * A name reduced to what a filename and a response header can carry: accents
 * folded (Peñafiel → Penafiel), every other run of characters one hyphen.
 * 🔒 Interpolated into `Content-Disposition` — a quote or CR/LF cannot survive.
 */
export function fileSafe(raw: string | null | undefined, max = 40): string {
  return (raw ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ß/g, 'ss')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[øØ]/g, 'o')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
}

/** `2026-12-18` stays; anything else is dropped rather than guessed. */
function isoDay(d: string | null | undefined): string | null {
  return d && /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
}

/**
 * `Maria-Santos-pass-Indalecio-Claire-2026-12-18.png` — the PERSON first, so a
 * camera roll holding six of them reads as six people. The couple's "&" is a
 * separator, not a word.
 */
export function passCardFileName(input: {
  guestName: string | null | undefined;
  eventName: string | null | undefined;
  eventDate: string | null | undefined;
}): string {
  const who = fileSafe(input.guestName) || 'Guest';
  const couple = fileSafe((input.eventName ?? '').replace(/\s*(?:&|\+|\band\b)\s*/gi, ' '));
  const day = isoDay(input.eventDate);
  return [who, fileSafe(PASS_CARD_WORDS.noun), couple || null, day].filter(Boolean).join('-') + '.png';
}

/** `Indalecio-Claire-2026-12-18-passes.zip` — the couple's own download of every card. */
export function passCardsZipFileName(eventName: string | null | undefined, eventDate: string | null | undefined): string {
  const couple = fileSafe((eventName ?? '').replace(/\s*(?:&|\+|\band\b)\s*/gi, ' ')) || 'Event';
  const day = isoDay(eventDate);
  return [couple, day, fileSafe(PASS_CARD_WORDS.plural)].filter(Boolean).join('-') + '.zip';
}

/**
 * Two guests with the same name in one zip must not overwrite each other: the
 * second becomes `…-2.png`. Order-stable.
 */
export function uniqueFileNames(names: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const k = n.toLowerCase();
    const count = (seen.get(k) ?? 0) + 1;
    seen.set(k, count);
    return count === 1 ? n : n.replace(/(\.[a-z0-9]+)$/i, `-${count}$1`);
  });
}

/** The most cards one zip request draws. Past this the route says so — it never truncates. */
export const PASS_CARD_ZIP_MAX = 600;

/** What a couple without Event Hub Pro is told when they ask for the zip. One card stays free. */
export const PASS_CARD_ZIP_PRO_MESSAGE = `${PASS_CARD_WORDS.downloadAll} comes with Event Hub Pro. Each guest’s ${PASS_CARD_WORDS.noun} downloads free from their guest card.`;
