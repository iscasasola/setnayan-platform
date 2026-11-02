## 2026-10-18 · feat(auth): a typed Google address takes the same door as "Continue with Google"

Owner, 2026-10-18: "we want people to login via google and typing their google
account be same." Before this, a person who TYPED their Gmail address was given
a password box: a Google-only account was refused and only then told "This
account signs in with Google"; at /signup the same address was sent a welcome
email and landed on "Your account is ready", where the password it had just
chosen was refused. Now, on the sign-in card (the /login route and every
in-place popup), /signup and the wedding onboarding's account screen, a Google
address (gmail.com / googlemail.com by name; a Google Workspace domain by its
preferred MX, looked up server-side by DOMAIN only via
`/api/sign-in/google-domain`) folds the password part away and shows the
shell's own Google button with the address handed to Google as `login_hint` —
the web server action, the desktop loopback and the phone app's system browser
all forward it. Same callback, same landing, same account (Supabase links one
verified address to one user; measured in prod: 0 addresses on two users).
"Use a password instead" keeps the 3 password accounts on Google addresses
reachable. New: `lib/google-address.ts` (+ `.server.ts`, `.test.ts`),
`app/_components/auth/google-address-door.tsx`,
`app/api/sign-in/google-domain/route.ts`.

SPEC IMPACT: None (no locked decision changed; the 2026-09-23 "reveal an
account's provider only after a failed password" rule is untouched — the domain
check says nothing about any account).
