// Section 10 — PH coverage map (iteration 0015 § Section 10)
// PH SVG basemap with city-level pins (never barangay public).
// Aggregated counts only. Brand-accent pins; sizes scale by event count.
//
// Skeleton phase: placeholder simplified-PH silhouette with a handful of
// dummy city pins to give the section visual rhythm. Full SVG basemap +
// PSGC-keyed pin overlay is design-direction-blocked.

// Generic three-island silhouette (placeholder geography).
// Coordinates are decorative only — not actual lat/lon.
const PIN_PLACEHOLDERS: Array<{
  city: string;
  cx: number;
  cy: number;
  size: 'sm' | 'md' | 'lg' | 'xl';
}> = [
  { city: 'Metro Manila', cx: 145, cy: 110, size: 'xl' },
  { city: 'Cebu City', cx: 175, cy: 195, size: 'lg' },
  { city: 'Davao', cx: 230, cy: 280, size: 'md' },
  { city: 'Iloilo', cx: 145, cy: 200, size: 'sm' },
  { city: 'Cagayan de Oro', cx: 210, cy: 250, size: 'sm' },
  { city: 'Baguio', cx: 130, cy: 75, size: 'sm' },
];

const SIZE_MAP: Record<'sm' | 'md' | 'lg' | 'xl', number> = {
  sm: 4,
  md: 6,
  lg: 9,
  xl: 12,
};

export function CoverageMap() {
  return (
    <section
      aria-labelledby="coverage-map-heading"
      className="border-b border-ink/5 bg-cream"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8 lg:py-28">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="space-y-4">
            <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-terracotta">
              Coverage
            </p>
            <h2
              id="coverage-map-heading"
              className="text-balance font-sans text-3xl font-semibold tracking-tight text-ink sm:text-4xl lg:text-5xl"
            >
              From Luzon to Mindanao.
            </h2>
            <p className="text-base text-ink/65 sm:text-lg">
              City-level coverage only on the public site. Aggregated event
              counts only — never individual events, never barangay-level.
              Hover or tap a pin to see how many weddings are being planned
              in that city.
            </p>
            <p className="text-xs text-ink/50">
              City pins light up as Setnayan-booked weddings ship in each
              location.
            </p>
          </div>

          <div className="relative">
            <div className="aspect-square rounded-2xl border border-ink/10 bg-gradient-to-br from-cream to-ink/[0.03] p-6">
              <svg
                viewBox="0 0 320 380"
                role="img"
                aria-label="Map of the Philippines with city-level pins"
                className="h-full w-full"
              >
                {/* Decorative island silhouettes — placeholder geography. */}
                <g
                  fill="rgb(var(--color-ink) / 0.06)"
                  stroke="rgb(var(--color-ink) / 0.12)"
                  strokeWidth="1"
                >
                  {/* Luzon */}
                  <path d="M120,30 C150,25 175,40 168,80 C172,105 145,135 130,140 C115,125 105,90 110,60 Z" />
                  {/* Visayas */}
                  <path d="M130,170 C160,165 195,180 185,210 C175,222 140,222 130,210 C120,200 118,180 130,170 Z" />
                  {/* Mindanao */}
                  <path d="M180,240 C220,235 260,265 250,310 C235,340 200,330 185,310 C175,290 168,260 180,240 Z" />
                  {/* Smaller decorative islands */}
                  <circle cx="100" cy="160" r="6" />
                  <circle cx="240" cy="190" r="4" />
                  <circle cx="105" cy="220" r="5" />
                </g>
                {/* Pins */}
                {PIN_PLACEHOLDERS.map((p) => (
                  <g key={p.city}>
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={SIZE_MAP[p.size] + 6}
                      fill="rgb(var(--color-terracotta) / 0.18)"
                    />
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={SIZE_MAP[p.size]}
                      fill="rgb(var(--color-terracotta) / 1)"
                    />
                    <title>{p.city}</title>
                  </g>
                ))}
              </svg>
            </div>
            <ul className="mt-4 flex flex-wrap gap-2 text-xs text-ink/55">
              {PIN_PLACEHOLDERS.map((p) => (
                <li
                  key={p.city}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 bg-cream px-2.5 py-1"
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 rounded-full bg-terracotta"
                  />
                  {p.city}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
