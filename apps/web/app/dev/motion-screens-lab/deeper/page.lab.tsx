import { notFound } from 'next/navigation';
import { MotionScreensLabStage } from '../stage';

/** A page one step deeper in the lab's section — what Push arrives on, and what Picture leads lands its photo in. */
export default function MotionScreensLabDeeperPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <MotionScreensLabStage page="deeper" />;
}
