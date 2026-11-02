## 2026-10-13 · feat(supplier): Customers = People · Dates · Money — People in the approved look; the Clients page retired into it (S-PR2)

Corpus `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 6 row S-PR2 (prototype frame 03), in the 2026-10-12
look calls and control templates round 2 (kind 30 Search box). Stacked on #6497 (S-PR0 + S-PR1).

- **Segments.** Customers is one pill track — People · Dates · Money — each with its own address (`?seg=`,
  `customers/segments.ts`). One table maps every old `?tab=` / `?open=` key (the redirect stubs, the folds) to the
  segment that draws it; the anchors table carries `seg` on every landing (`#payday` → `?seg=money#payday`), because
  a fragment never reaches the server. **Each segment reads only what it draws**: People no longer pays for the
  month's day states, waitlist, services and team; Dates no longer pays for the roster. "People 3" = the waiting count.
- **People** (frame 03): hairline rows — avatar · name · type · date · place · the shared `Badge` (Asked · Booking ·
  Holding · Talking · Quoted · Booked · Done · Outside) · one right-hand line (waiting / the fuse / quiet N days /
  quote pending / the money) · terracotta arrow; the row is the one tap. Filter ▾ sits in the "Waiting first"
  eyebrow (44 px); Show ▾, the ⋯ menu, the in-list search form and the three summary tiles are gone (plan § 2).
  The date-clash warning is one warn row. This year's dates drop the year.
- **Thumb row** = the new shared **`SearchBox`** (`app/_components/search-box.tsx`, kind 30: pill, magnifier, ✕
  with the first letter, results as you type via the address, a plain GET form without script, matching letters
  terracotta, "N of M customers") + **Add** (brand) → a sheet of Form rows posting the shipped `importExternalClient`.
- **Clients page retired** (`clients/surface.tsx` deleted; the stub forwards to People). Its booked and
  in-conversation customers are roster rows; "Quoted" now shows on the roster (one batched read per page); a
  booking the couple confirmed received is **Done** (the shared `rowReadsCompleted`, handed into `customerLaneOf`);
  outside clients are People rows that open in place with Remove (asks once, comes back to People with a toast);
  kept notes are a fold at the foot.
- **Honest money:** an unread payday says "couldn't load" on every booked row — it used to say "No plan yet".
- **Dates / Money** carry the existing month + QR codes / Bookings + Payday unchanged (S-PR3 / S-PR4 redraw them).
- Shared, additive: `Fold` gains `lead`; `SupplierToast` gains `retryHref`; `VendorQrSection` keeps `seg` on its
  GET form; the thumb row's field rule leaves the Search box's own pill alone.
- **Root map fix:** the fields scanner read a Form row's visible `name` ("Contact", "From") as a posted field; it now
  reads `fieldName` (fixture test) — five false "filled in but not saved" findings, fixed rather than baselined.
- Lab: `/dev/supplier-lab?s=people|clash|empty|fail|nopools` (+ `&q=` `&lane=` `&add=1` `&toast=`).

SPEC IMPACT: None in the corpus text (builds the approved S-PR2 row). Status + deviations recorded in the builder's
handover `controller-2026-10-12/handovers/supplier-dash-2.md` for the build-status doc.
