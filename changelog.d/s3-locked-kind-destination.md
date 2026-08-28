## 2026-08-28 · fix(vendor): a plan-locked kind of service leads somewhere now

In the service card maker, a kind of service greyed out because a supplier's
plan can't hold it used to explain why and stop there. Owner ruled (S3): it
should lead to "tell us what you do" — the existing category-request intake
on My Shop — not the pricing page.

- The greyed pill itself stays exactly as it was: disabled, unpressable.
- The one reason sentence beside the greyed set now links to `proposeCategory`
  on My Shop's Tools tab, which opens straight to that form.
- A supplier who follows the link gets an explicit "Back to your card" link
  back to the maker, and that intent survives the form's own redirect. The
  maker's existing draft-keep (autosave to the browser, offered back on
  return) is what actually restores their half-built card — no second return
  mechanism was added.
- Guard: `apps/web/app/vendor-dashboard/services/a-locked-kind-leads-somewhere.test.ts`
  (8 assertions, each mutation-tested).

SPEC IMPACT: None — implements an existing session-register item
(`WHATS_NEXT_Service_Card_SESSIONS_2026-08-28.md` § S3); no product-shape
decision beyond the destination the owner already picked.
