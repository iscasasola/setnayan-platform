## 2026-09-21 · feat(profile): a formal name on the profile, the @tag, and search by all three

The profile gains a **Full name** group — Prefix · First · Middle · Last ·
Suffix (`users.name_prefix/first_name/middle_name/last_name/name_suffix`, same
columns and 80-char cap as `guests`). Display name stays the nickname. The
handle (`users.slug`) is now labelled **Account name** and shown as **@tag**.
Self-declared, never verified (owner).

When the five parts are blank, the form is PRE-FILLED — not saved — from a
guest row already linked to the account through `guests.person_id` (the
couple's own groom/bride/celebrant row first), with a note naming the event.
Only the name travels; meal/allergies keep their own consent path.
`lib/formal-name-from-guest-list.ts`.

People search now reads a generated `users.name_search` (nickname + five parts
+ slug, lower-cased), one escaped ILIKE per word, so "Indalecio", "Ice
Casasola", "Casasola Ice" and "@ice" all find the same person. A result shows
nickname, @tag and — when it differs — the full name.

Pure rules in `lib/formal-name.ts` (+ tests); search tests extended.

SPEC IMPACT: `DECISION_LOG.md` row 2026-09-21 "THE PROFILE CARRIES A FORMAL
NAME, AN @TAG…" — four owner rulings (nickname stays; @tag = slug; search shows
all three; add-from-people copies the name + links the account, never auto-
imports meal/allergies/photo). The add-from-people half is recorded, not built.
