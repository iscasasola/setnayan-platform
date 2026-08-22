## 2026-08-20 · feat(story): only me · the people of this celebration · everyone

**Owner, 2026-08-20:** *"they also get to choose whether it is only me, private
(all in that event only), public."*

The composer now asks **"Who can read this?"** and offers exactly those three.
It replaced a Publish button and a "Move to draft" button — two doors onto one
question, with no way at all to say the middle answer.

### 🔑 Three values of ONE column, and the reason is which way it fails

Ten shipped read paths ask `status = 'published'` — the public profile, the
chapter page, the share card, the Real Stories shelf, the storyteller search,
the follower notification, analytics, attribution, the host's curation screen,
and the RLS policy itself. As a third **status**, an event-only chapter is
refused by every one of them **without being edited**, and by every read path
written in future. As a separate `audience` column, all ten would have kept
serving event-only chapters to the internet until each was found and changed —
and the eleventh would leak forever. **The safe direction is the one where
forgetting means hiding.**

⚠ The stored word `draft` now carries a second meaning; the screen never says
it. A person reads *Only me · The people of this celebration · Everyone*.

### 🔒 "The people of this celebration" is not "whoever opened the page"

Two of six production events are **public**, so on those pages a passer-by is
just a visitor. An event-only chapter placed there without an identity check
would be published to the internet under a word promising the opposite. The
event page loads these stories **only** for a viewer the database recognises:

- the host · a booked supplier · a guest carrying their pass · **a signed-in
  guest holding a seat**

🪤 **The fourth is the one that would have been missed, and it is the most
ordinary person in the list.** The guest pass is a cookie with a hard 60-day
life carrying one event, while save-the-dates go out 6–12 months ahead — so the
invited cousin is usually a signed-in account with a seat and no cookie. The
seat lookup already existed; it only ever ran inside the private-event gate,
which never runs on a public event at all.

### Also

- **Sharing with one celebration never touches the public page.** Only
  "Everyone" flips a profile public or notifies followers — doing that for the
  middle answer would be the opposite of what the person just asked for.
- **The host still decides what appears on their day.** These stories are
  filtered on `host_included_at`, the 2026-08-15 ruling: attaching is the
  author's act, appearing where Setnayan speaks about the celebration is the
  host's. A couple's own chapter is stamped automatically by the database.
- **A link is offered only when the chapter's page would really open** — an
  event-only piece has no public page, and a link to one is a dead end dressed
  as a story.
- 🪤 **Detaching the celebration drops the chapter back to "only me"** — via a
  trigger, because the constraint alone would have refused a legitimate unlink
  and told somebody their own save was invalid, with nothing on screen able to
  explain it. A direct write claiming an audience with no celebration lands as
  "only me": of the two possible wrong answers, that is the one nobody else can
  read.
- The "needs a story before anybody else can read it" rule is **widened** from
  `published` to both shared answers, and its constraint renamed accordingly —
  a name saying "published" had become a lie about its own scope.

**Verification.** 8 new db tests doing real reads under `SET ROLE anon` and
`SET ROLE authenticated` — including the two that matter: *a stranger to the
internet cannot read an event-only chapter* and *another signed-in account
cannot either* · 14 source guards · 910 app tests · typecheck clean · lints
clean. Port-controls baseline regenerated: **the only removals are the two
intended** (`publishChapter`, `unpublishChapter`).

⏭ **Named, not built:** the tie-break when two chapters share one celebration
(a couple's own and their photographer's) — they resolve to the same day and
fall to publish order; on the event-side list it should be the host's own first.

SPEC IMPACT: `DECISION_LOG.md` — the three audiences and why they live in one
column.
