import {
  ROLE_LABELS,
  SIDE_LABELS,
  type Event,
  type Guest,
  type Household,
} from "@/lib/db/types";

interface Props {
  event: Event;
  guest: Guest;
  partner: Guest | null;
  household: Household | null;
}

export function EventDetails({ event, guest, partner, household }: Props) {
  const date = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const role = ROLE_LABELS[guest.role];
  const side = SIDE_LABELS[guest.side];
  const yourRoleParts = [
    role,
    side,
    household?.name,
    partner ? `paired with ${partner.first_name}` : null,
  ].filter(Boolean);

  return (
    <section className="rounded-3xl border border-rule bg-surface px-6 py-7 shadow-tayo-sm lg:px-10 lg:py-9">
      <p className="meta-label mb-4">Event Details</p>
      <dl className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Row k="Date" v={date} />
        <Row k="Your role" v={yourRoleParts.join(" · ")} />
        <Row k="Ceremony" v={event.ceremony_venue ?? "TBA"} sub="Mass at 3:00 PM" />
        <Row k="Reception" v={event.reception_venue ?? "TBA"} sub="Cocktails 5 PM · Dinner 6:30 PM" />
      </dl>
    </section>
  );
}

function Row({ k, v, sub }: { k: string; v: string; sub?: string }) {
  return (
    <div>
      <dt className="meta-label">{k}</dt>
      <dd className="mt-1 font-serif text-[18px] font-medium text-ink lg:text-[20px]">{v}</dd>
      {sub && <p className="mt-1 text-[12px] text-ink-soft">{sub}</p>}
    </div>
  );
}
