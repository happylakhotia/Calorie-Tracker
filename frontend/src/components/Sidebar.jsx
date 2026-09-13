import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, UtensilsCrossed, List, BarChart2,
  Target, MessageCircle, LogOut, Leaf,
} from 'lucide-react';
import useAuth from '../context/useAuth';
import { getInitials } from '../utils/helpers';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/log',       icon: UtensilsCrossed,  label: 'Log Meal' },
  { to: '/entries',   icon: List,             label: 'My Entries' },
  { to: '/reports',   icon: BarChart2,        label: 'Reports' },
  { to: '/goals',     icon: Target,           label: 'Goals' },
  { to: '/chat',      icon: MessageCircle,    label: 'AI Chat' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <aside className="sidebar">

      {/* ── Logo ── */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-icon">
          <Leaf size={18} color="#FFFFFF" />
        </div>
        <div className="sidebar-logo-text">
          <span>NutriTrack</span>
          <span>Precision Health</span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Menu</span>
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            id={`nav-${label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── Footer ── */}
      <div className="sidebar-footer">



        {/* User card / logout */}
        <div
          className="user-card"
          onClick={handleLogout}
          title="Click to logout"
          id="btn-logout"
        >
          <div className="user-avatar">{getInitials(user?.name)}</div>
          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
          </div>
          <LogOut size={14} color="var(--text-muted)" />
        </div>

      </div>
    </aside>
  );
}
