## 2026-08-13 · fix(copy): finish the Stories rename — 16 customer-facing surfaces the first pass missed

Follow-up to PR #4388 (redesign Session 3). That PR renamed the stories shelf and **I verified it on the live site afterwards, which is the only reason this was found**: `www.setnayan.com/realstories` still served a footer link reading *Real stories*.

### 🔑 Why the first sweep missed them — the variant it never searched for

The first pass swept for **`Real weddings`** and for the page title **`Real stories · Setnayan`**. The shelf's own navigation link is the bare string **`Real stories`**, and the couple's consent checkbox says **`Feature our story in Real Stories`** — neither matches either pattern. The rename landed on the pages and missed the doorways to them.

**That is the same defect shape this project keeps paying for**, one level up: not *a name left behind*, but **a sweep whose pattern could not match the name left behind**. A search that cannot match is not a negative result. Three passes were needed here; each one found surfaces the previous pattern was blind to, which is itself the argument for enumerating render sites rather than grepping one phrase.

### What a person would have seen

| Surface | Read | Now |
|---|---|---|
| Public site footer | *Real stories* | **Their stories** |
| Couple's consent checkbox, in their own dashboard | *Feature our story in Real Stories* | **Feature our story in Stories** |
| …and its help text | *the public Real Stories gallery* | **the public Stories gallery** |
| **Notification sent to the couple** | *Your wedding is featured on Real Stories* | **…on Stories** |
| **Notification sent to the storyteller** | *Your chapter is featured on Real Stories* | **…on Stories** |
| Couple's editorial editor toasts | *featured in Real Stories* / *Removed from Real Stories* | **…in / from Stories** |
| Error shown to a couple | *Real Stories features weddings only.* | **Stories features weddings only.** |
| Creator dashboard | *may feature standout chapters on Real Stories* | **…on Stories** |
| Public `/creators` page (3 places) | *Featured on Real Stories*, *Real Stories showcase*, *See Real Stories* | **Stories** |
| Vendor's own Stories page | title, heading, two body strings | **Stories** |
| Vendor shop nav row | *Real Stories* | **Stories** |
| App nav registry + route meta (5 labels) | *Real Stories* | **Stories** |
| Screen-reader labels on both search boxes | *Search real stories* | **Search stories** |
| `llms.txt` site map | *[Real Weddings]*, *[Journal]* | **[Stories]**, **[Articles]** — both names were already retired |

**Two of these are messages we SEND**, not pages someone browses — a couple and a storyteller each get told their story is featured. Those name the product back to a customer, so they were the least acceptable to leave stale.

### Deliberately NOT changed

- **Admin operator surfaces** (`/admin/real-stories`, `/admin/studio`, moderator confirm dialogs, user-report actions). Internal vocabulary, no customer reads it, and the route is the address.
- **`lib/blog.ts`'s `Real Weddings` article category.** A different taxonomy — it categorises *our articles about weddings*, not the couples' own stories shelf. Renaming it to "Their stories" would be wrong, and its key is an address (`?category=real-weddings`). Left as an editorial decision, not swept in silently.
- **Prose meaning "genuine weddings"** in help copy and article bodies (*"clips of real weddings, not a polished reel"*). That is the ordinary adjective, not the product name.
- **Routes and addresses** — `/realstories`, `/vendor-dashboard/real-stories`, `?category=real-weddings` are all untouched. Nothing a person has bookmarked or printed moves.

**Verified:** typecheck clean · all 16 `lint:*` guards pass · 7,746 unit tests pass.

SPEC IMPACT: None beyond the naming already recorded for Session 3 — this completes it. No SKU, price, schema or address change.
