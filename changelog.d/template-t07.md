## 2026-11-14 · feat(template): T07 — supplier pages onto the design template

Owner-approved 2026-11-14 design template (`design_template_sheet_2026-11-14_fable.html`), batch T07 (Supplier).
Copied from the shipped pieces (`template-rows.tsx`, `ActionButton`, `Badge`, `InfoTip`, `PickMenu`, `Sheet`); no
server action, query or data rule changed, and every fact, control and link is kept.

- **The client's mood board** (`clients/[eventId]/mood-board`) — palette, reception design and more inspirations are
  sections of hairline rows, not tiles; the two explaining paragraphs move behind ⓘ; the empty board is one line.
  **Sign-off** asks are rows with ActionButtons (I’ll build this · Not as designed · Go ahead · Keep it as agreed);
  **Colours you can adjust** is a section with its permission behind ⓘ; the suggest board drops half-ink words.
- **Cocktail editor** — Add booth is one PickMenu; Add sign / dismiss are ActionButtons; the booth's "what does it
  serve" popover is now a rising Sheet (Cancel · Save); the 8–10 px plan labels read at 11 px; a hex fallback went.
- **Activities + questions, Lines, Theft Watch** — the visible page title is screen-reader only (each route gets its
  own title-less `loading.tsx` so the skeleton stops promising a title bar); paragraphs → ⓘ; mono captions → section
  labels; every hand-made button → ActionButton; empty → one line; a failed read is amber with "We couldn’t…".
  Lines now says when its list could not be read instead of showing "nothing yet". Theft Watch statuses are Badges.
- **Locked QR (/vendor/lock) and Fit check (/vendor/fit)** — the deal and the checks are hairline rows with bold
  tabular money; one terracotta main per screen; emerald/amber raw colours → state tokens.
- **Claim door (/vendor/claim)** — the record and perks are rows, captions are section labels, the two hand-made
  links wear the ActionButton class.
- **On the day · Papic** — the consent gate's one main button; the credits meter on the warm surface with bold
  count; captures / challenge strips are sections with amber couldn't-read and one-line empty; Pay with is a PickMenu.
- **Service wizard** — Coverage is a PickMenu; the gift yes/no are equal ActionButtons with the explanation behind ⓘ;
  Back/Continue/Publish/Save as draft are ActionButtons; review is hairline rows. The add-a-service title is sr-only.
- **Manpower gig card, set list, dossier view, team helpers, put-on-my-page** — rows instead of cards, raw slate
  palette → tokens, confidence as a Badge, 11–12 px words → 13 px dark grey.

SPEC IMPACT: None
