'use client';

/**
 * 👗 SEAM ALLOWANCES, ONE ROW PER KIND (plan step B11; the approved drawing is the prototype `gown_maker_v205.html`
 * `saRows`, ported; owner D29: on by default and editable; D30: centimetres). Used in two places that must agree:
 * Shop › Attire Maker › "Patterns and printing" (her shop's own), and Clients › the event › an order's cutting blocks
 * (this order's own). Each kind is the house `Counter`, a tenth of a centimetre a tap, held to its own range
 * (`GOWN_SEAM_KINDS`): seams 0.5–3, hem 0.5–8, zip 1–4, necklines and armholes 0.3–2. Lengths only: never money.
 * 🔒 lib/gown-pattern/allowance.test.ts (the ranges) · app/dev/gown-shop-lab (walked at 375 px, light and dark)
 */
import { Counter } from '@/app/_components/counter';
import { GOWN_SEAM_KINDS, gownSeamAllowClean, type GownSeamAllow, type GownSeamKind } from '@/lib/gown-pattern/allowance';

export function GownSeamAllowRows({ value, onChange, disabled = false, data }: { value: GownSeamAllow; onChange: (next: GownSeamAllow) => void; disabled?: boolean; data?: string }) {
  const step = (k: GownSeamKind, by: number) => onChange(gownSeamAllowClean({ ...value, [k]: Math.round((value[k] + by) * 10) / 10 }, value));
  return (
    <ul className="sn-frame divide-y divide-line" data-gown-seam-allow={data ?? ''}>
      {GOWN_SEAM_KINDS.map(([k, name, , least, most]) => (
        <li key={k} className="flex items-center justify-between gap-3 px-3 py-2 text-sn-base" data-gown-seam-kind={k}>
          <span className="min-w-0 text-ink">{name}</span>
          <span className="flex flex-none items-center gap-2">
            <Counter
              value={value[k]}
              label={`${name}, centimetres`}
              onLess={() => step(k, -0.1)}
              onMore={() => step(k, 0.1)}
              lessDisabled={disabled || value[k] <= least}
              moreDisabled={disabled || value[k] >= most}
              lessLabel={value[k] <= least ? `${name}: ${least} cm is the least` : `Less: ${name}`}
              moreLabel={value[k] >= most ? `${name}: ${most} cm is the most` : `More: ${name}`}
              data={`gown-seam-${k}`}
            />
            <small className="text-sn-sm text-ink/70">cm</small>
          </span>
        </li>
      ))}
    </ul>
  );
}
