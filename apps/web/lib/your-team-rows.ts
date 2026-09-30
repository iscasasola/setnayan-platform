/**
 * YOUR TEAM, AS ROWS — the phone screen's top half (owner-APPROVED 2026-10-01,
 * `prototypes/phone_app_simple_2026-10-01_fable.html` frame 4, DECISION_LOG row
 * "THE SIMPLE PHONE APP — APPROVED").
 *
 *     Lumina Studio   Photo & video   [Booked]    Next: pay your deposit   Pay ›
 *     Kusina ni Tita  Catering        [Quote in]  Next: lock the price     Lock ›
 *     Flores de Mayo  Flowers         [Booked]    Next: nothing — all set
 *     DJ Marco        Music           [Waiting]   Next: they send a quote  Nudge ›
 *
 * ── NOTHING HERE IS A NEW STATE ─────────────────────────────────────────────
 * Every row is read off a derivation that already ships, and this module only
 * PICKS which one answers "what happens next":
 *
 *   booked or not      → `lockRequestStateOf` (lib/lock-request-state.ts) — the
 *                        one place the handshake is derived; couple asks,
 *                        supplier agrees.
 *   the deposit        → `DepositStep` from `depositStepOf` (lib/deposit-pay-step.ts)
 *                        — `unknown` is a refused read and is NEVER `due`.
 *   can they lock      → the bench card's own verdict (`resolveBenchCardActions`
 *                        → `lockGroupId`), resolved on the page, so this row and
 *                        the card can never disagree about the same supplier.
 *   the review window  → the page's `reviewState()` map ('open' | 'submitted').
 *   a quote waiting    → `SupplierStanding.needsYou` (lib/supplier-standing.ts).
 *
 * ── ONE ACTION, AT MOST ─────────────────────────────────────────────────────
 * A row carries AT MOST one action — the one-tap step the prototype names
 * (Pay · Lock · Nudge, plus Review after the day). "Nothing — all set" carries
 * none, and saying so is the point: a button on a finished row is a chore
 * invented for the couple. `your-team-rows.test.ts` executes every branch.
 *
 * ⚠ NUDGE IS THE CONVERSATION. There is no "send a nudge" server action and
 * this build may not add one (the 1,225-action ceiling). The Nudge link opens
 * the supplier's thread, where the couple writes the nudge themselves — the
 * same destination the "Waiting for quotes" strip already links to.
 *
 * Pure: no React, no I/O, no env. The flag arrives as a parameter.
 */
import { lockRequestStateOf, lockRequestFuseLabel } from '@/lib/lock-request-state';
import { depositStepHref, type DepositStep } from '@/lib/deposit-pay-step';
import { formatPhpRounded } from '@/lib/php';
import type { BlockedLockReason } from '@/lib/bench-card-actions';
import { BLOCKED_LOCK_ROW } from '@/lib/explore-info-copy';

/** Everything one row is derived from — all of it already read by the page. */
export type TeamRowFacts = {
  /** `event_vendors.vendor_id`. */
  vendorId: string;
  /** Resolved (hybrid-anonymity) name — never re-resolved here. */
  name: string;
  /** The category's label ("Photo & video"). Null when it has none. */
  service: string | null;
  /** The logo, already masked until the name is revealed. Null → initials. */
  logoUrl: string | null;
  /** Raw `event_vendors.status`. */
  status: string | null;
  /** Raw `event_vendors.lock_request_state`. */
  lockRequestState: string | null;
  /** Materialized deadline of an outstanding ask. */
  lockRequestExpiresAt: string | null;
  /** Pinned to the couple's build (`event_build_picks`). */
  inBuild: boolean;
  /**
   * The group the bench card would lock this supplier in — non-null ONLY when
   * the card's own resolver offers Lock (`resolveBenchCardActions().lockGroupId`).
   */
  lockGroupId: string | null;
  /** Why a build pick cannot be locked right now (`blockedLockReason`). */
  lockBlocked: BlockedLockReason | null;
  /** `chat_threads.inquiry_status` for this supplier, when a thread exists. */
  inquiryStatus: string | null;
  threadId: string | null;
  /** The agreed/quoted price NOW, in pesos. Null = no price recorded. */
  pricePhp: number | null;
  /** Present only for a `contracted` supplier (the page's `depositStepOf` map). */
  depositStep: DepositStep | null;
  /** The page's review map: 'open' may be written now; 'submitted' already was. */
  reviewStatus: 'open' | 'submitted' | null;
  /** A quote is out and the answer is the couple's (`SupplierStanding.needsYou`). */
  quoteWaitingOnCouple: boolean;
  /** Marketplace verification, for the Lock button's own "Verifying" gate. */
  isVerified?: boolean;
};

export type TeamRowAction =
  | { kind: 'pay'; label: 'Pay'; href: string }
  | { kind: 'lock'; label: 'Lock'; groupId: string }
  | { kind: 'nudge'; label: 'Nudge'; href: string }
  | { kind: 'review'; label: 'Review'; href: string }
  /** A refused deposit read: a doorway that claims nothing either way. */
  | { kind: 'check'; label: 'Check'; href: string };

export type TeamRowTone = 'ok' | 'warn' | 'soft' | 'no';

export type TeamRowGroup =
  /** A real booking. Always listed first. */
  | 'booked'
  /** The couple asked to lock; the supplier has not answered. */
  | 'asked'
  /** A price is in (or the supplier is in the build) and the couple can lock. */
  | 'deciding'
  /** The couple reached out; no reply or quote yet. */
  | 'waiting';

export type TeamRow = {
  vendorId: string;
  name: string;
  service: string | null;
  logoUrl: string | null;
  initials: string;
  group: TeamRowGroup;
  pill: { text: string; tone: TeamRowTone };
  /** The sentence after "Next:" — always present, never blank. */
  next: string;
  action: TeamRowAction | null;
  /** The couple has something to DO on this row (counted as "need you"). */
  needsYou: boolean;
  isVerified?: boolean;
};

const GROUP_ORDER: Record<TeamRowGroup, number> = { booked: 0, asked: 1, deciding: 2, waiting: 3 };

/** Two letters for the logo square when there is no logo ("Lumina Studio" → "LS"). */
export function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '·';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

function threadHref(eventId: string, threadId: string | null): string | null {
  return threadId ? `/dashboard/${eventId}/messages/${threadId}` : null;
}

/**
 * One supplier → one row, or `null` when they are not on the team yet (a name
 * on the bench nobody has written to). Those live inside "Find a supplier".
 */
export function teamRowOf(
  f: TeamRowFacts,
  ctx: { eventId: string; lockHandshakeEnabled: boolean; now?: Date },
): TeamRow | null {
  const base = {
    vendorId: f.vendorId,
    name: f.name,
    service: f.service,
    logoUrl: f.logoUrl,
    initials: initialsOf(f.name),
    isVerified: f.isVerified,
  };
  const state = lockRequestStateOf(
    { status: f.status, lock_request_state: f.lockRequestState },
    ctx.lockHandshakeEnabled,
  );
  const nudge = threadHref(ctx.eventId, f.threadId);

  // ── 1 · Booked ───────────────────────────────────────────────────────────
  if (state === 'locked') {
    const booked = { ...base, group: 'booked' as const, pill: { text: 'Booked', tone: 'ok' as const } };
    // After the day: the review window, when (and only when) it is open.
    if (f.reviewStatus === 'open') {
      return {
        ...booked,
        next: 'leave a review',
        action: { kind: 'review', label: 'Review', href: `/dashboard/${ctx.eventId}/vendors/${f.vendorId}/review` },
        needsYou: true,
      };
    }
    // The deposit — read ONLY for `contracted`, exactly as the page reads it.
    if (f.status === 'contracted' && f.depositStep) {
      const href = depositStepHref(ctx.eventId, f.vendorId);
      switch (f.depositStep) {
        case 'due':
          return { ...booked, next: 'pay your deposit', action: { kind: 'pay', label: 'Pay', href }, needsYou: true };
        case 'refused':
          return {
            ...booked,
            pill: { text: 'Deposit not received', tone: 'warn' },
            next: 'send your deposit again',
            action: { kind: 'pay', label: 'Pay', href },
            needsYou: true,
          };
        case 'sent':
          return { ...booked, next: 'they confirm your deposit', action: null, needsYou: false };
        case 'unknown':
          // A refused read is NOT "due" — telling a couple who paid to pay again
          // is the failure this whole codebase keeps fencing. Say what is true.
          return {
            ...booked,
            next: 'we couldn’t check your deposit',
            action: { kind: 'check', label: 'Check', href },
            needsYou: false,
          };
        case 'confirmed':
          break;
      }
    }
    return { ...booked, next: 'nothing — all set', action: null, needsYou: false };
  }

  // ── 2 · Asked to lock — the supplier's turn (couple asks, supplier agrees) ─
  if (state === 'requested') {
    const fuse = lockRequestFuseLabel(f.lockRequestExpiresAt, ctx.now);
    return {
      ...base,
      group: 'asked',
      pill: { text: 'Waiting', tone: 'soft' },
      next: fuse ? `they agree to your lock · ${fuse}` : 'they agree to your lock',
      action: nudge ? { kind: 'nudge', label: 'Nudge', href: nudge } : null,
      needsYou: false,
    };
  }

  // ── 3 · In the build, but the card withholds Lock — say why, offer nothing ─
  if (f.inBuild && f.lockBlocked) {
    return {
      ...base,
      group: 'deciding',
      pill: { text: 'Can’t lock', tone: 'no' },
      next: `${BLOCKED_LOCK_ROW[f.lockBlocked]} — pick someone else`,
      action: null,
      needsYou: false,
    };
  }

  // ── 4 · The couple can lock: in their build, or a quote is waiting on them ─
  if (f.lockGroupId && (f.inBuild || f.quoteWaitingOnCouple)) {
    const priced = f.pricePhp != null;
    return {
      ...base,
      group: 'deciding',
      pill: priced ? { text: 'Quote in', tone: 'warn' } : { text: 'In your build', tone: 'soft' },
      next: priced ? `lock the price — ${formatPhpRounded(f.pricePhp)}` : 'lock them in',
      action: { kind: 'lock', label: 'Lock', groupId: f.lockGroupId },
      needsYou: true,
    };
  }

  // ── 5 · Reached out; no answer yet ────────────────────────────────────────
  if (f.inquiryStatus === 'pending') {
    return {
      ...base,
      group: 'waiting',
      pill: { text: 'Waiting', tone: 'soft' },
      next: 'they send a quote',
      action: nudge ? { kind: 'nudge', label: 'Nudge', href: nudge } : null,
      needsYou: false,
    };
  }

  // Everyone else is a name on the bench — inside "Find a supplier".
  return null;
}

/** The team, booked first, then the order the couple acts in. Stable within a group. */
export function teamRows(
  facts: readonly TeamRowFacts[],
  ctx: { eventId: string; lockHandshakeEnabled: boolean; now?: Date },
): TeamRow[] {
  const seen = new Set<string>();
  const rows: TeamRow[] = [];
  for (const f of facts) {
    if (seen.has(f.vendorId)) continue;
    seen.add(f.vendorId);
    const r = teamRowOf(f, ctx);
    if (r) rows.push(r);
  }
  return rows
    .map((r, i) => ({ r, i }))
    .sort((a, b) => GROUP_ORDER[a.r.group] - GROUP_ORDER[b.r.group] || a.i - b.i)
    .map(({ r }) => r);
}

/** "4 booked · 2 need you" — counted from the same rows the screen draws. */
export function teamCountsLine(rows: readonly TeamRow[]): { booked: number; needYou: number } {
  return {
    booked: rows.filter((r) => r.group === 'booked').length,
    needYou: rows.filter((r) => r.needsYou).length,
  };
}
