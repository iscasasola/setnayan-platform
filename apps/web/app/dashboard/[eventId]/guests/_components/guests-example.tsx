/**
 * 👻 THE GUEST LIST'S EXAMPLE (Build 5 Lane H; owner 2026-11-09, DECISION_LOG 🧱👻 ×2; approved prototype
 * `prototypes/empty_looks_user_event_2026-11-10/` frame "Event · Guests"): under the shipped "No guests yet." and its
 * one Add, the roster itself on sample rows — the list's own section header (`.sec · .barWrap · .bar`, open) and row
 * (`.g · .ava · .who · .nm · .meta`, the reply pill family of `guests-screen.tsx`'s `PILL`) from
 * `guests-screen.module.css`, so the couple sees sides, roles and replies before they type a name.
 *
 * Inert by construction: no buttons, no swipe, inside the shared `ExamplePreview`. Avatars are monograms, never photos.
 * The page mounts it only on its EMPTY branch — after the guest read was MEASURED (a refused read returns earlier with
 * "We couldn’t load your guest list"), with no guests at all, and not for a finished event.
 */
import { Check, Clock, Send, Users } from 'lucide-react';
import { ExamplePreview } from '@/app/_components/states/empty-state';
import { SAMPLE_GUESTS } from '@/lib/empty-look-samples';
import { RSVP_ROW_WORDS } from '@/lib/guests';
import styles from './guests-screen.module.css';

const PILL = {
  attending: { cls: 'pillOk', word: RSVP_ROW_WORDS.attending, Icon: Check },
  pending: { cls: 'pillMute', word: RSVP_ROW_WORDS.pending, Icon: Clock },
  toinvite: { cls: 'pillGold', word: 'To invite', Icon: Send },
} as const;

export function GuestsExample() {
  return (
    <ExamplePreview className="mt-2 text-left">
      {SAMPLE_GUESTS.map((sec) => (
        <section key={sec.section} className={`${styles.sec} ${styles.accSec} ${styles.open}`}>
          <div className={`${styles.barWrap} sn-acc-head`} data-open="">
            <div className={styles.bar}>
              <span className={`${styles.ico} sn-acc-chip`} aria-hidden>
                <Users aria-hidden strokeWidth={1.9} />
              </span>
              <span className={styles.lab}>{sec.section}</span>
              <span className={styles.n}>· {sec.rows.length}</span>
            </div>
          </div>
          <div className={styles.fold}>
            <div>
              {sec.rows.map((r) => {
                const pill = PILL[r.reply];
                return (
                  <div key={r.name} className={styles.g}>
                    <span className={styles.ava}>{r.initials}</span>
                    <div className={styles.who}>
                      <div className={styles.nm}>
                        <span aria-hidden className={`${styles.dot} ${sec.side === 'bride' ? styles.sideBride : styles.sideGroom}`} />
                        <span className={styles.nmt}>{r.name}</span>
                      </div>
                      <div className={styles.meta}>
                        <span className={`${styles.pill} ${styles[pill.cls]}`}>
                          <pill.Icon aria-hidden className={styles.pillIco} strokeWidth={2.4} />
                          {pill.word}
                        </span>
                        {r.note ? ` · ${r.note}` : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      ))}
    </ExamplePreview>
  );
}
