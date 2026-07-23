import type { EventRow } from '../_lib/types';

/**
 * Dress code section on the public landing page (CLAUDE.md 2026-05-22).
 *
 * Reads `events.dress_code_config` (migration 20260605030000) — host edits
 * via /dashboard/[eventId]/website/dress-code. When every field is empty
 * (brand-new event, host hasn't set anything yet), renders a polite
 * brand-voice fallback so guests know the section is intentional and to
 * check back closer to the day.
 */
export function DressCodeWidget({
  config,
  ceremonyType,
  genderSeparation,
}: {
  config: EventRow['dress_code_config'];
  ceremonyType?: string | null;
  genderSeparation?: string | null;
}) {
  // The couple's walima seating posture, surfaced to guests so they know what to
  // expect at the reception. Muslim-only; 'none' (default) shows nothing. Neutral
  // tone per the spec — we describe, never editorialize.
  const genderNote =
    ceremonyType === 'muslim' && genderSeparation === 'sections'
      ? 'Seating: separate sections for men and women.'
      : ceremonyType === 'muslim' && genderSeparation === 'separate_spaces'
        ? 'Seating: separate spaces for men and women.'
        : null;
  // Defensive read — JSONB column defaults to `{}` so every field may be
  // absent. Skip rows in palette that aren't valid #RRGGBB to avoid CSS
  // injection via the inline style attribute.
  const title = typeof config?.title === 'string' ? config.title : '';
  const description = typeof config?.description === 'string' ? config.description : '';
  const dos = Array.isArray(config?.dos)
    ? config.dos.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const donts = Array.isArray(config?.donts)
    ? config.donts.filter((s): s is string => typeof s === 'string' && s.length > 0)
    : [];
  const palette = Array.isArray(config?.palette)
    ? config.palette.filter(
        (p): p is { name: string; hex: string } =>
          !!p &&
          typeof p.name === 'string' &&
          typeof p.hex === 'string' &&
          /^#[0-9a-fA-F]{6}$/.test(p.hex),
      )
    : [];

  const hasAnything =
    title.length > 0 ||
    description.length > 0 ||
    dos.length > 0 ||
    donts.length > 0 ||
    palette.length > 0;

  // Empty state — section stays visible (so guests know to expect it) but
  // reads as an intentional note in the host's brand voice.
  if (!hasAnything) {
    // INC weddings require modest, formal attire of everyone present (no
    // sleeveless / short), so even when the host hasn't authored a dress code
    // we surface that expectation — it spares guests the most common INC-
    // wedding friction. See INC_Wedding_Practices_Reference_2026-06-28.md § 5.4.
    if (ceremonyType === 'inc') {
      return (
        <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
          <header>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              Dress code
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">
              Modest &amp; formal
            </h3>
          </header>
          <p className="text-sm text-ink/70">
            Our ceremony is held in the INC chapel, so we kindly ask everyone to
            dress modestly and formally — please avoid sleeveless tops and short
            dresses or skirts. Thank you for honoring the occasion with us.
          </p>
        </section>
      );
    }
    // Muslim weddings carry a strong modesty expectation (lib/wedding-traditions
    // 'muslim': modest dress), so surface it even when the host hasn't authored a
    // dress code — it spares guests the most common Nikah/walima friction.
    if (ceremonyType === 'muslim') {
      return (
        <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
          <header>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
              Dress code
            </p>
            <h3 className="mt-1 text-2xl font-semibold tracking-tight">
              Modest dress
            </h3>
          </header>
          <p className="text-sm text-ink/70">
            We warmly ask everyone to dress modestly — shoulders and knees
            covered. Ladies, please feel free to bring a scarf for the ceremony.
            Thank you for honoring the occasion with us.
          </p>
          {genderNote ? (
            <p className="text-sm font-medium text-ink/75">{genderNote}</p>
          ) : null}
        </section>
      );
    }
    return (
      <section className="space-y-3 rounded-xl border border-ink/10 bg-cream p-6">
        <header>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">
            Dress code
          </p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight">
            Coming together
          </h3>
        </header>
        <p className="text-sm text-ink/65">
          Your hosts haven&rsquo;t shared the dress code yet — check back closer to
          the wedding.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-5 rounded-xl border border-ink/10 bg-cream p-6">
      <header>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ink/55">Dress code</p>
        <h3 className="mt-1 text-2xl font-semibold tracking-tight">
          {title || 'Dress with us'}
        </h3>
      </header>
      {description ? <p className="text-sm text-ink/70">{description}</p> : null}
      {palette.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {palette.map((p, i) => (
            <div
              key={`${p.hex}-${i}`}
              className="flex items-center gap-2 text-xs text-ink/70"
            >
              <span
                aria-hidden
                className="inline-block h-6 w-6 rounded-full ring-1 ring-ink/10"
                style={{ backgroundColor: p.hex }}
              />
              {p.name}
            </div>
          ))}
        </div>
      ) : null}
      {dos.length > 0 || donts.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {dos.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-success-200 bg-success-50 p-4 text-sm text-success-900">
              <p className="font-mono text-xs uppercase tracking-[0.15em]">Do</p>
              <ul className="space-y-1">
                {dos.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {donts.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-900">
              <p className="font-mono text-xs uppercase tracking-[0.15em]">
                Don&rsquo;t
              </p>
              <ul className="space-y-1">
                {donts.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
      {genderNote ? (
        <p className="text-sm font-medium text-ink/75">{genderNote}</p>
      ) : null}
    </section>
  );
}
