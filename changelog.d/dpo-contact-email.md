## 2026-07-16 · docs(privacy): DPO public contact email → iscasasolaii@gmail.com (owner decision)

Owner decided 2026-07-16 that the public Data Protection Officer contact email is
`iscasasolaii@gmail.com`, not the never-provisioned `dpo@setnayan.com` mailbox.
Swapped every public-facing DPO/privacy/data-protection contact surface:
privacy notice, terms, acceptable-use, cookies, refunds pages, the reskin marketing
footer, the Organization JSON-LD `data protection officer` contactPoint in `layout.tsx`,
`lib/help.ts` privacy articles, and `public/llms.txt`. Auth/`is_internal` logic that
keys on `iscasasolaii@gmail.com` for the owner's internal flag is unrelated and untouched.

SPEC IMPACT: None (contact correction).
