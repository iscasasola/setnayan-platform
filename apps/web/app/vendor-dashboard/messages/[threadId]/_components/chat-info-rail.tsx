'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FileText,
  Info,
  Lock,
  User,
  Wallet,
} from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';

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
 * MASKING: the parent only passes `masked = true` for a still-pending inquiry.
 * When masked, the rail reveals nothing beyond the "New inquiry" placeholder —
 * no snapshot, no quick actions, no profile link (vendor hybrid-anonymity).
 */

export type ChatInfoRailProps = {
  /** Event display name — already the only identity the page exposes. */
  displayName: string;
  /** Initials for the avatar (derived by the parent from displayName). */
  initials: string;
  /** True while the inquiry is pending — reveal nothing extra. */
  masked: boolean;
  stage: {
    label: string;
    /** Tailwind classes for the pill (border/bg/text). */
    tone: string;
  };
  /** Event date, pre-formatted for display (or null). */
  eventDate: string | null;
  /** Service / inquiry category label (or null). */
  service: string | null;
  /** Live pax estimate, when the page has one. */
  paxLabel: string | null;
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
    <aside className="hidden w-[19rem] shrink-0 flex-col overflow-y-auto rounded-xl border border-ink/10 bg-cream lg:flex">
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
  masked,
  stage,
  eventDate,
  service,
  paxLabel,
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
          className="border-b border-ink/10 px-4 py-3 font-mono text-[11px] uppercase tracking-[0.2em] text-terracotta"
        >
          Customer
        </p>
      ) : null}

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 border-b border-ink/10 px-4 py-5 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full border border-ink/10 bg-white text-sm font-semibold text-ink/70">
          {masked ? (
            <User aria-hidden className="h-6 w-6 text-ink/40" strokeWidth={1.75} />
          ) : (
            initials
          )}
        </span>
        <p className="text-base font-semibold text-ink">{displayName}</p>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${stage.tone}`}
        >
          {stage.label}
        </span>
      </div>

      {masked ? (
        /* Masked pre-accept — reveal nothing. */
        <div className="flex items-start gap-2 px-4 py-5 text-sm text-ink/65">
          <Lock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-ink/40" strokeWidth={1.75} />
          <p>
            New inquiry — accept the conversation to reveal who they are and open
            their customer profile.
          </p>
        </div>
      ) : (
        <>
          {/* Event snapshot — only what this page already exposes. Location is
              deliberately omitted (masked by the disclosure ladder; the page
              never loads a venue for the vendor's plain client). */}
          <dl className="flex flex-col gap-3 border-b border-ink/10 px-4 py-4 text-left">
            <SnapRow label="Date" value={eventDate ?? 'Not set yet'} />
            {service ? <SnapRow label="Service" value={service} /> : null}
            {paxLabel ? <SnapRow label="Guests" value={paxLabel} /> : null}
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
      )}
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
