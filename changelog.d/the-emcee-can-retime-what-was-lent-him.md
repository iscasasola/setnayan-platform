## 2026-09-17 · feat(dayof): the emcee can retime the segments the couple lent him

The running order belongs to the couple. They lend it, one area at a time, through
the delegate grid — an accepted `event_moderators` row carrying `schedule: 'edit'`.
The control that acts on that loan, `ScheduleUpdater`, has shipped since the
floor-command surface was built.

It was mounted in exactly **one** place: the coordinator's surface. The host/MC's
desk read the same blocks, drew the same script, and offered no way to touch them —
so an emcee holding a loan the couple had already granted watched his own segments
run late and could do nothing.

**Nothing rendered wrongly, which is why nothing found it.** A search for the
capability finds `ScheduleUpdater` and answers "already ships"; there is no false
branch to catch, because there is no branch. Only comparing the two sibling surfaces
finds this class.

- `lentScheduleState` is **extracted** from `buildFloorCommand`, not copied — a
  second surface needing the same rule is exactly when a project grows two copies of
  it, and the copy that drifts is the one that stops refusing. The coordinator's
  behaviour is unchanged by construction.
- the host/MC desk resolves that rule and mounts the control when the loan is real.
  Nothing is drawn when it is not: no padlock, no greyed panel, no "ask for access" —
  running the programme is not that desk's job by default, and a closed panel for a
  thing he was never meant to hold is furniture.
- `ScheduleUpdater` gains `onLoan`, which renders one sentence **above** the controls:
  *"This is the couple's running order, shared with you for tonight. Anything you move
  here moves it for everyone."* It defaults false, so the coordinator's surface renders
  byte-identically — running the programme IS their job, and they do not need telling.

⚠ `'view'` is not a loan. It is permission to watch, and that distinction is the whole
purpose of the delegate grid; a gate accepting any non-null level would pass every test
that only tried `edit` and `null`.

⚠ This decides only whether a control is DRAWN. The write stays gated server-side by
`decideMayAdvance`, whose own docblock records that two earlier generations of it were
beaten by "keep the call, discard its result".

Guarded by `apps/web/lib/the-emcee-can-retime-what-was-lent-him.test.ts` — the resolver
EXERCISED across the grant × schedule space, the two mounts and the one-rule property
PARSED. Sabotage-checked five ways, each still parsing and typechecking, count printed
before the colour: `view` accepted · `onLoan` dropped · the mount gated on a constant
`false` (it stays in the file, so a mount count alone would have stayed green) · the
coordinator's mount renamed · the rule re-inlined.

SPEC IMPACT: None. The delegate grid, its levels and the server-side advance gate are
unchanged; this row only draws an existing control on a second surface.
