import type { DoorSkin } from '@/app/_components/door/door-shell';
import type { InviteSkinInput } from './invite-skin';
import { SealMark } from './seal-mark';
import styles from './capiz.module.css';

/**
 * CAPIZ — the Elegant invite theme (Event Hub Pro). See capiz.module.css.
 *
 * The photo is painted as a CSS background whose URL goes through
 * `JSON.stringify` — a quoted, escaped CSS string — so a presigned URL's `&`,
 * `%` or any stray quote can never break out of `url(…)`.
 */
export function capizSkin({ photo, accent, monogram, mark, markPlays }: InviteSkinInput): DoorSkin {
  return {
    themeId: 'capiz',
    className: styles.capiz ?? '',
    style: { ['--accent' as string]: accent } as React.CSSProperties,
    ground: (
      <>
        {photo ? (
          <div className={styles.photo} style={{ backgroundImage: `url(${JSON.stringify(photo)})` }} />
        ) : null}
        <div className={styles.shell} />
      </>
    ),
    crest: (
      <div className={styles.crest}>
        <span className={styles.seal}>
          <SealMark mark={mark} monogram={monogram} px={46} plays={markPlays} />
        </span>
      </div>
    ),
    hinge: <div className={styles.hinge} />,
  };
}
