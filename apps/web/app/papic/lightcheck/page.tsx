import type { Metadata } from 'next';
import { LightcheckClient } from './_components/lightcheck-client';

/**
 * /papic/lightcheck — THROWAWAY capability + frame-rate probe.
 *
 * M1 + M3 of Papic_Low_Light_Council_Verdict_2026-07-21.md § 7.1. It exists to
 * convert four load-bearing [UNVERIFIED] claims into measurements on a real
 * handset: does this device expose `torch`, `exposureCompensation`, `iso`, and
 * `ImageCapture` — and what frame rate does the camera actually deliver in the
 * dark. Every downstream low-light estimate is gated on those answers.
 *
 * Not linked from anywhere and `noindex` — it is an operator tool, reached by
 * typing the URL. NOT on the capture path: it opens its own stream and shares no
 * code with lib/use-papic-camera.ts, so it cannot affect a live event.
 *
 * DELETE THIS ROUTE once the numbers are recorded in the verdict.
 */

export const metadata: Metadata = {
  title: 'Papic light check',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <LightcheckClient />;
}
