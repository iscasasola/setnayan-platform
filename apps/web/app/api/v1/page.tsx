import Link from 'next/link';

export const metadata = {
  title: 'Setnayan API v1 — Reference',
  description:
    'Read-only endpoints for the Setnayan platform. Bearer-authenticated for events/guests; public for vendor browse.',
};

type Endpoint = {
  method: 'GET';
  path: string;
  auth: 'public' | 'bearer';
  scope?: string;
  summary: string;
  example: string;
  notes?: string[];
};

const ENDPOINTS: Endpoint[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    auth: 'public',
    summary: 'Liveness probe. Returns 200 with a static payload.',
    example: 'curl https://setnayan-platform-web.vercel.app/api/v1/health',
  },
  {
    method: 'GET',
    path: '/api/v1/me',
    auth: 'bearer',
    scope: 'me.read',
    summary: 'Whoami — returns the calling user’s public profile.',
    example: `curl https://setnayan-platform-web.vercel.app/api/v1/me \\
  -H "Authorization: Bearer sk_live_…"`,
  },
  {
    method: 'GET',
    path: '/api/v1/events',
    auth: 'bearer',
    scope: 'events.read',
    summary: 'List events the calling user is a member of.',
    example: `curl "https://setnayan-platform-web.vercel.app/api/v1/events?limit=20" \\
  -H "Authorization: Bearer sk_live_…"`,
    notes: [
      'Pagination: ?limit= (max 50, default 20), ?cursor= from the previous page’s next_cursor.',
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/events/:eventId',
    auth: 'bearer',
    scope: 'events.read',
    summary: 'Fetch a single event by event_id (UUID) or public_id.',
    example: `curl https://setnayan-platform-web.vercel.app/api/v1/events/E89G-XXXXXXXXXX \\
  -H "Authorization: Bearer sk_live_…"`,
    notes: ['Returns 404 if the caller is not an event member — no leakage.'],
  },
  {
    method: 'GET',
    path: '/api/v1/events/:eventId/guests',
    auth: 'bearer',
    scope: 'guests.read',
    summary:
      'List active guests for the event with RSVP status, role, and table assignment.',
    example: `curl "https://setnayan-platform-web.vercel.app/api/v1/events/E89G-XXXXXXXXXX/guests?limit=20" \\
  -H "Authorization: Bearer sk_live_…"`,
    notes: ['Pagination same as /events. Deleted guests are filtered out.'],
  },
  {
    method: 'GET',
    path: '/api/v1/vendors',
    auth: 'public',
    summary: 'Browse published vendor profiles with optional filters.',
    example: `curl "https://setnayan-platform-web.vercel.app/api/v1/vendors?category=photographer&city=manila&limit=20"`,
    notes: [
      'Filters: ?category= (exact match on services[]), ?city= (substring), ?q= (substring on business_name).',
      'Contact fields are not returned in the list.',
      'CORS: open to any origin (GET, OPTIONS).',
    ],
  },
  {
    method: 'GET',
    path: '/api/v1/vendors/:publicId',
    auth: 'public',
    summary: 'Fetch a single published vendor by public_id or business_slug.',
    example: `curl https://setnayan-platform-web.vercel.app/api/v1/vendors/B89G-XXXXXXXXXX`,
    notes: [
      'Contact fields are masked. Use the booking flow (V1.5+) for the real values.',
      '404 if the row is missing or unpublished.',
    ],
  },
];

/**
 * Minimal reference page for the V1 public API. Intentionally not styled
 * as a developer portal — that’s a V1.5+ project. Goal: get the endpoints,
 * auth model, and example curls in one place that an integration partner
 * can read in 30 seconds.
 */
export default function ApiV1ReferencePage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8 space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Setnayan API
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">v1 reference</h1>
        <p className="max-w-2xl text-base text-ink/65">
          Read-only endpoints for the Setnayan platform. Phase A (events + guests)
          is Bearer-authenticated; Phase C (vendor browse) is public. Webhooks and
          booking write paths land in V1.5.
        </p>
        <p className="text-sm text-ink/55">
          Create a token at{' '}
          <Link
            href="/dashboard/api-keys"
            className="underline decoration-ink/40 underline-offset-2 hover:decoration-ink"
          >
            /dashboard/api-keys
          </Link>{' '}
          and pick the scopes you need.
        </p>
      </header>

      <section className="mb-8 space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Auth
        </h2>
        <p className="text-sm text-ink/75">
          Authenticated endpoints expect{' '}
          <code className="rounded bg-ink/[0.06] px-1 font-mono text-xs">
            Authorization: Bearer sk_live_…
          </code>
          . Keys are scope-gated — a token without the right scope receives a 403
          with{' '}
          <code className="rounded bg-ink/[0.06] px-1 font-mono text-xs">
            error.code = &quot;insufficient_scope&quot;
          </code>
          .
        </p>
        <p className="text-sm text-ink/75">
          Public endpoints accept any origin via CORS for GET requests.
        </p>
        <p className="text-sm text-ink/75">
          All responses use{' '}
          <code className="rounded bg-ink/[0.06] px-1 font-mono text-xs">
            Content-Type: application/json; charset=utf-8
          </code>
          . Errors return{' '}
          <code className="rounded bg-ink/[0.06] px-1 font-mono text-xs">
            {'{ error: { code, message } }'}
          </code>
          .
        </p>
      </section>

      <section className="mb-8 space-y-3 rounded-2xl border border-ink/10 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Scopes
        </h2>
        <ul className="space-y-1.5 text-sm text-ink/75">
          <li>
            <code className="font-mono text-xs">me.read</code> — implicit on every token.
            Reads your profile.
          </li>
          <li>
            <code className="font-mono text-xs">events.read</code> — list + read events you
            are a member of.
          </li>
          <li>
            <code className="font-mono text-xs">guests.read</code> — read the guest list of
            an event you are a member of.
          </li>
          <li>
            <code className="font-mono text-xs">vendors.read</code> — reserved for the V1.5
            booking flow. /api/v1/vendors is already public.
          </li>
        </ul>
      </section>

      <section className="space-y-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Endpoints ({ENDPOINTS.length})
        </h2>
        {ENDPOINTS.map((endpoint) => (
          <article
            key={endpoint.path}
            className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5"
          >
            <header className="flex flex-wrap items-center gap-2">
              <span className="rounded-md bg-ink text-cream px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.1em]">
                {endpoint.method}
              </span>
              <code className="font-mono text-sm text-ink">{endpoint.path}</code>
              {endpoint.auth === 'public' ? (
                <span className="rounded-full bg-success-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-success-900">
                  Public
                </span>
              ) : (
                <span className="rounded-full bg-warn-100 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-warn-900">
                  Bearer
                </span>
              )}
              {endpoint.scope ? (
                <span className="rounded-full bg-ink/[0.06] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ink/65">
                  scope: {endpoint.scope}
                </span>
              ) : null}
            </header>
            <p className="text-sm text-ink/75">{endpoint.summary}</p>
            {endpoint.notes && endpoint.notes.length > 0 ? (
              <ul className="list-inside list-disc space-y-1 text-xs text-ink/55">
                {endpoint.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            ) : null}
            <pre className="overflow-x-auto rounded-md bg-ink/[0.05] p-3 font-mono text-[11px] text-ink/80">
              {endpoint.example}
            </pre>
          </article>
        ))}
      </section>

      <section className="mt-10 space-y-3 rounded-2xl border border-dashed border-ink/15 bg-cream p-5">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.2em] text-ink/55">
          Coming in V1.5
        </h2>
        <ul className="list-inside list-disc space-y-1 text-sm text-ink/65">
          <li>Webhook subscriptions (Phase B) — receive events.* and bookings.* deliveries.</li>
          <li>Booking write surface (Phase D) — POST /api/v1/bookings with vendor + couple flows.</li>
          <li>
            Rate limiting — currently unrate-limited. Expect ~60 RPM per token / per IP in V1.5.
          </li>
          <li>OAuth 2.0 + service-account distinction.</li>
        </ul>
      </section>
    </main>
  );
}
