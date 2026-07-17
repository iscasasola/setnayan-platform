## 2026-07-17 · docs(legal): self-declared/unverified + user-content warranty clause (Terms + Privacy Notice)

Added a self-declared / user-content warranty clause to both public legal pages, formalizing Setnayan's posture as a self-service, self-asserted, unverified-identity consumer platform:

- `apps/web/app/terms/page.tsx` — new "Your information & the content you share" section: information you provide is self-provided and not verified by Setnayan; you're responsible for its accuracy; you warrant you have the right to share any content (including other people's photos, likenesses, or details); for public event/guest media you confirm you have the necessary permissions from the people shown. Notes that vendor identity verification is the separate, verified exception.
- `apps/web/app/privacy/page.tsx` — new "Self-declared information (and what we verify)" subsection: most account info is self-declared and unverified; users control and are responsible for their own data; identity is verified only where stated (vendor verification); for content involving other people the platform relies on the uploader's rights plus the event's own consent controls. Does not weaken the separate biometric/sensitive-PI explicit-consent requirements.

Counsel-reviewable draft copy — final wording is for PH counsel. Consistent with the existing vendor-verification, biometric (face-vector), and anti-fraud sections; contradicts none of them.

SPEC IMPACT: Aligns the live Terms + Privacy Notice with the owner-stated platform posture recorded in `~/Documents/Claude/Projects/Setnayan/NPC_Creator_Economy_Processing_Addendum_2026-07-17.md` §0 (self-service, self-asserted, unverified identity; heightened controls only where processing touches another data subject — enforced via the event consent chain; vendor verification R-03 is the separate verified exception). DECISION_LOG.md row appended in the corpus.
