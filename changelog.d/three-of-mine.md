## 2026-08-19 · fix: three regressions from today's own work

An adversarial pass over everything shipped today — five lenses, each finding
then attacked by an independent skeptic — confirmed three, all mine.

**1 · The stall watchdog capped the SERVER'S reply at 45 seconds.** Upload
progress events stop permanently the moment the body is written to the network
stack, and the only thing that re-armed the clock was that progress listener. So
the entire response wait ran on the transfer-silence budget — becoming the fixed
total-duration cap `stall-watchdog.ts` explicitly says it refuses to be. The
save-the-date picker allows 300 MB. On a slow uplink the bar reached 100%, the
send buffer drain plus R2's commit exceeded 45s, and a healthy, essentially
finished upload was aborted with "check your connection" — advice wrong twice
over: the connection was fine, and re-picking re-sends the same bytes.
`arm()` now takes a budget, and `upload.loadend` hands the clock to a separate
5-minute response wait. Still bounded, so a genuinely hung reply resolves.
🔑 THE VERIFICATION THAT MISSED IT IS THE LESSON. The only real-world check was
a 171 KB file completing in ~1s — the one size that CANNOT exhibit this.

**2 · A guard could not match the line it was written to catch.** Its lookahead
`(?!\s*\?)` existed so the fixed ternary would not self-trip, and it swallowed
`??` as collateral — so `photoUrl: g.photo_url ?? null`, which is *verbatim* the
Patiktok booth's pre-fix line at the commit this guard shipped with, sailed past.
Proven by running the pattern against the string from git history: false. Now
`(?!\s*\?[^?])`, and re-verified by reverting the booth to its historical bug:
the suite goes RED.

**3 · Seven facet pills printed fabricated zeros beside my own "not loaded"
line.** Same panel. "Everyone 0 · Bride 0 · Groom 0" and "Attending 0 · Pending
0 · Declined 0 · Maybe 0" rendered as ordinary live counts immediately under the
hedge. Seven confident zeros outweigh one small caveat. The pill hides its badge
when the count is undefined, so the filters still work and only the invented
number goes.

SPEC IMPACT: None.

🪤 AND THE MUTATION RUN DESTROYED THE FILE IT WAS TESTING. Backups were keyed on
`basename`, and BOTH the guest list and the Patiktok booth are called `page.tsx`
— so the restore wrote the booth over the guest list, silently, and the "baseline"
afterwards was measuring a 394-line file where 1568 belonged. Recovered from git;
backups are now keyed on the FULL PATH. This is the second time a mid-mutation
restore has eaten work in this repo.
