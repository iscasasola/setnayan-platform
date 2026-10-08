'use client';

/**
 * BenchVendorActions — the three actions under a bench vendor card
 * (Explore Replan slice D · spec §3 PR-D, §12.1, decision #9).
 *
 * ⚠ EVERY leg here is a PORT of shipped machinery, never a second copy of it:
 *
 *  1. **＋ Add to build** → `setBuildPick` / `removeBuildPick`, the SAME actions
 *     the legacy accordion's `AccordionBuildButton` calls. Hard-single groups
 *     hold one candidate and adding swaps — that rule lives server-side in
 *     `replacesSiblingsOnPin` (`lib/build-pick-rules.ts`), so this component
 *     never reimplements it.
 *  2. **Inquire / 💬 Check inquiry** → the shipped `ContactShortlistVendorButton`
 *     (which delegates to `startServiceInquiry` and dedupes on the UNIQUE
 *     (event_id, vendor_profile_id) thread) for a fresh inquiry, and a plain
 *     `<Link>` to the existing thread when one is live. `InquiryComposer` is
 *     deliberately NOT mounted here: it is a pure prop consumer needing seven
 *     props the bench does not load, and the contract forbids a second composer.
 *  3. **Lock this** → the shipped `AccordionLockButton`, so the hard-single
 *     conflict gate, the date-lock modal, the reservation-terms and downpayment
 *     gates, the milestone toast and undo ALL carry unchanged. There is exactly
 *     one lock path in this app and this is not a new one.
 *
 * Copy lives in `lib/explore-info-copy.ts` (§11 rule 3 — no strings in JSX) and
 * the decision of WHICH legs render lives in `lib/bench-card-actions.ts`. This
 * file is presentation only, wearing the bench's own scoped `.slcat` classes.
 *
 * The lock label is "Lock this", never "it's final": per the §7 handshake
 * amendment a lock is a REQUEST until the vendor accepts the payment.
 *
 * PR-G1 adds ONE more state to leg 1: a SOFT schedule clash (no free day left
 * inside the build's shared-date window) replaces the Add CTA with a note that
 * names the clashing candidate and the fix. It does NOT touch leg 2 — "Ask
 * anyway" is deliberate (decision #3) — and leg 3 is withheld upstream by the
 * resolver returning a null `lockGroupId`. Nothing here is a hard block: the
 * couple removes the clashing candidate and every leg comes straight back.
 */

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Ban,
  BellRing,
  CalendarCheck,
  CalendarDays,
  CalendarX2,
  Check,
  Clock,
  CreditCard,
  FolderOpen,
  Hourglass,
  MessageCircle,
  Pencil,
  Plus,
  QrCode,
  X,
} from 'lucide-react';
import { ActionButton, actionButtonClass, useFitRow } from '@/components/action-button';
import { useConfirm } from '@/app/_components/confirm-dialog';
import { cardVerbs, type CardVerb } from '@/lib/supplier-card-verbs';
import { contactShortlistVendor } from '../_actions/contact-shortlist-vendor';
import { deleteVendor } from '../actions';
import { haptic } from '@/lib/haptics';
import { announceBuildAdded } from '@/lib/budget-build';
import { useSaveLoader } from '@/components/sd-loader';
import type { BenchCardActions } from '@/lib/bench-card-actions';
import {
  DOESNT_FIT_ACTION,
  NOT_AVAILABLE_ACTION,
  NOT_AVAILABLE_REASON,
  doesntFitReason,
} from '@/lib/build-date-window';
import {
  CARD_ADDING,
  CARD_LOCKING,
  CARD_NEEDS_PRICE,
  CARD_ASK_SENT,
  LOCK_WITHHELD_COPY,
  cardInquireLabel,
  waitingOnSupplier,
} from '@/lib/explore-info-copy';
import type { PlanGroupId } from '@/lib/wedding-plan-groups';
import { removeBuildPick, setBuildPick } from '../build-pick-actions';
import { AccordionLockButton } from './accordion-lock';
import { ContactShortlistVendorButton } from './contact-shortlist-vendor-button';
import { WithdrawAskButton } from './withdraw-ask-button';
import { SelfAddedPrice } from './self-added-price';
import { ConnectSupplierModal } from '../../_components/connect-supplier-modal';

/** `deleteVendor` redirects a signed-out caller; that is not a failure to report. */
function isRedirect(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'digest' in e &&
    typeof (e as { digest?: unknown }).digest === 'string' &&
    (e as { digest: string }).digest.startsWith('NEXT_REDIRECT')
  );
}

export function BenchVendorActions({
  actions,
  eventId,
  vendorId,
  vendorName,
  groupLabel,
  verifiedState,
  lockRequestExpiresAt,
  booked = false,
  hasPrice = false,
  quoteIn = false,
  payHref = null,
  workspaceHref,
  onRecord,
}: {
  actions: BenchCardActions;
  eventId: string;
  /** `event_vendors.vendor_id` — what every action below keys on. */
  vendorId: string;
  vendorName: string;
  /** The category label, for the lock modals' copy ("Caterer", "Florist"…). */
  groupLabel: string;
  /**
   * TRI-state verification (see `ShortlistVendor.verifiedState`). NULL means
   * unknown / off-platform and MUST pass through as `undefined` — coercing it
   * to false would client-block a manual vendor from a lock they are entitled
   * to (spec §9: manual vendors skip the handshake and lock directly).
   */
  verifiedState: boolean | null;
  /** ISO deadline of a still-outstanding ask, read back off the row the DB
   *  stamped. Only meaningful when `actions.withdraw` is non-null. */
  lockRequestExpiresAt?: string | null;
  /** Booked here (contracted or later) — the verbs become Pay · Chat · Workspace. */
  booked?: boolean;
  /** A price is recorded for them. */
  hasPrice?: boolean;
  /** Their quote is waiting on the couple (`standing.needsYou`). */
  quoteIn?: boolean;
  /** Where "Pay" goes when a payment is due — the Booked row's own link, or null. */
  payHref?: string | null;
  /** The supplier's workspace on this event. */
  workspaceHref: string;
  /** Opens the couple's own record of a supplier they added. */
  onRecord?: () => void;
}) {
  const [pending, start] = useTransition();
  const save = useSaveLoader();

  const pin = (planGroupId: string) => {
    haptic('confirm');
    start(async () => {
      const added = await save.run(() => setBuildPick({ eventId, planGroupId, vendorId }), {
        steps: ['Pinning your pick'],
        hint: 'Saving',
      });
      // The cart peeks (the page's shell listens) — only for a pick that saved.
      if (added.ok) announceBuildAdded({ name: vendorName, category: groupLabel });
    });
  };

  const unpin = (planGroupId: string) => {
    haptic('tick');
    start(async () => {
      // vendorId is REQUIRED: a multi-pick category holds several picks and a
      // vendorless clear would destroy the couple's others.
      await removeBuildPick({ eventId, planGroupId, vendorId });
    });
  };

  // ONE ID PER JOB. The build slot acts on `buildGroupId`; Lock renders on
  // `lockGroupId`. They were one variable until 2026-09-11, and the resolver
  // nulls the lock id on a clash — so the clash note below could never draw.
  const groupId = actions.lockGroupId;
  const buildGroupId = actions.buildGroupId;
  const [connectOpen, setConnectOpen] = useState(false);

  // ── THE VERBS, BY STEP (`lib/supplier-card-verbs.ts`) ────────────────────
  // Which buttons, in what order and colour, is ONE table. Whether an action
  // is allowed stays the resolver's (`actions`); a verb is drawn only when the
  // resolver already holds its action.
  const verbs = cardVerbs({ actions, booked, hasPrice, quoteIn, payDue: Boolean(payHref) });
  const threadHref =
    actions.inquiry?.kind === 'check' ? `/dashboard/${eventId}/messages/${actions.inquiry.threadId}` : null;
  const threadId = actions.inquiry?.kind === 'check' ? actions.inquiry.threadId : null;
  const rowRef = useRef<HTMLDivElement>(null);
  useFitRow(rowRef);
  const router = useRouter();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const [said, setSaid] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const remove = () => {
    start(async () => {
      setSaid(null);
      const ok = await confirm({
        title: `Remove ${vendorName}?`,
        body: `They leave your ${groupLabel} list. Your conversation with them is kept.`,
        confirmLabel: 'Remove',
        cancelLabel: 'Keep',
        destructive: true,
      });
      if (!ok) return;
      try {
        const fd = new FormData();
        fd.set('event_id', eventId);
        fd.set('vendor_id', vendorId);
        await deleteVendor(fd);
        router.refresh();
      } catch (e) {
        if (isRedirect(e)) throw e;
        // The server refuses a booked supplier, or one with a payment on record.
        setSaid({ tone: 'error', text: `${vendorName} could not be removed. Nothing changed.` });
      }
    });
  };

  const nudge = () => {
    if (!threadId) return;
    start(async () => {
      setSaid(null);
      const res = await contactShortlistVendor({ eventId, vendorId, nudgeThreadId: threadId });
      if (res.status === 'nudged') setSaid({ tone: 'ok', text: `Nudged ${vendorName}.` });
      else setSaid({ tone: 'error', text: res.status === 'error' ? res.message : 'That did not send. Nothing changed.' });
    });
  };

  const pill = (v: CardVerb) => actionButtonClass(v.tone, { main: v.main, quiet: v.quiet });
  const draw = (v: CardVerb) => {
    switch (v.key) {
      case 'add':
        return buildGroupId ? (
          <ActionButton key={v.key} tone={v.tone} main icon={Plus} label={pending ? CARD_ADDING : v.label} disabled={pending} onClick={() => pin(buildGroupId)} />
        ) : null;
      case 'in_build':
        // In the build — a second press takes it back out (the prototype's toggle).
        return buildGroupId ? (
          <ActionButton key={v.key} tone={v.tone} main icon={Check} label={v.label} aria-pressed disabled={pending} onClick={() => unpin(buildGroupId)} />
        ) : null;
      case 'book':
        return groupId ? (
          <AccordionLockButton
            key={v.key}
            eventId={eventId}
            groupId={groupId as PlanGroupId}
            groupLabel={groupLabel}
            vendorId={vendorId}
            vendorName={vendorName}
            label={v.label}
            pendingLabel={CARD_LOCKING}
            icon={<CalendarCheck aria-hidden strokeWidth={1.9} />}
            className={pill(v)}
            wrapperClassName="verb-slot"
            isVerified={verifiedState ?? undefined}
          />
        ) : null;
      case 'ask':
        return (
          <ContactShortlistVendorButton
            key={v.key}
            eventId={eventId}
            vendorId={vendorId}
            label={v.label}
            ariaLabel={cardInquireLabel(vendorName)}
            className={pill(v)}
            wrapperClassName="verb-slot"
            errorClassName="verb-err"
          />
        );
      case 'withdraw':
        return (
          <WithdrawAskButton
            key={v.key}
            vendorId={vendorId}
            vendorName={vendorName}
            label={v.label}
            className={pill(v)}
            wrapperClassName="verb-slot"
            errorClassName="verb-err"
          />
        );
      case 'nudge':
        return <ActionButton key={v.key} tone={v.tone} icon={BellRing} label={v.label} disabled={pending} onClick={nudge} />;
      case 'chat':
      case 'read_reply':
      case 'another_day':
        return threadHref ? (
          <ActionButton
            key={v.key}
            tone={v.tone}
            main={v.main}
            quiet={v.quiet}
            icon={v.key === 'another_day' ? CalendarDays : MessageCircle}
            label={v.label}
            href={threadHref}
            prefetch={false}
          />
        ) : null;
      case 'pay':
        return payHref ? <ActionButton key={v.key} tone={v.tone} main icon={CreditCard} label={v.label} href={payHref} prefetch={false} /> : null;
      case 'payments':
        return (
          <ActionButton key={v.key} tone={v.tone} main quiet icon={CreditCard} label={v.label} href={`${workspaceHref}?tab=payments`} prefetch={false} />
        );
      case 'set_price':
      case 'workspace':
        return (
          <ActionButton
            key={v.key}
            tone={v.tone}
            main={v.main}
            icon={v.key === 'set_price' ? Pencil : FolderOpen}
            label={v.label}
            href={workspaceHref}
            prefetch={false}
          />
        );
      case 'record':
        return <ActionButton key={v.key} tone={v.tone} main={v.main} icon={Pencil} label={v.label} onClick={onRecord} disabled={!onRecord} />;
      case 'remove':
        return <ActionButton key={v.key} tone={v.tone} icon={X} label={v.label} disabled={pending} onClick={remove} />;
      default:
        return null;
    }
  };

  return (
    <div className="vacts">
      {confirmDialog}
      {/* ── WHY A VERB IS MISSING — said, never left as a gap ──────────────── */}
      {actions.build && buildGroupId ? (
        actions.build.kind === 'not_available' ? (
          // HARD tier (PR-G2 · owner 2026-09-11): their calendar shows the
          // committed day taken. The reason is named; the card stays, but it
          // cannot be added to the build or booked.
          <span className="vact note unavailable">
            <CalendarX2 size={12} strokeWidth={1.9} aria-hidden />
            <span className="vact-note-txt">
              <b>{NOT_AVAILABLE_ACTION}</b>
              <span>{NOT_AVAILABLE_REASON}</span>
            </span>
          </span>
        ) : actions.build.kind === 'schedule_clash' ? (
          // SOFT schedule clash (PR-G1). Not an error and not a wall: the
          // reason is named, and removing the clashing candidate brings this
          // card back.
          <span className="vact note clash">
            <CalendarX2 size={12} strokeWidth={1.9} aria-hidden />
            <span className="vact-note-txt">
              <b>{DOESNT_FIT_ACTION}</b>
              <span>{doesntFitReason(actions.build.clashWith)}</span>
            </span>
          </span>
        ) : actions.build.kind === 'set_price' ? (
          // A supplier the couple added themselves. There is nobody to ask, so
          // the couple types the price and the card unblocks (owner
          // 2026-09-20). Writes through `updateVendorCosts` — the one writer.
          <SelfAddedPrice eventId={eventId} vendorId={vendorId} />
        ) : actions.build.kind === 'needs_price' ? (
          <span className="vact note">
            <Clock size={12} strokeWidth={1.9} aria-hidden />
            {CARD_NEEDS_PRICE}
          </span>
        ) : null
      ) : null}

      {/* PR-H · THE ASK IS OUT AND NOBODY HAS ANSWERED. The deadline is the
          DB's own stamped value, never a recomputed window. */}
      {actions.withdraw ? (
        <span className="vact note">
          <Hourglass size={12} strokeWidth={1.9} aria-hidden />
          <span className="vact-note-txt">
            <b>{CARD_ASK_SENT}</b>
            <span>{waitingOnSupplier(lockRequestExpiresAt ?? null)}</span>
          </span>
        </span>
      ) : null}

      {/* "Hide lock, say why" (owner 2026-09-11) — the reason Book is absent,
          read off the thread, never a guessed one. */}
      {actions.lockWithheld ? (
        <span className="vact note withheld">
          <Ban size={12} strokeWidth={1.9} aria-hidden />
          <span className="vact-note-txt">
            <b>{LOCK_WITHHELD_COPY[actions.lockWithheld].headline}</b>
            <span>{LOCK_WITHHELD_COPY[actions.lockWithheld].line}</span>
          </span>
        </span>
      ) : null}

      {/* ── THE VERB ROW — one line, one fit state (icon + word → word → icon) */}
      <div ref={rowRef} className="verbs" data-card-verbs={verbs.map((v) => v.key).join(' ')}>
        {verbs.map(draw)}
        {/* [Connect] — the supplier's portal into their own account, for one
            the couple added themselves. It stays reachable at every step until
            the record sheet (PR2b) carries the claim link. Opening it only
            READS whether a link exists. */}
        {actions.connect ? (
          <ActionButton tone="neutral" icon={QrCode} label="Connect" aria-haspopup="dialog" onClick={() => setConnectOpen(true)} />
        ) : null}
      </div>
      {connectOpen ? (
        <ConnectSupplierModal
          eventId={eventId}
          vendorId={vendorId}
          vendorName={vendorName}
          onClose={() => setConnectOpen(false)}
        />
      ) : null}
      {/* What a press came back with — a refusal is said in words, here. */}
      {said ? (
        <p className={said.tone === 'error' ? 'verb-err' : 'verb-ok'} role="status">
          {said.text}
        </p>
      ) : null}
    </div>
  );
}
