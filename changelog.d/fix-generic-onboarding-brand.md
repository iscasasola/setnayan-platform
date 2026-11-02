## 2026-06-28 · fix(onboarding): bring the non-wedding flow up to the premium brand bar

Gap audit of the live non-wedding onboarding (`/onboarding/[type]` — birthday,
debut, corporate, etc.). It was functional but visually a plain form next to the
premium wedding flow, breaking brand consistency on two counts:

1. **No brand on screen.** The flow showed only a thin progress bar — no Setnayan
   mark or wordmark until the very end, violating the "brand visible during
   onboarding" rule. Added a header with the gold Setnayan mark + mono champagne
   "SETNAYAN" wordmark (the same lockup the wedding flow opens with).
2. **Wrong typography.** Headlines rendered in the default sans (`font-semibold`)
   instead of the signature Editorial serif. Titles now use Cormorant Garamond
   serif-italic (`font-serif italic`) and eyebrows use the mono champagne-gold
   treatment — matching the wedding flow's `.q` / `.eyebrow`.

Result: a birthday/debut/corporate onboarding now reads as the same premium
Setnayan product, not a generic questionnaire. Markup/className only — no logic,
data, or flow change; the lean generic shell is otherwise untouched. Verified on
desktop + mobile (welcome + question screens), console clean, typecheck green.

SPEC IMPACT: None (visual brand-consistency polish on an already-live flow).
