## 2026-10-29 · fix(supplier): Events you run lists only events this shop serves

Live bug (owner, iPhone app, his own shop): supplier Today › "Events you run"
listed his OWN wedding ("Indalecio & Claire · Wedding · Co-host · 29 tasks
overdue"), though his shop is not on it and the event's coordinator is another
shop. PR #7041 (S1) had widened the run-seat rule to ANY live full co-host
seat, and a host's account holds a genuine co-host seat on his own event.

A row (the tab, the Today rows, the Events page, the customer card's "Open
their event", the Hub's check-in rows) now needs BOTH:
(a) THIS SHOP is on the event — a live `event_vendors` row (`archived_at` null)
whose `marketplace_vendor_id` is the person's active shop (`resolveActiveShop`).
`event_vendors` has no vendor SELECT policy, so that one column is read with the
admin client scoped by the session-resolved shop id and the seat read's event
ids; a refused read fails closed (no tab, no rows).
(b) the seat is one a supplier gets — the coordinator seat, or the co-host seat
the hosts granted through Home's Full access (`permissions_json.access_level =
'full'`). A co-host seat with no recorded answer is a partner's/family's own.
Everything else S1 did (window, words, Message everyone) is unchanged.

Guarded by `lib/events-you-run.test.ts` and
`app/vendor-dashboard/coordinator-door.test.ts` §8 (incl. the regression "a
host's own event never appears under their shop's Events you run"; both halves
sabotaged red once).

SPEC IMPACT: None — narrows a shipped door back to the owner's ruling
(coordinators / Full-access suppliers on events their shop serves).
