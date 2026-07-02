import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
export function ProtectedRoute() {
  const auth = useAuth(); const location = useLocation();
  if (auth.isLoading) return <div className="grid min-h-screen place-items-center bg-canvas"><LoaderCircle className="h-7 w-7 animate-spin text-brand-600"/></div>;
  return auth.isAuthenticated ? <Outlet/> : <Navigate to="/login" replace state={{ from: location.pathname }}/>;
}
