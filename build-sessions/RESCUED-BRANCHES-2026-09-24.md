# Five branches that existed only on one Mac — what is in each

> **Swept and pushed 2026-09-24**, before this account was handed over. Every commit below was on
> **one machine's disk and nowhere else** — four of the five branches had never been pushed at all
> (`NO-REMOTE`), and two carried uncommitted files on top. They are on the remote now.
>
> 🛑 **None of these is finished, none is reviewed, and none has a PR.** They are preserved, not
> proposed. Read the diff before building on any of them.

## The sweep that found them — run it before ending any session here

```bash
git worktree list --porcelain | grep '^worktree ' | sed 's/^worktree //' | while read w; do
  br=$(git -C "$w" rev-parse --abbrev-ref HEAD); [ "$br" = HEAD ] && continue
  d=$(git -C "$w" status --porcelain | grep -vcE '^\?\? (node_modules|\.next)$')
  git -C "$w" rev-parse --verify -q "origin/$br" >/dev/null \
    && u=$(git -C "$w" rev-list --count "origin/$br..HEAD") \
    || u="NO-REMOTE:$(git -C "$w" rev-list --count origin/main..HEAD)"
  [ "$d" != 0 ] || [ "${u#NO-REMOTE:}" != 0 ] && echo "$w $br dirty=$d unpushed=$u"
done
```

🔑 **`NO-REMOTE` is the dangerous row** — a branch git has never pushed anywhere. This machine runs
~40 worktrees at once, so a session that ends without pushing leaves no trace anyone else can find.

---

## `s41-wip` — 2 commits · 97 files · +699/−82

*"wip S41 all money edits"* · *"wip S41 booking edits"*

The largest and the coldest — last touched 2026-09-19. Touches editorial data, the story spine,
`your-own-day.server.ts` and `_actions/run-of-show.ts`. **97 files of money and booking edits with
no PR and no description beyond "wip".** Whoever owns S41 should say whether this is superseded
before anyone reads 97 files.

## `claude/the-gift-is-a-switch` — 2 commits · 20 files · +714/−128

*"the switch exists in the database, and `save_vendor_service` stops refusing a giftless publish"*
then *"wip: stopped mid-flight — **superseded by PR #5375**, kept only so nothing is lost"*.

⚠ **Its own commit message says it is superseded.** Check #5375 first; this may be nothing but a
record. It is the second-coldest at 14 days, and the 3-day snapshot window used to hide it —
see [[a-recency-filter-hides-the-most-endangered-row]] in memory.

## `rd/closing-copy-says-who` — 3 commits · 7 files · +557/−5

*"a withdrawn conversation offers nothing"* · *"the server refuses a withdrawn conversation too"*

The most finished-looking of the five: both surfaces (`dashboard/[eventId]/messages` and
`vendor-dashboard/messages`), a shared `thread-closing-copy.ts`, and its own guard
`a-withdrawn-thread-offers-nothing.test.ts`. Client and server both closed. **This one looks ready
for a PR** — verify it against `main` and open one rather than rebuilding it.

## `claude/papic-drops-the-back-link` — 2 commits · 9 files · +251/−35

*"sheets clear the bottom nav, look picker uses a real photo"*, plus a preservation commit holding
four files that were loose in the worktree.

⚠ **The second commit is unreviewed working state**, not a considered change. It was committed only
so it would survive. `apps/web/app/globals.css` is in it.

## `claude/front-door-drops-hero-for-anchor` — 1 preservation commit · 4 files · +280/−4

`nav-fab.tsx`, `globals.css`, a new `the-bar-outlives-the-slide.test.ts` and its changelog fragment
— loose in the primary checkout, never committed.

Two things were **deliberately left out** of that commit and remain uncommitted in that tree:

- `.claude/launch.json` — local editor config, not a change.
- `supabase/security/prod-schema.snapshot.txt` — a **generated** baseline, +1360 lines. Regenerate
  it on the merged tree; carrying a stale regenerated baseline forward can silently restore what
  another PR deleted.

---

## Why this file exists rather than five PRs

A PR asserts *"this is ready"*. None of these is, and opening five would put unreviewed work in the
merge queue and hide the finished ones. A PR also decides the shape of a change somebody else was
mid-thought on.

⚠ **And a branch alone is not a handoff.** `s41-wip ahead 2` in a snapshot tells the next account
nothing about what is in it or whether it matters. **The rescue is only complete when somebody can
tell, without reading 97 files, whether to keep going.** That is what the sections above are for.
