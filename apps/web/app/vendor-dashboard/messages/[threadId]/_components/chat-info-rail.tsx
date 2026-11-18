'use client';

import { useState } from 'react';
import { User } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { Badge } from '@/app/_components/badge';
import { ActionButton, actionButtonClass } from '@/components/action-button';
import type { CustomerEventSummary } from '@/lib/customer-event-summary';

/**
 * Customer info rail beside the vendor⇆couple conversation (PR-3 of the
 * Customer Card respine, design source
 * 03_Strategy/Customer_Card_Prototype_2026-07-03.html · View 1, owner-approved
 * 2026-07-03).
 *
 * The conversation head's "Customer" opens it as the shared sheet
 * (app/_components/sheet.tsx · the locked modal-a11y pattern) — at EVERY width
 * since 2026-10-29. It was also a 19rem column docked beside the chat from
 * 1024, which gave the supplier's chat a narrower column than the couple's
 * (owner, *"event dashboard chat is full screen. supplier chat not same?"*);
 * the sheet is one tap away and the chat keeps the page's column.
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
  /** Where the inquiry came from (vendor-private) and the returning-customer companion chip, if any. */
  source?: { label: string; returning: string | null };
};

const HEADING_ID = 'chat-info-rail-heading';

/**
 * The trigger — belongs in the conversation head's actions, opens the rail as
 * the shared sheet, at every width. Owns its own open-state.
 *
 * 🔑 A VISIBLE LABEL, NOT A LONE GLYPH. This used to be an unlabelled 36px
 * circle with only an <Info> icon — then the sole way into the mobile tools,
 * and a supplier on a live thread could not find it (owner, 2026-09-11: "i
 * cannot access tools when on mobile mode?"). The icon-only affordance read as
 * decoration, not a button. Since 2026-10-14 the tools have their own door —
 * the grey ＋ beside the message field (`thread-tools-sheet.tsx`) — so this pill
 * says only what it still opens: "Customer". It is now a labelled pill matching the house's small secondary
 * pill-button pattern (see `SubmitButton` usage in
 * `app/vendor-dashboard/repertoire/page.tsx`) — text plus an icon, never the
 * icon alone. `globals.css` already floors every `button` at 44px min-height;
 * the pill is sized for that instead of fighting it with a fixed height.
 */
export function ChatInfoRailTrigger(props: ChatInfoRailProps) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Customer details"
        // The grey button piece (rule 3), its own class list — never a hand-made pill.
        className={`${actionButtonClass('neutral')} shrink-0 px-3`}
      >
        <User aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        Customer
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
  eventId,
  source,
  headingId,
  inSheet = false,
}: ChatInfoRailProps & {
  headingId: string;
  inSheet?: boolean;
}) {
  return (
    <div className="flex flex-col">
      {/* Column-only header (the sheet renders its own title bar). */}
      {!inSheet ? (
        <p
          id={headingId}
          // The template's section label (rule 13): small grey capitals, never gold typewriter words.
          className="border-b border-[color:var(--m-line)] px-4 py-3 text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]"
        >
          Customer
        </p>
      ) : null}

      {/* Identity */}
      <div className="flex flex-col items-center gap-2 border-b border-[color:var(--m-line)] px-4 py-5 text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--m-paper-2)] text-sm font-semibold text-ink">
          {initials}
        </span>
        <p className="text-base font-semibold text-ink">{displayName}</p>
        <span
          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[12px] font-semibold ${stage.tone}`}
        >
          {stage.label}
        </span>
        {source ? (
          <p className="flex flex-wrap items-center justify-center gap-1" data-rail-source="">
            {/* Rule 5 · status chips: soft fill, no border, never 9 px typewriter capitals. */}
            <Badge tone="quiet">{source.label}</Badge>
            {source.returning ? <Badge tone="ok">{source.returning}</Badge> : null}
          </p>
        ) : null}
      </div>

      <>
          {/* WHO STARTED WHAT, AND WHEN. */}
          <p className="border-b border-[color:var(--m-line)] px-4 py-4 text-left text-sm leading-relaxed text-[color:var(--m-slate-2)]">
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
          <dl className="flex flex-col gap-3 border-b border-[color:var(--m-line)] px-4 py-4 text-left">
            {summary.facts.map((f) => (
              <SnapRow
                key={f.label}
                label={f.label}
                value={f.value}
                note={f.note ?? null}
                noteIsPrivate={f.noteIsPrivate ?? false}
              />
            ))}
            {service ? <SnapRow label="Service" value={service} /> : null}
          </dl>

          {/* WHICH SLOTS ARE TAKEN (owner 2026-09-08). Rendered only when the
              couple has actually locked something — an "Already locked" heading
              over nothing reads as a finding, and "none" is already said by the
              `Locked suppliers` row above. Categories only; the supplier's
              NAMES stay behind the booked-stage `vendor_roster`. */}
          {summary.lockedCategories.length > 0 ? (
            <div className="border-b border-[color:var(--m-line)] px-4 py-4">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[color:var(--m-slate-2)]">
                Already locked
              </p>
              {/* Facts, not statuses — one dark-grey line joined by a middot (rule 5). */}
              <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[13px] text-[color:var(--m-slate-2)] [&>span+span]:before:mr-1.5 [&>span+span]:before:content-['·']">
                {summary.lockedCategories.map((c) => (
                  <span
                    key={c}
                    className="inline-flex items-center"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Full customer profile.
              ⚠ `?tab=details`, never the bare client route: a bare landing on
              the client page is a CHAT landing and redirects straight back to
              this thread (#5614) — this button reloaded the page it sat on.
              `details` is the shell tab that holds the full brief. */}
          <div className="px-3 pb-4 pt-2">
            {/* The grey button piece (rule 3) — a dark filled block competed with the screen's one main. */}
            <ActionButton
              tone="neutral"
              icon={<User aria-hidden strokeWidth={2} />}
              label="Full customer profile"
              href={`/vendor-dashboard/clients/${eventId}?tab=details`}
              className="w-full !min-h-11"
            />
          </div>
      </>
    </div>
  );
}

/**
 * One decision row. The optional `note` is the SECOND fact a value sometimes
 * needs — "150 at inquiry" under a live guest count, or who else wants the
 * target date.
 *
 * 🔒 A PRIVATE NOTE SAYS SO. When `noteIsPrivate` is set the row prints, under
 * the note, that this is the supplier's own pipeline and the couple never sees
 * it. A supplier reading their own commercial position beside a customer's
 * facts must never have to guess which side of the conversation it is on.
 */
function SnapRow({
  label,
  value,
  note = null,
  noteIsPrivate = false,
}: {
  label: string;
  value: string;
  note?: string | null;
  noteIsPrivate?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[color:var(--m-slate-2)]">{label}</dt>
      <dd className="text-sm font-medium text-ink">
        {value}
        {note ? (
          <>
            <span className="mt-0.5 block text-[13px] font-normal text-[color:var(--m-slate-2)]">{note}</span>
            {noteIsPrivate ? (
              <span className="mt-0.5 block text-[13px] font-normal text-[color:var(--m-slate-3)]">
                Your pipeline only — the couple never sees this line.
              </span>
            ) : null}
          </>
        ) : null}
      </dd>
    </div>
  );
}
