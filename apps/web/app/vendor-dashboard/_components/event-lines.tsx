import Link from 'next/link';
import type { ReactNode } from 'react';
import { Check, ChevronRight, MessageSquare, X } from 'lucide-react';
import { Badge, type BadgeTone } from '@/app/_components/badge';
import { InfoTip } from '@/app/_components/info-tip';
import type { EventLines, EventStage } from '@/lib/supplier-event-lines';
import { formatCount } from '@/lib/format-number';
import { SupplierSubmit } from './supplier-submit';

type Act = (formData: FormData) => void | Promise<void>;

/**
 * 📋 THE OPENED EVENT — the fixed lines every supplier surface shows for one event (supplier dashboard v13, APPROVED
 * 2026-10-29; the ruling and the read are `lib/supplier-event-lines.ts`): Event type · Celebrant · Hosted by (the one
 * who asked marked "Asked you") · Location · Date · Est. pax · Service requested · You also offer (only while asking) ·
 * For your service · Also booked.
 *
 * ONE component for Today's inquiry row, the Customers › Events row and the card at the top of the chat — the three
 * places the prototype draws the same `evBody`. A server component: everything arrives already read; the answers are
 * handed in (`InquiryAnswers`), never imported here.
 *
 * House rules: hairline sections, no box (frames only on what you press); each heading is a title + its ⓘ; names
 * never cut (they wrap); a line that could not be read says so — never an empty list that reads as "nobody".
 * 🔒 app/vendor-dashboard/_components/a-supplier-row-opens-beside-itself.test.ts
 */
export function EventLinesBody({ lines }: { lines: EventLines }) {
  const unread = !lines.read;
  return (
    <div data-event-lines={lines.stage} className="text-ink">
      {lines.firstEvent ? (
        <p className="border-b border-ink/10 py-2.5 text-[13.5px] text-ink/70" data-event-lines-first="">
          Their 2nd event ·{' '}
          <Link href={lines.firstEvent.href} className="font-medium text-sn-accent">
            see their first · {lines.firstEvent.title}
          </Link>
        </p>
      ) : null}

      <Facts
        cells={[
          { k: 'Event type', v: unread ? null : (lines.type ?? 'Not set yet') },
          { k: 'Celebrant', v: unread ? null : (lines.celebrant ?? 'Not named yet') },
        ]}
      />

      <Section title="Hosted by" tip="Everyone hosting this event — the couple, every co-host, and the coordinator once one is booked. The one marked “Asked you” first messaged your shop — your main contact.">
        {lines.hosts === null ? (
          <Unread what="who hosts this" />
        ) : lines.hosts.length === 0 ? (
          <p className="py-2 text-[13.5px] text-ink/60">No host has joined on Setnayan yet.</p>
        ) : (
          <ul data-event-lines-hosts="">
            {lines.hosts.map((h) => (
              <li key={h.name} className="flex min-h-11 items-center gap-3 py-1.5">
                <span aria-hidden className="grid h-8 w-8 flex-none place-items-center rounded-full bg-ink/[0.06] text-[12px] font-semibold text-ink/70">
                  {initials(h.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-[14.5px] ${h.askedYou ? 'font-medium text-sn-accent' : 'text-ink'}`}>{h.name}</span>
                  {/* Who they are to the event (owner 2026-10-29: every host "with their role" + the booked coordinator). */}
                  {h.role ? (
                    <span className="block text-[12.5px] text-ink/60" data-event-lines-host-role="">
                      {h.role}
                    </span>
                  ) : null}
                </span>
                {h.askedYou ? (
                  <Badge tone="wait" data="asked-you">
                    Asked you
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Facts
        cells={[
          { k: 'Location', v: unread ? null : (lines.location ?? 'Not set yet'), wide: true },
          { k: 'Date', v: unread ? null : (lines.date ?? 'Not set yet') },
          { k: 'Est. pax', v: unread ? null : lines.pax ? formatCount(lines.pax) : 'Not set yet' },
        ]}
      />

      <Section title="Service requested" tip="What this event asked your shop for, and where it stands.">
        {lines.requested === null ? (
          <Unread what="what they asked for" />
        ) : lines.requested.length === 0 ? (
          <p className="py-2 text-[13.5px] text-ink/60">They haven’t named a service yet — ask them in the chat.</p>
        ) : (
          <ul data-event-lines-requested="">
            {lines.requested.map((s) => (
              <li key={s.name} className="flex min-h-11 items-center gap-3 py-1.5">
                <span className="min-w-0 flex-1 text-[14.5px] font-medium">{s.name}</span>
                <StageBadge stage={lines.stage} />
              </li>
            ))}
          </ul>
        )}
      </Section>

      {lines.alsoOffer.length > 0 ? (
        <Section
          title="You also offer"
          tip="Your other services in the categories this event already added to its plan — only those, never your whole list. Offer one in the chat."
        >
          <ul data-event-lines-offer="">
            {lines.alsoOffer.map((o) => (
              <li key={o.serviceId}>
                <DoorRow
                  href={lines.threadId ? `/vendor-dashboard/messages/${lines.threadId}` : `/vendor-dashboard/clients/${lines.eventId}?tab=details`}
                  label={o.name}
                  line={o.from ? `They added this to their plan · ${o.from}` : 'They added this to their plan'}
                  end="Offer"
                />
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section
        title="For your service"
        tip="What this event saved for the service you do here, opened straight from their event. View only — the seat plan and production sheet open once they book you."
      >
        <ul data-event-lines-for-you="">
          {lines.forYou.map((d) => (
            <li key={d.key}>
              <DoorRow href={d.href} label={d.label} line={d.line} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Also booked" tip="Other suppliers this event has booked — names and services only, never their prices.">
        {lines.alsoBooked === null ? (
          <Unread what="who else they booked" />
        ) : lines.alsoBooked.length === 0 ? (
          <p className="py-2 text-[13.5px] text-ink/60">No other suppliers booked yet.</p>
        ) : (
          <ul data-event-lines-also-booked="">
            {lines.alsoBooked.map((a) => (
              <li key={`${a.name}·${a.service}`} className="flex min-h-11 flex-col justify-center py-1.5">
                <span className="text-[14.5px] font-medium">{a.name}</span>
                <span className="text-[12.5px] text-ink/60">{a.service}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

/**
 * An inquiry's three answers — the same on Today, on the Events row and at the top of the chat (prototype `inqActions`):
 * Decline · Ask a question · Accept. The SHIPPED answers (`declineInquiry` / `acceptInquiry`, handed in): answering is
 * saying yes to talk, and books nothing. Accept keeps the supplier where they are (`returnTo` — a save never resets the
 * screen); Ask a question says the same yes and opens the chat to type in.
 */
export function InquiryAnswers({
  threadId,
  returnTo,
  acceptTo,
  pinned = false,
  acceptInquiry,
  declineInquiry,
}: {
  /** In a box that scrolls on its own (the chat's top band): the three answers stay in sight at its foot. */
  pinned?: boolean;
  threadId: string;
  returnTo: string;
  /** Where Accept lands, when not `returnTo` — the chat's own card starts a quote (`?compose=quote`). */
  acceptTo?: string;
  acceptInquiry: Act;
  declineInquiry: Act;
}) {
  const chat = `/vendor-dashboard/messages/${threadId}`;
  return (
    <div
      className={`flex flex-wrap items-center justify-end gap-2 border-t border-ink/10 pt-3 ${pinned ? 'sticky bottom-0 z-[1] pb-2' : ''}`}
      style={pinned ? { background: 'var(--sn-canvas)' } : undefined}
      data-inquiry-answers=""
    >
      <form action={declineInquiry} className="contents">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <SupplierSubmit tone="neutral" icon={<X aria-hidden="true" strokeWidth={1.9} />} label="Decline" pendingLabel="Declining…" />
      </form>
      <form action={acceptInquiry} className="contents">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="return_to" value={chat} />
        <SupplierSubmit tone="neutral" icon={<MessageSquare aria-hidden="true" strokeWidth={1.9} />} label="Ask a question" pendingLabel="Opening…" />
      </form>
      <form action={acceptInquiry} className="contents">
        <input type="hidden" name="thread_id" value={threadId} />
        <input type="hidden" name="return_to" value={acceptTo ?? returnTo} />
        <SupplierSubmit tone="brand" main icon={<Check aria-hidden="true" strokeWidth={1.9} />} label="Accept" pendingLabel="Accepting…" />
      </form>
    </div>
  );
}

const STAGE_BADGE: Record<EventStage, { word: string; tone: BadgeTone }> = {
  asking: { word: 'Asking', tone: 'wait' },
  talking: { word: 'Talking', tone: 'quiet' },
  booked: { word: 'Booked', tone: 'ok' },
  done: { word: 'Done', tone: 'quiet' },
};

function StageBadge({ stage }: { stage: EventStage }) {
  const b = STAGE_BADGE[stage];
  return (
    <Badge tone={b.tone} data="service-stage">
      {b.word}
    </Badge>
  );
}

function Section({ title, tip, children }: { title: string; tip: string; children: ReactNode }) {
  return (
    <section className="border-t border-ink/10 pt-2" data-event-lines-section={title}>
      <p className="home-k2 flex items-center gap-1.5">
        <InfoTip label={title} align="start">
          {tip}
        </InfoTip>
      </p>
      <div className="pb-2">{children}</div>
    </section>
  );
}

/** Two (or three) facts side by side — the small caps word, the value under it. A value that could not load says so. */
function Facts({ cells }: { cells: Array<{ k: string; v: string | null; wide?: boolean }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 border-t border-ink/10 py-2.5 first:border-t-0" data-event-lines-facts="">
      {cells.map((c) => (
        <div key={c.k} className={`min-w-0 py-1 ${c.wide ? 'col-span-2' : ''}`}>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink/55">{c.k}</dt>
          <dd className={`text-[15px] leading-snug ${c.v === null ? 'text-ink/55' : 'text-ink'}`}>{c.v ?? 'couldn’t load'}</dd>
        </div>
      ))}
    </dl>
  );
}

function Unread({ what }: { what: string }) {
  return (
    <p role="status" className="py-2 text-[13.5px]" style={{ color: 'rgb(var(--color-warn))' }}>
      Couldn’t load {what}. Refresh to try again.
    </p>
  );
}

/** A row that goes somewhere — the label, its one line, the terracotta arrow (or its word). The whole row is the tap. */
function DoorRow({ href, label, line, end }: { href: string; label: string; line: string; end?: string }) {
  return (
    <Link href={href} className="sn-press flex min-h-11 items-center gap-3 py-1.5">
      <span className="min-w-0 flex-1">
        <span className="block text-[14.5px] font-medium text-ink">{label}</span>
        <span className="block text-[12.5px] text-ink/60">{line}</span>
      </span>
      {end ? <span className="text-[13px] font-semibold text-sn-accent">{end}</span> : null}
      <ChevronRight aria-hidden className="h-4 w-4 flex-none text-sn-accent" strokeWidth={2} />
    </Link>
  );
}

function initials(name: string): string {
  const w = name.trim().split(/[\s&]+/).filter(Boolean);
  if (w.length === 0) return '·';
  if (w.length === 1) return w[0]!.slice(0, 2).toUpperCase();
  return (w[0]![0]! + w[1]![0]!).toUpperCase();
}
