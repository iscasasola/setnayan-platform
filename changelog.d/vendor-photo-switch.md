## 2026-08-05 · feat: a couple can take one supplier's photos out of their gallery

When a supplier shoots at an event, their photos land in the couple's gallery.
Until now the couple's only choices were a platform-wide setting that isn't
theirs, or hiding photos one at a time — so "I don't want the caterer's shots in
my wedding album" meant two hundred taps.

There's now a switch per supplier, on the Papic page, listing only the suppliers
who have actually taken photos. Turning one off removes their photos from the
couple's gallery.

**It hides; it does not delete.** The supplier keeps their own copies — they
shot them for their own records — and nothing is removed from storage. The
screen says so, because the moment someone is exercising control over their
photos is the worst moment to be vague about what a button does.

If the check for which suppliers are hidden ever fails, nothing is hidden rather
than everything. This switch only ever removes, so failing that way shows too
much — visible and fixable — instead of blanking a couple's whole gallery
because a query stumbled.

SPEC IMPACT: DECISION_LOG row — the couple now has a per-supplier lever over
Papic captures; the platform-wide control is unchanged.
