import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Flame, Eye, EyeOff, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../context/useAuth';
import { getApiError } from '../utils/helpers';

// ── Design tokens matching NourishLoop ─────────────────────────────────────────
const T = {
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  border: 'oklch(0.9 0.024 120)',
  borderLight: 'oklch(0.93 0.018 115)',
  primary: 'oklch(0.48 0.098 155)',
  primaryDark: 'oklch(0.40 0.095 152)',
  primaryForeground: '#FFFFFF',
  text: 'oklch(0.24 0.032 152)',
  muted: 'oklch(0.53 0.028 145)',
  shadowSoft: '0 2px 10px rgba(0, 0, 0, 0.05)',
  cardShadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
};

const FEATURES = [
  'Photo and label calorie scanning',
  'Weekly macro and micro reports',
  'A coach that logs by chat',
];

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const signup = mode === 'signup';

  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setForm({ name: '', email: '', password: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      return toast.error('Email and password are required.');
    }
    if (signup && !form.name) {
      return toast.error('Name is required.');
    }
    if (signup && form.password.length < 6) {
      return toast.error('Password must be at least 6 characters.');
    }

    setLoading(true);
    try {
      if (signup) {
        await register(form.name, form.email, form.password);
        toast.success("Account created! Let's track your nutrition 💪");
      } else {
        await login(form.email, form.password);
        toast.success('Welcome back! 🎉');
      }
      navigate('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-root">
      <style>{`
        .login-page-root {
          display: grid;
          min-height: 100vh;
          grid-template-columns: 1fr 1fr;
          background: ${T.bg};
          width: 100%;
        }
        @media (max-width: 860px) {
          .login-page-root {
            grid-template-columns: 1fr !important;
          }
          .login-hero-panel {
            display: none !important;
          }
          .login-form-container {
            padding: 24px 16px !important;
            min-height: 100vh;
          }
          .login-form-card {
            padding: 24px 20px 22px !important;
            border-radius: 18px !important;
          }
          .login-mobile-brand {
            display: flex !important;
          }
        }
      `}</style>
      {/* ── Left Hero Panel (Hidden on small mobile, flex on desktop) ── */}
      <div
        className="login-hero-panel"
        style={{
          background: 'linear-gradient(175deg, oklch(0.40 0.095 152), oklch(0.48 0.098 155))',
          color: T.primaryForeground,
          padding: '48px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          minHeight: '100vh',
          boxSizing: 'border-box',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }} onClick={() => navigate('/')}>
          <span style={{
            display: 'grid',
            placeItems: 'center',
            width: 38,
            height: 38,
            borderRadius: 14,
            background: 'rgba(255, 255, 255, 0.18)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
          }}>
            <Flame size={20} color="#FFFFFF" />
          </span>
          <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.3px', color: '#FFFFFF' }}>
            NutriTrack
          </span>
        </div>

        {/* Hero Copy */}
        <div style={{ maxWidth: 440, margin: '60px 0' }}>
          <h1 style={{
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1.22,
            letterSpacing: '-0.6px',
            color: '#FFFFFF',
            margin: '0 0 18px 0',
          }}>
            One small log a day keeps the loop alive.
          </h1>
          <p style={{
            fontSize: 14.5,
            lineHeight: 1.65,
            opacity: 0.85,
            margin: '0 0 28px 0',
            color: '#FFFFFF',
          }}>
            Log with photos, conversational chat, or manual entry. View macro and micronutrient trends that help you stay consistent.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {FEATURES.map((feat) => (
              <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.2)',
                  fontSize: 11,
                  fontWeight: 700,
                  flexShrink: 0,
                }}>
                  ✓
                </span>
                <span style={{ opacity: 0.95 }}>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{ fontSize: 12.5, opacity: 0.65 }}>
          © {new Date().getFullYear()} Nutritrack @Happy · All rights reserved.
        </div>
      </div>

      {/* ── Right Form Panel ── */}
      <div
        className="login-form-container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '32px 24px',
        }}
      >
        <div
          className="login-form-card"
          style={{
            width: '100%',
            maxWidth: 400,
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 22,
            padding: '32px 32px 28px',
            boxShadow: T.cardShadow,
            boxSizing: 'border-box',
          }}
        >
          {/* Mobile Brand Logo */}
          <div
            className="login-mobile-brand"
            onClick={() => navigate('/')}
            style={{
              display: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginBottom: 20,
              cursor: 'pointer',
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: 10, background: T.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Flame size={18} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.3px' }}>NutriTrack</span>
          </div>

          {/* Tabs */}
          <div style={{
            marginBottom: 24,
            display: 'flex',
            borderRadius: 14,
            background: T.surface2,
            border: `1px solid ${T.border}`,
            padding: 4,
            fontSize: 13.5,
            fontWeight: 600,
          }}>
            {[
              ['login', 'Log in'],
              ['signup', 'Sign up'],
            ].map(([key, label]) => {
              const active = mode === key;
              return (
                <button
                  key={key}
                  id={`tab-${key}`}
                  type="button"
                  onClick={() => handleModeChange(key)}
                  style={{
                    flex: 1,
                    borderRadius: 10,
                    padding: '8px 0',
                    border: 'none',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 13.5,
                    transition: 'all 0.18s ease',
                    background: active ? T.surface : 'transparent',
                    color: active ? T.text : T.muted,
                    boxShadow: active ? '0 1px 4px rgba(0, 0, 0, 0.08)' : 'none',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Heading */}
          <h2 style={{
            fontSize: 22,
            fontWeight: 800,
            color: T.text,
            margin: '0 0 4px 0',
            letterSpacing: '-0.3px',
          }}>
            {signup ? 'Create your account' : 'Welcome back'}
          </h2>
          <p style={{
            fontSize: 13.5,
            color: T.muted,
            margin: '0 0 22px 0',
          }}>
            {signup ? 'Your log stays private to you.' : 'Pick up your streak.'}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {signup && (
              <div>
                <label
                  htmlFor="input-name"
                  style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}
                >
                  Name
                </label>
                <input
                  id="input-name"
                  type="text"
                  placeholder="Happy Lakhotia"
                  value={form.name}
                  onChange={set('name')}
                  autoComplete="name"
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${T.borderLight}`,
                    background: T.surface2,
                    fontSize: 14,
                    color: T.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = T.primary)}
                  onBlur={(e) => (e.target.style.borderColor = T.borderLight)}
                />
              </div>
            )}

            <div>
              <label
                htmlFor="input-email"
                style={{ display: 'block', fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 6 }}
              >
                Email
              </label>
              <input
                id="input-email"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={set('email')}
                autoComplete="email"
                style={{
                  width: '100%',
                  padding: '11px 14px',
                  borderRadius: 10,
                  border: `1.5px solid ${T.borderLight}`,
                  background: T.surface2,
                  fontSize: 14,
                  color: T.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.18s',
                }}
                onFocus={(e) => (e.target.style.borderColor = T.primary)}
                onBlur={(e) => (e.target.style.borderColor = T.borderLight)}
              />
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <label
                  htmlFor="input-password"
                  style={{ fontSize: 13, fontWeight: 600, color: T.text }}
                >
                  Password
                </label>
                {signup && (
                  <span style={{ fontSize: 11.5, color: T.muted }}>At least 6 characters</span>
                )}
              </div>
              <div style={{ position: 'relative' }}>
                <input
                  id="input-password"
                  type={showPass ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={signup ? 'new-password' : 'current-password'}
                  style={{
                    width: '100%',
                    padding: '11px 40px 11px 14px',
                    borderRadius: 10,
                    border: `1.5px solid ${T.borderLight}`,
                    background: T.surface2,
                    fontSize: 14,
                    color: T.text,
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.18s',
                  }}
                  onFocus={(e) => (e.target.style.borderColor = T.primary)}
                  onBlur={(e) => (e.target.style.borderColor = T.borderLight)}
                />
                <button
                  type="button"
                  id="btn-toggle-password"
                  onClick={() => setShowPass((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: 8,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: T.muted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                  }}
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              id="btn-auth-submit"
              disabled={loading}
              style={{
                marginTop: 6,
                width: '100%',
                padding: '12px 20px',
                background: loading ? 'oklch(0.55 0.08 155)' : T.primary,
                color: '#FFFFFF',
                border: 'none',
                borderRadius: 11,
                fontSize: 14.5,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: '0 3px 12px rgba(45,90,67,0.22)',
                transition: 'all 0.18s ease',
              }}
            >
              {loading && <Loader2 size={17} className="animate-spin" />}
              {signup ? 'Create account' : 'Log in'}
            </button>

          </form>

          {/* Switch mode */}
          <p style={{
            textAlign: 'center',
            fontSize: 12.5,
            color: T.muted,
            marginTop: 20,
            marginBottom: 0,
          }}>
            {signup ? 'Already have an account? ' : 'New here? '}
            <button
              type="button"
              id="btn-switch-auth-mode"
              onClick={() => handleModeChange(signup ? 'login' : 'signup')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                fontSize: 12.5,
                fontWeight: 700,
                color: T.text,
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
            >
              {signup ? 'Log in' : 'Create one'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
