'use client';

import Link from 'next/link';
import {
  DECISIONS_EMPTY,
  decisionStageWord,
  type DecisionEntry,
  type DecisionReply,
} from '@/lib/thread-decisions';
import { respondAppointment } from './appointments-actions';
import { respondAmendmentFromChat } from './negotiation-actions';
import { SubmitButton } from './submit-button';
import { formatPhp } from '@/lib/vendors';
import { THREAD_STAGE_TONE } from '@/lib/vendor-thread-stage';
import { STANDING_LABEL, standingSentence, type SupplierStanding } from '@/lib/supplier-standing';
import type { SharedFileEntry } from '@/lib/chat-shared-files';

/**
 * chat-thread-views.tsx — All · Decisions · Files, and the two panels behind
 * the second and third.
 *
 * ── WHAT THE OWNER ASKED FOR ────────────────────────────────────────────────
 * *"anyway to filter what their current cards are… so it can eliminate other
 * conversation and just show what is the current verdict for those?"*
 *
 * On **Decisions** every text bubble, system line and day divider falls away
 * and only the cards remain, oldest to newest, under ONE standing line.
 *
 * ── ⛔ THIS FILE RENDERS. IT DOES NOT DECIDE. ───────────────────────────────
 * Every word with a claim in it arrives already computed:
 *   • the standing sentence from `standingSentence` (S6) — NOT rewritten here,
 *     because "it is fine to show it twice" is only safe while one derivation
 *     is drawn in several places;
 *   • each entry's verdict from `buildThreadDecisions`;
 *   • each pill's word from `THREAD_STAGE_LABEL`, via `decisionStageWord`,
 *     which returns null for every kind that may not wear one.
 * If you find yourself composing a sentence in this file, it belongs in one of
 * those modules instead.
 *
 * ── THE PHONE IS NOT AN AFTERTHOUGHT ────────────────────────────────────────
 * On a phone this may be the most useful thing on the screen — the whole
 * standing of a booking without scrolling a month of chat. The switch is a
 * 44px-tall row directly under the header at every width, the panels are
 * single-column, and nothing here is hidden below a breakpoint.
 */

import type { ThreadView } from '@/lib/thread-view';
export type { ThreadView } from '@/lib/thread-view';

const VIEW_HINT: Record<ThreadView, string> = {
  all: 'Decisions hides the chatter and shows only the cards — each with where it stands now.',
  decisions: 'Only the cards, oldest to newest — each says where it stands now.',
  files: 'Everything shared in this conversation, oldest to newest.',
};

/* ─────────────────────────────────────────────────────────────────────────── */

export function ThreadViewSwitch({
  view,
  onChange,
  decisionsCount,
  needsYouCount,
  filesCount,
}: {
  view: ThreadView;
  onChange: (v: ThreadView) => void;
  decisionsCount: number;
  needsYouCount: number;
  filesCount: number;
}) {
  const tab = (key: ThreadView, label: string, count: number | null, needs: number) => {
    const active = view === key;
    return (
      <button
        key={key}
        type="button"
        onClick={() => onChange(key)}
        aria-pressed={active}
        className={[
          'inline-flex min-h-[44px] items-center gap-1.5 px-3 text-xs font-semibold',
          'border-r border-ink/15 last:border-r-0',
          active ? 'bg-ink text-cream' : 'bg-cream text-ink/70 hover:bg-ink/[0.04]',
        ].join(' ')}
      >
        {label}
        {count != null ? (
          <span className="font-mono text-[0.6rem] font-normal opacity-85">{count}</span>
        ) : null}
        {needs > 0 ? (
          // ⚖ A COUNT AND AN OUTLINE, NEVER A SIXTH LADDER WORD. "Needs you" is
          // not a stage — a thread with two things outstanding is still Booked.
          <span
            className="rounded-full border border-terracotta bg-terracotta/10 px-1.5 font-mono text-[0.6rem] font-bold text-terracotta"
            aria-label={`${needs} need${needs === 1 ? 's' : ''} you`}
          >
            {needs}
          </span>
        ) : null}
      </button>
    );
  };

  return (
    <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <div
        role="group"
        aria-label="Show"
        className="inline-flex overflow-hidden rounded-lg border border-ink/15"
      >
        {tab('all', 'All', null, 0)}
        {tab('decisions', 'Decisions', decisionsCount, needsYouCount)}
        {tab('files', 'Files', filesCount, 0)}
      </div>
      <span className="text-[0.7rem] text-ink/50">{VIEW_HINT[view]}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE ONE STANDING LINE, above the cards.
 *
 * ⛔ The sentence is `standingSentence(standing)` and nothing else. The bench
 * card renders the same string from the same derivation; that is the whole
 * reason the owner's "show it twice" is safe.
 */
function StandingLine({
  standing,
  counterpartyLabel,
  needsYouCount,
}: {
  standing: SupplierStanding | null;
  counterpartyLabel: string;
  needsYouCount: number;
}) {
  if (!standing) return null;
  return (
    <div
      role="status"
      aria-label="Where things stand"
      className="mb-3 rounded-lg border border-gold/25 bg-gold/[0.06] px-3 py-2"
    >
      <p className="flex flex-wrap items-center gap-2 text-[0.7rem] font-semibold uppercase tracking-wide text-ink/60">
        {STANDING_LABEL} with {counterpartyLabel}
        {needsYouCount > 0 ? (
          <span className="rounded-full border border-terracotta bg-terracotta/10 px-1.5 font-mono text-[0.6rem] normal-case tracking-normal text-terracotta">
            {needsYouCount} need{needsYouCount === 1 ? 's' : ''} you
          </span>
        ) : null}
      </p>
      <p className="mt-0.5 text-sm text-ink">{standingSentence(standing)}</p>
    </div>
  );
}

/**
 * Server actions a reply may need that are NOT shared chat actions.
 *
 * The payment and guest-count replies are the SUPPLIER's, and their actions
 * live beside the supplier's thread page (`pay-confirm-actions.ts`,
 * `pax-actions.ts`). They arrive as props from that page instead of being
 * imported here, so this shared component stays free of any one route — and
 * so the couple's page, which never receives those replies, cannot offer them.
 */
export type SupplierReplyActions = {
  confirmPayment: (formData: FormData) => Promise<void>;
  applySurcharge: (formData: FormData) => Promise<void>;
  holdPrice: (formData: FormData) => Promise<void>;
};

/** Everything a reply form must post, identical to the stream's own cards. */
export type ReplyContext = {
  threadId: string;
  eventId: string;
  vendorProfileId: string;
  /**
   * Where the reply lands. ALREADY CARRIES `?view=decisions`, so answering the
   * other side keeps you on Decisions instead of dropping you into the chat.
   */
  returnPath: string;
  supplierActions?: SupplierReplyActions;
};

export function DecisionsPanel({
  entries,
  standing,
  counterpartyLabel,
  needsYouCount,
  reply,
}: {
  entries: readonly DecisionEntry[];
  standing: SupplierStanding | null;
  counterpartyLabel: string;
  needsYouCount: number;
  reply: ReplyContext;
}) {
  return (
    <div className="space-y-2">
      <StandingLine
        standing={standing}
        counterpartyLabel={counterpartyLabel}
        needsYouCount={needsYouCount}
      />

      {entries.length === 0 ? (
        // ⚠ NOT AN EMPTY BOX. A heading over nothing reads as a view that
        // failed to load — the couple must be told what WILL collect here.
        <p className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
          {DECISIONS_EMPTY}
        </p>
      ) : (
        <ol className="space-y-2">
          {entries.map((e) => (
            <DecisionCard key={e.key} entry={e} ctx={reply} />
          ))}
        </ol>
      )}
    </div>
  );
}

function DecisionCard({ entry, ctx }: { entry: DecisionEntry; ctx: ReplyContext }) {
  const stageWord = decisionStageWord(entry);
  return (
    <li
      className={[
        'rounded-lg border bg-cream p-3',
        entry.now.needsYou ? 'border-terracotta/40' : 'border-ink/12',
      ].join(' ')}
    >
      <p className="flex flex-wrap items-baseline gap-x-2 text-[0.7rem] uppercase tracking-wide text-ink/55">
        {entry.kindLabel}
        <span className="font-normal normal-case tracking-normal text-ink/40">
          {entry.sentLabel}
        </span>
      </p>

      <p className="mt-0.5 text-sm font-semibold text-ink">{entry.title}</p>

      {/*
        🔑 THE NOW LINE — the reason this view exists. It is derived from the
        LIVE row, never from the message that announced the card above it.
      */}
      <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-sm">
        <span className="text-[0.65rem] font-semibold uppercase tracking-wide text-ink/40">
          Now
        </span>
        {stageWord ? (
          <span
            className={`rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold ${
              entry.now.stage ? THREAD_STAGE_TONE[entry.now.stage] : ''
            }`}
          >
            {stageWord}
          </span>
        ) : null}
        {entry.now.wasText ? (
          <s className="text-ink/35">{entry.now.wasText}</s>
        ) : null}
        <span className={entry.now.needsYou ? 'font-semibold text-terracotta' : 'text-ink/75'}>
          {entry.now.text}
        </span>
      </p>

      {entry.reply ? <ReplyControls reply={entry.reply} ctx={ctx} /> : null}
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

/*
 * The two looks, lifted from the stream's own cards so a reply here and the
 * same reply in the chat are visibly the same act — but 44px tall, because
 * Decisions is the phone's surface and the chat cards' 36px sits under the
 * touch target. Primary is the CTA colour; decline is quiet ink, never red.
 */
const PRIMARY =
  'inline-flex min-h-[44px] items-center rounded-lg bg-mulberry px-3.5 text-sm font-medium text-cream hover:bg-mulberry-600';
const QUIET =
  'inline-flex min-h-[44px] items-center rounded-lg border border-ink/15 px-3.5 text-sm font-medium text-ink/75 hover:bg-ink/[0.04]';

/**
 * THE REPLY — one of four existing actions, or a link.
 *
 * Every form posts exactly the fields the stream's own card for that kind
 * posts, to the same action, so there is ONE way to answer each request and
 * this view is only a second door to it. The action re-checks, server-side,
 * that the caller is the party allowed to answer.
 */
function ReplyControls({ reply, ctx }: { reply: DecisionReply; ctx: ReplyContext }) {
  switch (reply.kind) {
    case 'meeting': {
      const hidden = (
        <>
          <input type="hidden" name="appointment_id" value={reply.appointmentId} />
          <input type="hidden" name="event_id" value={ctx.eventId} />
          <input type="hidden" name="vendor_profile_id" value={ctx.vendorProfileId} />
          <input type="hidden" name="return_path" value={ctx.returnPath} />
          <input type="hidden" name="label" value={reply.label} />
        </>
      );
      return (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={respondAppointment}>
            {hidden}
            <input type="hidden" name="decision" value="confirm" />
            <SubmitButton className={PRIMARY} pendingLabel="Confirming…">
              Confirm
            </SubmitButton>
          </form>
          <form action={respondAppointment}>
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <SubmitButton className={QUIET} pendingLabel="Declining…">
              Decline
            </SubmitButton>
          </form>
        </div>
      );
    }

    case 'adjustment': {
      const hidden = (
        <>
          <input type="hidden" name="thread_id" value={ctx.threadId} />
          <input type="hidden" name="amendment_id" value={reply.amendmentId} />
          {/* ⚠ this action reads `return_to`, the meeting one `return_path` */}
          <input type="hidden" name="return_to" value={ctx.returnPath} />
        </>
      );
      return (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={respondAmendmentFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="accept" />
            <SubmitButton className={PRIMARY} pendingLabel="Accepting…">
              Accept
            </SubmitButton>
          </form>
          <form action={respondAmendmentFromChat}>
            {hidden}
            <input type="hidden" name="decision" value="decline" />
            <SubmitButton className={QUIET} pendingLabel="Declining…">
              Decline
            </SubmitButton>
          </form>
        </div>
      );
    }

    case 'payment': {
      // Supplier-only. Absent actions ⇒ no button, never a button that fails.
      const act = ctx.supplierActions?.confirmPayment;
      if (!act) return null;
      return (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={act}>
            <input type="hidden" name="payment_id" value={reply.paymentId} />
            <input type="hidden" name="thread_id" value={ctx.threadId} />
            <SubmitButton className={PRIMARY} pendingLabel="Confirming…">
              Confirm received
            </SubmitButton>
          </form>
        </div>
      );
    }

    case 'guest_count': {
      const apply = ctx.supplierActions?.applySurcharge;
      const hold = ctx.supplierActions?.holdPrice;
      if (!apply || !hold) return null;
      const hidden = (
        <>
          <input type="hidden" name="event_vendor_id" value={reply.eventVendorId} />
          <input type="hidden" name="thread_id" value={ctx.threadId} />
        </>
      );
      const s = reply.surchargePhp;
      return (
        <div className="mt-2.5 flex flex-wrap gap-2">
          <form action={apply}>
            {hidden}
            <SubmitButton className={PRIMARY} pendingLabel="Applying…">
              {s != null && s !== 0
                ? `Apply ${s > 0 ? '+' : '−'}${formatPhp(Math.abs(s))}`
                : 'Apply the new count'}
            </SubmitButton>
          </form>
          <form action={hold}>
            {hidden}
            <SubmitButton className={QUIET} pendingLabel="Holding…">
              Hold the price
            </SubmitButton>
          </form>
        </div>
      );
    }

    case 'quote_review':
      // ⚖ A LINK, NOT AN ACCEPT. Accepting books the supplier; the couple
      // reviews the whole proposal first, exactly as the chat's card sends them.
      return (
        <div className="mt-2.5">
          <Link href={`/proposals/${reply.publicId}`} className={PRIMARY}>
            Review &amp; accept →
          </Link>
        </div>
      );
  }
}

/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * THE FILES THIRD — every file that passed through THIS conversation.
 *
 * 🔒 The rows arrive from `buildSharedFiles` (PR #5362), and their `href`
 * comes from `chatAttachmentHref` — the ONE place in this repo that turns a
 * chat message into a link to its file. Nothing here reaches into a stored
 * reference or composes a URL of its own; when the private-storage route lands
 * that function's body changes and this panel follows without being touched.
 */
export function FilesPanel({ files }: { files: readonly SharedFileEntry[] }) {
  if (files.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-ink/15 bg-cream p-6 text-center text-sm text-ink/55">
        No files in this conversation yet. Anything either of you attaches will be listed here.
      </p>
    );
  }

  return (
    <ol className="space-y-2">
      {files.map((f) => (
        <li
          key={f.key}
          className="flex items-center gap-3 rounded-lg border border-ink/12 bg-cream p-3"
        >
          <span className="shrink-0 rounded border border-ink/12 bg-ink/[0.04] px-2 py-1 font-mono text-[0.6rem] uppercase text-ink/60">
            {f.typeLabel ?? 'File'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{f.name}</span>
            <span className="block truncate text-xs text-ink/50">
              {[f.sizeLabel, f.origin].filter(Boolean).join(' · ')}
            </span>
          </span>
          {f.href ? (
            <a
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-md border border-ink/15 px-3 py-2 text-xs font-semibold text-ink hover:bg-ink/[0.04]"
            >
              Open
            </a>
          ) : (
            // A row whose link cannot be built still LISTS the file — saying
            // "we have this and cannot open it" beats omitting it silently.
            <span className="shrink-0 text-xs text-ink/40">Unavailable</span>
          )}
        </li>
      ))}
    </ol>
  );
}
