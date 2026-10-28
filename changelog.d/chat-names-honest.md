## 2026-10-28 · fix(chat): a couple's Chats name every supplier — a hidden shop no longer reads "Supplier"

Owner, live: one thread on the couple's Chats › Suppliers list read **"Supplier"** (avatar "S") beside a thread that
read its shop name, and the thread head said "Supplier" too.

**Cause (proven per shop state in `apps/web/tests/db/a-couple-sees-every-suppliers-chat-name.db.test.ts`).** The
list and the head read the shop through a `vendor_profiles` embed under the couple's own session. The only policy
that lets a couple read another person's shop is `vendor_profiles_public_read` (`public_visibility = 'verified' AND
verification_state = 'verified'`), so every other shop the couple can chat with — a free shop not yet verified, one
pending review, a paid shop not yet verified, a verified shop that is hidden or coming soon, an unverified venue —
came back as a NULL embed, which both pages printed as the literal `'Supplier'`.

**Fix.** Migration `20271295352678` adds `couple_thread_supplier_names(p_event_id)` — SECURITY DEFINER, pinned
search_path, EXECUTE for `authenticated` only, gated on `current_couple_event_ids()` (the couple branch of
`chat_threads_member_read`). It returns the anonymity inputs for every thread's shop; the business name and the logo
come back ONLY when the name is revealed (the SQL twin of `isVendorNameRevealed`, with parity over every tier ×
verification × venue × stamp held by the db test). `vendor_profiles` RLS is not widened. `lib/chat-supplier-names.ts`
runs each row through the same `resolveVendorDisplayName`, so the label is the screen name pre-reveal and the
business name once revealed. The couple's Chats list, the thread head, the thread's left column, the read receipts'
reveal flag and the ✎ team picker all read it. A failed read now says "Couldn’t load name" (avatar "?") — never a
word that looks like a name. A revealed shop with an empty business name falls back to its screen name instead of
the resolver's bare 'Supplier'.

Guards: `lib/a-couples-chat-names-every-supplier.test.ts` (never the bare word; both couple pages take the name from
the one reader). `/dev/chat-lab` carries three hidden-shop fixtures. Exposure baseline: one added function line
(`couple_thread_supplier_names`, authenticated only). Paid down two `the-badge-has-a-deadline` bill lines.

SPEC IMPACT: None — implements the existing anonymity rule (CLAUDE.md 2026-05-30 row) on a surface that was not
honouring it; no decision changed.
