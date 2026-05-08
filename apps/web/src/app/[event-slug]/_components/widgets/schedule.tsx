interface Item {
  time: string;
  title: string;
  sub?: string;
}

const SCHEDULE: Item[] = [
  { time: "2:00 PM", title: "Pre-Cana Mass", sub: "Sacred Heart Chapel" },
  { time: "3:00 PM", title: "Ceremony", sub: "Catholic rite — please be seated by 2:50 PM" },
  { time: "4:30 PM", title: "Photos with the Couple", sub: "Garden lawn" },
  { time: "5:00 PM", title: "Cocktails", sub: "Glass Pavilion" },
  { time: "6:30 PM", title: "Reception", sub: "Dinner, toasts, first dance" },
  { time: "10:00 PM", title: "After-Party", sub: "Optional · DJ set in the lounge" },
];

export function Schedule({ eventDate }: { eventDate: string }) {
  void eventDate;
  return (
    <section className="rounded-3xl border border-rule bg-surface px-6 py-7 shadow-tayo-sm lg:px-10 lg:py-9">
      <p className="meta-label mb-4">Schedule</p>
      <ol className="flex flex-col">
        {SCHEDULE.map((it, i) => (
          <li
            key={it.time}
            className={`grid grid-cols-[88px_1fr] gap-3 py-3 lg:grid-cols-[120px_1fr] ${
              i < SCHEDULE.length - 1 ? "border-b border-dashed border-rule" : ""
            }`}
          >
            <div className="font-mono text-[13px] font-medium tracking-label-tight text-accent">
              {it.time}
            </div>
            <div>
              <div className="font-serif text-[18px] font-medium leading-tight text-ink">
                {it.title}
              </div>
              {it.sub && <div className="mt-0.5 text-[12px] text-ink-soft">{it.sub}</div>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
