/**
 * The chat's own lines that ARE a lane-C card, read by their exact words (Supplier Build 3 · lane C).
 *
 * NO IMPORTS ON PURPOSE: the message stream asks `streamLineKind` for every line, so this module rides in the chat's
 * first load — and the shared bundle has almost no headroom. Every card itself is a lazy chunk (`cards/lazy-cards.tsx`).
 */

export type AskSubject = 'quote' | 'plan' | 'form';

// ── Book-request cards (the database's own lines, lane B migration 20271329937802 § 6) ──────────────────────────

export type BookRequestState = 'asked' | 'booked' | 'not_available' | 'withdrawn' | 'closed' | 'expired';

/** A booking-ask system line → its card, or null when the line is something else. Exact words, never guessed. */
export function bookRequestFromLine(body: string | null | undefined): { state: BookRequestState; reason: string | null } | null {
  const b = (body ?? '').trim();
  if (b === "Booking ask sent by the hosts · waiting for the supplier's answer") return { state: 'asked', reason: null };
  if (b === 'Booked ✓') return { state: 'booked', reason: null };
  if (b === 'Not available') return { state: 'not_available', reason: null };
  if (b.startsWith('Not available · ')) return { state: 'not_available', reason: b.slice('Not available · '.length) || null };
  if (b === 'Booking ask withdrawn by the hosts') return { state: 'withdrawn', reason: null };
  if (b === 'Booking ask closed') return { state: 'closed', reason: null };
  if (b === 'Booking ask expired without an answer') return { state: 'expired', reason: null };
  return null;
}

/**
 * 📮 AN ANSWERED ASK NEVER READS "WAITING" (owner screenshot 17 Nov, "Debut 18": the ask still said "Waiting for your
 * answer" under "Booked ✓"). The ask line is history the database wrote once; what answered it is a LATER book-request
 * line in the same chat. Each still-open ask → the state of the first later answer (booked · not available · withdrawn ·
 * closed · expired). An ask with no later answer is not in the map: it IS still waiting. Rows in stream order; only
 * the database's own lines count (`role` 'system' — a person typing the same words answers nothing).
 */
export function answeredBookAsks(
  rows: ReadonlyArray<{ id: string; body: string | null | undefined; role?: string | null }>,
): Map<string, BookRequestState> {
  const answered = new Map<string, BookRequestState>();
  let open: string[] = [];
  for (const r of rows) {
    if (r.role != null && r.role !== 'system') continue;
    const b = bookRequestFromLine(r.body);
    if (!b) continue;
    if (b.state === 'asked') {
      open.push(r.id);
      continue;
    }
    for (const id of open) answered.set(id, b.state);
    open = [];
  }
  return answered;
}

/** An Ask-for-a-change system line (this lane's migration) → its subject, or null. */
export function changeAskFromLine(body: string | null | undefined): { subject: AskSubject; answered: 'revised' | 'declined' | null } | null {
  const b = (body ?? '').trim();
  const subj = (w: string): AskSubject | null => (w === 'Quotation' ? 'quote' : w === 'Payment plan' ? 'plan' : w === 'Form' ? 'form' : null);
  let m = /^Asked for a change · (Quotation|Payment plan|Form) · /.exec(b);
  if (m) {
    const s = subj(m[1]!);
    return s ? { subject: s, answered: null } : null;
  }
  m = /^Change asked · (Quotation|Payment plan|Form) · (the supplier is sending a new version|declined by the supplier)/.exec(b);
  if (m) {
    const s = subj(m[1]!);
    return s ? { subject: s, answered: m[2]!.startsWith('declined') ? 'declined' : 'revised' } : null;
  }
  return null;
}

/**
 * The title a supplier's shipped form line names ("I sent you a form — “<title>”. Answer it in your event."), or null.
 * "Send again" (owner 18 Nov 2026) words it "I sent you a form again — “<title>”. Your last answers are still ticked; …"
 * — the same form, so the host's face mounts under it too, with their answers already in it.
 */
export function formLineTitle(body: string | null | undefined): string | null {
  const m =
    /^I sent you a form(?: again)? — “(.+)”\. (?:Answer it in your event|Your last answers are still ticked; change any you like in your event)\.$/.exec(
      (body ?? '').trim(),
    );
  return m ? m[1]! : null;
}

/** "Guest count changed · 150 → 170 guests" (lane B's booking-change line) → the two counts; anything else → null. */
export function guestCountFromLine(body: string | null | undefined): { from: number; to: number } | null {
  const m = /^Guest count changed · (\d+) → (\d+) guests$/.exec((body ?? '').trim());
  return m ? { from: Number(m[1]), to: Number(m[2]) } : null;
}

/**
 * 👥💸 "Quote rose to 150 pax · +₱32,500" — the line `quote_follow_guest_count` posts when the guest list lifts a
 * not-yet-booked quote (migration 20271339826198, SQL `quote_rise_words`; Piece 1 · PR-2). Exact words, never guessed:
 * the count and the rise as the database wrote them (`deltaWords` is the ₱ figure as printed, never re-parsed into money).
 */
export function quoteRiseFromLine(body: string | null | undefined): { pax: number; deltaWords: string } | null {
  const m = /^Quote rose to (\d{1,3}(?:,\d{3})*) pax · \+(₱\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/.exec((body ?? '').trim());
  return m ? { pax: Number(m[1]!.replace(/,/g, '')), deltaWords: m[2]! } : null;
}

/**
 * 📉 "Quote fell to 160 pax · −₱800" — the line `quote_follow_guest_count` posts when the guest list shrinks under an
 * UNLOCKED, not-yet-booked quote that had risen (migration 20271340566104, SQL `quote_fall_words`). Exact words, as
 * `quoteRiseFromLine` (the minus is U+2212, as the database writes it).
 */
export function quoteFallFromLine(body: string | null | undefined): { pax: number; deltaWords: string } | null {
  const m = /^Quote fell to (\d{1,3}(?:,\d{3})*) pax · −(₱\d{1,3}(?:,\d{3})*(?:\.\d{2})?)$/.exec((body ?? '').trim());
  return m ? { pax: Number(m[1]!.replace(/,/g, '')), deltaWords: m[2]! } : null;
}

/**
 * 🗳 "Poll · <question>" — the line a posted poll rides (migration 20271338412990 writes it with the poll). Its close /
 * reopen lines ("Poll closed · …", "Poll reopened · …") stay plain lines.
 */
export function pollFromLine(body: string | null | undefined): { question: string } | null {
  const b = (body ?? '').trim();
  return b.startsWith('Poll · ') && b.length > 'Poll · '.length ? { question: b.slice('Poll · '.length) } : null;
}

/** 🤝 "Counter · <the total|line> · ₱X · <who>" / "Plan proposed · <who>" (migration 20271340018194) → its card. */
export function negotiationFromLine(body: string | null | undefined): 'counter' | 'plan' | null {
  const b = (body ?? '').trim();
  return b.startsWith('Counter · ') ? 'counter' : b.startsWith('Plan proposed · ') ? 'plan' : null;
}

/**
 * 🗓 "Schedule changed · Ceremony · 2:00 PM → 2:30 PM · 30 min later" — the line a host's chapter move posts in each
 * booked supplier's conversation (SCHEDULES HAND-IN-HAND part (b), 2026-11-12; written by `scheduleChangeLine` in
 * `lib/schedule-hand-in-hand.ts`). Exact words, never guessed: the chapter, both clocks and the shift as written.
 */
export function scheduleChangeFromLine(
  body: string | null | undefined,
): { chapter: string; from: string; to: string; shift: string } | null {
  const m = /^Schedule changed · (.+) · ([^·→]+?) → ([^·→]+?) · ((?:\d+ days? ?)?(?:\d+ hr ?)?(?:\d+ min ?)?(?:later|earlier))$/.exec(
    (body ?? '').trim(),
  );
  if (!m || !/\d/.test(m[4]!)) return null;
  return { chapter: m[1]!, from: m[2]!, to: m[3]!, shift: m[4]! };
}

/**
 * 🗓 A TIME-CHANGE ASK, EITHER WAY (Unichat part F, 2026-11-20; written by `timeAskLine` in `lib/schedule-time-ask.ts`):
 *   · "Time change asked · Sound check · 3:30 PM → 3:00 PM"      a supplier asks to move its moment
 *   · "New moment asked · Crew call · 12:00 PM"                   a supplier asks to add one
 *   · "Host asks a new time · Detail shots · 10:00 AM → 9:30 AM"  the host or coordinator asks the supplier
 * Exact words, never guessed; anything else is null (the plain line it always was).
 */
export type TimeAskBy = 'supplier' | 'host';
export type TimeAskLine = { by: TimeAskBy; add: boolean; label: string; from: string | null; to: string };

export const TIME_ASK_HEADS = {
  move: 'Time change asked',
  add: 'New moment asked',
  host: 'Host asks a new time',
} as const;

export function timeAskFromLine(body: string | null | undefined): TimeAskLine | null {
  const text = (body ?? '').trim();
  const m = /^(Time change asked|New moment asked|Host asks a new time) · (.+) · (?:([^·→]+?) → )?([^·→]+?)$/.exec(text);
  if (!m) return null;
  const clock = /^\d{1,2}:\d{2} (AM|PM)$/;
  const from = m[3] ?? null;
  const to = m[4]!;
  if (!clock.test(to) || (from !== null && !clock.test(from))) return null;
  const head = m[1]!;
  if (head === TIME_ASK_HEADS.add && from !== null) return null;
  return { by: head === TIME_ASK_HEADS.host ? 'host' : 'supplier', add: head === TIME_ASK_HEADS.add, label: m[2]!, from, to };
}

/**
 * ✉ The service an inquiry names — its own last line, as `startServiceInquiry` writes it (`inquiryServicesLine`):
 * "Service: Reception Lights & Sound" → that name; "Services: A · B" → "A · B"; no such line → null (the inquiry card
 * then says "Not given", never a guess).
 */
export function inquiryServiceOf(body: string | null | undefined): string | null {
  const m = /^Services?: (.+)$/m.exec(body ?? '');
  return m ? m[1]!.trim() || null : null;
}

// ── The deal's end (Unichat part H2, 20 Nov 2026) — four lines the database writes, each one a card ───────────────

/**
 * 🧾 A CONFIRMED payment's own line, as the ledger trigger writes it (`tg_vendor_payments_chat_record`, migration
 * 20271329937802): "First payment confirmed · ₱9,000" · "Payment confirmed · ₱9,000" · a supplier-recorded one,
 * "Payment recorded · ₱9,000 · GCash · confirmed". The receipt card reads the payment ROW for every figure it shows;
 * `amountWords` is only the ₱ text as the database printed it, used to find that row — never re-parsed into a price.
 */
export function receiptFromLine(body: string | null | undefined): { first: boolean; amountWords: string } | null {
  const m = /^(First payment|Payment) (?:confirmed · (₱\d{1,3}(?:,\d{3})*(?:\.\d{2})?)|recorded · (₱\d{1,3}(?:,\d{3})*(?:\.\d{2})?)(?: · [^·]+)? · confirmed)$/.exec(
    (body ?? '').trim(),
  );
  return m ? { first: m[1] === 'First payment', amountWords: (m[2] ?? m[3])! } : null;
}

export type HandoverKind = 'gallery_link' | 'file' | 'note' | 'signoff';
/** The shipped kinds' own words (`handover-inbox.tsx` KIND_META) — the line says them, the card reads them back. */
export const HANDOVER_KIND_WORD: Record<HandoverKind, string> = {
  gallery_link: 'Album link',
  file: 'Sample / proof',
  note: 'Note',
  signoff: 'All delivered',
};

/**
 * 📦 "Handover · Album link" (optionally " · <the supplier's label>") — written when a supplier posts a delivery
 * (`tg_booking_handovers_chat_record`, migration `the_deals_end_is_said_in_the_chat`). "Handover received · Album
 * link" is the hosts' confirmation: `received` true, and it stays one settled line.
 */
export function handoverFromLine(body: string | null | undefined): { kind: HandoverKind; received: boolean } | null {
  const m = /^Handover( received)? · (Album link|Sample \/ proof|Note|All delivered)(?: · .+)?$/s.exec((body ?? '').trim());
  if (!m) return null;
  const kind = (Object.keys(HANDOVER_KIND_WORD) as HandoverKind[]).find((k) => HANDOVER_KIND_WORD[k] === m[2]);
  return kind ? { kind, received: Boolean(m[1]) } : null;
}

/** ⭐ The review ask — one line per chat, written when the hosts confirm the first handover (same migration). */
export const REVIEW_ASK_LINE = 'Review asked · how did it go?';
export function reviewAskFromLine(body: string | null | undefined): boolean {
  return (body ?? '').trim() === REVIEW_ASK_LINE;
}

/** 👷 Crew for the day — one line per chat, written the first time the supplier's crew is named on the schedule. */
export const DAY_CREW_LINE = 'Crew named for the day';
export function dayCrewFromLine(body: string | null | undefined): boolean {
  return (body ?? '').trim() === DAY_CREW_LINE;
}

/** Which lane-C card a SYSTEM line is, or null (the stream then draws the plain Setnayan line it always drew). */
export function streamLineKind(
  body: string | null | undefined,
): 'book' | 'ask' | 'guests' | 'rise' | 'fall' | 'poll' | 'negotiate' | 'schedule' | 'receipt' | 'handover' | 'review' | 'crew' | null {
  if (bookRequestFromLine(body)) return 'book';
  if (negotiationFromLine(body)) return 'negotiate';
  if (pollFromLine(body)) return 'poll';
  if (changeAskFromLine(body)) return 'ask';
  if (guestCountFromLine(body)) return 'guests';
  if (quoteRiseFromLine(body)) return 'rise';
  if (quoteFallFromLine(body)) return 'fall';
  if (scheduleChangeFromLine(body)) return 'schedule';
  if (receiptFromLine(body)) return 'receipt';
  if (handoverFromLine(body)) return 'handover';
  if (reviewAskFromLine(body)) return 'review';
  if (dayCrewFromLine(body)) return 'crew';
  // 🗓 A time-change ASK, either way (Unichat part F) — the same lazy card chunk draws it.
  if (timeAskFromLine(body)) return 'schedule';
  return null;
}

// ── 🎂 The Cake Maker's design (DECISION_LOG 2026-11-21) ─────────────────────────────────────────────────────────

/** The head line of a couple's "Cake design" block — the SAME words as `CAKE_DESIGN_HEAD` (lib/cake-maker.ts, pinned by its test). */
export const CAKE_DESIGN_HEAD_WORDS = '🎂 Cake design · ';

/** 👗 The head of a Gown Maker design message — the SAME words as `GOWN_DESIGN_HEAD` (lib/gown-maker.ts, pinned by test). */
export const GOWN_DESIGN_HEAD_WORDS = '👗 Gown design · ';

/** Is this message a shop's Gown Maker design (posted when the couple scanned its QR)? Its block is the whole message. */
export function isGownDesign(body: string | null | undefined): boolean {
  return (body ?? '').startsWith(GOWN_DESIGN_HEAD_WORDS);
}

/** The supplier's "Ask for a cake design" invite — the SAME words as `CAKE_INVITE_BODY` (lib/cake-maker.ts, pinned). */
export const CAKE_INVITE_WORDS = '🎂 Design your cake for us';

/** Is this message the shop's Cake Maker invite? (Its card: "Design your cake for us" · Design your cake.) */
export function isCakeInvite(body: string | null | undefined): boolean {
  return (body ?? '').startsWith(CAKE_INVITE_WORDS);
}

/**
 * Where a message's cake design block starts (the index of its head line), or -1 when the message carries none. The
 * words before it are the couple's own lead-in, which stays a bubble; the block itself is drawn as the design card.
 */
export function cakeDesignAt(body: string | null | undefined): number {
  const b = body ?? '';
  if (b.startsWith(CAKE_DESIGN_HEAD_WORDS)) return 0;
  const i = b.indexOf(`\n${CAKE_DESIGN_HEAD_WORDS}`);
  return i < 0 ? -1 : i;
}
