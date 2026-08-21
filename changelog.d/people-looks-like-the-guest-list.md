## 2026-08-21 · feat(people): People wears the guest list's clothes — add first, label after

Owner, 2026-08-21: *"creating connection to them should be after they become
connected to you. just add them first. Then you can set a label. or a samahan,
just like the guest list."* · *"Add an alaga needs to be a button to generate the
wizard."* · *"we want the interface of people and guest list to be similar."*

**The model inverts.** The page used to ask *"is this your spouse, your parent or
your sibling?"* about somebody who was not on the page yet and had not agreed to
anything. Now: type a name and an email on one line, press Enter, they are on
your roster — and what they are to you is a chip you set afterwards, when there
is somebody there to be it.

That sentence was a schema change. `person_connections.relation` and `.layer`
were NOT NULL, so "on the list, unlabelled" could not be stored at all.
Migration `20271153380637` makes both nullable and adds the two guards the
nullability opens:

* `person_connections_label_pair_chk` — a label and its layer travel together or
  not at all, so no reader has to invent a rule for the half-state;
* `person_connections_unlabelled_uniq` — **two NULLs are DISTINCT in a unique
  index**, so the existing `(from, to, relation)` index could not stop the same
  person landing on the roster twice. This partial index does exactly that and
  nothing else.
* `declared_name` — the name the ADDER typed. The name-visibility rule
  deliberately refuses to resolve a real display name to the declarer before
  confirmation (2026-07-05), so without it a waiting row can only render
  "Someone", which is precisely the list the owner asked to see populated.

**The interface is the guest list's, borrowed rather than invented** — capture
bar that keeps focus so you can add several in a row · counted facet chips ·
the same `font-mono uppercase tracking-[0.12em]` table head · tier header rows ·
pill chips in the same tint vocabulary, mapped by MEANING (ninong/ninang take
the violet the roster gives principal sponsors; an alaga takes the green it gives
the bearers and flower girl) · and the chip IS the editor, opening the **shared
`<Popover>` primitive imported from the guest list**, not a copy of it, so the
two cannot drift in behaviour or a11y.

**One thing is deliberately unlike it:** a guest is the host's own record, so it
flips optimistically. A person is somebody else's account, so nothing here
pretends: the row's state says whose move it is, and "connected" appears only
when they have actually said yes.

**Add an alaga is a button.** The eight-field form no longer sits open on a page
whose job is to show you your people; it opens in the roster's own `<Drawer>`.
`AddAlagaFields` is unchanged — including the part that already behaves like a
wizard (choosing a pet hides relationship, debut year and religion).

Also: `lib/people-parse.ts` turns one typed line into `{name, email}` the way
`guest-parse.ts` turns one into a guest — and carries **no label grammar**, on
purpose: a guest is your own record, a person is somebody else's account.

Tests: 10 unit (`people-parse`), 8 db (`connection-label-comes-later`), both
migration guards mutation-measured — deleting the partial index (1→0) turns 3
tests red, deleting the pair check (3→1) turns 2 red. 36 pass across the four
person-related db suites.

Baseline regenerated (`port-control-baseline.json`): the three removed symbols
are the deleted `ConnectionsPanel` and its two types; **zero destinations lost**
— the two that changed are additions from other merged work.

SPEC IMPACT: `DECISION_LOG.md` — the add-first/label-after model, and the alaga
form becoming a button.
