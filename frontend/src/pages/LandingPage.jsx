import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, BarChart2, Target, Camera, MessageCircle,
  Check, Zap, UtensilsCrossed, TrendingUp,
  Eye, EyeOff, ArrowRight, Loader2, Sparkles, Shield,
  ChevronRight, Bot, Activity, Heart,
} from 'lucide-react';
import toast from 'react-hot-toast';
import useAuth from '../context/useAuth';
import { getApiError } from '../utils/helpers';

// ── Design tokens matching NourishLoop / Nutritrack ───────────────────────────
const T = {
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  surface3: 'oklch(0.935 0.033 122)',
  border: 'oklch(0.9 0.024 120)',
  borderLight: 'oklch(0.93 0.018 115)',
  primary: 'oklch(0.48 0.098 155)',
  primaryDark: 'oklch(0.40 0.095 152)',
  primaryLight: 'oklch(0.92 0.06 160)',
  mint: 'oklch(0.88 0.08 165)',
  mintFg: 'oklch(0.32 0.07 165)',
  warning: 'oklch(0.75 0.13 70)',
  danger: 'oklch(0.6 0.2 25)',
  text: 'oklch(0.24 0.032 152)',
  secondary: 'oklch(0.34 0.06 155)',
  muted: 'oklch(0.53 0.028 145)',
};

const FEATURES = [
  {
    icon: Camera,
    title: 'AI Photo & Label Scanner',
    desc: 'Snap a plate or nutrition label. Gemini AI identifies items and calculates exact calories, macros, and micronutrients in seconds.',
    tag: 'Computer Vision',
  },
  {
    icon: Bot,
    title: 'NutriBot Conversational Logging',
    desc: 'Speak or type naturally like "I had 2 boiled eggs and avocado toast". NutriBot logs the entire meal and answers nutrition questions.',
    tag: 'Natural Language AI',
  },
  {
    icon: BarChart2,
    title: 'Macro & Micronutrient Reports',
    desc: 'Track weekly calorie averages, protein/carb/fat splits, and deep micronutrient profiles including vitamins, sodium, calcium, and iron.',
    tag: 'Analytics & Insights',
  },
  {
    icon: Target,
    title: 'Dynamic Habit Loop & Goals',
    desc: 'Set custom targets for weight loss, maintenance, or muscle gain. Build a continuous daily streak with interactive habit feedback.',
    tag: 'Goal Tracking',
  },
];

const STATS = [
  { value: '99.4%', label: 'AI Food Recognition' },
  { value: '3 Sec', label: 'Average Log Time' },
  { value: '14+', label: 'Macro & Micro Metrics' },
  { value: '100%', label: 'Private & Secure' },
];

export default function LandingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleStart = (mode = 'login') => {
    if (user) {
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="landing-root">
      {/* ── Scoped Mobile-First Responsive Styles ── */}
      <style>{`
        .landing-root {
          background: ${T.bg};
          min-height: 100vh;
          color: ${T.text};
          overflow-x: hidden;
          width: 100%;
          box-sizing: border-box;
        }

        /* Sticky Header */
        .landing-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(255, 255, 255, 0.94);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-bottom: 1px solid ${T.border};
          transition: all 0.2s ease;
          width: 100%;
        }
        .landing-header-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          box-sizing: border-box;
        }

        .desktop-nav {
          display: none;
          gap: 28px;
          align-items: center;
        }
        @media (min-width: 860px) {
          .desktop-nav {
            display: flex;
          }
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .landing-header-inner {
            padding: 12px 16px;
          }
          .brand-subtitle {
            display: none;
          }
          .header-actions {
            gap: 6px;
          }
          .header-actions .btn-ghost {
            padding: 7px 10px !important;
            font-size: 13px !important;
          }
          .header-actions .btn-primary {
            padding: 8px 14px !important;
            font-size: 13px !important;
          }
        }

        /* Hero Section */
        .landing-hero {
          max-width: 1200px;
          margin: 0 auto;
          padding: 70px 24px 60px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .landing-hero {
            padding: 44px 18px 36px;
          }
        }
        @media (max-width: 480px) {
          .landing-hero {
            padding: 30px 14px 24px;
          }
        }

        .hero-pill-badge {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 6px 14px;
          border-radius: 99px;
          background: oklch(0.88 0.08 165 / 0.35);
          border: 1px solid oklch(0.88 0.08 165 / 0.7);
          color: ${T.primaryDark};
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 24px;
          max-width: 100%;
          box-sizing: border-box;
          line-height: 1.3;
        }
        @media (max-width: 480px) {
          .hero-pill-badge {
            font-size: 11.5px;
            padding: 5px 12px;
            margin-bottom: 18px;
            gap: 5px;
          }
        }

        .hero-title {
          font-size: clamp(28px, 5.5vw, 56px);
          font-weight: 800;
          line-height: 1.16;
          letter-spacing: -0.035em;
          color: ${T.text};
          max-width: 820px;
          margin: 0 0 20px 0;
          word-break: break-word;
        }
        @media (max-width: 480px) {
          .hero-title {
            font-size: 27px;
            line-height: 1.22;
            margin-bottom: 14px;
          }
        }

        .hero-subtitle {
          font-size: clamp(14.5px, 2.2vw, 18px);
          line-height: 1.65;
          color: ${T.muted};
          max-width: 640px;
          margin: 0 0 36px 0;
          padding: 0 4px;
          box-sizing: border-box;
        }
        @media (max-width: 480px) {
          .hero-subtitle {
            font-size: 14px;
            line-height: 1.55;
            margin-bottom: 24px;
          }
        }

        .hero-cta-group {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          justify-content: center;
          margin-bottom: 36px;
          width: 100%;
        }
        @media (max-width: 480px) {
          .hero-cta-group {
            flex-direction: column;
            align-items: center;
            gap: 10px;
            margin-bottom: 26px;
          }
          .hero-cta-group .btn {
            width: 100%;
            max-width: 320px;
            justify-content: center;
            padding: 13px 20px !important;
          }
        }

        .hero-value-pills {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: center;
          gap: 20px;
          font-size: 13px;
          font-weight: 600;
          color: ${T.secondary};
        }
        @media (max-width: 580px) {
          .hero-value-pills {
            gap: 10px 16px;
            font-size: 12px;
          }
        }

        /* Mockup Card */
        .landing-mockup {
          margin-top: 50px;
          width: 100%;
          max-width: 960px;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 24px;
          padding: 28px 32px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.06);
          text-align: left;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .landing-mockup {
            margin-top: 36px;
            padding: 20px 18px;
            border-radius: 18px;
          }
        }
        @media (max-width: 480px) {
          .landing-mockup {
            margin-top: 24px;
            padding: 16px 14px;
            border-radius: 16px;
          }
        }

        .mockup-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid ${T.borderLight};
          padding-bottom: 16px;
          margin-bottom: 20px;
          gap: 10px;
        }
        @media (max-width: 540px) {
          .mockup-topbar {
            flex-direction: column;
            align-items: flex-start;
            gap: 8px;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }
        }

        .mockup-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 20px;
        }
        @media (max-width: 640px) {
          .mockup-grid {
            grid-template-columns: 1fr;
            gap: 14px;
          }
        }

        /* Stats Bar */
        .stats-section {
          background: ${T.surface};
          border-top: 1px solid ${T.border};
          border-bottom: 1px solid ${T.border};
          padding: 36px 24px;
          box-sizing: border-box;
        }
        .stats-grid {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
          text-align: center;
        }
        @media (max-width: 768px) {
          .stats-section {
            padding: 28px 16px;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 20px 16px;
          }
        }
        .stat-value {
          font-size: 32px;
          font-weight: 800;
          color: ${T.primaryDark};
          letter-spacing: -0.5px;
        }
        @media (max-width: 480px) {
          .stat-value {
            font-size: 26px;
          }
        }

        /* Core Features Section */
        .features-section {
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 24px;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .features-section {
            padding: 52px 18px;
          }
        }
        @media (max-width: 480px) {
          .features-section {
            padding: 40px 14px;
          }
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 24px;
        }
        @media (max-width: 640px) {
          .features-grid {
            grid-template-columns: 1fr;
            gap: 16px;
          }
        }

        .feature-card-item {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 20px;
          padding: 28px 24px;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.03);
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        @media (max-width: 480px) {
          .feature-card-item {
            padding: 20px 18px;
            border-radius: 16px;
          }
        }

        /* CTA Banner */
        .cta-banner-section {
          max-width: 1100px;
          margin: 70px auto 80px;
          padding: 0 24px;
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .cta-banner-section {
            margin: 44px auto 54px;
            padding: 0 16px;
          }
        }
        @media (max-width: 480px) {
          .cta-banner-section {
            margin: 32px auto 44px;
            padding: 0 12px;
          }
        }

        .cta-banner-box {
          background: linear-gradient(175deg, oklch(0.40 0.095 152), oklch(0.48 0.098 155));
          border-radius: 28px;
          padding: 54px 40px;
          color: #FFFFFF;
          text-align: center;
          box-shadow: 0 12px 40px rgba(45, 90, 67, 0.25);
          box-sizing: border-box;
        }
        @media (max-width: 768px) {
          .cta-banner-box {
            padding: 40px 24px;
            border-radius: 22px;
          }
        }
        @media (max-width: 480px) {
          .cta-banner-box {
            padding: 32px 18px;
            border-radius: 18px;
          }
          .cta-banner-box button {
            width: 100% !important;
            max-width: 280px;
            justify-content: center;
          }
        }

        /* Footer */
        .landing-footer {
          background: ${T.surface};
          border-top: 1px solid ${T.border};
          padding: 36px 24px 28px;
          box-sizing: border-box;
        }
        .landing-footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        @media (max-width: 560px) {
          .landing-footer {
            padding: 26px 16px 22px;
          }
          .landing-footer-inner {
            flex-direction: column;
            text-align: center;
            gap: 12px;
          }
        }
      `}</style>
      
      {/* ─── Modern Sticky Header ─── */}
      <header className="landing-header">
        <div className="landing-header-inner">
          {/* Logo */}
          <div
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
          >
            <div style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, oklch(0.48 0.098 155), oklch(0.38 0.095 150))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(45, 90, 67, 0.25)',
              flexShrink: 0,
            }}>
              <Flame size={20} color="#FFFFFF" />
            </div>
            <div>
              <span style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.3px', display: 'block', lineHeight: 1.1 }}>
                NutriTrack
              </span>
              <span className="brand-subtitle" style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.02em' }}>
                Precision Health
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="desktop-nav">
            <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              Features
            </a>
            <a href="#stats" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              Metrics
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="header-actions">
            {user ? (
              <button
                className="btn btn-primary"
                onClick={() => navigate('/dashboard')}
                id="btn-go-dashboard"
                style={{
                  padding: '9px 18px',
                  borderRadius: 12,
                  fontSize: 13.5,
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(45, 90, 67, 0.2)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Dashboard</span> <ArrowRight size={15} />
              </button>
            ) : (
              <>
                <button
                  className="btn btn-ghost"
                  onClick={() => navigate('/login')}
                  id="btn-nav-login"
                  style={{ fontSize: 13.5, fontWeight: 600, color: T.text }}
                >
                  Sign In
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => navigate('/login')}
                  id="btn-nav-start"
                  style={{
                    padding: '9px 18px',
                    borderRadius: 12,
                    fontSize: 13.5,
                    fontWeight: 700,
                    boxShadow: '0 2px 8px rgba(45, 90, 67, 0.2)',
                  }}
                >
                  Start Free
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <section className="landing-hero">
        {/* Pill Badge */}
        <div className="hero-pill-badge">
          <Sparkles size={15} color={T.primaryDark} />
          <span>Next-Gen AI Calorie & Macro Intelligence</span>
        </div>

        {/* Hero Title */}
        <h1 className="hero-title">
          One small log a day keeps the <span style={{ color: T.primary }}>loop alive</span>.
        </h1>

        {/* Subtitle */}
        <p className="hero-subtitle">
          Snap a plate, chat a sentence, or fill the form — your calories, macros and micros land in one private place with weekly reports to match.
        </p>

        {/* CTA Buttons */}
        <div className="hero-cta-group">
          <button
            onClick={() => handleStart('signup')}
            id="btn-hero-cta"
            className="btn btn-primary"
            style={{
              padding: '14px 28px',
              fontSize: 15.5,
              fontWeight: 700,
              borderRadius: 14,
              boxShadow: '0 4px 16px rgba(45, 90, 67, 0.28)',
              gap: 8,
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            {user ? 'Open Dashboard' : 'Start Tracking Free'} <ArrowRight size={17} />
          </button>
          <a
            href="#features"
            className="btn btn-secondary"
            style={{
              padding: '14px 24px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 14,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Explore Features
          </a>
        </div>

        {/* Value pills */}
        <div className="hero-value-pills">
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={T.primary} /> No credit card required
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={T.primary} /> 100% Private & secure
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Check size={16} color={T.primary} /> Powered by Gemini AI
          </span>
        </div>

        {/* ─── Interactive Mockup Card Preview ─── */}
        <div className="landing-mockup">
          {/* Mockup Top Header */}
          <div className="mockup-topbar">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginLeft: 6 }}>
                Live App Preview · Energy & Habit Loop
              </span>
            </div>
            <span style={{
              fontSize: 12,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 99,
              background: 'oklch(0.88 0.08 165 / 0.35)',
              color: T.primaryDark,
            }}>
              🔥 12-Day Streak
            </span>
          </div>

          {/* Mockup Content Grid */}
          <div className="mockup-grid">
            {/* Energy Ring Card */}
            <div style={{
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              padding: 20,
            }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Today's Calories
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: T.primaryDark }}>1,740</span>
                <span style={{ fontSize: 14, color: T.muted }}>/ 2,200 kcal</span>
              </div>
              <div style={{ width: '100%', height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 99, marginTop: 14, overflow: 'hidden' }}>
                <div style={{ width: '79%', height: '100%', background: T.primary, borderRadius: 99 }} />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>
                <span style={{ color: T.secondary }}>Protein: 110g</span>
                <span style={{ color: T.secondary }}>Carbs: 165g</span>
                <span style={{ color: T.secondary }}>Fat: 48g</span>
              </div>
            </div>

            {/* NutriBot Quick Interaction */}
            <div style={{
              background: T.surface2,
              border: `1px solid ${T.border}`,
              borderRadius: 18,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Bot size={18} color={T.primary} />
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>NutriBot Natural Logger</span>
              </div>
              <div style={{
                background: '#FFFFFF',
                border: `1px solid ${T.borderLight}`,
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 13,
                color: T.text,
                lineHeight: 1.5,
              }}>
                💬 <em>"Logged 2 eggs, avocado toast & coffee · 380 kcal ✅"</em>
              </div>
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 10 }}>
                Instant recognition · zero manual typing needed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Stats Bar ─── */}
      <section id="stats" className="stats-section">
        <div className="stats-grid">
          {STATS.map((s, idx) => (
            <div key={idx}>
              <div className="stat-value">
                {s.value}
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Core Features Section ─── */}
      <section id="features" className="features-section">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span style={{
            fontSize: 12.5,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: T.primaryDark,
          }}>
            Powerful Capabilities
          </span>
          <h2 style={{
            fontSize: 'clamp(24px, 4vw, 38px)',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: T.text,
            margin: '8px 0 12px 0',
          }}>
            Everything you need for nutritional precision.
          </h2>
          <p style={{ fontSize: 15.5, color: T.muted, maxWidth: 580, margin: '0 auto', lineHeight: 1.6 }}>
            Designed to make tracking effortless, accurate, and truly sustainable.
          </p>
        </div>

        <div className="features-grid">
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                className="feature-card-item"
              >
                <div style={{
                  width: 44,
                  height: 44,
                  borderRadius: 14,
                  background: 'oklch(0.88 0.08 165 / 0.35)',
                  border: '1px solid oklch(0.88 0.08 165 / 0.6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: T.primaryDark,
                  marginBottom: 18,
                }}>
                  <Icon size={22} />
                </div>
                <span style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: T.primaryDark,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                }}>
                  {f.tag}
                </span>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, margin: '0 0 10px 0' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: T.muted, margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="cta-banner-section">
        <div className="cta-banner-box">
          <h2 style={{ fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 800, margin: '0 0 14px 0', color: '#FFFFFF' }}>
            Ready to transform your health habits?
          </h2>
          <p style={{ fontSize: 15.5, opacity: 0.9, maxWidth: 560, margin: '0 auto 30px', lineHeight: 1.6, color: '#FFFFFF' }}>
            Create your account in seconds and experience the easiest way to track calories, macros, and nutrients.
          </p>
          <button
            onClick={() => handleStart('signup')}
            id="btn-cta-bottom"
            className="btn"
            style={{
              background: '#FFFFFF',
              color: T.primaryDark,
              padding: '14px 30px',
              fontSize: 15.5,
              fontWeight: 800,
              borderRadius: 14,
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 4px 18px rgba(0, 0, 0, 0.15)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {user ? 'Go to Dashboard' : 'Get Started Free'} <ArrowRight size={17} />
          </button>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="landing-footer">
        <div className="landing-footer-inner">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: T.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Flame size={16} color="#FFFFFF" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
              NutriTrack
            </span>
          </div>

          <p style={{ fontSize: 12.5, color: T.muted, margin: 0 }}>
            © {new Date().getFullYear()} Nutritrack @Happy · All rights reserved.
          </p>
        </div>
      </footer>

    </div>
  );
}
