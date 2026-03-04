import { Navigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { ReactNode } from 'react';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { isAuthenticated, authInitializing, user } = useAuth();

  if (authInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Restoring session...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
