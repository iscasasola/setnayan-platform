/**
 * person-page-facts.ts — the pure rules behind a person's page (`/u/[userSlug]`): the name it shows and whether a
 * connection waits on the viewer's answer. Client-safe, no I/O — the reads are `lib/public-profile.ts` and
 * `lib/profile-viewer.ts` (server-only). 🔒 lib/person-page-facts.test.ts
 */
import { isPlaceholderNameWord } from '@/lib/seat-placeholder-words';

/** The account's three name columns (`users.display_name` · `first_name` · `last_name`). */
export type AccountNameParts = {
  display_name: string | null | undefined;
  first_name: string | null | undefined;
  last_name: string | null | undefined;
};

/**
 * 👤 THE NAME A PERSON PAGE SHOWS (walk 13 Nov 2026, F-W3-04/10/29: "Someone on Setnayan", a page with no name).
 * `users.display_name` is blank on most accounts; the account's own first + last name are not. One order: the display
 * name, else first + last joined with a space, else null — the caller then says its own neutral words. Never the
 * email, never the public handle. A placeholder word ("—") is never a name (`isPlaceholderNameWord`, F-W3-22).
 */
export function profileShownName(u: AccountNameParts): string | null {
  const shown = (u.display_name ?? '').trim();
  if (shown && /[\p{L}\p{N}]/u.test(shown) && !isPlaceholderNameWord('display', shown)) return shown;
  const first = (u.first_name ?? '').trim();
  const last = (u.last_name ?? '').trim();
  const joined = [isPlaceholderNameWord('first', first) ? '' : first, isPlaceholderNameWord('last', last) ? '' : last]
    .filter(Boolean)
    .join(' ');
  return joined || null;
}

export type ConnRead = { connection_id: string; status: string; from_person_id: string; to_person_id: string };

/** The pending request that waits on MY answer: from one of their person rows to one of mine. Pure. */
export function waitingOnMe(conns: readonly ConnRead[], mine: readonly string[], theirs: readonly string[]): string | null {
  const row = conns.find((c) => c.status === 'pending' && theirs.includes(c.from_person_id) && mine.includes(c.to_person_id));
  return row?.connection_id ?? null;
}

/**
 * 👤 THE NAME IN "<name> CONFIRMED YOUR CONNECTION" (walk 13 Nov 2026, F-W3-27: the notice read "They confirmed your
 * connection"). The person row's display name first (what it always read), else the account's own name
 * (`profileShownName`), first word only — the notice's shape — else "They".
 */
export function confirmedByName(personDisplayName: string | null | undefined, account: AccountNameParts | null | undefined): string {
  const firstWord = (v: string | null | undefined) => {
    const t = (v ?? '').trim();
    return t && /[\p{L}\p{N}]/u.test(t) ? (t.split(/\s+/)[0] ?? null) : null;
  };
  return firstWord(personDisplayName) ?? firstWord(account ? profileShownName(account) : null) ?? 'They';
}
