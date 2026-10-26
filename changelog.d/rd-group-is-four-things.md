## 2026-10-26 · refactor(group): the group page is one page — members, events, stories, chat; Groups on the People list

Owner, 2026-10-26: *"Groups: We can bring in people in the group and they share the same group where there is a
place for chat, events and stories. that's it"* — and 2026-10-25, *"finding groups is so hard"*. A safe
rearrangement, no new feature, drawn from `prototypes/group_samahan_2026-10-25` (corpus 0e658e05) and
`prototypes/groups_on_people_2026-10-25`.

- `/dashboard/samahan/[communityId]` loses its tab bar (overview · usapan · members · events). The page is now the
  group's face (photo + rename in place, the description as its one line), the members row with **Bring people in**,
  then **Events**, **Stories** (the shipped strip, drawn as the prototype's ring row with "Add yours" first) and
  **Chatroom** (Usapan one tap away, its newest message as the preview) — `_components/group-home.tsx`.
- The old `?tab=` addresses still land: `?tab=usapan` is the chat, `?tab=members` the full list with the invite link
  under **Bring people in** (`#bring-in`), `?tab=events` every event; `?tab=overview` is the group page. Every
  redirect, the Usapan notice and the create-event back link keep working unchanged; rotating the invite link now
  returns to the members view, where the link lives.
- Organizer Promote · Demote · Remove are one ⋯ dropdown per member (`member-actions-menu.tsx`, same three actions).
- People: a **Groups · N** folded section after Loved ones — "New group" at its head, one row per group opening its
  page (`GroupsFoldList` / `GroupsFoldSection`). The ≡ Groups view stays.
- `/dev/group-lab` renders the group page on fixtures; `/dev/people-lab` shows the Groups section.
- Guards: `group-is-four-things.test.ts` (exactly four parts, in order; no tab bar; every old `?tab=` resolves) and
  `people/groups-are-on-the-list.test.ts` (Groups between Loved ones and the tree; New group heads it).
- Port-control baseline regenerated for the one owner-ruled removal: the `OverviewTab` block (the tab is gone; its
  contents moved — see the PR's "where each old-tab item went").

SPEC IMPACT: None — the prototypes are the corpus record; nothing in DECISION_LOG changes.
