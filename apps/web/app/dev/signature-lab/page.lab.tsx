/**
 * /dev/signature-lab — the motion standard's SIX SIGNATURE MOMENTS (18 Nov 2026, § 9; prototype Part I) on the SHIPPED
 * shared parts (`app/_components/signature/*`), with no sign-in and no database, so each can be walked at 375 / 390 px
 * beside the prototype: The Tie · Foil glint · Go live · Reply arrives · Day turns · Capiz light. The parts are the
 * app's own; the words are stand-ins. "Play again" remounts a stage — it does not touch the once-only marks, which the
 * lab never reads.
 */
import { notFound } from 'next/navigation';
import { SignatureLabStage } from './stage';

export default function SignatureLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return <SignatureLabStage />;
}
