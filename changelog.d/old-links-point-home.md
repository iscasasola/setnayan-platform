## 2026-11-16 · fix(links): our own links point at the new address, not the retired one

Full-page audit, 16 Nov 2026, fix list 1 (owner: *"Yes, start both"*).

Pages that moved still have their old address forwarding to the new one — right for a bookmark, wrong for our own links: every tap paid an extra hop through a redirect stub. About 160 hand-written links, form actions and after-save redirects in 33 files (85 of them in one sample list) now name the address the stub already lands on, byte for byte (same tab, same query, same `#fold`). Nothing a person sees changes; the forwarding stays for old bookmarks.

- **Public:** the marketplace search forms, category chips and "Clear" links, the feng-shui nudge, and the 85 "find this supplier" links on the Real Stories samples: `/explore…` → `/…`.
- **Admin:** vouchers, social queue, venues, suppliers, users, demo shops, the verification-docs sign-in bounce (`/sign-in` → `/login`).
- **Couple:** the old event-website door → `launch`; the colours / special message / what-to-bring error bounces go straight to the editor's panel (the `error` is kept in the address; the editor still does not show it — pre-existing, named as a follow-up).
- **Supplier:** a client's page actions, the calendar save, profile-missing bounces, the performance page's "Open your calendar", and the quote page's "Back to your quotes".

`revalidatePath` calls on old paths are deliberately untouched (a revalidation is not a link).

Guard: `lib/old-links-point-home.test.ts` reads the retired list from the same three places the forwarding uses (the middleware's legacy map, the screen map's redirect stubs, the admin map's redirect stubs) and fails if any page or lib module names one. 21 links still do — 20 in files an open PR is editing, plus payment methods' Back, which must agree with the page map that #7717 is editing — and sit in a baseline that only shrinks. Five existing guards that pinned an old address (the marketplace GET form, the website redirect, the verification-docs body pin, the back-link baseline, the generated screen map) now pin the new one. Sabotaged twice (an old link restored → red; a stale baseline line → red).

SPEC IMPACT: None.
