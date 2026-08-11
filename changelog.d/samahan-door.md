## 2026-08-11 · fix(people): the People page stopped hiding samahan behind a coming-soon preview

**The owner asked "how do i find my samahan". This was the answer.**

`app/dashboard/(account)/people/page.tsx` returns early when the connections AND
dependents flags are both off:

```
if (!showConnections && !showDependents) return <PeoplePreview />;
```

…and `PeoplePreview` never rendered `<SamahanPeopleSection />` — even though the same
file's own comment says samahan is *"Not flag-gated — samahan is live product."*

So the **phone pill nav's People target** — the most thumb-prominent People door in the
app, and one of the four the nav's docblock calls *"four honest targets"* — told a user
who had samahans:

> "There's nothing to do on this page yet."

**Two features were gated together and only one of them was ever supposed to be.** Samahan
has its own routes (`/dashboard/samahan`, `/new`, `/[communityId]`), its own library, join
tokens and event-creation context. None of it is behind a flag. It was reachable from the
home board's People tile the whole time — but not from the door labelled People.

### The fix

- The preview now renders `<SamahanPeopleSection />` **first**, because it is the part that
  actually works. The section carries its own "Create one" door when the user has none, so
  it is never dead weight.
- **The false sentence is gone.** "There's nothing to do on this page yet" was untrue for
  anyone with a samahan, and it is the exact sentence the owner read. The coming-soon
  wording is now scoped to **connections**, never to the page.

### 🔑 Why the guard matters more than the fix here

The connections and dependents flags were switched **ON in production hours after this bug
was found** (owner/DPO ruling, same day). That means **the preview branch is not currently
reached and the bug is MASKED, not gone** — nobody can reproduce it now, and the next
person to turn a flag off for a legal review, a rollback or a staging environment silently
restores it.

`people-preview-shows-samahan.test.ts` — 3 tests, both mutations verified applied before
the red was trusted:

| Mutation | Result |
|---|---|
| drop `<SamahanPeopleSection />` from the preview (the original bug) | **1 fails** |
| restore "nothing to do on this page yet" | **1 fails** |

It is a **source scan** on purpose: the hazard is a component that isn't rendered, so there
is nothing to observe at runtime — a unit test of the preview would assert whatever it
currently returns and pass either way. Comment-stripping goes through `lib/strip-comments.ts`
so the test does not trip on its own explanation of the bug.

### ⏭ Not fixed here, and bigger

Fable's ecosystem pass found the reason **all six** of the owner's navigation questions had
no good answer: **single-event, non-console couples never reach the home board at all.** The
landing rule bounces them into their event and the account switcher's Home button bounces
them back, so Alaala · People · Samahan · Creator's Lab are unreachable for the core
persona — and for every couple after their wedding. His own 2026-07-04 ruling was *"keep
auto-jump, hub reachable"*; only the first half shipped. That needs a structural decision,
not a patch.

SPEC IMPACT: `DECISION_LOG.md` — recorded 2026-08-11 with the ecosystem analysis.
