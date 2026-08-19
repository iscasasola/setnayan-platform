## 2026-08-19 · fix(nav): two doors move out of the account home, before it is stripped

**SPEC IMPACT:** None — both are moves, nothing is removed.

Owner 2026-08-19: *"make the page just your events."* A 58-agent mapping pass over
every block on that page found **two things that live ONLY there.** Both move now,
so the strip that follows cannot take them with it.

### 1 · The only way to hide a story item

`optOutOfEventStory`, `hideMyStoryItem` and `unhideMyStoryItem` are each imported
**exactly once** in the whole repo — by `life-story-section.tsx`, which was
rendered **exactly once**, on the account home.

They are a person's **RA 10173 controls over other people's photographs of them**,
and the feature is **live** (the owner set `NEXT_PUBLIC_PERSON_LIFE_STORIES` in
Vercel on 2026-08-13).

🔑 **It renders for nobody today, which is exactly why it was easy to lose.** Prod
holds zero story items, so the block is invisible — and deleting an invisible
thing costs nothing until the first story item arrives with **no off switch**.

Moved to **People**, where the actions it calls already live, and where a story
item — a thing other people made that has you in it — actually belongs.

⚠ **Mounted in BOTH branches.** People returns a separate `PeoplePreview` when the
connection flags are off, and **production takes that branch**. Mounting only the
main one would move the control somewhere nobody can reach — the same defect in a
new place. `SamahanPeopleSection` already sets that precedent.

### 2 · Your year had two doors and one was a keyboard shortcut

`/dashboard/year`'s only in-app entrances were the strip on the account home and a
⌘K row. The account home's own docblock states the standard it would then fail:
**"a palette entry is not a doorway"** — the sentence it gives as its reason for
building the People tile.

So Your year gets a **rail row**, with a registry slot (renameable from admin like
its siblings — the defect the People row carried) and a match row (so the rail
lights up on the page it links to).

🛡 2 tests, 4 sabotages measured by occurrence count as landed (2→1 · 1→0 · 1→0 ·
1→0), each confirmed RED.

⏭ **Next:** the account home loses its status board, its bento, Yours to run and
People — everything now proven reachable elsewhere. Three things stay and are
named in that PR: the phone pill nav (the phone's only navigation), and the
needs-you nudge, which must be promoted out of `sm:hidden` or desktop loses the
aggregate entirely.
