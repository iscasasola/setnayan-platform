/**
 * lib/send-run-page.ts — THE SEND RUN, REDRAWN SIMPLE (owner 2026-10-27, DECISION_LOG "THE SEND RUN, REDRAWN SIMPLE" ·
 * "APPROVED — THE SIMPLE SEND RUN, PLUS SWIPE" · "THE SEND RUN'S HINT LINE SAYS WHICH KIND OF INVITATION — THEN FADES AFTER
 * 10 S" · "THE SEND RUN ALSO SERVES A ONE-QR EVENT"; prototype `prototypes/send_run_simple_2026-10-27/`).
 *
 * The words and the small decisions of `/dashboard/<id>/guests/send`, pure, so the page and its guard read ONE source:
 *   · the guest as a page — role (the neutral pill), side · group, their +1s by name, the one detail the invite needs;
 *   · the status line "12 sent · 153 more to invite" and its bar;
 *   · the hint line, which names the invitation's kind;
 *   · a swipe's verdict — left = next, right = previous, a short drag snaps back.
 */
import { plusOneHasNoName } from '@/lib/extra-seats';
import { realNameParts } from '@/lib/seat-placeholder-words';
import { GROUP_CATEGORY_LABELS, SIDE_LABELS, guestRoleLabel, type GuestRole } from '@/lib/guests';
import type { RoleNames } from '@/lib/role-names';
import { formatCount } from '@/lib/format-number';

/** What the run shows of one guest, beyond the name. */
export type RunGuestPage = {
  /** Their role, in the event's own words — drawn as the neutral pill. */
  roleWord: string;
  /** "Bride's side · Family" — empty when there is nothing to say. */
  place: string;
  /** One line per +1 seat they bring: "+1 · Juan Ramos" or "+1 · no name yet". */
  plusOnes: string[];
  /** Their mobile, if on file — the one detail the invite needs. */
  mobile: string | null;
};

type PageRow = {
  guest_id: string;
  role: GuestRole;
  side: 'bride' | 'groom' | 'both';
  group_category: keyof typeof GROUP_CATEGORY_LABELS;
  mobile: string | null;
  plus_one_count?: number | null;
  plus_one_of_guest_id?: string | null;
  first_name: string | null;
  last_name: string | null;
  plus_one_name_confirmed_at: string | null;
  created_at?: string | null;
};

/**
 * One guest as the run's page draws them. `rows` is the page's whole read, so their +1 seats (rows whose
 * `plus_one_of_guest_id` is this guest) are named as the card names them; a seat still to be filled reads "no name
 * yet" — it rides on this guest's invitation (an unnamed +1 never gets a run card of its own, `mayBeInvited`).
 * `hasSides` — a sideless event never says a side.
 */
export function runGuestPage(g: PageRow, rows: readonly PageRow[], roleNames: RoleNames | null, hasSides: boolean): RunGuestPage {
  const seats = rows
    .filter((r) => r.plus_one_of_guest_id === g.guest_id)
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? '') || a.guest_id.localeCompare(b.guest_id));
  const plusOnes = seats.map((r) => {
    if (plusOneHasNoName({ ...r, plus_one_of_guest_id: g.guest_id })) return '+1 · no name yet';
    const n = realNameParts(r.first_name, r.last_name);
    return `+1 · ${[n.first, n.last].filter(Boolean).join(' ')}`;
  });
  // Seats counted on the guest but not yet rows of their own — still theirs to bring.
  const counted = typeof g.plus_one_count === 'number' ? Math.max(0, Math.min(4, Math.trunc(g.plus_one_count))) : 0;
  for (let i = plusOnes.length; i < counted; i++) plusOnes.push('+1 · no name yet');
  const place = [
    hasSides && g.side !== 'both' ? SIDE_LABELS[g.side] : null,
    g.group_category && g.group_category !== 'other' ? GROUP_CATEGORY_LABELS[g.group_category] : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return { roleWord: guestRoleLabel(g.role, roleNames), place, plusOnes, mobile: g.mobile?.trim() || null };
}

/** The run's status line (owner: "a status of how many more to invite"). */
export function sendRunStatus(sent: number, left: number): string {
  return `${formatCount(sent)} sent · ${formatCount(left)} more to invite`;
}

/** The thin bar under it — sent ÷ (sent + left), 0 when there is nobody. */
export function sendRunProgress(sent: number, left: number): number {
  return sent + left > 0 ? sent / (sent + left) : 0;
}

/** How long the hint line shows before it fades (owner: "which disappears after 10 seconds"). */
export const SEND_RUN_HINT_MS = 10_000;

/** The hint line — it names the event's kind of invitation. The same words stay inside the ⓘ. */
export function sendRunHint(oneQr: boolean): string {
  return oneQr
    ? 'Everyone gets the same link and QR, sent from your phone.'
    : 'Each guest gets their own link and QR, sent from your phone.';
}

/** A drag shorter than this snaps back; longer moves one guest. */
export const SWIPE_STEP_PX = 64;

/** A finished horizontal drag's verdict: left (negative) = the next guest, right = the previous one. */
export function swipeStep(dx: number, dy = 0): 'next' | 'prev' | null {
  if (Math.abs(dx) < SWIPE_STEP_PX || Math.abs(dy) > Math.abs(dx)) return null;
  return dx < 0 ? 'next' : 'prev';
}
