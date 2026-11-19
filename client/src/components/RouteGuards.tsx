import type { ReactNode } from 'react';
import { Link, Navigate, Outlet } from 'react-router';
import type { Role } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { AuthCard } from './AuthCard';
import { Feedback } from './Feedback';

export function ProtectedRoute({ children }: { children?: ReactNode }) {
  const { status, reload } = useAuth();

  if (status === 'anonymous') return <Navigate to="/login" replace />;
  if (status === 'loading') return <AuthCard title="Loading your account"><Feedback tone="info">Checking your session…</Feedback></AuthCard>;
  if (status === 'unavailable') {
    return (
      <AuthCard title="Account unavailable">
        <Feedback tone="error">Could not load your account.</Feedback>
        <button className="primary-button mt-4" onClick={() => void reload()}>Try again</button>
      </AuthCard>
    );
  }
  return children ?? <Outlet />;
}

export function RoleRoute({ roles }: { roles: readonly Role[] }) {
  const { user } = useAuth();
  const allowed = user && roles.includes(user.role);
  return (
    <ProtectedRoute>
      {allowed ? <Outlet /> : (
        <AuthCard title="Access denied">
          <Feedback tone="error">Your role does not have access to this page.</Feedback>
          <Link to="/" className="auth-link mt-4 inline-block">Back to Home</Link>
        </AuthCard>
      )}
    </ProtectedRoute>
  );
}
