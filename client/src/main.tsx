import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { ProtectedRoute } from './components/RouteGuards';
import { AuthProvider } from './context/AuthContext';
import { ForgotPassword } from './pages/ForgotPassword';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { SignUp } from './pages/SignUp';
import { VerifyEmail } from './pages/VerifyEmail';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Auth: public. */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* Auth: signed in, any role. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />
          </Route>
          {/* Auth: public fallback. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
