## 2026-07-26 · fix(security): revoke ALL on events_host from authenticated before granting SELECT

Migration `20271008731642` (SEC-2b, merged in #3736) failed to apply against
production: its own post-condition (g) `events_host-is-writable` refused it.

Root cause: this project carries `ALTER DEFAULT PRIVILEGES` in `public` granting
`arwdDxtm` to BOTH `anon` and `authenticated` on every newly created relation. A
view is a relation, so `CREATE VIEW public.events_host` handed `authenticated`
INSERT/UPDATE/DELETE before the grant block ran, and `GRANT SELECT` adds a
privilege rather than reducing the others. The migration revoked from `PUBLIC`
and `anon` but not from `authenticated`, leaving it holding write access to an
auto-updatable, `security_invoker = false` view — a write path past
`couple_can_update_event` and past RLS on `public.events`.

Measured on the real database, creating a throwaway definer view under the same
default ACL and rolling back:

  as-merged (no authenticated REVOKE)   UPDATE=t INSERT=t DELETE=t SELECT=t
  with REVOKE ALL FROM authenticated    UPDATE=f INSERT=f DELETE=f SELECT=t

Fixed in place rather than with a follow-up migration: `20271008731642` never
applied in any environment (absent from `supabase_migrations.schema_migrations`;
the transaction rolled back, so `public.events_host` does not exist), and a
later-numbered migration would queue BEHIND the failing one and never run. Main's
migration pipeline is blocked until this lands.

SPEC IMPACT: None — this restores the intent already documented in
`DECISION_LOG.md` (SEC-2b: "only SELECT is granted — an UPDATE grant would bypass
couple_can_update_event AND RLS"). The migration said so in a comment; it just
did not do it.
