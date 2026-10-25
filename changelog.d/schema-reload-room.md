## 2026-10-16 · fix(db): the API's schema reload no longer times out and takes every page down

Each time Supabase Realtime restarts (about 13 times a day), its partition DDL makes PostgREST reload its schema cache. That query runs as `authenticator` with an 8 s limit, and it peaked at 7.9 s. Twice (2026-10-15 16:37 and 2026-10-16 07:35) it crossed the limit, and every API call failed with PGRST002 for about a minute. The owner saw /dashboard take 20 s+.

Migration `20271269636634_api_schema_reload_has_room` raises `authenticator` to 30 s. It pins `service_role` at the 8 s it already inherited. anon (3 s) and authenticated (8 s) are unchanged.

SPEC IMPACT: None.
