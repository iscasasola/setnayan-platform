## 2026-08-17 · fix(exposure): unblock the storyteller-chapter PR, and answer both guards

#4471 has been open, armed for auto-merge and RED since 2026-08-15. Two guards
refused it, and both were right to.

**The new column.** `creator_chapters.host_included_at` widened the exposure
surface. I checked whether a stranger needs it before declaring it: the public
cross-rail read in `lib/storytellers.ts` runs through `createAdminClient()` — the
service role — so anon never needs the column. But this table carries TABLE-level
grants and no column ACLs *on purpose*: its own migration note records that a
column-granted table gets the WHOLE query rejected when a caller names a column it
lacks, and the page then 404s with nothing thrown. A column revoke here would also
convert the table grant into column grants for every other column. So the honest
answer is DECLARE, and the baseline is regenerated.

🔑 **Proved the regeneration absorbs nothing else:** exactly ONE new fact
(`host_included_at`), **zero** widenings, and 108 narrowings — which are batch 1's
revokes catching up. A regenerated baseline that quietly swallows a real widening is
the failure mode; this one is measured.

**The new function.** `set_chapter_host_inclusion` is anon-callable by grant, and the
guard is right that "only our server calls it" is not an answer. It RETURNS TRIGGER
and takes no arguments, so it is not an entry point at all.
⚠ I first tried to REVOKE EXECUTE rather than declare — narrowing beats declaring
where narrowing is free. **It is not free here: a blanket revoke broke the migration
replay outright, taking all six assertions red including the META one.** Reverted and
declared, with that measurement written into the baseline line so nobody repeats it.

SPEC IMPACT: None.
