import Link from 'next/link';
import { ChevronRight, Printer } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { PRINTS_HOME_LINE, PRINTS_PAGE_CARD, PRINTS_PAGE_LABEL, printsPageHref } from '@/lib/prints-page';

/**
 * 🖨 HOME'S PRINTS LINE (R8 · owner 2026-10-27, verbatim: *"… Home gets a Prints line that opens it. No new bottom tab."* —
 * DECISION_LOG "PRINTS LEAVES STUDIO …"). HOME HOLDS THE DOOR, NEVER THE TOOL: one line — the page's name, what it holds,
 * its ⓘ — and the whole line opens `/dashboard/<id>/prints`, where the shipped swipe carousel lives.
 *
 * Drawn from the control row's own card (`.sg-row.hc-card`, its `.hc-card-door` — the whole card is its one page, the ⓘ
 * sits above it, never a link in a link), so it reads as one more of Home's parts, not a new look. Server-rendered: no
 * client code reaches Home for it.
 */
export function HomePrintsLine({ eventId }: { eventId: string }) {
  return (
    <article className="sg-row hc-card" data-home-prints-line="" data-tour="home-prints">
      <Link href={printsPageHref(eventId)} className="hc-card-door" aria-label={`Open ${PRINTS_PAGE_LABEL}`} data-home-prints-door="" />
      <span className="sg-head">
        <span className="sg-mark" aria-hidden>
          <Printer aria-hidden strokeWidth={1.9} />
        </span>
        <span className="min-w-0">
          <span className="hc-card-name">
            <InfoTip label={PRINTS_PAGE_LABEL} labelClassName="sg-name" align="start">
              <p>{PRINTS_PAGE_CARD.controls}</p>
              <p>
                <b className="font-semibold text-ink">Guests see it:</b> {PRINTS_PAGE_CARD.seenAt}
              </p>
              <p>
                <b className="font-semibold text-ink">Do this first:</b> {PRINTS_PAGE_CARD.first}
              </p>
            </InfoTip>
          </span>
          <span className="sg-brand block truncate">{PRINTS_HOME_LINE}</span>
        </span>
        <ChevronRight aria-hidden className="sg-arrow h-[18px] w-[18px]" strokeWidth={1.9} />
      </span>
    </article>
  );
}
