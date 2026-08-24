## 2026-08-24 · fix(dashboard): the shape the guard could not see — parallel reads

The guard shipped in #4746 knew one destructure. #4752 taught it a second. It was
still blind to the shape that carries the **most** reads in this tree:

```ts
const [{ data: a }, { data: b }] = await Promise.all([ … ]);
```

**Seventy-two unbound reads** in `app/dashboard/[eventId]/**` sat inside one of
these while two passes of that guard reported the tree clean. All 72 now bind
and log. **A guard is only as wide as the shapes it matches — third time.**

And a parallel read is exactly where the case the brief actually named lives:
*"a partially-refused list must say so rather than present itself as complete —
a coordinator once read only the vendor documentation shots under a card headed
'Your gallery'."* Five screens are built from several reads at once, and when one
is refused they still render and still look whole:

- **The check-in desk** — guest list, seats, tables and who has already arrived.
  A refused check-in read shows everyone as not yet here, at the door, on the day.
- **The souvenir table** — the same four sources.
- **Who runs this event** — a co-host silently missing from the list, with
  "remove" one tap away.
- **The walkthrough manager** — zones or tables.
- **Photo moderation** — six reads. A photo that isn't listed cannot be hidden,
  and the screen gave the host no way to tell a quiet night from a refused read.

Each now says *"Some of this page is missing"* rather than presenting a short
list as the whole truth. One shared `ReadRefusedNotice` — the previous passes
hand-rolled that paragraph five times; prose can be half-deleted, a named
component cannot, and `<ReadRefusedNotice` is what the guard now looks for.

Also corrected: three short-circuit branches (`Promise.resolve({ data: [] })`)
returned a different shape from the real read, so binding the error broke the
type. They now carry `error: null` — the empty branch and the real one answer
the same question.

Guard: seventh rule, its own bill (**one entry, outside the couple's tree**) and
its own floor.

SPEC IMPACT: None.
