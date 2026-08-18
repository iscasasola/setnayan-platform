import type { EventWords } from '../_lib/event-words';
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
  words,
}: {
  words: EventWords;
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
        <section className="space-y-4">
          <header className="space-y-2">
            <p className="pahina-eyebrow">
              <span aria-hidden>№ 05</span>
              <span>Dress code</span>
            </p>
            <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
              Modest &amp; formal
            </h3>
          </header>
          <p className="max-w-prose text-base leading-relaxed text-ink/70">
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
        <section className="space-y-4">
          <header className="space-y-2">
            <p className="pahina-eyebrow">
              <span aria-hidden>№ 05</span>
              <span>Dress code</span>
            </p>
            <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
              Modest dress
            </h3>
          </header>
          <p className="max-w-prose text-base leading-relaxed text-ink/70">
            We warmly ask everyone to dress modestly — shoulders and knees
            covered. Ladies, please feel free to bring a scarf for the ceremony.
            Thank you for honoring the occasion with us.
          </p>
          {genderNote ? (
            <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p>
          ) : null}
        </section>
      );
    }
    return (
      <section className="space-y-4">
        <header className="space-y-2">
          <p className="pahina-eyebrow">
            <span aria-hidden>№ 05</span>
            <span>Dress code</span>
          </p>
          <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
            Coming together
          </h3>
        </header>
        <p className="max-w-prose text-base leading-relaxed text-ink/65">
          Your hosts haven&rsquo;t shared the dress code yet — check back closer to
          the {words.eventWord}.
        </p>
      </section>
    );
  }

  // Pahina (design 2026-07-25 §5/§7): chapter № 05, the palette rendered as SILK
  // SWATCHES (tall fabric chips with inner shading + a gild pin, not flat color
  // dots), and the Do/Don't boxes recoloured off the app's success/danger greens
  // and reds onto palette-derived tones — the functional-color exile (§4). The
  // two lists stay distinguishable by their key and rule, not by hue.
  return (
    <section className="space-y-5">
      <header className="space-y-2">
        <p className="pahina-eyebrow">
          <span aria-hidden>№ 05</span>
          <span>Dress code</span>
        </p>
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">
          {title || 'Dress with us'}
        </h3>
      </header>
      {description ? (
        <p className="max-w-prose text-base leading-relaxed text-ink/70">{description}</p>
      ) : null}
      {palette.length > 0 ? (
        <div className="flex flex-wrap gap-4">
          {palette.map((p, i) => (
            <figure key={`${p.hex}-${i}`} className="w-[3.25rem]">
              <span aria-hidden className="pahina-swatch" style={{ backgroundColor: p.hex }} />
              <figcaption className="mt-2 text-center font-mono text-[0.6rem] uppercase leading-tight tracking-[0.12em] text-ink/60">
                {p.name}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {dos.length > 0 || donts.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {dos.length > 0 ? (
            <div className="space-y-2 border-l-2 border-gild bg-veil/50 p-4 text-sm text-ink/80">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-gild">Do</p>
              <ul className="space-y-1">
                {dos.map((row, i) => (
                  <li key={i}>· {row}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {donts.length > 0 ? (
            <div className="space-y-2 border-l-2 border-ink/30 bg-paper-deep p-4 text-sm text-ink/75">
              <p className="font-mono text-[0.66rem] uppercase tracking-[0.28em] text-ink/50">
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
        <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p>
      ) : null}
    </section>
  );
}
