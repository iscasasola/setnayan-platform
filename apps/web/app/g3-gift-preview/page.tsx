// TEMPORARY — preview-only page for 390 px shots of G3 (#7674) inside J7's gift box (#7802). Never on a PR branch.
import { G3GiftPreview } from './preview';

export const dynamic = 'force-dynamic';

export default async function Page({ searchParams }: { searchParams: Promise<{ v?: string }> }) {
  const { v } = await searchParams;
  return <G3GiftPreview v={v ?? 'notices'} />;
}
