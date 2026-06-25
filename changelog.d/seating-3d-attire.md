## 2026-06-25 · feat(seating-3d): guests dress in gowns / suits in the motif

Owner directive ("the guests 3d people will follow the motif of their dresses …
same on the suits of the men"). Seated 3D avatars now wear a **gown** or **suit**
silhouette coloured to the mood-board attire motif, instead of a uniform token.
Couples will set it per guest (next PR) — but the **wedding party dresses itself
by role** today, so the room reads correctly immediately.

- **Migration `20270224120000_guest_attire.sql`** — `guests.attire`
  (`gown` / `suit` / `neutral`, default `neutral`). Applied to prod
  (`setnayan-prod`) ahead of this code, since the guest query now selects it.
- **`lib/guests.ts`** — `GuestAttire` type + `resolveGuestAttire(role, attire)`:
  an explicit couple value wins, else a gendered wedding-party role implies it
  (bride/bridesmaid/MOH/flower-girl → gown · groom/groomsman/best-man/bearers →
  suit), else `neutral`. `attire` added to `GUEST_FIELDS` + `GuestRow`.
- **`seating/lab/page.tsx`** — derives gown/suit motif colours from the
  mood-board `role_palette` (wedding-party/bride → gown · groom → suit; blush /
  charcoal fallbacks) and resolves each guest's attire + colour.
- **`lib/seating-3d.ts` / `seating-lab-3d.tsx`** — `Lab3DGuest` carries
  `attire` + `attireColor`; `SeatedAvatar` swaps in a flared gown or tapered
  suit body (motif-coloured) under the selfie head; `neutral` keeps the plain
  RSVP token. No gender is invented — unmapped guests stay neutral.

Next PR: a gown/suit/neutral picker on the guest detail page so couples can
dress the general crowd, not just the entourage.

SPEC IMPACT: 0008 Seating + 0001 Guests — guests carry attire; 3D avatars dress.
