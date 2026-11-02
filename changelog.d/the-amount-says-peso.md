## 2026-08-29 · fix(pay): the amount says a peso sign again

The one payment page — the screen a couple lands on the moment their
celebration is created, and the same screen after they send their proof —
printed its amount as three junk characters instead of `₱`. Three of its
sentences carried the same junk where an em dash belonged, including the first
instruction under *What happens next* and the confirmation line on the waiting
screen.

**What it was.** `apps/web/app/pay/[reference]/page.tsx` was read back as
latin-1 and re-saved as UTF-8 by an editing pass in `77186e580` (2026-08-28),
so every byte >= 0x80 in the whole file became two or three characters. 25
sequences in total: 21 in comments, 4 in text a person reads. Nothing threw,
nothing failed to compile, and all 29 of that page's existing tests stayed
green — a mangled peso sign is a perfectly valid string literal. The owner
found it on the screen that asks him for money.

The repair is character-level only: every changed line differs from `main`
solely in the bytes of one character. No wording, no logic, no markup moved.

**Swept, and it is one file.** Every `.ts`, `.tsx`, `.sql`, `.mjs`, `.md`,
`.json` and `.css` file in the repo (9,149 of them) was checked for the same
double-encoding signature. This page is the only one.

**New guard: `apps/web/lib/source-is-really-utf8.test.ts`.** The corruption
comes from the tool that writes a file, not from the file, so the next one will
be somewhere else — the guard walks `app/`, `lib/`, `components/`, `models/`
and `supabase/migrations/` rather than naming files. It re-encodes each run of
U+0080–U+00FF as latin-1 and reports it only when the bytes decode as valid
UTF-8 that is strictly shorter, which is the definition of a double encoding
and not something real prose does; the peso sign, em dashes, curly quotes, box
drawing and emoji are outside latin-1 entirely and can never match. It carries
no raw mojibake of its own — its fixtures are built from codepoints, because a
self-exemption is the one hole that would hide the next real offender.

Four assertions, each proved red by a measured sabotage (occurrence count
printed before → after): re-introducing the shipped mojibake into the payment
page, gutting the detector, pointing the scan at directories that do not exist,
and dropping both halves of the conservative-match rule so it cries wolf on
`àèìòù`.

SPEC IMPACT: None.
