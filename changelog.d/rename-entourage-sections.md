## 2026-10-19 · feat(entourage): the couple renames their entourage's section headings — on Guests and in the Maker

Owner, 2026-10-19, on the guest Event Hub's entourage: *"Immediate Family change it to VIP."* → *"or how can we rename
this?"* → *"on guests?"* — and *"keep the mapping consistent"*.

- **One value.** A section heading is stored beside the role words in `events.role_names`, under its own key space
  (`section:<entourage group key>` → `{ one }`) — no migration (the column has no key CHECK). Read through the one
  sanitiser (`readRoleNames`, now section-aware) and written through ONE compare-and-set writer
  (`lib/role-names.server.ts` `writeRoleNames`) — two hosts never overwrite each other. Empty = the usual heading.
- **One resolver.** `lib/entourage.ts` `groupHeading` asks `sectionName` first, so every heading built by
  `buildEntourage` / `entourageGroupLabel` says the couple's word: the invitation's entourage (On the axis, Lines; the
  Post Event entourage views read the same `group.label`), the Wedding March (printed and march-only sections), /everyone,
  the prints. `lib/role-groups.ts` `roleGroupLabel` builds the role-group headings that are MADE of a section from the
  same word (`ROLE_GROUP_SECTION_PARTS`: VIP · Immediate Family, Principal / Secondary Sponsors, Nikah Principals,
  Bearers & Flower Girl, Officiants & Readers) — the guest list's group headers, the studio's attire rows, the dress
  code's rows. The seat plan's "Immediate family (both sides)" switch reads it too.
- **Door 1 — Guests.** Under a guest's Role dropdown: "Rename this role" (restored — the shipped control was deleted with
  the retired roster on 2026-10-09) and "Rename this section", two typed Form rows (`CardRename`, the Guests pages' kit
  only — nothing added to the Maker's first load).
- **Door 2 — the Maker.** The Wedding March part's Edit keeps its door in row 1 and gains Section ▾ (every heading the
  page draws) + Heading (typed in place) in rows 2–3. A DRAFT like every Maker edit (`role_names`, section keys only);
  the host's canvas draws it (`lib/drafted-role-names.ts`); ✓ Apply writes it through `writeRoleNames`.
- Guard: `lib/section-names-reach-every-surface.test.ts` (iterates every section key; the mapping is a derived property).

SPEC IMPACT: DECISION_LOG row 2026-10-19 "THE COUPLE NAMES THEIR ENTOURAGE'S SECTIONS" (corpus) — a new owner-facing
capability; no locked decision changed.
