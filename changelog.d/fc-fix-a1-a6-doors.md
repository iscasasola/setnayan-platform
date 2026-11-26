## 2026-11-25 · fix(doors): final check area 1, batch a1-a6-doors

Lane A fixes for buttons that landed a stranger in the wrong place, and search hygiene for utility pages. No rule changed.

- **A1-031, A1-112:** every public host "Start planning" button (the doorway pages, /features, /about, /tour, /sample, /waitlist) opens `routes.start()` (/start: "What kind of event are you planning?"). It no longer opens wedding onboarding or asks for an account first. Three wedding-worded doors stay on purpose; the guard names them.
- **A1-050, A1-051, A1-052:** the /suppliers landing pages start at /start, "See them all on the marketplace" keeps the page's category, event and city, and the copy says "an anniversary" (`withArticle`).
- **A1-113:** "Browse suppliers" on /about and "Try it" on the marketplace feature open the public /suppliers directory, not Discover's sign-in wall.
- **A1-003:** /samahan keeps "Create a group" for everybody. A group belongs to the account, not to an event.
- **A1-121:** /start owns its `<main>` landmark.
- **A1-160:** /login, /signup and /forgot-password are `noindex` and leave the static sitemap. The /api/v1 reference is `noindex` with a canonical.
- **A1-172:** the sign-in card's ✕ is a real link, and Escape and the backdrop load the dismiss page outright, so a /login opened directly closes.

SPEC IMPACT: None.
