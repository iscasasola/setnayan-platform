## 2026-11-07 · feat(taxonomy): [migration] a service carries its own one-line ⓘ definition, written in Admin › Categories (plan D4)

DECISION_LOG 2026-11-06 "EVERY CATEGORY AND SERVICE IN THE SIGN-UP PICKER GETS AN ⓘ WITH A ONE-LINE DEFINITION" —
owner: *"add (i) for each so we can define the categories and service so they know where they should locate
themselves."* Categories already had `service_categories.hint_en`; services had no field.

- **Migration `20271320021260_a_service_carries_its_own_info_text`** — `canonical_service_schemas.hint_en TEXT NULL`,
  CHECK ≤ 120 characters. The table's RLS and grants carry it unchanged (public read, admin-only write), like
  `display_name_tl`. Nothing is backfilled: every service starts empty.
- **Admin › Categories › a service › Name › "ⓘ text"** — one line, saves in place through the existing `info-text`
  door (+0 exported server actions); `setServiceInfoTextCore` validates, refuses a combined service, writes one audit
  row (`taxonomy.set_service_info_text`). An unreadable line is said on the panel, never shown as an empty box.
  A written line previews as "Suppliers see" with the same component every surface uses.
- **The reader** — `lib/service-definitions.server.ts` `getServiceDefinitions()` (one cached read per request) and
  `serviceDefinition(key)`; pure half `lib/service-definitions.ts`. **`<ServiceInfo name line />`**
  (`app/_components/service-info.tsx`): no line → the name alone, never an empty ⓘ or a placeholder.
- **Not wired here (other builders own the files):** the sign-up picker (`app/open-shop/**`, #7351) and the card
  maker's kind row (`canvas-maker.tsx`). The one-line seams are in the PR body.
- Dev lab: `/dev/categories-lab?svc=written|empty&open=s:lab_fixture_service` draws one "(lab)" fixture service.
- Tests: `lib/service-definitions.test.ts`, `tests/db/a-service-carries-its-own-info-text.db.test.ts`.

SPEC IMPACT: None — builds the 2026-11-06 row as written. 🔑 The 120-character cap is the build brief's default (the
ruling counts words, "≤16 words each"); flagged for the owner.
