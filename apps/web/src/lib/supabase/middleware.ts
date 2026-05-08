import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_SESSION_COOKIE_NAME, signGuestSession } from "@/lib/server/guest-session";

export async function updateSession(request: NextRequest) {
  // ─── 1. Magic-link entry: /[event-slug]?invite=<token> ─────────────────
  // Cookies can only be set on responses from middleware / route handlers /
  // server actions in Next.js 15 — never from a Server Component during
  // render. So we intercept here, validate the token via the service-role
  // client, log the scan, set the guest cookie, and 302 to the clean URL.
  const inviteRedirect = await maybeHandleInvite(request);
  if (inviteRedirect) return inviteRedirect;

  // ─── 2. Supabase auth refresh + dashboard gate ─────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /dashboard routes — redirect to /login if unauthenticated.
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // If signed in and visiting /login, redirect to /dashboard.
  if (user && request.nextUrl.pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

/**
 * If the request URL is `/<slug>?invite=<token>` AND the token resolves to a
 * guest of an event with that slug, sign a JWT, set the cookie, log the scan,
 * and redirect to the clean URL `/<slug>`. Returns null otherwise so the
 * regular auth flow continues.
 */
async function maybeHandleInvite(request: NextRequest): Promise<NextResponse | null> {
  const invite = request.nextUrl.searchParams.get("invite");
  if (!invite) return null;

  const path = request.nextUrl.pathname;
  if (
    path.length <= 1 ||
    path.startsWith("/dashboard") ||
    path.startsWith("/auth") ||
    path.startsWith("/login") ||
    path.startsWith("/api/") ||
    path.startsWith("/_next")
  ) {
    return null;
  }

  const slug = path.replace(/^\//, "").split("/")[0]?.toLowerCase();
  if (!slug) return null;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createSupabaseClient<any>(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Validate token + slug match
  const { data: guestRow } = await admin
    .from("guests")
    .select("guest_id, event_id, qr_token, scan_tracking_opt_out, events!inner(slug)")
    .eq("qr_token", invite)
    .ilike("events.slug", slug)
    .is("deleted_at", null)
    .maybeSingle();

  if (!guestRow) return null; // invalid / mismatched — let the page render the generic landing

  // Sign the JWT bound to this token (rotation invalidates by qr_token mismatch).
  const jwt = await signGuestSession({
    guest_id: guestRow.guest_id as string,
    event_id: guestRow.event_id as string,
    qr_token: guestRow.qr_token as string,
  });

  // Best-effort scan log; never block the redirect on logging failures.
  if (!guestRow.scan_tracking_opt_out) {
    const userAgent = request.headers.get("user-agent");
    const fwdFor = request.headers.get("x-forwarded-for");
    const ip = fwdFor?.split(",")[0]?.trim() ?? null;
    const ipAnon = ip ? ip.split(".").slice(0, 3).join(".") + ".0" : null;
    void admin.from("scan_events").insert({
      event_id: guestRow.event_id,
      guest_id: guestRow.guest_id,
      source: "browser",
      context: { from: "qr_or_link" },
      user_agent: userAgent,
      ip_anon: ipAnon,
    });
  }

  // Strip ?invite= and redirect.
  const cleanUrl = request.nextUrl.clone();
  cleanUrl.searchParams.delete("invite");

  const response = NextResponse.redirect(cleanUrl);
  response.cookies.set(GUEST_SESSION_COOKIE_NAME, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return response;
}
