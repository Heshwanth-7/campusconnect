import { Ticket, Attendance } from './pages/TicketAttendance';
import { Scanner } from './pages/Scanner';
import { MyRegistrations } from './pages/MyRegistrations';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import { AppNav } from './components/AppNav';
import { ProtectedRoute, RoleRoute } from './components/RouteGuards';
import { AuthProvider } from './context/AuthContext';
import { EventDetail } from './pages/EventDetail';
import { EventForm } from './pages/EventForm';
import { Events } from './pages/Events';
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
            <Route element={<AppNav />}>
              <Route path="/" element={<Home />} />
              <Route path="/events" element={<Events key="all" />} />
              <Route path="/registrations/:id/ticket" element={<Ticket />} />
              <Route path="/registrations/mine" element={<MyRegistrations />} />
              <Route path="/events/mine" element={<Events key="mine" mine />} />
              <Route path="/events/:id" element={<EventDetail />} />
              {/* Auth: event owner or admin. */}
              <Route path="/events/:id/edit" element={<EventForm />} />
              {/* Auth: organizer or admin. */}
              <Route element={<RoleRoute roles={['ORGANIZER', 'ADMIN']} />}>
                <Route path="/events/:id/scanner" element={<Scanner />} />
                <Route path="/events/:id/attendance" element={<Attendance />} />
                <Route path="/events/new" element={<EventForm />} />
              </Route>
            </Route>
          </Route>
          {/* Auth: public fallback. */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
