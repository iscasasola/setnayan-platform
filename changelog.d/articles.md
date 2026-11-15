## 2026-11-16 · feat(articles): Articles — topics people start and talk in (Discover part 5)

Builds the approved Articles prototype (specs `prototypes/articles_2026-11-16/`, owner "1a 2a 3a", 16 Nov).

- **Topics list** `/articles` — inside the account only (signed out → sign in, then back). Search topics… ·
  Event ▾ (the shipped `event_type_vocab` roster) · Newest ▾ (Newest · Most replies) · **New topic** in the
  thumb zone (shipped `ThumbDock` / `ThumbRow`). Desktop: list left, open topic right.
- **New topic** and **thread with replies** `/articles/<S89A-…>`. Posts go live at once.
- **Names:** readers see "Guest · code", one code per person per topic (`article_topic_codes`, PK
  (topic_id, user_id) + UNIQUE (topic_id, code)); suppliers (shop owner or team) post as "Supplier · code".
  Every table is RLS Pattern F, so no browser can read the real account; the team sees it in Admin › User reports.
- **Links:** only setnayan.com — `lib/articles-links.ts`, run by the composer while typing AND by the write
  route before anything is stored.
- **Report** reuses the shipped six-reason sheet (`ReportPageButton`) and `fileReport` → `user_reports`, with
  two new targets `article_topic` / `article_reply`.
- **Moderation** in Admin › User reports: Keep · Remove · Remove and pause posting (the existing dismiss · hide ·
  block lanes of `resolveReport`). A pause (`article_posting_pauses`) stops posting in Articles only.
- **Signed out:** a topic's exact link opens read-only, with "Sign in to reply".
- **Discover read:** `latestArticleTopics(limit)` in `lib/articles.server.ts`.
- One write route `POST /api/articles` — ZERO new server actions.
- Migration also widens `user_reports_event_id_required_check` to include `vendor` (the shop-report target added
  by 20271240604358 inserts event_id NULL but the check was never widened) — loosening only.

SPEC IMPACT: None — builds the approved prototype as ruled (DECISION_LOG 2026-11-16 "ARTICLES … THREE QUESTIONS RULED").
