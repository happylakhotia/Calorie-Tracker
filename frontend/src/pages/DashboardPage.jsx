import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Droplets, Target, Sparkles, Camera, TrendingUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { entryApi, goalApi } from '../api';
import { fmtCal, fmt, getApiError, today } from '../utils/helpers';
import FoodEntryModal from '../components/FoodEntryModal';
import AIPhotoUpload from '../components/AIPhotoUpload';
import Modal from '../components/Modal';
import { useNavigate } from 'react-router-dom';
import useAuth from '../context/useAuth';

// ── Constants ─────────────────────────────────────────────────────────────────
const MEAL_CONFIG = {
  breakfast: { emoji: '🥐', label: 'Breakfast', color: 'oklch(0.79 0.13 42)', bg: 'oklch(0.79 0.13 42 / 0.12)' },
  lunch: { emoji: '🍽️', label: 'Lunch', color: 'oklch(0.48 0.098 155)', bg: 'oklch(0.48 0.098 155 / 0.10)' },
  snacks: { emoji: '🍎', label: 'Snacks', color: 'oklch(0.6 0.2 25)', bg: 'oklch(0.6 0.2 25 / 0.10)' },
  dinner: { emoji: '🍴', label: 'Dinner', color: 'oklch(0.48 0.098 155)', bg: 'oklch(0.88 0.08 165 / 0.18)' },
};

const MEAL_ORDER = ['breakfast', 'lunch', 'snacks', 'dinner'];

// Recommended daily values for micronutrients
const MICRO_RDV = { fiber: 25, vitaminD: 2000, iron: 18, potassium: 3500, calcium: 1000, vitaminC: 90 };
const MICRO_LABELS = { fiber: 'Fiber', vitaminD: 'Vitamin D', iron: 'Iron (Fe)', potassium: 'Potassium', calcium: 'Calcium', vitaminC: 'Vitamin C' };
const MICRO_UNITS = { fiber: 'g', vitaminD: 'IU', iron: 'mg', potassium: 'mg', calcium: 'mg', vitaminC: 'mg' };

const T = {
  /* NourishLoop exact oklch tokens */
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  surface3: 'oklch(0.935 0.033 122)',
  border: 'oklch(0.9 0.024 120)',
  primary: 'oklch(0.48 0.098 155)',
  success: 'oklch(0.48 0.098 155)',    /* same green */
  mint: 'oklch(0.88 0.08 165)',     /* mint tone */
  mintFg: 'oklch(0.32 0.07 165)',
  warning: 'oklch(0.75 0.13 70)',
  danger: 'oklch(0.6 0.2 25)',
  text: 'oklch(0.26 0.032 152)',
  secondary: 'oklch(0.34 0.06 155)',
  muted: 'oklch(0.53 0.028 145)',
  inverse: 'oklch(0.985 0.015 100)',
  /* nutrient tones — NourishLoop coral / sunny / sky */
  protein: 'oklch(0.79 0.13 42)',      /* coral */
  carbs: 'oklch(0.82 0.14 88)',      /* sunny */
  fat: 'oklch(0.72 0.1 230)',      /* sky */
  sky: 'oklch(0.34 0.07 250)',     /* sky foreground text */
  skyBg: 'oklch(0.86 0.07 230)',     /* sky bg */
};

// Week day labels for habit loop
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HYDRATION_KEY = () => `nutritrack_hydration_${today()}`;
const TOTAL_GLASSES = 8; // 8 × 250ml = 2000ml shown in row

// ── Smart food emoji matcher ──────────────────────────────────────────────────
const FOOD_EMOJI_MAP = [
  [/\begg/i, '🥚'], [/\bcheese|paneer|cottage/i, '🧀'], [/\bmilk/i, '🥛'],
  [/\byogurt|curd|dahi/i, '🫙'], [/\bbutter/i, '🧈'],
  [/\btoast|bread|bun|roti|chapati|naan|paratha|parotta/i, '🫓'],
  [/\bcroissant/i, '🥐'], [/\boatmeal|oats|porridge|muesli/i, '🥣'],
  [/\brice|biryani|pulao/i, '🍚'], [/\bpasta|spaghetti|noodle|macaroni/i, '🍝'],
  [/\bcornflake|cereal/i, '🌾'], [/\bchicken|poultry/i, '🍗'],
  [/\bfish|salmon|tuna|prawn|shrimp|seafood/i, '🐟'],
  [/\bmeat|beef|mutton|lamb|pork|steak/i, '🥩'],
  [/\bwhey|protein powder|supplement/i, '💪'],
  [/\bdal|lentil|pulse|bean|legume|rajma|chana|chole/i, '🫘'],
  [/\bsalad/i, '🥗'], [/\bbroccoli/i, '🥦'], [/\bcorn/i, '🌽'],
  [/\bcarrot/i, '🥕'], [/\btomato/i, '🍅'], [/\bpotato|aloo/i, '🥔'],
  [/\bspinach|palak/i, '🥬'], [/\bvegetable|sabzi|veggie/i, '🥦'],
  [/\bapple/i, '🍎'], [/\bbanana/i, '🍌'], [/\borange/i, '🍊'],
  [/\bgrape/i, '🍇'], [/\bstrawberr/i, '🍓'], [/\bmango/i, '🥭'],
  [/\bwatermelon/i, '🍉'], [/\bberr/i, '🫐'], [/\bfruit/i, '🍑'],
  [/\bcookie|biscuit/i, '🍪'], [/\bdonut|doughnut/i, '🍩'],
  [/\bcake|pastry/i, '🍰'], [/\bchocolate/i, '🍫'],
  [/\bchip|crisp|namkeen|chivda|mixture/i, '🍿'],
  [/\bnut|almond|cashew|peanut|walnut/i, '🥜'], [/\bpopcorn/i, '🍿'],
  [/\bcoffee|cappuccino|latte/i, '☕'], [/\btea|chai/i, '🍵'],
  [/\bjuice|smoothie/i, '🥤'], [/\bwater/i, '💧'],
  [/\bcurry|sabzi/i, '🍛'], [/\bthali|platter/i, '🍽️'],
  [/\bsamosa/i, '🥟'], [/\bidli|dosa/i, '🫓'], [/\bpaneer/i, '🧀'],
  [/\bsoup|broth/i, '🍲'], [/\bbowl/i, '🥣'],
  [/\bburger|hamburger/i, '🍔'], [/\bpizza/i, '🍕'],
  [/\bsandwich|sub|wrap/i, '🥪'], [/\btaco/i, '🌮'],
];

const getFoodEmoji = (foodName, fallback) => {
  const name = foodName || '';
  for (const [regex, emoji] of FOOD_EMOJI_MAP) {
    if (regex.test(name)) return emoji;
  }
  return fallback;
};

// ── Greeting helper ───────────────────────────────────────────────────────────
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Calorie Ring (large) ──────────────────────────────────────────────────────
function CalorieRing({ value, target, size = 120, stroke = 10 }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`${T.primary}18`} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.primary} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 24, fontWeight: 900, color: T.text, lineHeight: 1 }}>{fmtCal(value)}</span>
        <span style={{ fontSize: 11, fontWeight: 600, color: T.muted, letterSpacing: '0.08em', marginTop: 2 }}>of {fmtCal(target)} kcal</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.primary, marginTop: 2 }}>
          {target > 0 ? `${Math.round((value / target) * 100)}% of goal` : '—'}
        </span>
      </div>
    </div>
  );
}

// ── Macro bar row ─────────────────────────────────────────────────────────────
function MacroBar({ label, value, target, unit, color }) {
  const pct = target > 0 ? Math.min((value / target) * 100, 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, fontSize: 15 }}>
        <span style={{ fontWeight: 600, color: T.text }}>{label}</span>
        <span style={{ color: T.muted }}>{value} / {target} {unit}</span>
      </div>
      <div style={{ height: 7, borderRadius: 99, background: `${color}20` }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.6s ease' }} />
      </div>
    </div>
  );
}

// ── Source badge ──────────────────────────────────────────────────────────────

// ── Micro bar ─────────────────────────────────────────────────────────────────
function MicroBar({ pct, color }) {
  return (
    <div style={{ height: 4, borderRadius: 99, background: `${color}20`, flex: 1 }}>
      <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, borderRadius: 99, background: color, transition: 'width 0.5s ease' }} />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { user } = useAuth();
  const [todayData, setTodayData] = useState(null);
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [modalDefaults, setModalDefaults] = useState({});
  // AI scan modal state
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [aiScannedData, setAiScannedData] = useState(null);
  const [currentWeight, setCurrentWeight] = useState(() => {
    const s = localStorage.getItem('nutritrack_current_weight');
    return s ? parseFloat(s) : null;
  });
  const [editingWeight, setEditingWeight] = useState(false);
  const [weightInput, setWeightInput] = useState('');
  const [hydration, setHydration] = useState(() => {
    const s = localStorage.getItem(HYDRATION_KEY());
    return s ? parseFloat(s) : 0;
  });
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const [a, b] = await Promise.all([entryApi.getToday(), goalApi.getActive()]);
      setTodayData(a.data.data);
      const activeGoal = b.data.data;
      setGoal(activeGoal);
      const saved = localStorage.getItem('nutritrack_current_weight');
      if (saved) {
        setCurrentWeight(parseFloat(saved));
      } else if (activeGoal?.weightCurrentKg) {
        setCurrentWeight(parseFloat(activeGoal.weightCurrentKg));
        localStorage.setItem('nutritrack_current_weight', activeGoal.weightCurrentKg);
      }
    } catch { toast.error('Failed to load dashboard.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const handleSync = () => {
      const s = localStorage.getItem('nutritrack_current_weight');
      if (s) setCurrentWeight(parseFloat(s));
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('focus', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('focus', handleSync);
    };
  }, []);

  const logGlass = (idx) => {
    const glassesLogged = Math.round(hydration / 0.25);
    let next;
    if (idx < glassesLogged) {
      next = parseFloat((idx * 0.25).toFixed(2));
    } else {
      next = parseFloat(((idx + 1) * 0.25).toFixed(2));
    }
    next = Math.min(next, TOTAL_GLASSES * 0.25);
    setHydration(next);
    localStorage.setItem(HYDRATION_KEY(), next);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try { await entryApi.deleteEntry(id); toast.success('Deleted.'); fetchData(); }
    catch (e) { toast.error(getApiError(e)); }
  };

  const openAdd = (mealType, foodName = '') => { setEditEntry(null); setModalDefaults({ mealType, ...(foodName ? { foodName } : {}) }); setModalOpen(true); };
  const openEdit = (entry) => { setEditEntry(entry); setModalDefaults({}); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditEntry(null); setModalDefaults({}); };

  // ── AI scan handlers ─────────────────────────────────────────────────────────
  const openScan = () => { setAiScannedData(null); setScanModalOpen(true); };
  const closeScan = () => setScanModalOpen(false);

  const saveCurrentWeight = () => {
    const val = parseFloat(weightInput);
    if (!val || val <= 0) return toast.error('Enter a valid weight.');
    setCurrentWeight(val);
    localStorage.setItem('nutritrack_current_weight', val);
    setEditingWeight(false);
    setWeightInput('');
    toast.success('Current weight updated!');
  };
  const handleAIData = (data) => {
    // AI returned nutrition data — close scan modal and open entry modal pre-filled
    setScanModalOpen(false);
    setEditEntry(null);
    setModalDefaults({
      mealType: 'breakfast',
      foodName: data.foodName || '',
      quantity: data.quantity || '',
      unit: data.unit || 'g',
      calories: data.calories ?? '',
      protein: data.protein ?? '',
      carbs: data.carbs ?? '',
      fat: data.fat ?? '',
      fiber: data.fiber ?? '',
      sugar: data.sugar ?? '',
      sodium: data.sodium ?? '',
      potassium: data.potassium ?? '',
      vitaminC: data.vitaminC ?? '',
      vitaminD: data.vitaminD ?? '',
      calcium: data.calcium ?? '',
      iron: data.iron ?? '',
    });
    setAiScannedData(data);
    setModalOpen(true);
  };

  // ── Derived data ─────────────────────────────────────────────────────────────
  const consumed = todayData?.totals?.calories || 0;
  const goalCal = goal?.dailyCalories || 0;

  const proteinG = todayData?.totals?.protein || 0;
  const proteinGoal = goal?.proteinG || 0;
  const protNeeded = Math.max(0, proteinGoal - proteinG);

  const carbsG = todayData?.totals?.carbs || 0;
  const carbsGoal = goal?.carbsG || 0;

  const fatG = todayData?.totals?.fat || 0;
  const fatGoal = goal?.fatG || 0;

  const allEntries = todayData?.entries || [];
  const glassesLogged = Math.round(hydration / 0.25);

  const microTotals = allEntries.reduce((acc, e) => ({
    fiber: acc.fiber + (e.fiber || 0),
    vitaminD: acc.vitaminD + (e.vitaminD || 0),
    iron: acc.iron + (e.iron || 0),
    potassium: acc.potassium + (e.potassium || 0),
    calcium: acc.calcium + (e.calcium || 0),
    vitaminC: acc.vitaminC + (e.vitaminC || 0),
  }), { fiber: 0, vitaminD: 0, iron: 0, potassium: 0, calcium: 0, vitaminC: 0 });

  // Weight goal progress
  const weightTarget = goal?.weightGoalKg || 0;
  const weightNotes = goal?.notes || '';

  // Smart nudges helper — must be defined before nudges array
  const pctStr = (v, t) => t > 0 ? Math.round((v / t) * 100) : 0;

  // Smart nudges generated from real data
  const nudges = [
    protNeeded > 0 && {
      id: 'protein', title: 'Protein is running low',
      body: `You are ${fmt(protNeeded)}g short of today's protein goal. A shake would close the gap.`,
      time: 'based on today',
    },
    glassesLogged < TOTAL_GLASSES && {
      id: 'water', title: 'Stay hydrated',
      body: `You've had ${glassesLogged} of ${TOTAL_GLASSES} glasses today. Keep sipping!`,
      time: 'based on today',
    },
    goalCal > 0 && consumed > goalCal && {
      id: 'cal', title: 'Calorie budget exceeded',
      body: `You're ${fmtCal(consumed - goalCal)} kcal over your daily goal. Consider a lighter dinner.`,
      time: 'based on today',
    },
    goalCal > 0 && consumed < goalCal * 0.5 && {
      id: 'under', title: 'Low intake so far',
      body: `Only ${pctStr(consumed, goalCal)}% of your calorie goal logged — make sure to eat enough!`,
      time: 'based on today',
    },
  ].filter(Boolean);



  // Week dots: show M-Sun with today highlighted
  const today_dow = new Date().getDay(); // 0=Sun
  const weekDots = WEEK_DAYS.map((day, i) => {
    // i=0→Mon(1) … i=6→Sun(0)
    const dow = i === 6 ? 0 : i + 1;
    const isToday = dow === today_dow;
    const isSat = i === 5;
    return { day, isToday, isSat, logged: isToday ? allEntries.length > 0 : false };
  });

  const dateLabel = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const firstName = user?.name?.split(' ')[0] || 'there';

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
    </div>
  );

  // ── Card wrapper ─────────────────────────────────────────────────────────────
  const Card = ({ children, style = {} }) => (
    <div style={{
      background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16,
      padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      ...style,
    }}>
      {children}
    </div>
  );

  // ── Section title (label + optional hint) ────────────────────────────────────
  const SectionTitle = ({ children, hint }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{children}</span>
      {hint && <span style={{ fontSize: 13, color: T.muted }}>{hint}</span>}
    </div>
  );

  return (
    <div style={{ background: T.bg, minHeight: '100vh' }}>
      <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 6 }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>
              {getGreeting()}, {firstName}
            </h1>
            <p style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {dateLabel} · every logged meal keeps the loop alive
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button
              className="btn btn-secondary"
              onClick={openScan}
              id="btn-scan-photo"
              style={{ fontSize: 13, gap: 6 }}
            >
              <Camera size={14} /> Scan photo
            </button>
            <button
              className="btn btn-primary"
              onClick={() => openAdd('breakfast')}
              id="btn-add-entry-dashboard"
              style={{ fontSize: 13, gap: 6 }}
            >
              <Plus size={14} /> Log food
            </button>
          </div>
        </div>

        {/* ── Row 1: Today's Energy (2/3) + Habit Loop (1/3) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'stretch' }}>

          {/* Today's Energy */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <SectionTitle hint={goalCal > consumed ? `${fmtCal(goalCal - consumed)} kcal left` : `${fmtCal(consumed - goalCal)} kcal over`}>
              Today's energy
            </SectionTitle>
            <div style={{ display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap', flex: 1 }}>

              {/* Calorie ring */}
              <CalorieRing value={consumed} target={goalCal} size={130} stroke={10} />

              {/* Macro bars + water */}
              <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 14 }}>
                <MacroBar label="Protein" value={fmt(proteinG)} target={proteinGoal} unit="g" color={T.protein} />
                <MacroBar label="Carbs" value={fmt(carbsG)} target={carbsGoal} unit="g" color={T.carbs} />
                <MacroBar label="Fat" value={fmt(fatG)} target={fatGoal} unit="g" color={T.fat} />

                {/* Water row */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, background: T.surface2,
                  borderRadius: 12, padding: '8px 12px', cursor: 'default'
                }}>
                  <Droplets size={15} style={{ color: T.sky, flexShrink: 0 }} />
                  <span style={{ fontSize: 15, fontWeight: 600, color: T.text }}>Water</span>
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                    {Array.from({ length: TOTAL_GLASSES }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => logGlass(i)}
                        title={i < glassesLogged ? 'Click to un-log' : 'Click to log 250ml'}
                        style={{
                          width: 14, height: 14, borderRadius: 3, border: 'none', cursor: 'pointer',
                          background: i < glassesLogged ? T.sky : T.border,
                          transition: 'background 0.2s',
                          flexShrink: 0,
                        }}
                      />
                    ))}
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 14, color: T.muted }}>
                    {glassesLogged} / {TOTAL_GLASSES} glasses
                  </span>
                </div>
              </div>
            </div>
          </Card>

          {/* Habit Loop */}
          <Card style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <div>
              <SectionTitle hint={new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}>
                Habit loop
              </SectionTitle>

              {/* Week dots */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, margin: '10px 0 16px' }}>
                {weekDots.map((d) => (
                  <div key={d.day} style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: 12, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 14, fontWeight: 700, margin: '0 auto',
                      background: d.isToday
                        ? (d.logged ? T.primary : 'oklch(0.91 0.055 155)')
                        : (d.logged ? T.primary : T.surface3),
                      color: d.isToday
                        ? (d.logged ? '#fff' : T.primary)
                        : (d.logged ? '#fff' : T.secondary),
                      border: d.isToday
                        ? `2.5px solid ${T.primary}`
                        : '1.5px solid transparent',
                      boxShadow: d.isToday ? `0 0 0 3px ${T.primary}25` : 'none',
                      transition: 'all 0.2s',
                    }}>
                      {d.day[0]}
                    </div>
                    <span style={{
                      fontSize: 11,
                      fontWeight: d.isToday ? 700 : 500,
                      color: d.isToday ? T.primary : T.muted,
                      marginTop: 6,
                      display: 'block',
                    }}>
                      {d.day}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Coach tip */}
            <div style={{ background: T.surface2, borderRadius: 14, padding: '14px 16px', marginTop: 10 }}>
              <p style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>
                <Sparkles size={14} color={T.primary} /> Coach tip
              </p>
              <p style={{ fontSize: 12, color: T.muted, marginTop: 5, lineHeight: 1.55 }}>
                {protNeeded > 0
                  ? `You are ${fmt(protNeeded)}g short on protein. Add curd or a shake before bed to stay on target.`
                  : goalCal > 0 && consumed >= goalCal
                    ? "You've hit your calorie goal for the day — great job staying on track!"
                    : "Keep logging every meal to build your habit loop and hit your goals."}
              </p>
            </div>
          </Card>
        </div>

        {/* ── Row 2: Meals (2/3) + Right column (1/3) ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start', marginTop: 4 }}>

          {/* Meals card */}
          <Card>
            <SectionTitle hint={`${allEntries.length} entries today`}>Meals</SectionTitle>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {MEAL_ORDER.map((mealType) => {
                const cfg = MEAL_CONFIG[mealType];
                const entries = todayData?.grouped?.[mealType] || [];
                const mealCals = entries.reduce((s, e) => s + (e.calories || 0), 0);

                return (
                  <div key={mealType} style={{ background: T.surface2, borderRadius: 14, padding: 14 }}>

                    {/* Meal header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: entries.length > 0 ? 10 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 26, height: 26, borderRadius: 7, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
                          {cfg.emoji}
                        </div>
                        <span style={{ fontSize: 15, fontWeight: 700, color: cfg.color }}>{cfg.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {entries.length > 0 && (
                          <span style={{ fontSize: 14, color: T.muted }}>{fmtCal(mealCals)} kcal</span>
                        )}
                      </div>
                    </div>

                    {/* Empty state */}
                    {entries.length === 0 ? (
                      <p style={{ fontSize: 14, color: T.muted }}>Nothing logged yet.</p>
                    ) : (
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, listStyle: 'none', padding: 0, margin: 0 }}>
                        {entries.map((entry) => (
                          <li key={entry.id} style={{
                            display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                            background: T.surface, borderRadius: 10, padding: '9px 12px', fontSize: 13,
                          }}>
                            {/* emoji */}
                            <span style={{ fontSize: 18, flexShrink: 0 }}>{getFoodEmoji(entry.foodName, cfg.emoji)}</span>
                            {/* name + quantity */}
                            <span style={{ fontWeight: 600, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160, fontSize: 15 }}>
                              {entry.foodName}
                            </span>
                            <span style={{ color: T.muted, fontSize: 14 }}>· {entry.quantity}{entry.unit}</span>
                            {/* kcal */}
                            <span style={{ marginLeft: 'auto', fontWeight: 700, color: T.text, flexShrink: 0, fontSize: 15 }}>
                              {fmtCal(entry.calories)} kcal
                            </span>
                            {/* actions */}
                            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
                              <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26 }}
                                onClick={() => openEdit(entry)} id={`btn-edit-entry-${entry.id}`} title="Edit">
                                <Edit2 size={12} />
                              </button>
                              <button className="btn btn-ghost btn-icon" style={{ width: 26, height: 26, color: T.danger }}
                                onClick={() => handleDelete(entry.id)} id={`btn-delete-entry-${entry.id}`} title="Delete">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Weight Goal */}
            <Card>
              <SectionTitle>Weight goal</SectionTitle>
              {weightTarget > 0 ? (
                <>
                  {/* Current vs Target numbers */}
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div>
                      <p style={{ fontSize: 28, fontWeight: 900, color: T.text, lineHeight: 1, margin: 0 }}>
                        {currentWeight ? `${currentWeight} kg` : '— kg'}
                      </p>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>current</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontSize: 28, fontWeight: 900, color: T.primary, lineHeight: 1, margin: 0 }}>
                        {weightTarget} kg
                      </p>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>target</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  {(() => {
                    const cur = parseFloat(currentWeight);
                    const tgt = parseFloat(weightTarget);
                    let pct = 0;
                    let diff = null;
                    let direction = '';

                    if (cur && tgt) {
                      diff = Math.abs(cur - tgt);
                      if (cur === tgt) {
                        pct = 100;
                        direction = 'Goal reached! 🎉';
                      } else if (cur > tgt) {
                        // Losing weight
                        direction = `${diff.toFixed(1)} kg to lose`;
                        pct = Math.max(5, Math.min(100, Math.round((tgt / cur) * 100)));
                      } else {
                        // Gaining weight
                        direction = `${diff.toFixed(1)} kg to gain`;
                        pct = Math.max(5, Math.min(100, Math.round((cur / tgt) * 100)));
                      }
                    }

                    return (
                      <>
                        <div style={{ height: 8, borderRadius: 99, background: `${T.primary}18`, marginBottom: 8 }}>
                          <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            borderRadius: 99,
                            background: T.primary,
                            transition: 'width 0.6s ease',
                          }} />
                        </div>
                        {direction && (
                          <p style={{ fontSize: 12, color: T.muted, margin: 0 }}>
                            {direction}
                          </p>
                        )}
                      </>
                    );
                  })()}

                  {/* Inline set-weight input */}
                  {editingWeight ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 12, alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 74.5"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCurrentWeight(); if (e.key === 'Escape') setEditingWeight(false); }}
                        autoFocus
                        min="20" max="300" step="0.1"
                        style={{ flex: 1, fontSize: 14 }}
                        id="input-current-weight"
                      />
                      <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>kg</span>
                      <button className="btn btn-primary btn-sm" onClick={saveCurrentWeight} id="btn-save-weight">
                        Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingWeight(false)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setWeightInput(currentWeight ? String(currentWeight) : ''); setEditingWeight(true); }}
                      id="btn-update-weight"
                      style={{ marginTop: 12, width: '100%', justifyContent: 'center' }}
                    >
                      {currentWeight ? '✏️ Update weight' : '⚖️ Set current weight'}
                    </button>
                  )}

                  {goal?.targetDate && (
                    <p style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: T.muted, marginTop: 8 }}>
                      <TrendingUp size={12} /> Target date: {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  )}
                  {weightNotes && (
                    <p style={{ fontSize: 11, color: T.muted, marginTop: 6, fontStyle: 'italic' }}>{weightNotes}</p>
                  )}
                </>
              ) : (
                <div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 24, fontWeight: 900, color: T.text, lineHeight: 1, margin: 0 }}>
                        {currentWeight ? `${currentWeight} kg` : '— kg'}
                      </p>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>current weight</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate('/goals')} id="btn-set-weight-goal" style={{ fontSize: 12 }}>
                      <Target size={12} /> Set target weight
                    </button>
                  </div>
                  {editingWeight ? (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g. 74.5"
                        value={weightInput}
                        onChange={e => setWeightInput(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') saveCurrentWeight(); if (e.key === 'Escape') setEditingWeight(false); }}
                        autoFocus
                        min="20" max="300" step="0.1"
                        style={{ flex: 1, fontSize: 14 }}
                        id="input-current-weight"
                      />
                      <span style={{ fontSize: 13, color: T.muted, flexShrink: 0 }}>kg</span>
                      <button className="btn btn-primary btn-sm" onClick={saveCurrentWeight} id="btn-save-weight">
                        Save
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingWeight(false)}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setWeightInput(currentWeight ? String(currentWeight) : ''); setEditingWeight(true); }}
                      id="btn-update-weight"
                      style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                    >
                      {currentWeight ? '✏️ Update weight' : '⚖️ Set current weight'}
                    </button>
                  )}
                </div>
              )}
            </Card>

            {/* Latest nudges — derived from real data */}
            <Card>
              <SectionTitle hint={
                <button onClick={() => navigate('/reports')} style={{ fontSize: 12, color: T.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}>
                  Full report →
                </button>
              }>
                Latest nudges
              </SectionTitle>
              {nudges.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <p style={{ fontSize: 14, color: T.muted }}>Looking great — no nudges right now! 🎉</p>
                </div>
              ) : (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 10, listStyle: 'none', padding: 0, margin: 0 }}>
                  {nudges.slice(0, 3).map((n) => (
                    <li key={n.id} style={{ background: T.surface2, borderRadius: 12, padding: '10px 13px' }}>
                      <p style={{ fontSize: 15, fontWeight: 700, color: T.text, margin: 0 }}>{n.title}</p>
                      <p style={{ fontSize: 14, color: T.muted, marginTop: 3, lineHeight: 1.5 }}>{n.body}</p>
                      <p style={{ fontSize: 12, color: T.muted, marginTop: 5 }}>{n.time}</p>
                    </li>
                  ))}
                </ul>
              )}

              {/* Micronutrient mini-summary */}
              {allEntries.length > 0 && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${T.border}` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: T.secondary, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    Micronutrients
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {['fiber', 'vitaminC', 'calcium'].map((key) => {
                      const val = microTotals[key];
                      const rdv = MICRO_RDV[key];
                      const pct = Math.min(Math.round((val / rdv) * 100), 100);
                      const color = pct >= 100 ? T.success : pct >= 60 ? T.warning : T.danger;
                      return (
                        <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, color: T.secondary, width: 60, flexShrink: 0 }}>{MICRO_LABELS[key]}</span>
                          <MicroBar pct={pct} color={color} />
                          <span style={{ fontSize: 10, fontWeight: 700, color, width: 30, textAlign: 'right', flexShrink: 0 }}>{pct}%</span>
                        </div>
                      );
                    })}
                  </div>
                  <button onClick={() => navigate('/reports')}
                    style={{ fontSize: 11, color: T.primary, background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0, marginTop: 10 }}>
                    Full panel →
                  </button>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      {/* ── AI Scan Modal ── */}
      <Modal
        isOpen={scanModalOpen}
        onClose={closeScan}
        title="Scan Food with AI"
        maxWidth={520}
        footer={
          <button className="btn btn-secondary" onClick={closeScan} type="button">Cancel</button>
        }
      >
        <p style={{ fontSize: 13, color: T.muted, marginBottom: 16, lineHeight: 1.6 }}>
          Take or upload a photo of your food or nutrition label. AI will detect the food and fill in the macros automatically.
        </p>
        <AIPhotoUpload onDataExtracted={handleAIData} />
      </Modal>

      <FoodEntryModal
        isOpen={modalOpen}
        onClose={closeModal}
        onSaved={fetchData}
        entry={editEntry ? { ...editEntry, date: today() } : null}
        defaults={modalDefaults}
      />
    </div>
  );
}
