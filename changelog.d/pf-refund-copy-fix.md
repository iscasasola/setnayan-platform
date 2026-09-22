## 2026-09-22 · fix(help): the two-admin article names the clause, not the figure

Follow-up to `pf-refund-threshold`. That change put **₱25,000** and **₱10,000** into the
published two-admin help article, and CI was right to refuse it.

`help-no-hardcoded-prices.test.ts` (2026-07-05) forbids any peso figure in an article body
because bodies are serialized **verbatim into FAQPage + Article JSON-LD** that answer engines
and Google quote. A stale number there is invisible until a user acts on it. A second
assertion — the retired vendor-ladder figures — caught `10,000` for the same reason.

🔑 **TWO GUARDS DISAGREED AND THE OLDER ONE WAS RIGHT.** The new guard demanded the page state
the figures, so the page and the gate would quote one number. That reasoning is sound for the
*admin console* and wrong for a *published* body: a contractual threshold can be renegotiated
exactly like a price, and then the JSON-LD is stale somewhere nobody is looking.

⚠ **Neither guard was weakened.** The resolution splits the audiences:

- the **page** carries the rule and the citation — "above the § 9.1 limit", "Both limits are
  stated in § 9.1 itself";
- the **admin console** carries the figure, printed from `REFUND_TWO_ADMIN_THRESHOLD_PHP` in
  the refusal the admin actually reads — a new assertion holds that, because a gate that
  refuses without naming its limit leaves the admin unable to tell whether the form or the
  limit is wrong;
- **§ 9.1** stays the single source of the number.

The conflicting assertion is **replaced and its history kept in place**, so the next person
does not re-derive "the page should print the number" and re-break the build.

Also regenerated `lib/admin-map/admin-jobs.generated.ts` — the new `executeLargeRefund` export
is job 321. ⚠ That registry names the function as DATA, which is exactly the shape that once
made the money-gate guard report a phantom second door; the reachability check added yesterday
asks whether a file **calls or imports** the symbol, and correctly ignored it. Verified after
regeneration, not assumed.

SPEC IMPACT: None.
