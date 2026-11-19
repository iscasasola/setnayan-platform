import type { ReactNode } from 'react';

/** The lab's shell template — the same `.sn-page-enter` wrapper the four real shells use, so Enter and Push play here. */
export default function MotionScreensLabTemplate({ children }: { children: ReactNode }) {
  return <div className="sn-page-enter">{children}</div>;
}
