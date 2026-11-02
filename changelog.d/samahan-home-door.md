## 2026-07-15 · feat(samahan): home door — Spaces tile goes live (PR-4 of the minimal cut)

THE FLIP. PRs 1–3 shipped dark (schema + unlinked routes + community-event
context); this is the flag flip — the link itself (plan §4c). The launcher
Spaces tile now opens the Samahan door for every user.

- **`fetchUserCommunities(supabase, user.id)` joins the page `Promise.all`** with
  the launcher's graceful-degrade idiom (`logQueryError` + `[]` fallback), so a
  pre-migration environment or an OAuth-race read still renders the create-only
  Samahan section instead of the error boundary.
- **The Spaces tile renders for EVERYONE** — dropped the `spaces.length > 0`
  gate. Vendor shop / admin HQ rows stay capability-gated INSIDE the tile (a
  plain couple sees neither); the Samahan portion always renders so the create
  door exists for a plain couple.
- **Samahan section replaces the "Coming soon" note**: up to 3 `SpaceRow`s
  (icon Users · title = name · subtitle = `Organizer · N members` / `Member` ·
  href `/dashboard/samahan/<id>`), a "N more samahans" overflow row into the
  index when >3 (the `MAX_SHOP_CARDS` cap idiom), then a muted "+ Create a
  Samahan" door (`CreateSamahanRow`, dashed Plus chip). Zero communities keeps
  the section label + "A shared space for your barkada, parish, or clan." + the
  create door.
- **HomeCommandBar** gains one jump item per samahan (findable by name, ⌘K)
  plus a "Create a Samahan" destination — same mapping shape as `spaces.map`.
- **Doc comment** four-surface SPACES note rewritten (load-bearing docs).
- **RA 10173**: only display name + role + member count reach the DOM — no
  emails, photos, or user UUIDs.

Also in this PR (owner directive 2026-07-15 — one home for overdue counts):
**removed the duplicate attention/overdue signal from the event cards**. The
Watch owned attention on desktop (per-event `total` rows + the aggregate) AND
the `GlassEventCard` `AttentionPill` re-rendered the same `decisionByEvent`
summary; on mobile the nudge row AND the `MobileEventHero` "N overdue" fact
doubled up. Ruling: The Watch (desktop) / the nudge row (mobile) own attention
signals — event cards keep identity/type/date/progress only. Removed the
`AttentionPill` from `GlassEventCard` (+ its now-dead `decision` prop) and the
`overdue` fact from `MobileEventHero` (+ its now-dead `overdue` prop).
`decisionByEvent` / `checklistByEvent` stay (The Watch still consumes them);
`AttentionPill` stays (still used by `SpaceRow`). Net: exactly one overdue
surface per viewport.

SPEC IMPACT: `Samahan_Minimal_Build_Plan_2026-07-15.md` §4c shipped as specced;
the minimal cut (PR-1..4) is fully landed. A `DECISION_LOG.md` row is appended
in the corpus (Samahan minimal cut shipped; nesting + chat + invite-as-group
deferred). The home overdue-count de-dupe is an owner directive, not part of the
Samahan plan.
