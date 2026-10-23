import Link from 'next/link';

import type { ShellPeopleResults } from '@/lib/shell-people-results';
import { shopInitials } from '@/lib/shop-initials';

/** Words the results page says when the People read was refused — never "nobody", never a 0. */
export const PEOPLE_UNREAD = 'We couldn’t search people just now. Nothing is lost — try again in a moment.';

/**
 * shell-people-section.tsx — the People rows of the shell's search results (owner 2026-10-22).
 *
 * PORTED, NOT REDRAWN: each person is the results page's own card (`fd-item` · `fd-thumb` · `fd-imeta` ·
 * `fd-kindtag`, the OwnCard grammar) — a face or initials, the name, and the People page's own tag
 * ("Your people" / "On Setnayan") with what follows it. The press is a plain link to the person's card on the
 * People page (`/dashboard/people?person=…`), so the browser's Back returns here.
 *
 * 🔴 A REFUSED READ SAYS SO. `unavailable` draws one sentence even when some rows did load — a partial
 * answer must not pass for the whole one.
 */
export function ShellPeopleSection({ people }: { people: ShellPeopleResults }) {
  return (
    <>
      {people.rows.length > 0 ? (
        <div className="fd-grid" data-shell-people="">
          {people.rows.map((r) => {
            const initials = shopInitials(r.name, 2, '·');
            // A stored photo may be an r2:// reference — only an http(s) URL draws (PersonAvatar's rule).
            const photo = r.photoUrl && /^https?:\/\//.test(r.photoUrl) ? r.photoUrl : null;
            return (
              <Link key={r.key} href={r.href} className="fd-item" data-person-result="">
                <div className="fd-thumb fd-thumb-shop">
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photo} alt="" className="fd-shoplogo" loading="lazy" />
                  ) : (
                    <span className="fd-shopmark">{initials}</span>
                  )}
                </div>
                <div className="fd-imeta">
                  <span className="fd-ava" aria-hidden="true">
                    {initials}
                  </span>
                  <div className="fd-itxt">
                    <p className="fd-ttl">{r.name}</p>
                    <p className="fd-by">
                      <span className="fd-kindtag">{r.tag}</span>
                      {r.detail ? ` ${r.detail}` : null}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
      {people.unavailable ? (
        <p role="status" className="mb-4 text-sm text-ink/65" data-people-unread="">
          {PEOPLE_UNREAD}
        </p>
      ) : null}
    </>
  );
}
