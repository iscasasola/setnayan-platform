'use client';

/**
 * Client motion island for /download — the page stays a Server Component (ISR);
 * all data (DESKTOP_RELEASE, nav label) is fetched server-side and passed in as
 * props. This island owns the only motion and adds NOTHING to the IA: wrappers
 * render server-passed children verbatim, and ProvisionCard reproduces the
 * DownloadCard markup 1:1 with motion hooks + data-* markers added.
 *
 * Signature (the page's ONE moment): the DownloadCard "provisions itself" on entry
 * — header settles, the four spec rows stagger up, a single champagne hairline draws
 * left-to-right across the spec list's top edge, and the mulberry button lands last
 * (with a desktop-only magnetic pull). Everything else is a quiet Reveal. No
 * PanelThread anywhere. a11y: opacity-only (content stays in the a11y tree),
 * prefers-reduced-motion rests everything in its final state, useGSAP cleanup.
 */

import Link from 'next/link';
import { Apple, Download } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  useReveal,
  useLineReveal,
  useProvision,
  useMagnetic,
} from '@/app/_components/marketing/_premium';

/** Quiet staggered rise of [data-reveal-item] children. */
export function RevealGroup({
  children,
  className,
  stagger = 0.08,
  y = 16,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  y?: number;
}) {
  const ref = useReveal({ stagger, y });
  return (
    <div ref={ref as React.RefObject<HTMLDivElement>} className={className}>
      {children}
    </div>
  );
}

/** Serif line-reveal on the hero <h1> (above the fold → fires on mount). */
export function LineRevealH1({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useLineReveal({ trigger: 'mount' });
  return (
    <h1 ref={ref as React.RefObject<HTMLHeadingElement>} className={className}>
      {children}
    </h1>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div data-provision-item className="flex items-center justify-between gap-3">
      <dt className="font-mono text-[10px] uppercase tracking-[0.15em] text-ink/55">
        {label}
      </dt>
      <dd className="text-right text-ink/80">{children}</dd>
    </div>
  );
}

/**
 * ProvisionCard — the DownloadCard, self-assembling on entry. Markup is a faithful
 * copy of the server DownloadCard; the only additions are the useProvision scope,
 * data-provision-item markers, the champagne [data-provision-rule] hairline that
 * draws across the spec-list top edge (the page's one gold gesture), and the
 * magnetic ref on the mulberry button.
 */
export function ProvisionCard({
  filename,
  sizeBytes,
  version,
  publishedAt,
  label,
}: {
  filename: string;
  sizeBytes: number;
  version: string;
  publishedAt: string;
  label: string;
}) {
  const cardRef = useProvision();
  const btnRef = useMagnetic();

  return (
    <div
      ref={cardRef as React.RefObject<HTMLDivElement>}
      className="mx-auto w-full max-w-md self-center rounded-3xl border border-ink/10 bg-cream p-6 shadow-[0_30px_80px_-40px_rgba(26,26,26,0.25)]"
    >
      <div data-provision-item className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-cream">
            <Apple aria-hidden className="h-6 w-6" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-sm font-semibold text-ink">Setnayan.app</p>
            <p className="font-mono text-[11px] uppercase tracking-[0.15em] text-ink/55">
              macOS &middot; Apple Silicon
            </p>
          </div>
        </div>
        <span className="rounded-full bg-terracotta/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.15em] text-terracotta-700">
          v{version}
        </span>
      </div>

      {/* The champagne hairline draws L→R across the spec-list top edge as the rows
          land — the page's single gold gesture (replaces the plain ink top border;
          rests fully drawn under reduced-motion / no-JS). */}
      <dl className="relative mt-6 space-y-2 pt-4 text-sm">
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px w-full"
          viewBox="0 0 100 1"
          preserveAspectRatio="none"
        >
          <line
            data-provision-rule
            x1="0"
            y1="0.5"
            x2="100"
            y2="0.5"
            stroke="var(--m-orange-2)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <Row label="File">
          <code className="font-mono text-xs text-ink/75">{filename}</code>
        </Row>
        <Row label="Size">{(sizeBytes / 1024 / 1024).toFixed(1)} MB</Row>
        <Row label="Released">{publishedAt}</Row>
        <Row label="Verified by">SHA-256 + Tauri code signature</Row>
      </dl>

      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        ref={btnRef as React.RefObject<HTMLAnchorElement>}
        data-provision-item
        href="/api/download/mac"
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
      >
        <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} />
        {label}
      </a>
    </div>
  );
}
