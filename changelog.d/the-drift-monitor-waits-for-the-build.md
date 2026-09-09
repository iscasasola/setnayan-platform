## 2026-09-09 · fix(ci): the deploy drift monitor stops crying wolf

`deploy-drift-monitor` failed on EVERY run for hours on 2026-09-09 while
production was healthy the whole time — verified against the Vercel API and the
live site, both of which showed a READY production deployment for every merge.

**The cause was one missing `--first-parent`.** `oldestPendingAgeSeconds()`
walked `git rev-list --reverse <deployed>..origin/main`, which lists every
commit the range CONTAINS — including the feature-branch commits that arrive
inside a merge — and `--reverse` puts the oldest of those first. So the "age"
was measured from the moment somebody first typed on their branch, not from the
moment main became responsible for shipping it.

Measured on the 06:02Z run: production `55e3bb7`, main `96355b9`. The old walk
picked `cadf407f9`, committed 03:29Z on a branch, and reported **153 minutes**
— matching that run's "oldest pending change merged 152 min ago". The
first-parent walk picks the merge commit, committed 06:01Z: **1 minute**,
within the grace, which is the truth.

🔑 Any pull request whose branch is older than the 20-minute grace — nearly all
of them — tripped it the instant it merged. **A monitor that fails on almost
every run cannot report a real outage**; it is indistinguishable from its own
noise. That is the disease this file was written to catch, reproduced inside
the watcher, and it is the second time: its header already records `now` having
been frozen at the git tip for the same reason.

Tested against a REAL git repository with a real three-hour-old branch commit
merged one minute ago — a stubbed git, or an assertion that the source contains
"--first-parent", would pass on the broken version too. Sabotage-checked:
dropping the flag reports 10800s instead of 60s and fails by name. A second
test proves genuine drift is still reported, so the fix cannot have silenced
the monitor.

SPEC IMPACT: None.
