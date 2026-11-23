## 2026-11-23 · feat(plans): the supplier plans sell at the owner's final prices, monthly only

Owner, 22 Nov 2026 (DECISION_LOG "SUPPLIER PLAN PRICES, FINAL" and "NO YEARLY SUPPLIER/COORDINATOR PLAN ANYWHERE"): Plus, Pro and Ultra are paid every 4 weeks. There is no yearly plan and no add-on. Subscriptions PR 1a-2, stacked on #8186.

- **Migration `20271360321657_supplier_prices_final_monthly_only`** (do-not-auto-merge):
  - sets the three monthly rows of `vendor_billing_catalog` to the owner's final prices (Plus, Pro, Ultra);
  - retires the three yearly rows, the Ultra extra seat and the Ultra extra branch: off sale, with `retired_at` and a reason, never deleted;
  - refuses to run if any shop holds, or is scheduled onto, a retiring row, or owns bought seats (measured: none);
  - checks afterwards that exactly the three monthly plans are on sale at the final prices.

  Rows already paid keep the amount they were charged. What the shops already on Plus pay at renewal is a separate owner call, and nothing here changes an existing subscription.
- **The Plan sheet has no year switch.**
  - Every price is per 4 weeks.
  - The "plan is shorter than your time" refusal no longer sends a shop to a yearly plan.
  - Plus is shown while its monthly row is on sale. Before, it was keyed on the yearly row, which would have hidden Plus once that row retired.
- **No yearly price anywhere a supplier or a search engine reads:**
  - the /for-suppliers plan table (the "Pay for the year" row is gone);
  - /pricing (the words and the yearly schema.org offers);
  - llms.txt (the plan sentences; the yearly rows and the branch are no longer required rows, because a retired required row would have dropped the whole document to its stub);
  - the help page and the supplier feature page, in English and Filipino;
  - the yearly fields of `getVendorPrices` and of the /for-coordinators price read.

SPEC IMPACT: None. This builds the 22 Nov DECISION_LOG rows "SUPPLIER PLAN PRICES, FINAL" and "NO YEARLY SUPPLIER/COORDINATOR PLAN ANYWHERE" as ruled. The renewal price for shops already on Plus stays the owner's open call.
