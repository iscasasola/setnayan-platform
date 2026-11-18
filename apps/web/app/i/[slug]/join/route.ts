import { NextResponse, type NextRequest } from 'next/server';
import { cleanInviteSlug, SUPPLIER_INVITE_COOKIE, SUPPLIER_INVITE_COOKIE_MAX_AGE } from '@/lib/supplier-invite';

/**
 * 🤝 "Create my free shop" on a supplier's invite door (`/i/<slug>`). Remembers WHICH shop's link this is — a cookie,
 * so it survives the shipped shop setup's own error round trips and a Google / Apple sign-in — then opens the shipped
 * shop setup, unchanged but for its "Invited by" line. The shop-creation action (`becomeVendor`) reads the cookie once
 * the shop exists, writes the handshake (`supplier_invite_join`) and clears it.
 *
 * It writes nothing but the cookie: a shop that is never made leaves no record.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug: raw } = await params;
  const slug = cleanInviteSlug(raw);
  const res = NextResponse.redirect(new URL('/open-shop', req.url));
  if (slug) {
    res.cookies.set(SUPPLIER_INVITE_COOKIE, slug, {
      path: '/',
      maxAge: SUPPLIER_INVITE_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
  }
  return res;
}
