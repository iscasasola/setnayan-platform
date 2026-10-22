## 2026-10-22 · feat(people): People wears the Guest list — the counts line is the top, Find-or-invite is the thumb row's field

Owner, 22 Oct: *"People must look similar to guests … Somewhat but not exactly"*, and of the view dropdown at the
top, *"remove it"*. Built to the approved prototype `prototypes/people_and_memories_template_2026-10-22.html`
(P1–P5) and its §5 capability map:

- The "Connected N ▾" dropdown is gone; the counts line ("3 connected · 1 waiting for them · 1 asking you") is the
  top and filters to exactly the rows it counts (tap again: everyone). A refused read says so — never a 0.
- Rows, folding sections, the sticky head and the glass thumb row are the Guest list's own
  (`guests-screen.module.css`, `ActionButton`, imported). Row: face · name · label pill (the editor) · "· group" ·
  round ✎ / ✕ (Send again · Withdraw on a waiting row). Requests are pinned rows with round ✓ Accept · ✕ Decline.
- THE ONE THUMB ROW (owner 2026-10-22, the Find row on every list page; `prototypes/one_thumb_row_2026-10-22.html`):
  ≡ · "Search or invite" · ＋ Invite — no band, each control its own glass, 44 px, the field ≥ 60 % (72 % at 375, 67 %
  at 320). ≡ is one dropdown: the views AND the list's Expand / Collapse all and Select. ＋ opens the invite as a
  sheet. Drawn by one small component (`(account)/_components/account-thumb-row.tsx`) so the shared row can replace it.
- Find-or-invite moved into the thumb row's field (one state: `useFindOrInvite` → `FindField` + `FindResults`);
  a name nobody has shows the invite card with its own email box.
- Loved ones (alaga, incl. a business alaga) and Your connection tree are folded sections of the list.
  Groups · Following · Followers sit under the ≡ button (the moved `PeopleViewPicker`); every `?view=` the rail
  links to still resolves.
- Row → card (P4): eyebrow · name · state pill · Together (where the request came from · Plan an event together) ·
  Label · Group · Remove. Select mode (controller, the prototype's question 1): Ask into group · Remove N — no bulk
  label.
- Dark: every surface on tokens; the framed capture card and the framed tree card are gone.
- `/dev/people-lab` draws it on fixture data. Guard: `people-wears-the-guest-list.test.ts` (row anatomy shared,
  every capability reachable, failed reads say couldn't-read).

SPEC IMPACT: DECISION_LOG row 2026-10-22 "PEOPLE WEARS TODAY'S GUEST LIST" (Setnayan-specs) — the owner's two
rulings and the controller's select-mode call.
