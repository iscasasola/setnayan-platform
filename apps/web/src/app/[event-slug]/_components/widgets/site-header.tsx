import type { Event } from "@/lib/db/types";

export function SiteHeader({ event }: { event: Event }) {
  const dateLabel = new Date(`${event.event_date}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <header className="sticky top-0 z-20 border-b border-rule bg-page-bg/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className="h-5 w-5 rounded-full"
            style={{ background: "linear-gradient(135deg, var(--accent-soft), var(--accent))" }}
          />
          <span className="font-serif text-base font-medium tracking-tight">Tayo</span>
        </div>
        <div className="flex flex-col items-end leading-tight">
          <span className="font-serif text-[15px] font-medium text-ink">
            {event.bride_first_name} <span className="italic text-accent">&</span>{" "}
            {event.groom_first_name}
          </span>
          <span className="meta-label">{dateLabel}</span>
        </div>
      </div>
    </header>
  );
}
