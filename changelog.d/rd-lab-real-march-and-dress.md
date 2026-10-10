## 2026-10-10 · chore(lab): the Maker lab draws the REAL Wedding March and Dress code

The Maker's test page (`/dev/maker-lab/guest`, dev-only) drew the Dress code as a placeholder line and drew no Wedding March
at all, so neither could be reviewed. It now draws `DressCodeWidget` and `EntourageSection` — the guest page's own
components — fed with sample data (`app/dev/maker-lab/guest/lab-sample.ts`: a 16-person entourage built by the real
`buildEntourage`, and a sample dress code and Mood Board in the lab's five colours). The March sits after the Dress code on
the Invitation (Details) and on The Day (Welcome), marked `f:entourage` + the `entourage` block mark exactly as `site-body.tsx`
marks it. The dress code wears its picked Style, palette look and do's look. Nothing a real guest or event sees changes.

SPEC IMPACT: None
