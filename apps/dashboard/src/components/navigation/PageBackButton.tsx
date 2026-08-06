import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

interface PageBackButtonProps {
  className?: string;
  fallbackTo?: string;
}

export function PageBackButton({ className = '', fallbackTo = '/' }: PageBackButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();

  if (location.pathname === '/') return null;

  const goBack = () => {
    if (location.key === 'default') {
      navigate(fallbackTo);
      return;
    }
    navigate(-1);
  };

  return (
    <button
      type="button"
      aria-label="Go back"
      onClick={goBack}
      className={`focus-ring inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-brand-700 ${className}`}
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Back</span>
    </button>
  );
}
