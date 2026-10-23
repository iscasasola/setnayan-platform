## 2026-10-23 · copy(ui): no "gallery" in the app — Memories · Portfolio · Inspiration

Owner, 2026-10-23: *"check the rest of the words in the app. remove gallery and use
memories"*. Asked how to split the concepts, he chose: an event's own photos and
videos are **Memories**; a supplier's own photos are **Portfolio**; the Mood Board
library is **Inspiration**. Every user-visible "gallery"/"Gallery"/"galleries"
under `apps/web/app`, `apps/web/lib` and `apps/web/components` is reworded — page
titles, the guest page's tab, Papic, post-event scenes, help answers, spotlight
tours, /features and feature pages, the full-res email, empty states, aria-labels,
alt text, public marketing (blog, llms.txt, metadata). Code identifiers, routes
(`/dashboard/[eventId]/galleries`, `/tour/gallery`, `/studio/papic/gallery-zip`),
DB columns, CSS classes and analytics names are unchanged.

Two words outside the three concepts, chosen so no "gallery" remains: a
photographer's delivered link (the handover kind `gallery_link`) reads **"Album
link"**, and the phone's own photo roll (scan a QR from it) reads **"your photos"**.
The Event Hub Pro item "Photo gallery" is renamed **"Photos you add"** — the name
its widget already carries (`the-four-photo-names.test.ts`).

Guarded by `apps/web/lib/no-gallery-word.test.ts` — reads every string a source
file can put on screen through the TypeScript parser (comments are not copy;
tokens such as keys, routes and anchors are allowed) and fails on the word.
The privacy page's "kept for life" row in
`legal-retention-promises-have-a-mechanism.test.ts` now quotes the reworded
sentence (same promise, same mechanism).

Search keywords keep the word (owner, 2026-10-23: *"keep the SEO keyword as
gallery"*) — page metadata, never drawn: the home page, /papic and the
day-memories feature page. Each is a named exemption in the guard.

One name, two scopes (owner, 2026-10-23): the account's Memories holds every
event; an event's Memories (`/galleries`) is the same, filtered to that event.
So the door on that page to the guests' Photo Notes (`/alaala`) is named
**"Guest Stories"** — the name the Live page already gives them — instead of a
second "Memories".

SPEC IMPACT: `DECISION_LOG.md` row "23 Oct: no 'gallery' in the UI — Memories /
Portfolio / Inspiration".
