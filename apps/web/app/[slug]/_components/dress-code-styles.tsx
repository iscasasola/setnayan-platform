import type { EveryoneDressRow } from '@/lib/dress-code-for-everyone';

/**
 * THE DRESS CODE'S OTHER TWO STYLES — B · The palette and C · The line
 * (prototype `every_scene_three_styles_2026-09-29.html` §7). A · Colours and
 * roles is `DressCodeWidget` itself.
 *
 * 🔒 THESE ARE THE GENERAL VIEW ONLY. A guest the page knows is shown their
 * own role's outfit and colours and nothing else (owner 2026-09-28), in every
 * style — `DressCodeWidget` keeps drawing that panel itself and never hands a
 * known guest's view here. What arrives is exactly what the general view of A
 * prints: the heading and words, the couple's colours, one row per dressed
 * role, the do's and don'ts and the seating note. Nothing is looked up.
 */

export type DressCodeGeneral = {
  title: string;
  description: string;
  palette: ReadonlyArray<{ name: string; hex: string }>;
  rows: readonly EveryoneDressRow[];
  dos: readonly string[];
  donts: readonly string[];
  genderNote: string | null;
};

const SWATCH_EDGE = 'outline outline-1 outline-ink/20 [outline-offset:-1px]';

function DosAndDonts({ dos, donts }: { dos: readonly string[]; donts: readonly string[] }) {
  if (dos.length === 0 && donts.length === 0) return null;
  return (
    <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
      {dos.length > 0 ? (
        <div className="space-y-1 border-l-2 border-gild pl-3 text-ink/80">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-gild">Do</p>
          <ul className="space-y-1">
            {dos.map((row, i) => (
              <li key={i}>· {row}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {donts.length > 0 ? (
        <div className="space-y-1 border-l-2 border-ink/30 pl-3 text-ink/75">
          <p className="font-sans text-xs uppercase tracking-[0.2em] text-ink/60">Don&rsquo;t</p>
          <ul className="space-y-1">
            {donts.map((row, i) => (
              <li key={i}>· {row}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** B · The palette — the colours first, large, each with who wears it; the words after. */
export function DressCodePalette({ title, description, palette, rows, dos, donts, genderNote }: DressCodeGeneral) {
  // One band per wearer — the couple's colours first, then each dressed role —
  // so every colour is named with who wears it, once.
  const bands = [
    ...(palette.length > 0 ? [{ key: 'ours', who: 'Our colours', swatches: palette.map((p) => ({ hex: p.hex, name: p.name })) }] : []),
    ...rows.filter((r) => r.hexes.length > 0).map((r) => ({ key: r.key, who: r.label, swatches: r.hexes.map((hex) => ({ hex, name: '' })) })),
  ];
  return (
    <section className="space-y-5" data-scene-style="palette">
      <p className="pahina-eyebrow">
        <span>Dress code</span>
      </p>
      {bands.length > 0 ? (
        <ul className="space-y-4" aria-label="The colours, and who wears them">
          {bands.map((band) => (
            <li key={band.key} data-palette-band={band.key}>
              <div className="flex h-20 w-full overflow-hidden">
                {band.swatches.map((sw, i) => (
                  <span
                    key={`${sw.hex}-${i}`}
                    aria-hidden
                    className={`h-full flex-1 ${SWATCH_EDGE}`}
                    style={{ backgroundColor: sw.hex }}
                  />
                ))}
              </div>
              <p className="mt-1.5 text-sm text-ink">{band.who}</p>
              {band.swatches.some((sw) => sw.name) ? (
                <p className="text-xs text-ink/65">{band.swatches.map((sw) => sw.name).filter(Boolean).join(' · ')}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="space-y-2">
        <h3 className="font-pahina text-3xl font-light leading-tight tracking-tight text-ink">{title}</h3>
        {description ? <p className="max-w-prose text-base leading-relaxed text-ink/70">{description}</p> : null}
      </div>
      {rows.some((r) => r.lines.length > 0) ? (
        <ul className="space-y-1 text-sm text-ink/70">
          {rows.flatMap((r) =>
            r.lines.map((line, i) => (
              <li key={`${r.key}-${i}`}>
                <span className="text-ink">{r.label}</span> · {line.styleLabel}
                {line.note ? <> — {line.note}</> : null}
              </li>
            )),
          )}
        </ul>
      ) : null}
      <DosAndDonts dos={dos} donts={donts} />
      {genderNote ? <p className="max-w-prose text-sm font-medium text-ink/75">{genderNote}</p> : null}
    </section>
  );
}

/** C · The line — words first in the display face, the palette as one ribbon, roles as a quiet table. */
export function DressCodeLine({ title, description, palette, rows, dos, donts, genderNote }: DressCodeGeneral) {
  const seen = new Set<string>();
  const ribbon = [...palette.map((p) => p.hex), ...rows.flatMap((r) => r.hexes)].filter((hex) => {
    const k = hex.toUpperCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return (
    <section className="space-y-5 text-center" data-scene-style="line">
      <p className="pahina-eyebrow justify-center">
        <span>Dress code</span>
      </p>
      <h3 className="font-pahina text-4xl font-light italic leading-tight text-ink">{title}</h3>
      {description ? (
        <p className="mx-auto max-w-prose text-base leading-relaxed text-ink/70">{description}</p>
      ) : null}
      {ribbon.length > 0 ? (
        <div className={`mx-auto flex h-6 w-full max-w-sm overflow-hidden ${SWATCH_EDGE}`} aria-label="Our colours" role="img">
          {ribbon.map((hex, i) => (
            <span key={`${hex}-${i}`} className="h-full flex-1" style={{ backgroundColor: hex }} />
          ))}
        </div>
      ) : null}
      {rows.length > 0 ? (
        <table className="mx-auto w-full max-w-sm border-y border-ink/10 text-left text-sm">
          <tbody className="divide-y divide-ink/10">
            {rows.map((r) => (
              <tr key={r.key} data-role-row={r.key}>
                <th scope="row" className="py-2 pr-3 align-top font-normal text-ink">
                  {r.label}
                </th>
                <td className="py-2 align-top text-ink/65">
                  {r.hexes.length > 0 ? (
                    <span className="mr-2 inline-flex gap-1 align-middle" aria-hidden>
                      {r.hexes.map((hex, i) => (
                        <span key={`${hex}-${i}`} className={`inline-block h-3.5 w-3.5 ${SWATCH_EDGE}`} style={{ backgroundColor: hex }} />
                      ))}
                    </span>
                  ) : null}
                  {r.lines.map((l) => l.styleLabel).join(' · ')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <div className="text-left">
        <DosAndDonts dos={dos} donts={donts} />
      </div>
      {genderNote ? <p className="mx-auto max-w-prose text-sm font-medium text-ink/75">{genderNote}</p> : null}
    </section>
  );
}
