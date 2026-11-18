import { notFound } from 'next/navigation';
import { RiseRouteLabSheet } from './lab-sheet';

export default function RiseRouteLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <RiseRouteLabSheet />;
}
