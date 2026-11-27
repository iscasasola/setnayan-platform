## 2026-11-25 · fix(front door): final check area 1, the LIVE batch

Lane A fixes for the faults the final check saw on setnayan.com (area 1, front door and public pages).

- **A1-058, A1-083:** `/login`, `/signup`, `/signup/you`, `/reset-password`, `/i/<shop>` and `/help` pick one of their own
  sentences from `?error=` (a closed list, `ownMessageFromParam`) and decode params without throwing
  (`decodeParamSafely`): a stray "%" no longer answers HTTP 500, and a link's own words never print inside our cards.
  The email banners show only an email address. Help's failed send carries a code and the typed subject and message back.
- **A1-081, A1-082:** a signed-out link to an account's guide or topic opens a sign-in door that comes back; an
  answer's topic breadcrumb opens `/help/topics/<key>` and "All help topics" opens `/help/topics`.
- **A1-032:** a full or expired Live Watch demo link says where a fresh demo opens and has an "Open Live Watch" button.
- **A1-149, A1-036:** `/papic` mints its demo codes only when the block scrolls into view (no row, no socket for a
  visitor who never reaches it), and a failed mint has Try again.
- **A1-027, A1-152, A1-108, A1-104 (Verified tag only):** Logo Maker for "Monogram" in the words people read on the
  public pages and the footer; E-Gifts for "Pabuya"; no "Safe" or "Trusted" on /features.
- **A1-047:** the commission line on the public pages is "Hosts pay 0% commission."
- **A1-048, A1-103 (part):** no "forever", "for good" or "habambuhay" price promises on /creators, the supplier feature
  pages, /about and help.

SPEC IMPACT: None — copy and guards only; the owner-ruled conflicts (the /for-suppliers drawing's "Free stays free",
FaceBlock "Always free", Home's "Suppliers you can trust") are left as they are and listed in the PR.
