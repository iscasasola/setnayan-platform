## 2026-07-05 · feat(vendors): structured verification fields (portfolio grid / client refs / multi-platform social)

Redesigned slots 5–7 of My Shop → Get verified → "Your documents" (owner
2026-07-03). Items 1–4 (DTI/SEC · BIR 2303 · Mayor's Permit · bank proof) are
unchanged; the three vendor slots that outgrew the "one file / one URL" model
now carry structured payloads in the existing `doc_uploads` JSONB — no
migration, and all three stay OPTIONAL (the submit gate is untouched).

- **Portfolio (5)** — a multi-file photo grid, up to 10, that persists the FULL
  array. Fixes a latent inline-save bug where portfolio/client-references saved
  only the first ref (`val[0]`); the whole set is now stored.
- **Client references (6)** — a structured repeater `{name, contact_number,
  event, date}`; a blank row auto-appears as each fills, up to 5. Reviewers see
  the parsed rows in the admin verification queue.
- **Social media (7)** — 9 labeled platform inputs (Website · Facebook ·
  Instagram · TikTok · X · YouTube · Snapchat · WhatsApp · Telegram) replacing
  the single URL field. Legacy `{ url }` values (and open-shop's seeded link)
  still read + count, mapped onto their detected platform.

`buildSlotValue` gained optional `references` / `social` / `portfolioRefs`
params (additive — the retiring `/verify` flow and `open-shop` seeding compile
+ behave unchanged). The admin `/admin/verify` checklist now surfaces the
structured references, the social links, and the portfolio count so a reviewer
can read them without a presigned URL.

SPEC IMPACT: None — behavior refinement of an already-shipped feature; JSONB
storage, no schema migration.
