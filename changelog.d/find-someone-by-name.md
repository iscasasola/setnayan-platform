## 2026-08-21 · feat(people): find somebody by name and pick them — and the empty table shows its own columns

Owner, 2026-08-21: *"we can search all users of that name as well. so they can
also add manually instead of email address"* · *"it will show all people with
that name and pick the person they want to add"* · *"just like facebook."*

Type a name into the same one line that already takes an address. Matches appear
underneath with a face, the name, and **why you might know them** — *"In Barkada
'08"*, *"Both at Maria & Jose"*. Tap **Add** on the right one. No email needed.

### ⚖ This is a change of posture and it needs saying out loud

`visible_connection_names` has carried this sentence since 2026-07-05: *"name-only,
confirmed-only, self-scoped — **never a browsable directory**."* Searching all
accounts by name **is** a directory. The owner — the NPC-registered DPO — asked
for it in those words, so it is built. Everything else in that rule is untouched
and still enforced:

* a result carries a **name, a photo, a public id and a hint** — never an email,
  a phone number, a slug, a raw `user_id`, their events, or anyone's connections;
* finding somebody lets you **ask** them. The mutual confirmation is unchanged.

### Five refusals, and only one of them is a preference

`discoverable_by_name` (migration `20271155742397`, **DEFAULT TRUE** — findable
is the default, as asked) is the person's own switch, with a plain-English pair
of buttons on the profile. The other four live in the query because they are
about the query: **no display name** (nothing to match, nothing to show),
**anonymous drafts** (somebody who has not secured their account has not chosen
to be anywhere — same `isPlaceholderEmail` test the email sender uses, so the two
can never disagree about who is real), **yourself**, and **anyone already on your
list**.

🔒 **A search is not an oracle.** An opted-out account, a name nobody has, and a
name only anonymous drafts carry all return the same empty list, with the same
sentence.

### 🚨 The escape this codebase has already paid for

`%` and `_` are ILIKE **wildcards**. Unescaped, a typed `%` searches for
*everybody* — the whole users table, ten rows at a time — and `_` quietly matches
any character, which is exactly how the admin shop-address correction could move
a **different** shop (2026-08-12). Escaped once, in a pure module split out of
the server-only file specifically so it could be tested, and proved from both
ends: unit tests on the escape, and db tests that seed a person actually named
`Maria %_ Test` so a wildcard search must return *her* and nobody else.

Mutation-measured: removing the escape (**1 → 0**) turns **5 tests red** across
both files.

### Also: the empty table (owner, same day)

*"we want to see the empty table if they have no people yet."* The roster now
renders its columns — Name · Label · Samahan · Status — with the empty message
**inside** the table body. The columns are the explanation: somebody who has
added nobody can see that a row will carry a label, a samahan and a status, which
"Nobody here yet" never told them. Floated above the table instead, the headers
would sit over nothing and read as a rendering fault. A filter chip that matches
nothing gets its own sentence rather than the first-run one.

⏭ **Named, not fixed — a separate finding.** The live `/privacy` page promises
*"A request nobody answers, and a connection that is declined, are both deleted
after 30 days."* **No such job exists** — no `DELETE FROM person_connections`
anywhere in the migrations, and no sweeper in the app. Nothing is stranded today
(production holds zero connections), but that is a printed promise nothing keeps,
and it is the same family as the retention-copy trap the repo already guards.

SPEC IMPACT: `DECISION_LOG.md` — people are findable by name by default, the
2026-07-05 "never a browsable directory" clause is superseded by owner ruling,
and the opt-out that comes with it. The `/privacy` connection-tree section will
need a line about being findable once the owner confirms the wording.
