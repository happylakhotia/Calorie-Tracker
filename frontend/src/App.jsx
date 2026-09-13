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
  const title = PAGE_TITLES[location.pathname] ?? 'NutriTrack';
  const isDashboard = location.pathname === '/dashboard';
  const isChat = location.pathname === '/chat';

  return (
    <div
      className="app-layout"
      style={isChat ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden' } : undefined}
    >
      <Sidebar />
      {/* Topbar — hidden on dashboard since it has its own header */}
      {!isDashboard && (
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <div className="topbar-actions">
          </div>
        </header>
      )}
      <main
        className="main-content"
        style={{
          ...(isDashboard ? { paddingTop: 0 } : {}),
          ...(isChat ? { height: '100vh', maxHeight: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' } : {}),
        }}
      >
        {children}
      </main>
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
