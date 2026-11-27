## 2026-11-27 · perf(shop page, marketing): the shop page starts its reads together; GSAP and the booth's 3D load on demand

Speed audit 2026-11-27 (`docs/audits/2026-11-27/speed.md`), items E1 and I1. Nothing a person sees changes except how soon it arrives.

- **E1 · the supplier shop page (`app/v/[slug]/page.tsx`) waits once, not ~37 times in a row.**
  - The two gate reads (admin demo mode, bookings open) now run beside the shop-row read.
  - Right after the gate, every read that needs only the shop row (or the viewer) is started: the section batch, the unlisted events, Trusted by, the seals and badges, the experience probe, the inspiration looks, the attributes, microsite, Instagram, songs, branches, the custom address, the featured stories, the held-services count, and the viewer's own reads (events, booked chat, the Inquire event list, the card curator check).
  - A read that hangs on another is chained to just that one: the service cards' batch and records on the live cards; the reviews list and the page photos on the unlisted events; the featured stories on the section toggles.
  - Same reads, same conditions, same fail-softs. Each is still awaited where the page draws it. The second bookings-open read now reuses the gate's answer (the same remembered setting).
- **I1 · heavy libraries load on demand.**
  - `app/_components/marketing/_premium.tsx`: GSAP + SplitText are fetched once, on the first mount of any motion hook, instead of riding in every marketing page's first JavaScript. Each hook runs the same body in the same `gsap.context`, reverted on unmount.
  - `app/v/[slug]/booth`: `three` was already split behind `dynamic()`; its waiting screen is now the shared `Ghost` skeleton instead of a hand-styled "Loading the booth…" box with a raw hex.
- **Not done here:** `/tour`'s phone-only extra JavaScript comes from the shared root chrome, not from `app/tour/**`; and the grown service card stays a full-screen rise (see the PR).

SPEC IMPACT: None
