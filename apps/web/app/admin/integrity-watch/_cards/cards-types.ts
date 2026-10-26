/** Props for Integrity watch › Cards — plain data, so the lab draws the same components from fixtures. */
import type { CardReason } from '@/lib/service-card-checks';
import type { ServiceCard } from '@/lib/service-card-view-model';

export type CardStatusFilter = 'open' | 'approved' | 'asked_to_fix' | 'rejected' | 'all';
export type CardReasonFilter = 'any' | 'photo' | 'price' | 'service' | 'words' | 'check_unavailable';
export type CardFlagStatus = 'open' | 'asked_to_fix' | 'rejected' | 'approved' | 'dismissed';

export type CardQueueRow = {
  flagId: number;
  publicId: string;
  status: CardFlagStatus;
  title: string;
  priceLine: string;
  coverUrl: string | null;
  shopName: string;
  shopLine: string;
  shopVerified: boolean;
  filedLabel: string;
  readsLike: string | null;
  reasons: CardReason[];
  afterReject: boolean;
  /** ISO time the flag opened. */
  age: string;
  overSla: boolean;
};

export type PhotoPair = {
  imageFlagPublicId: string;
  hamming: number;
  stillOpen: boolean;
  thisUrl: string | null;
  thisCaption: string;
  sourceUrl: string | null;
  sourceCaption: string;
};

export type CardOpenView = {
  flagId: number;
  publicId: string;
  serviceId: string;
  vendorProfileId: string;
  status: CardFlagStatus;
  flaggedAt: string;
  afterReject: boolean;
  resolutionNotes: string | null;
  card: ServiceCard;
  title: string;
  shopName: string;
  shopState: string;
  shopVerified: boolean;
  shopLine: string;
  filedLabel: string;
  shopCovers: string;
  reasons: CardReason[];
  pairs: PhotoPair[];
  bandRegionLabel: string | null;
};

export type ClaimWordRow = { phrase: string; note: string | null };

/** The chip each reason draws (admin copy may say "flag"; supplier copy never does). */
export const REASON_CHIP: Record<CardReason['code'], { label: string; tone: string }> = {
  photo: { label: 'Photo seen elsewhere', tone: 'photo' },
  price: { label: 'Price outside band', tone: 'price' },
  service: { label: 'Wrong service', tone: 'service' },
  words: { label: 'Claim words', tone: 'words' },
  check_unavailable: { label: 'Check didn’t finish', tone: 'muted' },
};

export const REJECT_REASONS = [
  'Photo belongs to another shop',
  'Price is not real',
  'Filed under the wrong service',
  'Claims that can’t be shown',
  'Other — I’ll write it',
] as const;
