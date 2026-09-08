'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FileText,
  Info,
  User,
  Wallet,
} from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import type { CustomerEventSummary } from '@/lib/customer-event-summary';

/**
 * Customer info rail beside the vendor⇆couple conversation (PR-3 of the
 * Customer Card respine, design source
 * 03_Strategy/Customer_Card_Prototype_2026-07-03.html · View 1, owner-approved
 * 2026-07-03).
 *
 * Desktop (lg+): a right column docked next to the conversation.
 * Mobile: hidden; the conversation header's info button opens it as the shared
 * bottom-sheet primitive (app/_components/sheet.tsx · the locked modal-a11y
 * pattern).
 *
 * NO MASKING (owner ruling 2026-09-08 — "we do not need to hide anything, since
 * no more tokens"). This rail used to take a `masked` flag that, for a pending
 * inquiry, replaced the whole body with "accept the conversation to reveal who
 * they are". That lock was the token wallet's storefront, and the wallet was
 * retired on 2026-05-11 — so it withheld the customer without selling anything.
 * A supplier now sees the same rail before and after accepting.
 */

export type ChatInfoRailProps = {
  /** Event display name — already the only identity the page exposes. */
  displayName: string;
  /** Initials for the avatar (derived by the parent from displayName). */
  initials: string;
  stage: {
    label: string;
    /** Tailwind classes for the pill (border/bg/text). */
    tone: string;
  };
  /**
   * The customer's event, in one sentence plus the decision rows — built by
   * `buildCustomerEventSummary` so the sentence, the rows and the header above
   * them all come from a single resolve. Owner 2026-09-08.
   */
  summary: CustomerEventSummary;
  /*
   * ⚠ `eventDate` AND `paxLabel` USED TO LIVE HERE and are deliberately gone.
   * Both now arrive inside `summary.facts`, from one builder. `eventDate` was
   * documented "pre-formatted" while its only caller passed the raw Postgres
   * value, so the rail rendered "2026-12-18" — a mismatch no type could catch,
   * both being `string | null`. Two props feeding rows that a third prop also
   * describes is exactly how one screen came to show a wedding day three ways.
   */
  /** Service / inquiry category label (or null). */
  service: string | null;
  threadId: string;
  eventId: string;
};

const HEADING_ID = 'chat-info-rail-heading';

/**
 * Desktop column — docked right of the conversation on lg+, hidden below. No
 * internal state (always visible), so it stays a pure render.
 */
export function ChatInfoRailColumn(props: ChatInfoRailProps) {
  return (
    <aside className="hidden w-[19rem] shrink-0 flex-col overflow-y-auto sn-row lg:flex">
      <RailBody {...props} headingId={HEADING_ID} />
    </aside>
  );
}

/**
 * Mobile trigger — an info button (belongs in the conversation header) that
 * opens the rail as the shared bottom-sheet. Hidden on lg+ where the column is
 * always shown. Owns its own open-state.
 */
export function ChatInfoRailTrigger(props: ChatInfoRailProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Customer details"
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink/55 hover:bg-ink/5 hover:text-ink"
      >
        <Info aria-hidden className="h-5 w-5" strokeWidth={1.75} />
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={HEADING_ID} title="Customer">
        <RailBody {...props} headingId={HEADING_ID} inSheet />
      </Sheet>
    </div>
  );
}

function RailBody({
  displayName,
  initials,
  summary,
  stage,
  service,
  threadId,
  eventId,
  headingId,
  inSheet = false,
}: ChatInfoRailProps & { headingId: string; inSheet?: boolean }) {
  return (
    <div className="flex flex-col">
      {/* Column-only header (the sheet renders its own title bar). */}
      {!inSheet ? (
        <p
          id={headingId}
          className="border-b border-ink/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta-700"
        >
          Customer
        </p>
      ) : null}

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 border-b border-ink/10 px-4 py-5 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-ink/10 bg-white text-sm font-semibold text-ink/70">
          {initials}
        </span>
        <p className="text-base font-semibold text-ink">{displayName}</p>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stage.tone}`}
        >
          {stage.label}
        </span>
      </div>

      <>
          {/* WHO STARTED WHAT, AND WHEN. */}
          <p className="border-b border-ink/10 px-4 py-4 text-left text-sm leading-relaxed text-ink/75">
            {summary.sentence}
          </p>

          {/* The decision rows. `Date`/`Guests` used to be rendered here from
              their own props; they now come from `summary.facts` so the rail
              cannot show one date while the sentence beside it shows another.
              `Service` stays a separate row — it is a fact about THIS thread
              (the interest chip), not about the couple's event. Exact venue is
              still absent: that sits behind the agreement ladder in
              `get_vendor_event_brief`, which the 2026-09-08 ruling did not
              touch. */}
          <dl className="flex flex-col gap-3 border-b border-ink/10 px-4 py-4 text-left">
            {summary.facts.map((f) => (
              <SnapRow key={f.label} label={f.label} value={f.value} />
            ))}
            {service ? <SnapRow label="Service" value={service} /> : null}
          </dl>

          {/* Quick actions — all reuse EXISTING in-thread flows. Send proposal &
              Log payment anchor-scroll to the affordances already on the page;
              Propose schedule links the client brief's schedule tab. */}
          <div className="px-4 pt-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
              Quick actions
            </p>
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-2">
            <RailAction href={`/vendor-dashboard/messages/${threadId}#send-proposal`} icon={FileText}>
              Send proposal
            </RailAction>
            <RailAction
              href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
              icon={CalendarClock}
            >
              Propose schedule
            </RailAction>
            <RailAction href={`/vendor-dashboard/messages/${threadId}#pending-payments`} icon={Wallet}>
              Log payment
            </RailAction>
          </div>

          {/* Full customer profile */}
          <div className="px-3 pb-4 pt-2">
            <Link
              href={`/vendor-dashboard/clients/${eventId}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90"
            >
              <User aria-hidden className="h-4 w-4" strokeWidth={2} />
              Full customer profile
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
      </>
    </div>
  );
}

function SnapRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink/45">{label}</dt>
      <dd className="text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}

function RailAction({
  href,
  icon: Icon,
  children,
}: {
  href: string;
  icon: typeof CalendarDays;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2.5 rounded-lg border border-ink/10 bg-white px-3 py-2.5 text-sm font-semibold text-ink hover:border-terracotta/40"
    >
      <Icon aria-hidden className="h-4 w-4 shrink-0 text-ink/55" strokeWidth={1.75} />
      {children}
    </Link>
  );
}
