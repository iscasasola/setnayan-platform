import type { Event, Guest, Household } from "@/lib/db/types";

interface Props {
  event: Event;
  guest: Guest;
  partner: Guest | null;
  household: Household | null;
}

export function Greeting({ event, guest, partner }: Props) {
  const greetingName = partner
    ? `${guest.first_name} & ${partner.first_name}`
    : guest.display_name?.trim().split(" ")[0] || guest.first_name;
  const couple = `${event.bride_first_name} & ${event.groom_first_name}`;
  const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
  });

  return (
    <section className="rounded-3xl border border-rule bg-surface px-6 py-8 shadow-tayo-sm lg:px-10 lg:py-10">
      <p className="font-serif text-[26px] italic font-medium text-ink lg:text-[32px]">
        Hi, {greetingName}.
      </p>
      <p className="mt-4 text-[15px] leading-relaxed text-ink-soft lg:text-[16px]">
        <span className="font-medium text-ink">{couple}</span> would love to celebrate with you on{" "}
        <span className="font-medium text-ink">{dateLabel}</span> — see you at{" "}
        <span className="font-medium text-ink">
          {event.ceremony_venue ?? "the ceremony venue"}
        </span>
        , then dinner and dancing at{" "}
        <span className="font-medium text-ink">{event.reception_venue ?? "the reception venue"}</span>.
      </p>
    </section>
  );
}
