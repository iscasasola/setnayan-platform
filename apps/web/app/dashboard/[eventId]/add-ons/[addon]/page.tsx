import Link from 'next/link';
import { notFound } from 'next/navigation';
import { IterationPlaceholder } from '../../_components/placeholder';
import { createClient } from '@/lib/supabase/server';

const ADD_ON_META: Record<
  string,
  { iteration: string; title: string; blurb: string; hint?: string }
> = {
  orders: {
    iteration: 'Iteration 0034',
    title: 'Orders',
    blurb:
      'Cart · checkout · BDO + GCash QR · screenshot upload · admin reconciliation (24-hr SLA).',
  },
  'mood-board': {
    iteration: 'Iteration 0010',
    title: 'Mood Board',
    blurb:
      'Per-role + venue palettes. Setnayan Guide evaluates cohesion · contrast · temperature · saturation · cultural defaults.',
  },
  papic: {
    iteration: 'Iteration 0012',
    title: 'Papic',
    blurb:
      'Web-only V1 (native moved to Phase 2). getUserMedia + MediaRecorder + MediaPipe-WASM face detection · QR tagging · R2 upload pipeline.',
  },
  panood: {
    iteration: 'Iteration 0011',
    title: 'Panood',
    blurb:
      'Cloudflare Stream Live SFU → YouTube RTMP relay. Web broadcaster + camera operator. AI Video Highlight · AI Edited Highlight · Same-Day Edit.',
  },
  'photo-delivery': {
    iteration: 'Iteration 0009',
    title: 'Photo Delivery',
    blurb:
      'Google Drive integration for full-resolution photo handoff post-event. 30-day post-download compression rule applies.',
  },
  led: {
    iteration: 'Iteration 0005',
    title: 'LED Background',
    blurb:
      '8K template render pipeline · Photo Pool blend · USB delivery for venue playback.',
  },
  patiktok: {
    iteration: 'Iteration 0017',
    title: 'Patiktok',
    blurb:
      'Vertical-reel template gallery (9:16 · 1080×1920 · 1-30s) with render-on-demand. Same FFmpeg pipeline backbone as Save-the-Date + Papic personal reels.',
  },
  'supplies-marketplace': {
    iteration: 'Iteration 0018',
    title: 'Supplies Marketplace',
    blurb:
      'Wedding-day supplies + favors from vetted Filipino suppliers — souvenirs, tokens, sponsor gifts, ceremony props — direct-to-venue with logistics quoted up front.',
  },
};

type Props = {
  params: Promise<{ eventId: string; addon: string }>;
};

async function isInternalAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;

  const { data: me } = await supabase
    .from('users')
    .select('is_internal, is_team_member')
    .eq('user_id', user.id)
    .maybeSingle();
  return Boolean(me?.is_internal || me?.is_team_member);
}

export default async function AddOnDetailPage({ params }: Props) {
  const { eventId, addon } = await params;
  const meta = ADD_ON_META[addon];
  if (!meta) notFound();
  const showDevCodes = await isInternalAdmin();

  return (
    <div className="space-y-4">
      <Link
        href={`/dashboard/${eventId}/add-ons`}
        className="font-mono text-xs uppercase tracking-[0.2em] text-ink/50 hover:text-terracotta"
      >
        ‹ Back to add-ons
      </Link>
      <IterationPlaceholder
        iteration={meta.iteration}
        title={meta.title}
        blurb={meta.blurb}
        hint={meta.hint}
        showIteration={showDevCodes}
      />
    </div>
  );
}
