import { redirect } from 'next/navigation';

/**
 * Legacy /admin/compliance → studio redirect (Money split · 2026-07-10). The surface
 * now lives at /admin/settings?tab=compliance; its body was re-homed into a _surfaces/*
 * file. actions/_components stay in this dir. Params are forwarded so deep-links
 * + post-mutation redirects land on the right tab with their flash intact.
 */
export const dynamic = 'force-dynamic';

export default function Redirect() {
  redirect('/admin/settings?tab=compliance');
}
