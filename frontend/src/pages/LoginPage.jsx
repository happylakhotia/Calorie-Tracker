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

  const handleGoogleAuth = () => {
    toast('Google Sign-In integration is in progress.', { icon: '🔒' });
  };

  return (
    <div style={{
      display: 'grid',
      minHeight: '100vh',
      gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
      background: T.bg,
    }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
            Nutritrack
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
            Snap a plate, chat a sentence, or fill the form — your calories, macros and micros land in one private
            place with weekly reports to match.
          </p>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            opacity: 0.95,
          }}>
            {FEATURES.map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: '#FFFFFF',
                  flexShrink: 0,
                }} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer info */}
        <p style={{ fontSize: 12, opacity: 0.65, margin: 0, color: '#FFFFFF' }}>
          Nutritrack @Happy
        </p>
      </div>

      {/* ── Right Auth Form Panel ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '32px 24px',
      }}>
        <div style={{
          width: '100%',
          maxWidth: 400,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 22,
          padding: '32px 32px 28px',
          boxShadow: T.cardShadow,
          boxSizing: 'border-box',
        }}>
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

            {/* Continue with Google */}
            <button
              type="button"
              id="btn-google-auth"
              onClick={handleGoogleAuth}
              style={{
                width: '100%',
                padding: '11px 20px',
                background: T.surface,
                color: T.text,
                border: `1.5px solid ${T.border}`,
                borderRadius: 11,
                fontSize: 13.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'all 0.18s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.primary;
                e.currentTarget.style.background = T.surface2;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.background = T.surface;
              }}
            >
              <svg width="17" height="17" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google</span>
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
