/**
 * /v/[slug]/dates — the address a shop's printed "Check a date" QR opens (owner 2026-10-28, DECISION_LOG
 * "✅📅 CHECK A DATE — APPROVED; BUILD `/v/[slug]/dates`").
 *
 * SHOP-02 v7 (owner-approved 14 Nov 2026): Check a date is no longer a page of its own — it is a sheet over the shop
 * (`app/v/[slug]/_components/check-a-date-over-shop.tsx`). This address keeps working forever (it is printed on
 * stickers and posters): it forwards to the shop with the sheet already open, carrying the day, the services, the step
 * and where the visit came from, so × then shows the shop and never an empty screen.
 *
 * 🔒 The sheet reads only the shop's own month (`readCheckADate`) — never an inquiry. Guard: `no-inquiry-reads.test.ts`.
 */
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { datesSheetHref } from '@/lib/check-a-date';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ d?: string; s?: string; step?: string; src?: string; event?: string }>;
};

export const metadata: Metadata = { title: 'Check a date', robots: { index: false, follow: true } };

export default async function CheckADatePage({ params, searchParams }: Props) {
  const { slug } = await params;
  redirect(datesSheetHref(slug, await searchParams));
}
