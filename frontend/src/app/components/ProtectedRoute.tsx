import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ReactNode } from 'react';

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authInitializing } = useAuth();
  const location = useLocation();

  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    const redirectTarget = encodeURIComponent(
      `${location.pathname}${location.search}${location.hash}`,
    );
    return <Navigate to={`/login?redirect=${redirectTarget}`} replace />;
  }

  return <>{children}</>;
}
