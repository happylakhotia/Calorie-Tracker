import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, PlusCircle, List, BarChart2, Target, MessageCircle,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/log',       icon: PlusCircle,      label: 'Log' },
  { to: '/entries',   icon: List,             label: 'Entries' },
  { to: '/reports',   icon: BarChart2,        label: 'Reports' },
  { to: '/goals',     icon: Target,           label: 'Goals' },
  { to: '/chat',      icon: MessageCircle,    label: 'AI Chat' },
];

export default function MobileNavBar() {
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile Navigation">
      <div className="mobile-bottom-nav-inner">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `mobile-nav-item${isActive ? ' active' : ''}`}
            id={`mobile-nav-${label.toLowerCase().replace(/\s/g, '-')}`}
          >
            <div className="mobile-nav-icon-wrap">
              <Icon size={20} />
            </div>
            <span className="mobile-nav-label">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
