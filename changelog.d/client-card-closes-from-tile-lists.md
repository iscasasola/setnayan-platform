## 2026-11-16 · fix(supplier-clients): a client card opened from Overdue (or any tile list) closes — EB-246

Every-button walk EB-246: Clients › Overdue › "Debut 18" opened the card on Payment; ✕ (twice) and Esc changed the
address but the card stayed — only a reload got out.

- **Cause:** the tile lists (Schedules · To collect · Overdue · Unread) and the Money rows recorded no list origin, so
  the picked shell's close PUSHED `/vendor-dashboard/customers`. On a soft navigation Next keeps a parallel slot's last
  page when the new address does not name the slot (`@client/default.tsx` answers only a hard load), so the card stayed
  over a changed URL, and the shell's one-shot close ignored every later ✕.
- **Fix:** those rows now sit in `RememberPickedOrigin` (as the roster rows already did), so ✕ / Esc go BACK to the list
  pressed — Overdue stays Overdue. `customers/@client/page.tsx` answers the bare Clients address with nothing, so any
  push to the list (a hard-loaded card, a door with no origin) also takes the card away. The close decision is one pure
  helper, `pickedCloseStep` (`picked-motion.ts`).
- **Guard:** `customers/client-card-closes-to-its-list.test.ts` renders the real lists, records the Overdue press, reads
  it back as the card does and checks ✕ goes back; and checks the slot answers the list address with nothing.
  Sabotaged: unwrapping the Overdue row turns 1–2 red; deleting `@client/page.tsx` turns 3 red.

SPEC IMPACT: None.
