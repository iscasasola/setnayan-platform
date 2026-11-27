## 2026-11-27 · fix(words): L4b — "Free to start" and the "e.g." box hints leave the app

Owner rule R3 (27 Nov): "a fixed app, not an app with guidelines on what should be here." This follows the owner's "yes to all" on the calls left open by OLD-L4 (#8423).

- **"Free to start" / "Free to stay" are gone from every marketing line.** Covered: the sign-up meta, /for-coordinators (meta and both fine lines), /for-suppliers (meta and the plan line), Why Setnayan, the feature pages, /about, /setnayan-ai, /our-story, /start, the Logo Maker page and the AI answer for coordinators. Where a line needs it, it now says "Planning is free". The four lines OLD-L4 already removes are left to it. The two in-app Studio chips (`lib/add-ons-catalog.ts`) are product state, so they are left for the owner.
- **No typing box shows an "e.g." example.**
  - A box with a visible label loses its example.
  - A box whose hint was "Name, e.g. X" keeps the name ("First name", "Item", "Template name").
  - A box with no visible label gets its field name instead: the shop sign-up list lines ("Inclusion", "Extra"), the mood-board custom role ("Role name") and the venue address ("Street, barangay, city").
  - This covers about 230 boxes across couple, supplier, admin and shop sign-up screens, plus the add-guest sheet's example line (its Tips fold stays).
- **Not touched:**
  - the seat-plan boxes (seat-plan editor, walkthrough, the public tour), which go to the NEW account;
  - the Guests search box, which OLD-L4 handles;
  - help lines, notes under a field, error messages, AI prompts and comments.
- **New guards:**
  - `lib/no-eg-placeholder-in-a-box.test.ts` (an allow-list with a reason per line, and a stale line fails);
  - `lib/no-free-to-start-in-marketing.test.ts`.

SPEC IMPACT: None. Copy only, per R3 (DECISION_LOG 2026-11-27) and the owner's "yes to all" the same day.
