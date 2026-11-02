## 2026-09-18 · fix(explore): the way out of an empty marketplace actually leads out

A signed-in couple whose celebration is not a wedding had their event type
auto-applied to `/explore`. With two active services on the whole platform, both
tagged wedding, that is zero cards and a *"COMING SOON — Simple Event vendors are
being recruited"* panel. The empty state offered a way out:

```
Or browse all vendors instead →     href="/explore"
```

🔑 **That link was the trigger.** The auto-apply fires on a **missing**
`event_type`, and the escape worked by **removing** it — precisely the condition
that re-applies the scope. Following the only way out reproduced the identical
empty page. The comment above the block described dropping the parameter as the
solution; it was the mechanism.

Verified: adding `?event_type=wedding` by hand restores the cards.

⚖ **"No filter" and "I asked for everything" stop being the same state.** An
absent parameter means *"I have not chosen"* — scope me to my celebration.
`?event_type=all` means *"I chose everything"*, and beats the auto-apply. A
choice has to be expressible or the escape hatch is a loop.

`lib/explore-event-type-scope.ts` holds both decisions as pure functions, so the
guard **executes** the loop rather than grepping for its absence: it feeds the
escape link's own parameter back into the resolver and asserts the scope does
not come back.

**The guard caught a second link I had missed** — and then convicted an innocent
one. `Clear all filters` is also a bare `/explore`, but that control means "back
to the default view", and for a scoped couple the default view *is* their own
celebration. That is not a loop; the page it lands on now carries a working way
out. The assertion is scoped to the escape CTA it was written for.

Sabotage: `all` ceasing to beat the auto-apply fails 2, the href reverting to a
bare `/explore` fails 2, the page hand-writing the link fails 1, weddings
becoming auto-scoped fails 1.

SPEC IMPACT: None.
