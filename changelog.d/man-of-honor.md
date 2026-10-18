## 2026-10-19 · feat(guests): a Man of Honor — the bride's side gets a man's word, like Best Man / Best Woman

Owner, verbatim (DECISION_LOG 2026-10-19 "A MAN OF HONOR"): *"we give them a choice maid/matron/man of honor. so they
can have male/female version like bestman and best woman"* · *"so maid/matron of honor can have the same character.
both female. but also want a man of honor option"* · *"please add that on the dress code and keep the mapping
consistent and don't let me trace it and tell you to map it properly."*

- **New guest role `man_of_honor`** (migration `20271277879483_guest_role_add_man_of_honor`, enum value only) — the
  bride's side (group Bridesmaids / the couple's crew), sorted after the matron; same march column (the bride's), colour
  slot (`maid_of_honor`, now "Maid / Matron / Man of Honor"), seat tier, invited-to blocks, seating set, emcee billing,
  editorial badge, onboarding word, search alias ("moh") as the maid and the matron. Figure / 3D seat plan / Role ▾: a man.
- **Host seat** `man_of_honor` beside `maid_of_honor` (migration `20271278367143_host_roles_add_man_of_honor`, CHECK
  widened from the latest definition), the best woman's mirror: edit, no checkout.
- **Role pickers**: the either-or set is now Maid / Matron / Man of Honor ("Maid, matron or man of honour"); the sets
  hold any number of words (`ROLE_ALTERNATIVES`).
- **Entourage / Wedding March**: he stands in the maid's column and, like the best woman, names himself in the heading
  ("Man of Honor & Best Man", "Maid of Honor / Man of Honor & Best Man").
- **Dress code**: the shared honour row "Maid of Honor & Matron of Honor" gains a FOR MEN column (the best man's list —
  Suit and tie · 3-piece suit · Barong Tagalog · Tuxedo, drawings #02/#21/#22/#23); FOR WOMEN stays the maid and the
  matron (one woman, one pick, stored where it always was). The FOR MEN column is drawn only when a man of honor is on
  the guest list or the column holds a pick, and never inherits the maid's Wear. Title: "Maid, Matron & Man of Honor"
  when he is there, else "Maid of Honor & Matron of Honor". Second pick stored in `dress_code_config.women.roles.maid_of_honor`
  (the best man row's shape). Undressed, he keeps the crew's look (unchanged fallback).
- **Audit fixes on the other honour roles**: the best woman's guest-page figure is now her Studio column's (the maid of
  honor's — it had none); Me › What to wear's "has a Wear" now reads the reader's own column (a best woman or a man of
  honor was told they had a Wear because the other column had one); `readerPick` picks a column by who it dresses, not
  by position.
- **Guards**: `lib/every-role-is-mapped-everywhere.test.ts` (every enum value read from the migrations; universal,
  printed and gender maps; every honour role resolves to the same row / key / label / designs / person in the Studio,
  the guest page and the prints) and `tests/db/every-guest-role-has-its-words.db.test.ts` (replayed enum = ROLE_LABELS).

SPEC IMPACT: None beyond the owner's own DECISION_LOG row (2026-10-19 "A MAN OF HONOR", corpus commit 63c499f9), which
this implements; the title decision ("Maid, Matron & Man of Honor") and the FOR MEN column's visibility rule are recorded
in the PR body for the owner's sign-off.
