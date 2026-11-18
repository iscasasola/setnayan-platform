import { notFound } from 'next/navigation';

/** Nothing risen over the lab's sheet. */
export default function NothingRisenHere() {
  if (process.env.NODE_ENV === 'production') notFound();
  return null;
}
