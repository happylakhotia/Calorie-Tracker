import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Flame, BarChart2, Target, Camera, MessageCircle,
  Check, Zap, Star, UtensilsCrossed, TrendingUp,
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

const TESTIMONIALS = [
  {
    quote: 'Logging food used to be such a chore. With NutriBot, I just type what I ate or upload a photo, and everything is tracked instantly.',
    author: 'Alex Morgan',
    role: 'Marathon Runner & Tech Lead',
    stars: 5,
  },
  {
    quote: 'The weekly macro breakdown and Habit Loop streak keeps me disciplined without feeling overwhelmed. Beautiful design that inspires consistency.',
    author: 'Sarah Chen',
    role: 'Fitness Enthusiast',
    stars: 5,
  },
  {
    quote: 'NutriBot feels like having a private dietitian in my pocket. The PDF import and nutrient estimates are unmatched.',
    author: 'David Patel',
    role: 'Nutrition & Health Coach',
    stars: 5,
  },
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
    <div style={{ background: T.bg, minHeight: '100vh', color: T.text, overflowX: 'hidden' }}>
      
      {/* ─── Modern Sticky Header ─── */}
      <header style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${T.border}`,
        transition: 'all 0.2s ease',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
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
            }}>
              <Flame size={20} color="#FFFFFF" />
            </div>
            <div>
              <span style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: '-0.3px', display: 'block', lineHeight: 1.1 }}>
                NutriTrack
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.02em' }}>
                Precision Health
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav style={{ display: 'none', gap: 28, alignItems: 'center' }} className="desktop-nav">
            <a href="#features" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              Features
            </a>
            <a href="#demo" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              AI Assistant
            </a>
            <a href="#stats" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              Metrics
            </a>
            <a href="#testimonials" style={{ fontSize: 14, fontWeight: 600, color: T.secondary, textDecoration: 'none' }}>
              Reviews
            </a>
          </nav>

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                }}
              >
                Go to Dashboard <ArrowRight size={15} />
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
      <section style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '70px 24px 60px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        {/* Pill Badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          padding: '5px 14px',
          borderRadius: 99,
          background: 'oklch(0.88 0.08 165 / 0.35)',
          border: '1px solid oklch(0.88 0.08 165 / 0.7)',
          color: T.primaryDark,
          fontSize: 13,
          fontWeight: 700,
          marginBottom: 24,
        }}>
          <Sparkles size={15} color={T.primaryDark} />
          <span>Next-Gen AI Calorie & Macro Intelligence</span>
        </div>

        {/* Hero Title */}
        <h1 style={{
          fontSize: 'clamp(32px, 5.5vw, 56px)',
          fontWeight: 800,
          lineHeight: 1.15,
          letterSpacing: '-0.035em',
          color: T.text,
          maxWidth: 820,
          margin: '0 0 20px 0',
        }}>
          One small log a day keeps the <span style={{ color: T.primary }}>loop alive</span>.
        </h1>

        {/* Subtitle */}
        <p style={{
          fontSize: 'clamp(15px, 2vw, 18px)',
          lineHeight: 1.65,
          color: T.muted,
          maxWidth: 640,
          margin: '0 0 36px 0',
        }}>
          Snap a plate, chat a sentence, or fill the form — your calories, macros and micros land in one private place with weekly reports to match.
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, justifyContent: 'center', marginBottom: 40 }}>
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
            }}
          >
            Explore Features
          </a>
        </div>

        {/* Value pills */}
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 20,
          fontSize: 13,
          fontWeight: 600,
          color: T.secondary,
        }}>
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
        <div style={{
          marginTop: 50,
          width: '100%',
          maxWidth: 960,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 24,
          padding: '28px 32px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.06)',
          textAlign: 'left',
          boxSizing: 'border-box',
        }}>
          {/* Mockup Top Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${T.borderLight}`, paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#EF4444' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }} />
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: T.muted, marginLeft: 8 }}>
                Live App Preview · Today's Energy & Habit Loop
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
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 20,
          }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14, fontSize: 12.5, fontWeight: 600 }}>
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
      <section id="stats" style={{
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '36px 24px',
      }}>
        <div style={{
          maxWidth: 1100,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 24,
          textAlign: 'center',
        }}>
          {STATS.map((s, idx) => (
            <div key={idx}>
              <div style={{ fontSize: 32, fontWeight: 800, color: T.primaryDark, letterSpacing: '-0.5px' }}>
                {s.value}
              </div>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: T.muted, marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Core Features Section ─── */}
      <section id="features" style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '80px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 54 }}>
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
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 800,
            letterSpacing: '-0.5px',
            color: T.text,
            margin: '8px 0 14px 0',
          }}>
            Everything you need for nutritional precision.
          </h2>
          <p style={{ fontSize: 16, color: T.muted, maxWidth: 580, margin: '0 auto' }}>
            Designed to make tracking effortless, accurate, and truly sustainable.
          </p>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 24,
        }}>
          {FEATURES.map((f, idx) => {
            const Icon = f.icon;
            return (
              <div
                key={idx}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 20,
                  padding: '28px 24px',
                  boxShadow: '0 2px 10px rgba(0, 0, 0, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                }}
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

      {/* ─── Testimonials Section ─── */}
      <section id="testimonials" style={{
        background: T.surface2,
        borderTop: `1px solid ${T.border}`,
        borderBottom: `1px solid ${T.border}`,
        padding: '70px 24px',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 44 }}>
            <h2 style={{ fontSize: 30, fontWeight: 800, color: T.text, margin: '0 0 10px 0' }}>
              Loved by individuals and coaches
            </h2>
            <p style={{ fontSize: 15, color: T.muted }}>
              Real people achieving real nutritional balance every day.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 24,
          }}>
            {TESTIMONIALS.map((t, idx) => (
              <div
                key={idx}
                style={{
                  background: T.surface,
                  border: `1px solid ${T.border}`,
                  borderRadius: 20,
                  padding: '24px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                }}
              >
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[...Array(t.stars)].map((_, i) => (
                    <Star key={i} size={16} fill="#F59E0B" color="#F59E0B" />
                  ))}
                </div>
                <p style={{ fontSize: 14, lineHeight: 1.65, color: T.text, margin: '0 0 18px 0', fontStyle: 'italic' }}>
                  "{t.quote}"
                </p>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.author}</div>
                  <div style={{ fontSize: 12, color: T.muted }}>{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section style={{
        maxWidth: 1100,
        margin: '80px auto',
        padding: '0 24px',
      }}>
        <div style={{
          background: 'linear-gradient(175deg, oklch(0.40 0.095 152), oklch(0.48 0.098 155))',
          borderRadius: 28,
          padding: '54px 40px',
          color: '#FFFFFF',
          textAlign: 'center',
          boxShadow: '0 12px 40px rgba(45, 90, 67, 0.25)',
        }}>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, margin: '0 0 14px 0', color: '#FFFFFF' }}>
            Ready to transform your health habits?
          </h2>
          <p style={{ fontSize: 16, opacity: 0.85, maxWidth: 560, margin: '0 auto 32px', lineHeight: 1.6, color: '#FFFFFF' }}>
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
      <footer style={{
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        padding: '36px 24px 28px',
      }}>
        <div style={{
          maxWidth: 1200,
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}>
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
