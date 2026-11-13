import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { RiseRoute } from '@/app/_components/rise/rise-route';
import { avatarRowWords } from '@/app/vendor-dashboard/_components/supplier-avatar-rows';

/** The soft tap: the screen is the layout (it rises at once), the body streams into it — the supplier slot's shape. */
export default async function RisenLabRowLayout({ children, params }: { children: ReactNode; params: Promise<{ row: string }> }) {
  if (process.env.NODE_ENV === 'production') notFound();
  const { label, sub } = avatarRowWords((await params).row);
  return (
    <RiseRoute title={label} line={sub} data="avatar-lab">
      {children}
    </RiseRoute>
  );
}
