## 2026-08-01 · feat(ugat): the deal chain — Package · Proposal · Contract, and the break between the last two

Second map-backlog cluster. Owner chose three nodes over one journey or two halves: a package is what a vendor sells, a proposal is what they offer one couple, a contract is what both sign — three stages of one deal, each with its own rules and its own moment. Reviews fold under Vendor. Backlog **41 → 35**.

**J24 · Package → items → options.** The cluster is a TREE, not a list: items hang off a package, options off an item, and an item can hang off an *option* (`parent_option_id`). That recursion is how "pick a lunch, then pick its drink" is modelled. Flattening it loses the branch — an item reached through `parent_option_id` is *conditional* on that option being chosen.

**J25 · Package → Proposal, via template, optionally.** The only path from a package to a proposal runs `vendor_proposals.template_id → vendor_proposal_templates.default_package_id`, and `template_id` is **NULLABLE**. A freehand proposal is first-class. Any code assuming every proposal has a package behind it is wrong for that case.

**J26 · Proposal → Amendment.** A proposal keeps changing after it is sent, with amendments carrying their own line items. The base row is not the agreement; the agreement is the base plus every amendment.

**J28 · Vendor ↔ Event (review).** `override_admin_id` exists — an admin can override a review, so any rating average ignoring it reports something the vendor page does not show.

### 🚨 J27 · Proposal → Contract — the joint that isn't there

A contract carries `event_vendor_id` (the booking) and `order_id` (the money) and **no column referencing the proposal it came from**. So given a signed contract, *"what did they actually agree to?"* is unanswerable from the data — and because proposals are amendable after sending, the order amount cannot distinguish an original package from an amended one that happens to total the same.

Owner reviewed this and called it **a defect to fix**, not a quirk to live with (2026-08-01).

The joint is therefore recorded with a machine-checked `no_column` claim on `vendor_contracts.proposal_id`. That claim **asserts the absence**, which means the guard goes red the day the link lands — forcing the annotation to be rewritten rather than quietly outliving the defect it describes. A prose note would have rotted in place; this one cannot.

The fix itself (a nullable `proposal_id` FK plus wiring the contract-creation path to populate it) is a separate PR. Prod holds zero contracts, so there is no backfill.

Verified: `tsc --noEmit` clean · all six Ugat guards green on the first run · 68 `lib/ugat` unit tests green.

SPEC IMPACT: None yet — the contract↔proposal link is a schema change and lands with its own migration.
