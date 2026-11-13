## 2026-11-13 · fix(on-the-day): the supplier's on-the-day round (F-W1-75…82)

- **F-W1-82 (privacy)** After an account switch the day-of cache still held other logins' Event Hub pages
  (wanda-indigo, maria-and-jose, rosa-ben, w3-barkada-hangout). The worker now records the viewer on EVERY signed-in
  load (not only when a copy is saved), and a different viewer — or an unknown one — erases the saved copies AND the
  day-of guest pages (`DAYOF_CACHE`, `forgetGuestPages(null)`). A signed-out page's wipe (`OFFLINE_FORGET`) erases the
  day-of pages too. Pinned by an executing test of the real worker (`app/sw-offline-copies.test.ts`).

SPEC IMPACT: None.
