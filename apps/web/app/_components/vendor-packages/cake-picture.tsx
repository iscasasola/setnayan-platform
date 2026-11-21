/**
 * 🎂 THE CAKE PICTURE (Cake Maker drawing §02 · "the picture is assembled from the picks only" — no free-hand drawing,
 * no editor, V1 lock). Tiers, a sponge slice per tier, the finish, the design (ribbon · flowers · drip · pearls), the
 * topper and the message board. The cake keeps its real colours in light and dark; only the stage follows the theme.
 *
 * Every look is read from the shop's OWN option words by keyword (a "Fondant" finish draws fondant, a "Drip" design
 * draws a drip). A word the picture does not know draws the plain look — the picture never claims a look it cannot show.
 */
import css from './cake-designer.module.css';

export type CakeFinishLook = 'bc' | 'fd' | 'sn';
export type CakeStyleLook = 'cl' | 'fl' | 'dr' | 'pe';
export type CakeTopperLook = 'no' | 'ac' | 'fw' | 'fg';

export type CakePictureProps = {
  /** Sponge colour per tier, bottom first — its length is the number of tiers. */
  sponges: string[];
  finish: CakeFinishLook;
  look: CakeStyleLook;
  topper: CakeTopperLook;
  /** The picked colours, as hexes (ribbon stripes, flowers, the drip). */
  colours: string[];
  /** The message on the board; '' draws no board. */
  message: string;
  /** Flavour words beside each tier on the live picture (bottom first); omitted on the small pictures. */
  tags?: string[];
  className?: string;
};

/** The drawing's tier geometry, bottom first (a 6th tier continues the same step). */
const TIERS = [
  { left: 45, width: 210, bottom: 10 },
  { left: 62, width: 176, bottom: 46 },
  { left: 79, width: 142, bottom: 82 },
  { left: 95, width: 110, bottom: 118 },
  { left: 110, width: 80, bottom: 154 },
  { left: 123, width: 54, bottom: 190 },
];

/** No colour picked yet → the drawing's champagne, so the ribbon is never drawn invisible. */
const RESTING_COLOUR = '#E3CFA6';

export function CakePicture({ sponges, finish, look, topper, colours, message, tags, className }: CakePictureProps) {
  const n = Math.max(1, Math.min(TIERS.length, sponges.length));
  const ribbon = colours.length > 0 ? colours : [RESTING_COLOUR];
  const tierClass = finish === 'fd' ? css.tierFd : finish === 'sn' ? css.tierSn : '';
  const top = TIERS[n - 1]!;
  return (
    <div className={`${css.cake} ${className ?? ''}`} aria-hidden>
      <i className={css.stand} />
      {TIERS.slice(0, n).map((t, i) => (
        <div key={i} className={`${css.tier} ${tierClass}`} style={{ left: t.left, width: t.width, bottom: t.bottom }}>
          <i className={css.slice} style={{ ['--fc' as string]: sponges[i] }} />
          {look === 'cl' ? (
            <i className={css.rib}>
              {ribbon.map((c, k) => (
                <s key={k} style={{ background: c }} />
              ))}
            </i>
          ) : null}
          {look === 'pe' ? <i className={css.pearls} /> : null}
          {look === 'dr' ? (
            <i className={css.drip}>
              {ribbon.map((c, k) => (
                <s key={k} style={{ background: c }} />
              ))}
            </i>
          ) : null}
          {look === 'fl' && (i % 2 === 0 || i === n - 1) ? (
            <i className={`${css.flw} ${i === 1 ? css.flwT2 : i === 3 ? css.flwT4 : ''}`}>
              {ribbon.map((c, k) => (
                <s key={k} style={{ background: c }} />
              ))}
            </i>
          ) : null}
          {tags?.[i] ? <i className={css.ftag}>{tags[i]}</i> : null}
        </div>
      ))}
      {topper !== 'no' ? (
        <div className={css.topper} style={{ bottom: top.bottom + 36 }}>
          {topper === 'ac' ? <i className={css.tpAc}>{message.trim().slice(0, 12) || 'A & M'}</i> : null}
          {topper === 'fw' ? (
            <i className={css.tpFw}>
              <b />
              <b />
              <b />
            </i>
          ) : null}
          {topper === 'fg' ? (
            <i className={css.tpFg}>
              <b />
              <b />
            </i>
          ) : null}
        </div>
      ) : null}
      {message.trim() ? <span className={css.plaque}>{message.trim()}</span> : null}
    </div>
  );
}

const has = (label: string, ...words: string[]) => {
  const l = label.toLowerCase();
  return words.some((w) => l.includes(w));
};

/** The sponge colour a flavour draws (the drawing's five); any other flavour draws the vanilla sponge. */
export function spongeOf(label: string | null | undefined): string {
  const l = label ?? '';
  if (has(l, 'red velvet')) return '#A8323A';
  if (has(l, 'choc')) return '#5E3A24';
  if (has(l, 'ube', 'taro')) return '#7B4FA0';
  if (has(l, 'mocha', 'coffee')) return '#A47551';
  return '#F1DFAE';
}

export function finishOf(label: string | null | undefined): CakeFinishLook {
  const l = label ?? '';
  if (has(l, 'fondant')) return 'fd';
  if (has(l, 'semi', 'naked')) return 'sn';
  return 'bc';
}

export function lookOf(label: string | null | undefined): CakeStyleLook {
  const l = label ?? '';
  if (has(l, 'floral', 'flower', 'bloom')) return 'fl';
  if (has(l, 'drip')) return 'dr';
  if (has(l, 'pearl')) return 'pe';
  return 'cl';
}

export function topperOf(label: string | null | undefined): CakeTopperLook {
  const l = (label ?? '').trim();
  if (!l || has(l, 'none') || l.toLowerCase() === 'no topper') return 'no';
  if (has(l, 'flower', 'floral')) return 'fw';
  if (has(l, 'figur')) return 'fg';
  return 'ac';
}
