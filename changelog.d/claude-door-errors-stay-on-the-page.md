## 2026-11-06 · fix(toast): a door that prints its own `?error=` keeps it

Measured on /signup?error=password_leaked (local build, dummy env): the server HTML carried "This password has appeared in a known data breach…", and once the page settled the banner was gone and a generic "Something went wrong — please try again." toast stood in its place. The app-wide `ToastFromParams` saw `?error=`, fired the generic toast and `router.replace`d the address — a server round trip that drew the page again without its error. ~70 pages read `?error=` (signup, reset-password, join → set password, Profile, most admin and dashboard forms).

- **The flags leave the address with `history.replaceState`**, which the router follows without asking the server for the page again — whatever the page drew from the flag stays on screen. A refresh still does not re-fire.
- **An error the page already shows (a visible `role="alert"` — FormFlash, DoorNotice, the sign-in cards' banner) gets no second, generic toast.** An error the page does not show toasts exactly as before (its `msg`, else the generic line); success flags are unchanged.
- **Every flagged address is handled, not only the first of a visit.** The bridge lives in the root providers and used a one-shot `useRef(false)`: measured, after a first `?saved=1` a client navigation to `?updated=1` gave no toast and left the flag in the address. It now remembers the address it handled and forgets it once the address is clean.
- The decision is pure in `app/_components/toast/param-toast.ts`, tested in `param-toast.test.ts` (behaviour, plus the component's two mechanical promises and the four doors' `role="alert"`).

SPEC IMPACT: None
