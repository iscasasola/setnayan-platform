interface Moment {
  glyph: string;
  time: string;
  segment: string;
  title: string;
  context: string;
}

const MOMENTS: Moment[] = [
  {
    glyph: "🌸",
    time: "3:00 PM",
    segment: "Ceremony",
    title: "The Bridal Walk",
    context: "Down the aisle of Sacred Heart Chapel",
  },
  {
    glyph: "💋",
    time: "3:45 PM",
    segment: "Ceremony",
    title: "The Kiss",
    context: "After the vows",
  },
  {
    glyph: "🎉",
    time: "6:30 PM",
    segment: "Reception",
    title: "First Entrance",
    context: "Newlyweds enter the Glass Pavilion",
  },
];

export function PhotoMoments() {
  return (
    <section>
      <p className="meta-label mb-1">Savour the moments</p>
      <h2 className="font-serif text-[28px] font-medium leading-tight text-ink lg:text-[32px]">
        Be in the room
      </h2>
      <p className="mt-2 max-w-[600px] text-[14px] leading-relaxed text-ink-soft">
        We'll have <span className="font-semibold text-ink">shutterbugs</span> around to make sure
        you have photos of the event — so we'd love it if you'd savour these moments with us, and
        skip the videos. Just witness them.
      </p>

      <div className="mt-5 grid grid-cols-1 gap-3 lg:grid-cols-3">
        {MOMENTS.map((m) => (
          <article
            key={m.title}
            className="rounded-2xl border border-rule bg-surface p-5 shadow-tayo-sm"
          >
            <div
              aria-hidden
              className="grid h-12 w-12 place-items-center rounded-full bg-page-bg-soft text-[22px]"
            >
              {m.glyph}
            </div>
            <p className="meta-label mt-4">
              {m.time} · {m.segment}
            </p>
            <h3 className="mt-1 font-serif text-[20px] font-medium leading-tight text-ink">
              {m.title}
            </h3>
            <p className="mt-2 text-[13px] text-ink-soft">{m.context}</p>
          </article>
        ))}
      </div>

      <p
        className="mt-5 rounded-2xl border border-dashed border-accent/40 bg-page-bg-soft px-5 py-4 text-center text-[13px] text-ink-soft"
      >
        Shutterbugs cover the angles. Your job is to clap, cheer, and be in the room.
      </p>
    </section>
  );
}
