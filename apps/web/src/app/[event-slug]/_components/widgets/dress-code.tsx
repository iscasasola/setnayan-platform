const PALETTE: Array<{ name: string; hex: string }> = [
  { name: "Cream", hex: "#FAF6F0" },
  { name: "Champagne", hex: "#E8C9B0" },
  { name: "Capiz", hex: "#F1E2C8" },
  { name: "Terracotta", hex: "#C97B4B" },
  { name: "Midnight", hex: "#2B2825" },
];

const DOS = [
  "Look magical — formal evening wear",
  "Long gowns, ternos, tuxedos, well-cut suits",
  "Lean into the palette",
  "A little sparkle, sequins, or velvet — encouraged",
];

const DONTS = [
  "No barong tagalog",
  "No white or ivory — those are reserved for the bride",
  "No casual — please, no jeans or t-shirts",
  "No flash photography during the Mass",
];

export function DressCode() {
  return (
    <section className="rounded-3xl border border-rule bg-surface px-6 py-7 shadow-tayo-sm lg:px-10 lg:py-9">
      <p className="meta-label mb-1">Dress Code</p>
      <h2 className="font-serif text-[28px] font-medium leading-tight text-ink lg:text-[32px]">
        Look magical
      </h2>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-soft">
        We're aiming for a magical-evening feel — long gowns, ternos, tuxedos and well-cut suits.
        Lean into the palette below if you can.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {PALETTE.map((p) => (
          <div key={p.name} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-7 w-7 rounded-full border border-rule"
              style={{ background: p.hex }}
            />
            <span className="text-[12px] font-medium text-ink">{p.name}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Column tone="do" />
        <Column tone="dont" />
      </div>

      <p className="mt-6 text-center font-serif text-[18px] italic text-ink-soft lg:text-[20px]">
        "Dress like the night was made for you."
      </p>
    </section>
  );
}

function Column({ tone }: { tone: "do" | "dont" }) {
  const isDo = tone === "do";
  const items = isDo ? DOS : DONTS;
  const styles = isDo
    ? {
        background: "var(--rsvp-attending-soft)",
        color: "#355C3A",
        glyph: "✓",
        glyphBg: "var(--rsvp-attending)",
      }
    : {
        background: "var(--rsvp-declined-soft)",
        color: "#7A2F1E",
        glyph: "✕",
        glyphBg: "var(--rsvp-declined)",
      };

  return (
    <div
      className="rounded-2xl px-5 py-5"
      style={{ background: styles.background, color: styles.color }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-full font-bold text-[12px] text-white"
          style={{ background: styles.glyphBg }}
          aria-hidden
        >
          {styles.glyph}
        </span>
        <h4 className="font-serif text-[18px] font-medium leading-none">
          {isDo ? "Do" : "Don't"}
        </h4>
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li key={item} className="text-[13px] leading-relaxed">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
