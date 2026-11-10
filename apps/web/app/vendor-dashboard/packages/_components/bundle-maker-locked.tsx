'use client';

/**
 * 🔒 THE BUNDLE MAKER, LOCKED — shown, never hidden (Build 6 · Lane D; owner 10 Nov 2026: *"we do not hide it … show
 * a lock … tapping it will explain what is there"* · *"always show the Problem and Solution"*).
 *
 * A shop that may not use the Bundle Maker (`canUse('bundleMaker')`, lib/locks.ts) and reaches its address anyway (a
 * link, a reload) gets the SHARED explainer — The problem · The solution · a view-only preview · the papers progress ·
 * Get verified — never a second lock screen of its own. ✕ goes back to the Shop.
 */
import { useRouter } from 'next/navigation';
import { LockExplainer, type LockNeed } from '@/app/_components/lock/locked-feature';
import { BundlePreviewSample } from './bundle-preview-sample';

export function BundleMakerLocked({ need, closeHref }: { need: LockNeed; closeHref: string }) {
  const router = useRouter();
  return <LockExplainer lock="bundleMaker" need={need} preview={<BundlePreviewSample />} onClose={() => router.push(closeHref)} />;
}
