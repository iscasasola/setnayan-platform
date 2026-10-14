import { notFound } from 'next/navigation';
import { CanvasMaker } from '@/app/vendor-dashboard/services/_components/canvas-maker';

export default async function CardMakerLabPage() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-8">
      <CanvasMaker
        categoryValue=""
        categoryLabel=""
        categoryOptions={[{ key: 'your-coverage', label: 'What you cover', options: [{ value: 'catering', label: 'Catering', standing: 'covered' }] }]}
        otherCategories={[]}
        vendorProfileId="00000000-0000-4000-8000-0000000000bb"
        shopName="Tita Nena's Catering"
        initial={null}
      />
    </div>
  );
}
