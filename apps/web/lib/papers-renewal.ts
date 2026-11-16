/**
 * papers-renewal.ts — 📄 PAPERS RENEWAL: WHAT A SUPPLIER, A COUPLE AND THE ADMIN SEE AS 30 MARCH COMES AND GOES.
 * The pure half.
 *
 * Builds the approved design `Setnayan-specs/prototypes/supplier_papers_renewal_2026-11-14_fable.html` (DECISION_LOG
 * 2026-11-14 "Papers renewal (after 30 March) + branch verification — designs APPROVED") with the seven picks ruled in
 * "Renewal + branch verification — the seven open questions ruled: Fable's picks taken":
 *   (1) the badge stays until the END of 30 March — a permit's printed "valid until 31 Dec" never takes it off on
 *       1 January (`hasVerifiedBadge` reads only `next_renewal_due_at`; pinned in `papers-lapse.test.ts`);
 *   (2) a paid plan's unused days WAIT during Free · Unverified and come back on renewal (`planHoldAtLapse` below);
 *   (3) couples who already booked are NOT told (the lapse tells the supplier only — `papers-lapse.server.ts`);
 *   (4) a lapsed, previously verified shop reads "This supplier is renewing their papers with Setnayan…".
 *
 * ⚠ ONE WORD DIFFERS FROM THE DRAWING, ON PURPOSE. The drawing (14 Nov) says a lapsed shop "can't take new bookings".
 * Two later rulings changed what is true: DECISION_LOG 481b9b6b (a lapsed shop only leaves search and Discover; it
 * keeps its clients and the events that already inquired) and 15 Nov "UNVERIFIED SHOPS … BOOKABLE NOW" (any shop can
 * be booked through its own website). The shipped lapse refuses no booking, so every line here says what really
 * happens — new couples can't FIND the shop — never "can't book". A line that says a door is shut when it is open is
 * the failure this repo fences everywhere else.
 *
 * PURE — no database, no clock (`now` is passed in), no `server-only`.
 */

import { dayMonth } from '@/lib/format-date';
import { formatCount } from '@/lib/format-number';
import { badgeDeadlineMs, manilaDateKey } from '@/lib/verified-badge';
import type { NoticeKind, NoticeTone } from '@/lib/notices';

const DAY_MS = 86_400_000;

/** What the verification page is handed about the renewal (`readRenewalView`). */
export type RenewalPageFacts = {
  verified: boolean;
  dueAt: string | null;
  lapsedAt: string | null;
  lastVerifiedAt: string | null;
  /** The latest application is an APPROVED renewal (`annual_renewal`). */
  renewed: boolean;
  /** Active bookings that carry on through a lapse; null = not read. */
  bookings: number | null;
};

/** Which card heads the verification page during a renewal, or null for the page as it always was. */
export function renewalPageCard(f: RenewalPageFacts | null | undefined, submitted: boolean, now: Date): 'free_unverified' | 'waiting' | 'verified_again' | null {
  if (!f || !f.verified) return null;
  const at = renewalStage(f, now);
  if (at?.stage === 'lapsed') return submitted ? 'waiting' : 'free_unverified';
  if (f.renewed && !f.lapsedAt && f.lastVerifiedAt) {
    const v = Date.parse(f.lastVerifiedAt);
    if (Number.isFinite(v) && now.getTime() - v <= RENEWED_NEWS_DAYS * DAY_MS) return 'verified_again';
  }
  return null;
}

/** The facts the renewal lines read — all from the shop's own row (`vendor_profiles_self`). */
export type RenewalFacts = {
  /** `verification_state === 'verified'`. A never-verified shop has no renewal at all. */
  verified: boolean;
  /** `next_renewal_due_at` — the END of 30 March, Manila. */
  dueAt: string | null | undefined;
  /** `papers_lapsed_at` — stamped by the daily pass the morning after an unrenewed 30 March. */
  lapsedAt: string | null | undefined;
};

export type RenewalStage = 'sixty' | 'thirty' | 'week' | 'lapsed';

/**
 * Where the shop stands. `null` = nothing to say (not verified, no deadline, or more than 60 days out). A shop whose
 * deadline passed reads `lapsed` even before the daily pass stamps it — the badge is already off on read
 * (`hasVerifiedBadge`), so the words follow the date, never a job.
 */
export function renewalStage(f: RenewalFacts, now: Date): { stage: RenewalStage; daysLeft: number } | null {
  if (!f.verified) return null;
  if (f.lapsedAt) return { stage: 'lapsed', daysLeft: 0 };
  const ms = badgeDeadlineMs(f.dueAt ?? null);
  if (ms === null) return null;
  if (ms - now.getTime() <= 0) return { stage: 'lapsed', daysLeft: 0 };
  // Counted in Manila CALENDAR days, as the drawing counts them: 29 Jan → 60 days, 28 Feb → 30, 23 Mar → 7. The
  // renewal day itself still has its last hours, so it reads "1 day", never "0".
  const daysLeft = Math.max(1, Math.round((Date.parse(manilaDateKey(new Date(ms))) - Date.parse(manilaDateKey(now))) / DAY_MS));
  if (daysLeft <= 7) return { stage: 'week', daysLeft };
  if (daysLeft <= 30) return { stage: 'thirty', daysLeft };
  if (daysLeft <= 60) return { stage: 'sixty', daysLeft };
  return null;
}

/** "30 March" — the renewal day as the drawing writes it. */
export function renewalDayWords(dueAt: string): string {
  const key = manilaDateKey(new Date(dueAt));
  const [, m, d] = key.split('-');
  return `${Number(d)} ${LONG_MONTHS[Number(m) - 1]}`;
}

/** "31 March" — the first day of Free · Unverified (the day after the renewal day). */
export function dayAfterWords(dueAt: string): string {
  return renewalDayWords(new Date(Date.parse(dueAt) + 1000).toISOString());
}

const LONG_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** One renewal notice, in the one notice system's terms (`lib/notices.ts`). */
export type RenewalNoticeSpec = {
  /** Live notices carry their FACT in the key; to-dos carry their stage, so a closer stage asks again. */
  key: string;
  kind: NoticeKind;
  tone?: NoticeTone;
  /** false = no close word (it affects couples). */
  closable: boolean;
  title: string;
  /** Behind the ⓘ. Lines, drawn as a list when there is more than one. */
  detail: string[];
  /** The one action. */
  action: { label: string; href: string } | null;
};

/** Every "Renew my papers" opens the one upload place (the verification page). */
export const RENEW_PAPERS_HREF = '/vendor-dashboard/profile#docs';
export const RENEW_PAPERS_LABEL = 'Renew my papers';

/** What the ⓘ on the day-after band counts. `null` = not read → said without a number, never as zero. */
export type LapseCounts = { bookings: number | null; asksBefore: number | null };

/**
 * §1 + §2 of the drawing: the reminder on Today at 60 and 30 days (a to-do, Not now), 7 days (a live band, warning,
 * no close word) and the day after (a live band, problem, no close word, until the papers are checked).
 */
export function renewalNotice(f: RenewalFacts, now: Date, counts: LapseCounts = { bookings: null, asksBefore: null }): RenewalNoticeSpec | null {
  const at = renewalStage(f, now);
  if (!at || !f.dueAt) return null;
  const day = renewalDayWords(f.dueAt);
  const days = `${formatCount(at.daysLeft)} ${at.daysLeft === 1 ? 'day' : 'days'}`;
  const action = { label: RENEW_PAPERS_LABEL, href: RENEW_PAPERS_HREF };
  const stays = 'Your shop stays listed and couples can still book you.';
  switch (at.stage) {
    case 'sixty':
      return {
        key: `papers-renewal:sixty:${f.dueAt}`,
        kind: 'todo',
        closable: true,
        title: `Your Verified badge is up for renewal on ${day}`,
        detail: [`In ${days} your Verified badge needs your current papers — including this year’s Mayor’s Permit. ${stays}`],
        action,
      };
    case 'thirty':
      return {
        key: `papers-renewal:thirty:${f.dueAt}`,
        kind: 'todo',
        closable: true,
        title: `${days} left to renew your papers — due ${day}`,
        detail: [`In ${days} your Verified badge needs your current papers — including this year’s Mayor’s Permit. ${stays}`],
        action,
      };
    case 'week':
      return {
        key: `papers-renewal:week:${f.dueAt}`,
        kind: 'live',
        tone: 'warning',
        closable: false,
        title: `${days} left — renew your papers by ${day}`,
        detail: [`After ${day} new couples can’t find you until your papers are checked. Bookings you already have carry on.`],
        action,
      };
    case 'lapsed': {
      const since = dayAfterWords(f.dueAt);
      return {
        key: `papers-renewal:lapsed:${f.dueAt}`,
        kind: 'live',
        tone: 'problem',
        closable: false,
        title: `New couples can’t find you — your papers weren’t renewed by ${day}`,
        detail: lapsedDetail(since, counts),
        action,
      };
    }
  }
}

/** The reason behind the day-after ⓘ: what carries on and what is paused, with this shop's own numbers. */
export function lapsedDetail(since: string, counts: LapseCounts): string[] {
  const n = counts.bookings;
  const bookings =
    n === null
      ? 'Your bookings carry on as normal'
      : n === 0
        ? null
        : `Your ${formatCount(n)} ${n === 1 ? 'booking carries' : 'bookings carry'} on as normal`;
  const lines = [
    `Since ${since} your shop is Free · Unverified.${bookings ? ` ${bookings} — chat, payments, schedule, the Event Hub.` : ''}`,
  ];
  const a = counts.asksBefore;
  if (a !== null && a > 0) {
    lines.push(`You can still answer the ${formatCount(a)} ${a === 1 ? 'ask' : 'asks'} that came in before ${since}.`);
  } else if (a === null) {
    lines.push(`You can still answer asks that came in before ${since}.`);
  }
  lines.push('You’re out of Find and Discover, so new couples can’t find you.');
  lines.push('Send this year’s papers and it all comes back once they’re checked — usually on the spot.');
  return lines;
}

/** §6 of the drawing: the news line after a clean renewal. Gold ring, Got it closes it for good. */
export const RENEWED_NEWS = {
  title: 'You’re verified again — new couples can find you',
  detail: 'Your badge, Find, Discover and your plan are back. Next renewal: ',
} as const;

/** How long the "verified again" news may wait for the supplier to see it. */
export const RENEWED_NEWS_DAYS = 14;

/** A renewal approved in the last two weeks earns the news line, keyed by the NEW renewal day (once per renewal). */
export function renewedNotice(args: { renewedAt: string | null | undefined; nextDueAt: string | null | undefined; verified: boolean; lapsedAt: string | null | undefined }, now: Date): RenewalNoticeSpec | null {
  if (!args.verified || args.lapsedAt || !args.renewedAt || !args.nextDueAt) return null;
  const at = Date.parse(args.renewedAt);
  if (!Number.isFinite(at) || now.getTime() - at > RENEWED_NEWS_DAYS * DAY_MS || at > now.getTime()) return null;
  return {
    key: `papers-renewed:${args.nextDueAt}`,
    kind: 'news',
    closable: true,
    title: RENEWED_NEWS.title,
    detail: [`${RENEWED_NEWS.detail}${renewalDayWords(args.nextDueAt)} ${manilaDateKey(new Date(args.nextDueAt)).slice(0, 4)}.`],
    action: null,
  };
}

// ---------------------------------------------------------------------------
// §3 · Free · Unverified, with the one-tap renewal — the verification page
// ---------------------------------------------------------------------------

/** The four lines under "Free · Unverified" on the verification page. */
export function freeUnverifiedLines(bookings: number | null): Array<{ ok: boolean; text: string }> {
  return [
    {
      ok: true,
      text:
        bookings === null
          ? 'Your bookings carry on'
          : `Your ${formatCount(bookings)} ${bookings === 1 ? 'booking carries' : 'bookings carry'} on`,
    },
    { ok: true, text: 'Couples can still message you' },
    { ok: false, text: 'You’re out of Find and Discover for now' },
    { ok: false, text: 'Your plan is Free until you’re verified again' },
  ];
}

export const FREE_UNVERIFIED = {
  title: 'Free · Unverified',
  sub: 'Renew your papers to be found again',
} as const;

export const RENEWAL_WAITING = {
  title: 'Waiting for Setnayan',
  sub: 'A person is checking your new permit',
  body: 'We couldn’t read it after three tries, so we’ll compare what you typed by hand.',
} as const;

export const RENEWED_PAGE = {
  title: 'You’re verified',
  sub: 'Couples see your badge and can book you',
  stamp: 'Setnayan verified',
} as const;

/** "Next renewal: 30 March 2028." */
export function nextRenewalLine(nextDueAt: string): string {
  return `Next renewal: ${renewalDayWords(nextDueAt)} ${manilaDateKey(new Date(nextDueAt)).slice(0, 4)}.`;
}

/** "4 Mar 2031" — a printed paper date as the drawing writes it. */
export function paperDay(iso: string): string {
  return `${dayMonth(iso) ?? iso} ${iso.slice(0, 4)}`;
}

export type RenewalSlotKey = 'dti_certificate' | 'bir_2303' | 'mayors_permit';

/** What a paper's row says during a renewal. */
export type PaperStanding =
  /** Last year's paper, kept: it has not run out. */
  | { kind: 'still_good'; line: string }
  /** Last year's paper ran out: this is the one to upload. */
  | { kind: 'ended'; line: string }
  /** A paper read clean in THIS renewal. */
  | { kind: 'read'; line: string };

/** A kept paper: "Still good · valid until 4 Mar 2031", or "Still good · no end date" (a BIR 2303 has none). */
export function stillGoodLine(expirationDate: string | null | undefined): string {
  return expirationDate ? `Still good · valid until ${paperDay(expirationDate)}` : 'Still good · no end date';
}

/** A paper that ran out: "Ended 31 Dec 2026 — upload this year's". */
export function endedLine(endedOn: string): string {
  return `Ended ${paperDay(endedOn)} — upload this year’s`;
}

/** A paper read clean now: "Read ✓ · 2027-03158 · valid until 31 Dec 2027" (the number only on the permit). */
export function readLine(slot: RenewalSlotKey, number: string | null | undefined, expirationDate: string | null | undefined): string {
  const parts = ['Read ✓'];
  if (slot === 'mayors_permit' && number) parts.push(number);
  parts.push(expirationDate ? `valid until ${paperDay(expirationDate)}` : 'no end date');
  return parts.join(' · ');
}

/** The checklist count: "2 of 3 still good" while kept papers wait on the new one, else "N of 3". */
export function renewalCountLine(standings: ReadonlyArray<PaperStanding | null>): string {
  const good = standings.filter((s) => s?.kind === 'still_good').length;
  const read = standings.filter((s) => s?.kind === 'read').length;
  if (good > 0 && good + read < 3) return `${formatCount(good + read)} of 3 still good`;
  return `${formatCount(good + read)} of 3`;
}

/** The one-tap button names the paper that ran out ("Upload this year's permit"), else the generic ask. */
export function renewalButtonLabel(endedSlots: readonly RenewalSlotKey[]): string | null {
  if (endedSlots.length !== 1) return null;
  const word: Record<RenewalSlotKey, string> = {
    dti_certificate: 'DTI or SEC',
    bir_2303: 'BIR 2303',
    mayors_permit: 'permit',
  };
  return endedSlots[0] === 'mayors_permit' ? 'Upload this year’s permit' : `Upload your new ${word[endedSlots[0]!]}`;
}

// ---------------------------------------------------------------------------
// The renewal draft: last year's papers that are still good are KEPT
// ---------------------------------------------------------------------------

/** A kept paper carries this mark (so its row reads "Still good"); a paper that ran out leaves a marker with its date. */
export type RenewalMark = { kept_from: string } | { ended_on: string };

type SlotLike = {
  r2_key?: string;
  manual?: boolean;
  evidence?: { model?: { expirationDate?: string | null; registry?: string | null } | null } | null;
  [k: string]: unknown;
};

/** Has this paper run out by Manila `today`? A Mayor's Permit must also be THIS year's (`expiredOn`'s rule). */
export function paperEnded(slot: RenewalSlotKey, expirationDate: string | null | undefined, todayManila: string): boolean {
  if (!expirationDate) return slot === 'mayors_permit';
  if (expirationDate < todayManila) return true;
  return slot === 'mayors_permit' && expirationDate.slice(0, 4) < todayManila.slice(0, 4);
}

/**
 * The seed of a renewal draft (§3: "The checklist already knows the DTI and BIR are still good, so the button asks
 * for the permit only"). From the APPROVED application's papers: a paper read clean and not run out is carried over
 * whole — file, sealed read and all, so Submit re-runs every check on it — marked `renewal: { kept_from }`. A paper
 * that ran out (or was typed by hand) is not carried; its slot keeps only `renewal: { ended_on }` so the row can say
 * which date ended. Other slots (the optional extras) carry over unchanged.
 */
export function seedRenewalDraft(
  approved: Record<string, unknown> | null | undefined,
  todayManila: string,
  approvedApplicationId: string,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(approved ?? {})) {
    if (key !== 'dti_certificate' && key !== 'bir_2303' && key !== 'mayors_permit') {
      out[key] = raw;
      continue;
    }
    const s = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null) as SlotLike | null;
    const model = s?.evidence?.model ?? null;
    const exp = model?.expirationDate ?? null;
    if (s?.r2_key && model && !s.manual && !paperEnded(key, exp, todayManila)) {
      out[key] = { ...s, renewal: { kept_from: approvedApplicationId } satisfies RenewalMark };
    } else {
      const ended = exp ?? (key === 'mayors_permit' ? `${Number(todayManila.slice(0, 4)) - 1}-12-31` : null);
      out[key] = { attempts: 0, ...(ended ? { renewal: { ended_on: ended } satisfies RenewalMark } : {}) };
    }
  }
  return out;
}

/** The standing of one slot in a renewal draft, or null when the slot is not part of a renewal. */
export function paperStanding(slot: RenewalSlotKey, raw: unknown, renewing: boolean): PaperStanding | null {
  if (!renewing || !raw || typeof raw !== 'object') return null;
  const s = raw as SlotLike & { renewal?: Partial<{ kept_from: string; ended_on: string }> };
  const model = (s.evidence?.model ?? null) as { expirationDate?: string | null; registrationNumber?: string | null } | null;
  if (s.r2_key && model && !s.manual) {
    if (s.renewal?.kept_from) return { kind: 'still_good', line: stillGoodLine(model.expirationDate) };
    return { kind: 'read', line: readLine(slot, model.registrationNumber, model.expirationDate) };
  }
  if (!s.r2_key && s.renewal?.ended_on) return { kind: 'ended', line: endedLine(s.renewal.ended_on) };
  return null;
}

/**
 * Renewal is "one tap" (§3 → §6): once every paper of a renewal draft is in, read clean (nothing typed by hand), the
 * page presses Submit itself — the same Submit, the same server checks — so clean papers restore the shop at once.
 */
export function renewalReadyToSend(slots: ReadonlyArray<unknown>): boolean {
  return (
    slots.length === 3 &&
    slots.every((raw) => {
      const s = raw as SlotLike | null;
      return Boolean(s?.r2_key && s.evidence?.model && !s.manual);
    })
  );
}

// ---------------------------------------------------------------------------
// §4 · What a couple sees — the reason line under the shipped "Not yet bookable"
// ---------------------------------------------------------------------------

/** Ruling (4): the line for a shop that WAS verified and whose papers lapsed. */
export const RENEWING_COUPLE_LINE =
  'This supplier is renewing their papers with Setnayan. Keep them shortlisted — they’ll show in Find again once their papers are checked.';

/** The short marking (≤ 12 words) — the long line sits behind the ⓘ. */
export const RENEWING_COUPLE_MARK = 'Renewing their papers with Setnayan';

/** A shop's couple-facing state: the renewing wording only for a shop verified before (ruling 4). */
export function coupleShopRenewing(row: { verification_state?: unknown; papers_current?: unknown }): boolean {
  return row.verification_state === 'verified' && row.papers_current === false;
}

// ---------------------------------------------------------------------------
// Ruling (2) · a paid plan's unused days WAIT
// ---------------------------------------------------------------------------

const PAID = new Set(['solo', 'pro', 'enterprise']);

/** What the lapse does to the plan: the free "verified" plan drops to free; a PAID plan is held with its days left. */
export type PlanAtLapse =
  | { kind: 'none' }
  | { kind: 'free_drop' }
  | { kind: 'hold'; tier: string; heldMs: number | null };

export function planHoldAtLapse(row: { tier_state?: string | null; tier_expires_at?: string | null }, now: Date): PlanAtLapse {
  const tier = row.tier_state ?? null;
  if (tier === 'verified') return { kind: 'free_drop' };
  if (!tier || !PAID.has(tier)) return { kind: 'none' };
  const end = row.tier_expires_at ? Date.parse(row.tier_expires_at) : NaN;
  // No end date = a plan with no clock (comped for good): it waits whole and comes back whole.
  if (!Number.isFinite(end)) return { kind: 'hold', tier, heldMs: null };
  const left = end - now.getTime();
  if (left <= 0) return { kind: 'none' };
  return { kind: 'hold', tier, heldMs: left };
}

/** On renewal: the held plan comes back with the days it had left, counted from the approval. */
export function planBackAtRenewal(held: { tier?: unknown; held_ms?: unknown } | null | undefined, now: Date): { tier_state: string; tier_expires_at: string | null } | null {
  if (!held || typeof held.tier !== 'string' || !PAID.has(held.tier)) return null;
  const ms = typeof held.held_ms === 'number' && Number.isFinite(held.held_ms) && held.held_ms > 0 ? held.held_ms : null;
  return { tier_state: held.tier, tier_expires_at: ms === null ? null : new Date(now.getTime() + ms).toISOString() };
}

// ---------------------------------------------------------------------------
// §5 · The admin's view — the Renewals filter
// ---------------------------------------------------------------------------

export type RenewalBucket = 'lapsed' | 'due_week' | 'renewed';

/** Which Renewals chip a shop falls under, or null. A clean renewal clears its row by itself after two weeks. */
export function renewalBucket(
  row: { verification_state?: string | null; next_renewal_due_at?: string | null; papers_lapsed_at?: string | null; last_verified_at?: string | null; renewed?: boolean },
  now: Date,
): RenewalBucket | null {
  if (row.verification_state !== 'verified') return null;
  if (row.papers_lapsed_at) return 'lapsed';
  const at = renewalStage({ verified: true, dueAt: row.next_renewal_due_at, lapsedAt: null }, now);
  if (at?.stage === 'lapsed') return 'lapsed';
  if (at?.stage === 'week') return 'due_week';
  if (row.renewed && row.last_verified_at) {
    const v = Date.parse(row.last_verified_at);
    if (Number.isFinite(v) && now.getTime() - v <= RENEWED_NEWS_DAYS * DAY_MS) return 'renewed';
  }
  return null;
}

export const RENEWAL_BUCKET_LABEL: Record<RenewalBucket, string> = {
  lapsed: 'Free · Unverified',
  due_week: 'Due in 7 days',
  renewed: 'Renewed',
};

/** The papers line on the admin's renewal views — what was read, per paper, and which one ran out. */
export function adminPaperLines(uploads: Record<string, unknown> | null | undefined, todayManila: string): Array<{ tag: 'Read' | 'Ended' | 'Missing'; text: string }> {
  const rows: Array<[RenewalSlotKey, string]> = [
    ['dti_certificate', 'DTI'],
    ['bir_2303', 'BIR 2303'],
    ['mayors_permit', 'Business Permit'],
  ];
  return rows.map(([slot, word]) => {
    const s = (uploads ?? {})[slot] as SlotLike | undefined;
    const model = (s?.evidence?.model ?? null) as { expirationDate?: string | null; registrationNumber?: string | null; registry?: string | null } | null;
    if (!s?.r2_key || !model) return { tag: 'Missing' as const, text: `${word} · no read on file` };
    const name = slot === 'dti_certificate' && model.registry === 'sec' ? 'SEC' : word;
    const num = model.registrationNumber ? ` ${model.registrationNumber}` : '';
    if (paperEnded(slot, model.expirationDate ?? null, todayManila)) {
      return { tag: 'Ended' as const, text: `${name}${num} · ended ${model.expirationDate ? paperDay(model.expirationDate) : 'last year'}` };
    }
    return { tag: 'Read' as const, text: `${name}${num} · ${model.expirationDate ? `valid until ${paperDay(model.expirationDate)}` : 'no end date'}` };
  });
}

/** One short papers summary for a list row: "DTI ✓ · BIR ✓ · Permit ended 31 Dec 2026". */
export function adminPapersSummary(lines: ReadonlyArray<{ tag: 'Read' | 'Ended' | 'Missing'; text: string }>): string {
  const short = ['DTI', 'BIR', 'Permit'];
  return lines
    .map((l, i) => {
      if (l.tag === 'Read') return `${short[i]} ✓`;
      if (l.tag === 'Ended') return `${short[i]} ${l.text.slice(l.text.indexOf('ended'))}`;
      return `${short[i]} —`;
    })
    .join(' · ');
}

/** "29 Jan · 60 days · app + email" — one reminder the daily pass sent, as the admin reads it. */
export function reminderSentLine(sentAt: string, stage: number | 'lapse'): string {
  const day = dayMonth(manilaDateKey(new Date(sentAt))) ?? sentAt.slice(0, 10);
  return stage === 'lapse' ? `${day} · new couples can’t find the shop · app + email` : `${day} · ${formatCount(stage)} days · app + email`;
}
