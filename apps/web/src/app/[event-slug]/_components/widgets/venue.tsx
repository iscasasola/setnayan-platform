import type { Event } from "@/lib/db/types";

export function Venue({ event }: { event: Event }) {
  const date = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  return (
    <section>
      <p className="meta-label mb-3">Venue &amp; Travel</p>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
        <VenueCard
          kind="Ceremony"
          time="3:00 PM"
          dayLabel={date}
          name={event.ceremony_venue ?? "Ceremony Venue"}
          notes="Sacred Heart Chapel · Quezon City. Valet parking available; arrive 30 minutes early."
        />
        <VenueCard
          kind="Reception"
          time="6:30 PM"
          dayLabel={date}
          name={event.reception_venue ?? "Reception Venue"}
          notes="Tagaytay Ridge · 1.5 hr drive from Manila. Shuttle from Tagaytay Hotel at 5:30 PM."
        />
      </div>
    </section>
  );
}

function VenueCard({
  kind,
  time,
  dayLabel,
  name,
  notes,
}: {
  kind: "Ceremony" | "Reception";
  time: string;
  dayLabel: string;
  name: string;
  notes: string;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-rule bg-surface shadow-tayo-sm">
      <div
        className="relative flex h-[140px] items-end p-3"
        style={{
          background:
            kind === "Ceremony"
              ? "linear-gradient(135deg, var(--bride-soft), var(--accent-soft))"
              : "linear-gradient(135deg, var(--both-soft), var(--accent))",
        }}
      >
        <span
          className="rounded-full bg-surface/95 px-3 py-1 font-mono text-[10px] uppercase tracking-label-wide text-ink"
          style={{ backdropFilter: "blur(4px)" }}
        >
          {kind}
        </span>
      </div>
      <div className="p-5">
        <p className="meta-label">
          {time} · {dayLabel}
        </p>
        <h3 className="mt-1.5 font-serif text-[22px] font-medium leading-tight text-ink">{name}</h3>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-soft">{notes}</p>
        <div className="mt-4 flex items-center gap-2">
          <a
            className="btn-default text-[12px]"
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span aria-hidden>📍</span> Get directions
          </a>
          <span
            className="font-mono text-[10px] uppercase tracking-label-wide text-ink-faint"
            title="Native Waze + Google Maps deep links ship in iteration 0003 (Pro upgrade)"
          >
            Pro · Waze deep-link
          </span>
        </div>
      </div>
    </article>
  );
}
