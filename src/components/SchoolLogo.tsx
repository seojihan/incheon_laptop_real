import { useState } from 'react';
import { Laptop } from 'lucide-react';
import { cn } from '../lib/utils';

// Place the official school emblem at public/images/school-logo.png.
// Until that file exists, the previous laptop icon is shown instead.
const LOGO_SRC = './images/school-logo.png';

interface SchoolLogoProps {
  className?: string;
}

export default function SchoolLogo({ className }: SchoolLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={cn('flex items-center justify-center rounded-2xl bg-blue-700 text-white', className)}>
        <Laptop className="h-5 w-5" strokeWidth={2.5} />
      </span>
    );
  }

  return (
    <span className={cn('flex items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-white p-1', className)}>
      <img src={LOGO_SRC} alt="인천중산고등학교 교표" className="h-full w-full object-contain" onError={() => setFailed(true)} />
    </span>
  );
}
