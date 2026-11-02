## 2026-08-11 · docs(papic): the product is just "Papic" — and llms.txt was refusing to serve

Owner: *"Papic Pool will just be papic now."* The naming sweep the previous three PRs deferred.

🚨 **AND IT WAS NOT ONLY NAMING — `/llms.txt` HAD STOPPED SERVING ITS PRICE FILE.** Its
`REQUIRED_RETAIL` list named three SKUs the one-product change retired (`PAPIC_ONE_100`,
`PAPIC_CAMERA_MINI_DAY`, `PAPIC_GUEST_6K`). A guard added on 2026-08-11 throws `RetiredSkuError`
when a required code goes inactive, and the route then falls back to the SHORT pointer file —
**"serve less rather than serve wrong"**, working exactly as designed and completely silently.

So every AI assistant reading the site had been getting the stub since that merge. Fixed the way
the guard's own comment prescribes: **delete the prose line and the list entry together**, never
add an exemption. The two new rungs joined both. 🔑 The guard is the reason this was a five-minute
find rather than a slow discovery that llms.txt had been quietly wrong for weeks — the same class
of failure it was written for, catching a case its author had not seen coming.

⚠ **Its test fixture now carries the retired codes as `is_active: false`**, so "a retired SKU must
not be advertised" has a REAL case to catch instead of a hypothetical one.

### What a person now reads

- `/papic`, `/pricing`, the features page (**English and Tagalog**), the couple's onboarding, the
  admin service labels and the order descriptions on a bank transfer all name **Papic**, once.
- The help article *"Papic Pool or Papic One — which one do I want?"* answered a question that no
  longer exists. **Rewritten, not deleted** — the underlying worry is real and people still have
  it — as *"How do I make sure one person never runs out of shots?"*, under an accurate slug, with
  a **301 from the old one** so a bookmark lands on the answer rather than a 404.
- *"What is Papic?"* now describes one pot, shots you can set aside, and free unlimited cameras.

### Deliberately left alone

- **`papic_seats`** stays as an identifier. It is written into every onboarding draft ever saved;
  only its LABEL moved. Renaming it would orphan live rows.
- **`papic_tier_config.display_title` = "Papic One"** for the `mini` tier — a mirror of a live DB
  value with a guard pinning the two together. Moving it is a migration, not a copy edit.
- **Code comments and log lines** naming the old products where they describe history accurately
  (the Ugat map's note on why the `papic_guest_*` tables are not product names is the clearest).
- **The onboarding `one` copy entry** — a dead key kept only because the type union still permits
  it, marked as such so nobody reads it as a live product.

SPEC IMPACT: `DECISION_LOG.md` (2026-08-11 · the product is "Papic"; "Pool" and "One" retire as
names) · corpus `CLAUDE.md` Papic sections.
