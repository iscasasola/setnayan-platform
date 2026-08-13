'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getMutualStoryDays,
  type MutualDaysState,
} from '../_actions/mutual-days-actions';

// "The days you were both there" — a client island on the public /u profile.
//
// ⚠ IT IS AN ISLAND FOR ONE REASON: the profile page is ISR-cached
// (`export const revalidate = 60`). A per-VIEWER answer rendered into that body
// would be cached and then served to a DIFFERENT visitor — one person's shared
// days shown to a stranger. Resolving after hydration keeps the cached HTML
// identical for everyone. Do not "simplify" this into the server page.
//
// It renders NOTHING until its state resolves, and nothing at all when the
// feature is off, the visitor is signed out, or the visitor is the profile
// holder — so there is no flash of a wrong-state block. The zero case is a
// WRITTEN INVITATION, never a "0": a count of zero on somebody's memories reads
// as a rebuke, and the sentence is also where the rule gets explained.

export function MutualDays({
  profileUserId,
  profileName,
}: {
  profileUserId: string;
  /** Only pass this where the page already shows the holder's name publicly. */
  profileName?: string | null;
}) {
  const [state, setState] = useState<{ resolved: boolean } & MutualDaysState>({
    resolved: false,
    show: false,
    days: [],
  });

  useEffect(() => {
    let alive = true;
    void getMutualStoryDays(profileUserId)
      .then((s) => {
        if (!alive) return;
        setState({ resolved: true, show: s.show, days: s.days });
      })
      .catch(() => {
        // Fail closed — a failed read shows nothing, never an empty-looking
        // section that would read as "you two have never met".
        if (alive) setState({ resolved: true, show: false, days: [] });
      });
    return () => {
      alive = false;
    };
  }, [profileUserId]);

  if (!state.resolved || !state.show) return null;

  const them = profileName?.trim() || 'them';

  return (
    <section className="uprof-md" aria-label="Days you were both there">
      <h2 className="m-serif uprof-md-head">Days you were both there</h2>
      {state.days.length === 0 ? (
        <p className="uprof-md-invite">
          Nothing here yet. The next time you and {them} are at the same
          celebration and the photos are shared, that day appears here — on both
          of your pages, and only while you both want it there.
        </p>
      ) : (
        <ol className="uprof-md-list">
          {state.days.map((d) => {
            const meta = [d.venueName, formatDay(d.eventDate)]
              .filter(Boolean)
              .join(' · ');
            return (
              <li key={d.eventId} className="uprof-md-item">
                <Link href={`/${d.slug}`} className="uprof-md-card">
                  <span className="uprof-md-body">
                    <span className="m-serif uprof-md-title">
                      {d.displayName?.trim() || 'A celebration'}
                    </span>
                    {meta ? <span className="uprof-md-meta">{meta}</span> : null}
                  </span>
                  <span aria-hidden className="uprof-md-chev">
                    &rsaquo;
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

/**
 * A DATE IS NOT AN INSTANT. `events.event_date` is a DATE ('2026-12-12');
 * `new Date('2026-12-12')` is midnight UTC, which is the 11th on any phone west
 * of Greenwich — the exact bug that printed the wrong day on 41 screens. Format
 * the parts by hand so the day can never shift under the reader's timezone.
 */
function formatDay(iso: string | null): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const [, y, mo, d] = m;
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = MONTHS[Number(mo) - 1];
  if (!monthName) return null;
  return `${monthName} ${Number(d)}, ${y}`;
}
