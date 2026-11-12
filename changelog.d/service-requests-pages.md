## 2026-11-13 · feat(services): service requests — "Your requests" for suppliers, "Service requests" for admin, and the cards follow the decision

Builds the owner's 2026-11-13 rulings on a service we don't list (DECISION_LOG "A SERVICE WE DON'T HAVE",
"A NEW SERVICE REQUEST IS READ BY THE APP'S AI FIRST", "TWELVE ANSWERS IN ONE GO") on the shipped
`taxonomy_category_requests` path. Approved prototype: `prototypes/service_requests_2026-11-13_fable.html`.

- **Supplier — "Can't find yours? Tell us what you do"** (`/vendor-dashboard/services/requests/new`): pick a
  group → a category (each row says "<category> › Others") → name it (2–80) + optional note. `proposeCategory`
  now requires the category and writes `tile_id` (a column the table had since 2026-08-11 that it never filled);
  a name the shop already has waiting opens that request instead of a twin. The maker's door
  (`PROPOSE_CATEGORY_HREF`) opens this page; the search stays first in the shared Add-a-service picker.
- **"<category> › Others" is a TAG, not a taxonomy row** — `vendor_services.category_request_id` links a card
  to its waiting request; the request carries the category. No new taxonomy rows, no global Miscellaneous row.
  A supplier puts a card under a waiting request from the request's page.
- **Supplier — "Your requests"** (`/vendor-dashboard/services/requests`): Waiting first, then Decided, in the
  owner's words (Waiting · Added as a new service · Moved to "…" · Kept just for your shop · Not added); a detail
  page with "Note from Setnayan" and where the cards are now; "Pick the service that fits" on Not added. A
  decision the shop has not opened shows as a notice at the top of Services
  (`taxonomy_category_requests.supplier_seen_at`) and leaves once opened.
- **Admin — "Service requests"** (`/admin/categories/requests`): pending first, one row per name with "n shops";
  loading / empty / "Couldn't load requests · Try again" never look alike. One request's page has ONE Decision
  dropdown (Add as a new service · Move to an existing service · Keep just for this shop · Not added), category
  preset to where they filed, Move = a search of the live services (filed category first), a note on every
  choice (required on Not added), and "n cards move from … to …" before the press.
- **One decision moves every shop that asked for that name** (`decideServiceRequest`): all pending requests with
  the same name are decided together; on Add / Move their tagged cards leave Others for the service (and are
  filed under the shop's coverage of it); on Keep / Not added they stay online under Others. On Add the typed
  words become reviewed search words (`canonical_service_aliases`). The leaf mint is now one helper shared with
  `promoteCategoryRequest`.
- **The AI reads each request first (flag still OFF — the owner's to flip):** an existing match sends the
  supplier straight to that service's card maker (the request stays queued with the recommendation); a truly
  new one also drafts a description, search words and inspiration parts, shown to admin above the decision.
- Migration `20271341741286_service_requests_cards_follow_the_decision.sql`: `vendor_services.category_request_id`,
  `taxonomy_category_requests.supplier_seen_at`, three draft columns; exposure baseline regenerated for the two
  new columns (a uuid on a public card; a timestamp only admins can write).

Not built here (named, not hidden): the public card does not yet print a kept shop's own service name, and
Explore's category search does not yet include a Miscellaneous card by its request's category — both read
paths are shared with other builders and are listed as the next slice in the PR.

SPEC IMPACT: None to the corpus wording — this implements the 2026-11-13 DECISION_LOG rows as written.
