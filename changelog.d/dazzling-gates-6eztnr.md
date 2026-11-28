## 2026-11-27 · perf(shop page, marketing): the shop page starts its reads together; GSAP and the booth's 3D load on demand

Speed audit 2026-11-27 (`docs/audits/2026-11-27/speed.md`), items E1 and I1. Nothing a person sees changes except how soon it arrives.

- **E1 · the supplier shop page (`app/v/[slug]/page.tsx`) waits once, not ~37 times in a row.**
  - The two gate reads (admin demo mode, bookings open) now run beside the shop-row read.
  - Right after the gate, every read that needs only the shop row (or the viewer) is started: the section batch, the unlisted events, Trusted by, the seals and badges, the experience probe, the inspiration looks, the attributes, microsite, Instagram, songs, branches, the custom address, the featured stories, the held-services count, and the viewer's own events and card-curator check. (The booked-chat and Inquire event-list reads, signed-in only, stay where they were: guard tests pin their exact shape.)
  - A read that hangs on another is chained to just that one: the service cards' batch and records on the live cards; the reviews list and the page photos on the unlisted events; the featured stories on the section toggles.
  - Same reads, same conditions, same fail-softs. Each is still awaited where the page draws it. The second bookings-open read now reuses the gate's answer (the same remembered setting).
- **I1 · heavy libraries load on demand.**
  - `app/_components/marketing/_premium.tsx`: GSAP + SplitText are fetched once, on the first mount of any motion hook, instead of riding in every marketing page's first JavaScript. Each hook runs the same body in the same `gsap.context`, reverted on unmount. **Nothing flashes:** with the engine already loaded, the setup runs before paint as `useGSAP` did; when it arrives late, an entrance already on screen is skipped (it rests fully shown), and one below the fold still plays when scrolled to. Checked at 375 px on `/download`: before this fix four on-screen hero lines went from shown to hidden; after it, none.
  - `app/v/[slug]/booth`: unchanged. `three` was already split behind `dynamic()`.
- **Not done here:** `/tour` (its pages load no heavy library of their own; the phone-only extra was not traced) and the grown service card's move to `Sheet` (it is an approved full-screen rise). See the PR.

SPEC IMPACT: None
