## 2026-09-19 · fix(couple): a refused guest-door, song, venue or face read still degrades, but leaves its reason (S41b · couple 5)

COUPLE-FACING tier of `result-dropped-silently` (S26 baseline, #5625), batch 5.
41 sites, all option (a): join the missing end. Every degrade here is deliberate
and documented, and each one stays: the slug-access guest check fails closed,
the tradition guide falls back to its built-in defaults, the venue entrance to
the conventional spot, the watch links to "none", the event-type vocab to its
fallback list, the face-age gate to "not a minor on record", and the STD view
count is best-effort.

What changes is that a REFUSED read no longer takes the absence branch and leaves
nothing behind. Each one now records `[supabase-error] <file> · <target>` with
the error object.

Sites: slug access ×2, slug forwarding, songs ×3, stage notes, wedding
traditions, watch links, indoor blueprint, NSFW screen ×5, STD launch, date
narrowing ×2, event-type vocab, face-enrolment age ×2, face-data retention,
account face profile ×2, account autosurface, guest membership session ×2,
scan trail, vendor invites, lean months, guest self-join, STD view counter, act
song-request inbox, own-captures strip, portfolio album, admin compliance ×3,
event deletions, Pakanta.

Proof: `lib/couple-reads-keep-their-reason.test.ts` executes five readers
against a refusing client. Each must keep its degrade and leave exactly one
record carrying the error, and a genuine absence must leave none (9/9). Deleting
any one of four log lines turns exactly one test red.

SPEC IMPACT: None
