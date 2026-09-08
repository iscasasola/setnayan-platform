'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  FileText,
  Handshake,
  Info,
  ListChecks,
  Phone,
  Plus,
  ReceiptText,
  User,
  Video,
  Wallet,
} from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import type { CustomerEventSummary } from '@/lib/customer-event-summary';
import {
  VENDOR_THREAD_TOOLS,
  type VendorThreadLinkTool,
  type VendorThreadToolIcon,
} from '@/lib/vendor-thread-tools';
import { revealThreadTool } from './reveal-thread-tool';

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
  /**
   * Whether the tools this rail launches are actually ON THE PAGE. They mount
   * in the accepted branch only, so on a pending inquiry every launcher would
   * open nothing — a button that does nothing is worse than no button. The
   * rail shows the customer and the way out instead.
   */
  toolsMounted: boolean;
  /**
   * How many saved proposal templates the shop has. At zero the proposal
   * composer refuses to send and says "Pick a template" — with no way from
   * there to make one. The rail says so and links to the maker.
   */
  templateCount: number;
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
        {/* A tool opens BEHIND this sheet, so launching one closes it. Without
            that the supplier taps "Build a quote" and watches nothing happen,
            because the thing that opened is under the sheet they are looking
            at. */}
        <RailBody
          {...props}
          headingId={HEADING_ID}
          inSheet
          onLaunch={() => setOpen(false)}
        />
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
  toolsMounted,
  templateCount,
  headingId,
  inSheet = false,
  onLaunch,
}: ChatInfoRailProps & {
  headingId: string;
  inSheet?: boolean;
  /** Called before a tool is revealed — the sheet uses it to close itself. */
  onLaunch?: () => void;
}) {
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

          {/* WHICH SLOTS ARE TAKEN (owner 2026-09-08). Rendered only when the
              couple has actually locked something — an "Already locked" heading
              over nothing reads as a finding, and "none" is already said by the
              `Locked suppliers` row above. Categories only; the supplier's
              NAMES stay behind the booked-stage `vendor_roster`. */}
          {summary.lockedCategories.length > 0 ? (
            <div className="border-b border-ink/10 px-4 py-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                Already locked
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.lockedCategories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-ink/70"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* TOOLS — the right column's job (owner, 2026-09-08: "the right most
              can be the tools"). Every one of these used to be a panel wedged
              between the last message and the text box. They are still the same
              components, mounted once above the stream and closed; these are
              the launchers that open them.

              🔑 LABELLED BUTTONS, NOT AN ICON ROW. A supplier picking "Log
              payment" is choosing money, and an unlabelled glyph makes that a
              guess. The icons ride along with the words; they never replace
              them. */}
          {toolsMounted ? (
            <>
              <div className="px-4 pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/45">
                  Tools
                </p>
              </div>
              <div className="flex flex-col gap-1.5 px-3 py-2">
                {VENDOR_THREAD_TOOLS.map((tool) =>
                  tool.link ? (
                    <LinkTool key={tool.key} tool={tool} eventId={eventId} />
                  ) : (
                    <RailAction
                      key={tool.key}
                      icon={TOOL_ICON[tool.icon]}
                      primary={tool.primary}
                      onClick={() => {
                        // On a phone this rail IS a sheet covering the page it
                        // is about to scroll. Close it first, then reveal on
                        // the next tick so the scroll lands on a visible page.
                        onLaunch?.();
                        if (inSheet) {
                          window.setTimeout(() => revealThreadTool(tool.reveal), 0);
                        } else {
                          revealThreadTool(tool.reveal);
                        }
                      }}
                    >
                      {tool.label}
                    </RailAction>
                  ),
                )}
              </div>

              {/* A shop with no template cannot send a proposal at all — the
                  composer says "Pick a template to send a proposal" and offers
                  no way to make one. Said here, where the button is. */}
              {templateCount === 0 ? (
                <p className="px-4 pb-1 text-xs leading-relaxed text-ink/55">
                  No proposal template yet —{' '}
                  <Link
                    href="/vendor-dashboard/proposals"
                    className="font-semibold text-mulberry underline underline-offset-2"
                  >
                    create one
                  </Link>{' '}
                  and proposals become one click.
                </p>
              ) : null}
            </>
          ) : null}

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

/**
 * The one tool that still leaves this screen.
 *
 * ⚠ THE URL IS SPELLED OUT HERE, IN THE ROUTE'S OWN FILE, ON PURPOSE.
 * `lint-port-no-lost-controls` reads a route's files for the destinations it
 * offers and only sees a literal after `href=` — a URL composed in the shared
 * tool list makes this route read as having LOST that destination, and the
 * tempting fix (regenerating the baseline) would record a removal that never
 * happened.
 *
 * The `switch` is exhaustive by type, so a new link target with no URL fails
 * the typecheck rather than falling through to a launcher with nothing to open.
 */
function LinkTool({ tool, eventId }: { tool: VendorThreadLinkTool; eventId: string }) {
  const icon = TOOL_ICON[tool.icon];
  switch (tool.link) {
    case 'client-schedule':
      return (
        <RailAction
          href={`/vendor-dashboard/clients/${eventId}?tab=schedule`}
          icon={icon}
          primary={tool.primary}
        >
          {tool.label}
        </RailAction>
      );
    default: {
      const unhandled: never = tool.link;
      return unhandled;
    }
  }
}

/**
 * One icon per tool, resolved from the shared list's `icon` key rather than
 * chosen at each call site — so the rail cannot grow a tool the page does not
 * render, or render one under two different glyphs.
 */
const TOOL_ICON: Record<VendorThreadToolIcon, typeof CalendarDays> = {
  quote: ReceiptText,
  proposal: FileText,
  payment: Wallet,
  schedule: CalendarClock,
  offer: Plus,
  voice: Phone,
  video: Video,
  deal: Handshake,
  outcome: ListChecks,
};

function RailAction({
  href,
  onClick,
  icon: Icon,
  primary = false,
  children,
}: {
  /** Leaves the page. Mutually exclusive with `onClick` by construction. */
  href?: string;
  onClick?: () => void;
  icon: typeof CalendarDays;
  primary?: boolean;
  children: React.ReactNode;
}) {
  const className = `flex w-full items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold ${
    primary
      ? 'border-mulberry/40 bg-mulberry/[0.06] text-ink hover:border-mulberry'
      : 'border-ink/10 bg-white text-ink hover:border-terracotta/40'
  }`;
  const inner = (
    <>
      <Icon
        aria-hidden
        className={`h-4 w-4 shrink-0 ${primary ? 'text-mulberry' : 'text-ink/55'}`}
        strokeWidth={1.75}
      />
      {children}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}
