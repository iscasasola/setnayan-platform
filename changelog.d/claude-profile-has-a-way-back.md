## 2026-10-26 · fix(people): a person's page has a way back to People

Opening someone from People landed on their page (`/u/<slug>`) with no back button — in the installed app there is no browser bar, so the owner was stuck. A signed-in viewer now sees "‹ People" (the shared `BackButton`) above the header; a stranger following a shared link sees the page as before. The session is read on the device after mount, so the page stays cacheable.

SPEC IMPACT: None
