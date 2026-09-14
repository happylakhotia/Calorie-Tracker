import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Sidebar from './components/Sidebar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import LogPage from './pages/LogPage';
import EntriesPage from './pages/EntriesPage';
import ReportsPage from './pages/ReportsPage';
import GoalsPage from './pages/GoalsPage';
import ChatPage from './pages/ChatPage';

import MobileNavBar from './components/MobileNavBar';
import useAuth from './context/useAuth';
import { getInitials } from './utils/helpers';
import { Flame, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Page title mapping
const PAGE_TITLES = {
  '/dashboard': '',           // dashboard has its own full header
  '/log': 'Log Meal',
  '/entries': 'Food Entries',
  '/reports': 'Nutrition Reports',
  '/goals': 'Health Goals',
  '/chat': 'AI Chat',
};

function AppLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const title = PAGE_TITLES[location.pathname] ?? 'NutriTrack';
  const isDashboard = location.pathname === '/dashboard';
  const isChat = location.pathname === '/chat';

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div
      className="app-layout"
      style={isChat ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : undefined}
    >
      {/* Desktop Sidebar (hidden <= 768px via CSS) */}
      <Sidebar />

      {/* Mobile Top Header (only visible <= 768px via CSS) */}
      <header className="mobile-header">
        <div className="mobile-header-brand" onClick={() => navigate('/dashboard')}>
          <div className="mobile-header-logo">
            <Flame size={18} color="#FFFFFF" />
          </div>
          <span className="mobile-header-title">NutriTrack</span>
        </div>
        <div className="mobile-header-user">
          <div
            className="mobile-user-badge"
            onClick={handleLogout}
            title={`Logged in as ${user?.name || 'User'}. Tap to log out.`}
            id="mobile-btn-logout"
          >
            <span className="mobile-avatar">{getInitials(user?.name)}</span>
            <LogOut size={13} className="mobile-logout-icon" />
          </div>
        </div>
      </header>

      {/* Desktop Topbar — hidden on dashboard since it has its own header, hidden on mobile */}
      {!isDashboard && (
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
          </div>
        </header>
      )}

      <main
        className={`main-content${isChat ? ' is-chat-page' : ''}`}
        style={{
          ...(isDashboard ? { paddingTop: 0 } : {}),
          ...(isChat ? { height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
        }}
      >
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar (only visible <= 768px via CSS) */}
      <MobileNavBar />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--color-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-sm)',
              boxShadow: 'var(--shadow-lg)',
            },
          }}
        />
        <Routes>
          {/* Public */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          {/* Protected app routes */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <AppLayout><DashboardPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/log"
            element={
              <ProtectedRoute>
                <AppLayout><LogPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/entries"
            element={
              <ProtectedRoute>
                <AppLayout><EntriesPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout><ReportsPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/goals"
            element={
              <ProtectedRoute>
                <AppLayout><GoalsPage /></AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <AppLayout><ChatPage /></AppLayout>
              </ProtectedRoute>
            }
          />

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
