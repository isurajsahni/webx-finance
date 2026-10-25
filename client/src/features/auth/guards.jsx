import { Navigate, Outlet, useLocation } from 'react-router';
import { ErrorState, LoadingState } from '@/components/ui';
import { LandingPage } from '@/features/landing/LandingPage';
import { useAuth } from './AuthContext';

export function RequireAuth() {
  const { user, isLoading, error } = useAuth();
  const location = useLocation();
  if (isLoading) return <div className="grid min-h-screen place-items-center"><LoadingState /></div>;
  if (error) return <div className="grid min-h-screen place-items-center"><ErrorState error={error} onRetry={() => window.location.reload()} /></div>;
  // Signed-out visitors to the home page see the landing page; anything else goes to sign-in.
  if (!user) return location.pathname === '/' ? <LandingPage /> : <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RequireOwner() {
  const { isOwner } = useAuth();
  if (!isOwner) {
    return (
      <div className="card">
        <ErrorState title="Owner access only" error={{ message: 'Only the owner can open Settings. Ask the owner if you need a change here.' }} />
      </div>
    );
  }
  return <Outlet />;
}
