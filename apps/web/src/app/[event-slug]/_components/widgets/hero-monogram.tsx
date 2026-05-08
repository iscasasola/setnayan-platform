import type { Event } from "@/lib/db/types";

export function HeroMonogram({ event }: { event: Event }) {
  const dateLabel = new Date(`${event.event_date}T00:00:00`)
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    })
    .toUpperCase();
  return (
    <section className="flex flex-col items-center text-center">
      <p className="meta-label mb-5">You are invited</p>

      <div
        className="relative grid h-[88px] w-[88px] place-items-center rounded-full font-serif text-[28px] italic font-medium text-accent lg:h-[96px] lg:w-[96px] lg:text-[32px]"
        style={{
          border: "1.5px solid var(--accent)",
          background: "var(--surface)",
        }}
        aria-hidden
      >
        {event.bride_first_name[0]}&{event.groom_first_name[0]}
      </div>

      <h1 className="mt-7 font-serif text-[44px] font-medium leading-none tracking-tight text-ink lg:text-[64px]">
        {event.bride_first_name}
        <span className="mx-2 italic text-accent">&</span>
        {event.groom_first_name}
      </h1>

      <p className="mt-4 font-mono text-[11px] tracking-label-extra text-ink-soft lg:text-[12px]">
        {dateLabel}
      </p>

      <span
        aria-hidden
        className="mt-6 inline-block h-px w-[120px]"
        style={{ background: "var(--accent)" }}
      />
    </section>
  );
}
