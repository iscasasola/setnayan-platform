/**
 * people-parse.ts — one typed line becomes a person, the way `guest-parse.ts`
 * turns "Ana Cruz +1 groom vip #Barkada" into a guest.
 *
 * Owner, 2026-08-21: *"we want the interface of people and guest list to be
 * similar."* The guest list is fast because adding is ONE line and Enter; two
 * labelled boxes is a form, not a capture bar. So:
 *
 *     "Maria Cruz maria@email.com"   → { name: "Maria Cruz", email: "maria@email.com" }
 *     "maria@email.com"              → { name: "maria",      email: "maria@email.com" }
 *     "Tita Baby"                    → { name: "Tita Baby",  email: "" }
 *
 * ⚠ NO LABEL GRAMMAR HERE, and that is the point rather than an omission. The
 * guest parser reads roles and groups off the line because a guest is the host's
 * own record. A person is somebody else's account: you add them first and say
 * what they are to you afterwards, once they have agreed to be there at all.
 *
 * PURE — no I/O, no clock. The email is not validated beyond "looks addressed";
 * `normalizeEmail` in `people-add.ts` owns that, and the send is the real test.
 */

export type PersonLine = { name: string; email: string };

/** The first whitespace-separated token that looks like an address. */
function emailTokenOf(tokens: string[]): number {
  return tokens.findIndex((t) => {
    const stripped = t.replace(/^[<(]|[>),.;]+$/g, '');
    const at = stripped.indexOf('@');
    return at > 0 && at < stripped.length - 1 && !stripped.includes('@@');
  });
}

export function parsePersonLine(raw: string): PersonLine {
  const tokens = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { name: '', email: '' };

  const at = emailTokenOf(tokens);
  if (at === -1) return { name: tokens.join(' ').slice(0, 120), email: '' };

  const email = tokens[at]!.replace(/^[<(]|[>),.;]+$/g, '');
  const rest = [...tokens.slice(0, at), ...tokens.slice(at + 1)].join(' ').trim();

  // An address on its own still needs a name to render a row, and the part
  // before the @ is the best guess anyone has. It is a starting point the person
  // can correct, never a claim about what they are called.
  const fallback = email.slice(0, email.indexOf('@')).replace(/[._-]+/g, ' ').trim();

  return { name: (rest || fallback).slice(0, 120), email };
}
