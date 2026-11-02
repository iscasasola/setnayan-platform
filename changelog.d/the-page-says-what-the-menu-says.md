## 2026-08-26 · fix(admin): the page says what the menu says

Follow-on to *the menu says its new name*. With the rail and the phone corrected,
the owner asked for the destinations to match too. Measuring them — live, at his
own window width — turned up more than the two surfaces I had described to him,
and corrected one thing I had told him wrongly.

**What I had said was wrong:** I reported that the *Set up* menu opens a page
calling itself "Ugat Console". It does not — `/admin/ugat` shows "Menus & icons".
"Ugat Console" is visible one level deeper, on the **entity map**, which the menu
item calls "Entity map". Measured with real layout, not read from source.

**What a census of all six landings actually found** — five pages still titling
themselves with a menu name the recut retired, and one of them now simply false:

| menu | said | now |
|---|---|---|
| Today | `Overview HQ` | `Today` |
| People & shops | `Accounts · Admin` | `People & shops · Admin` |
| Numbers | `App Performance · Admin` | `Numbers · Admin` |
| Money | `Money & Settings HQ` | `Money` |
| All surfaces | `Menu · Admin` | `All surfaces · Admin` |
| Entity map | `Entity map · Ugat · Admin` | `Entity map · Set up · Admin` |

**"Money & Settings" was not merely mismatched — it was false.** The recut moved
every settings surface out of Money and into Set up, so the page was advertising
contents it no longer has.

**Only one offender was visible on screen:** the entity map's own heading,
"Ugat Console" at 391×23px → **"Entity map"**, matching the item that opens it.
The rest are browser-tab titles and `sr-only` headings — real, but not on-screen.
Measured, because `PageMasthead` renders its title `sr-only` in this repo and an
h1 in the HTML proves nothing about what a person sees.

**Two nav items carried retired menu names and were renamed with their registry
twins** — `Overview → Today`, `App Performance → Numbers`. Moving one without the
other is precisely the bug the previous PR fixed. A scan of all 62 sidebar slots
also found one already drifting: **code `Real Stories`, registry `Stories`, the
registry winning.**

**⚠ Renaming a menu item silently deletes its old name from the search box.** A
menu item's searchable words are label + group label + description + alias — the
route is *not* among them. Typing "app performance" would have returned nothing.
Both old names are now aliases, and rule 8 fails if one goes missing.

**Guard — three rules added to `the-menu-name-has-one-source.test.ts` (now 9):**
6 · a sidebar registry slot may not disagree with the item it overlays (derived).
7 · no retired menu name survives anywhere a person can read it.
8 · a renamed item keeps its old name findable.

🪤 **Rule 7 rev 1 was decoration exactly where it mattered, and only a mutation
said so:** it walked `page.tsx` and matched `title:`, catching the five tab
titles and missing the one genuinely VISIBLE offender — JSX text in a
`_components` file. Restoring "Ugat Console" left the suite green. Widened to
walk every admin source. A companion mutation confirms it does **not** cry wolf
on the legitimate "Overview" tab name.

🪤 **And `git checkout --` during that mutation run silently reverted the
widening**, because it had not been committed — the trap already on record in
this repo. Caught by `git commit` reporting "nothing to commit". Redone,
committed first, and the guard restored from an explicit backup thereafter.

Verification: 9 guard rules, 15 mutations printed by occurrence count before →
after, all RED (plus one deliberate must-stay-GREEN). Typecheck clean. 12 lints
green. Old search words re-proved to resolve to the renamed pages.

SPEC IMPACT: None. No route, address or SKU changes; nothing renamed in the Ugat
subsystem itself — only the words a person reads.
