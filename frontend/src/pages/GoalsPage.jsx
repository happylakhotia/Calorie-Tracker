import { useState, useEffect, useCallback } from 'react';
import { Target, TrendingUp, Scale, Save, Trash2, History, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { goalApi, entryApi } from '../api';
import { fmt, fmtDate, getApiError, today } from '../utils/helpers';

// ── Design tokens (match DashboardPage T object) ─────────────────────────────
const T = {
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  surface3: 'oklch(0.935 0.033 122)',
  border: 'oklch(0.9 0.024 120)',
  primary: 'oklch(0.48 0.098 155)',
  danger: 'oklch(0.6 0.2 25)',
  warning: 'oklch(0.75 0.13 70)',
  text: 'oklch(0.26 0.032 152)',
  secondary: 'oklch(0.34 0.06 155)',
  muted: 'oklch(0.53 0.028 145)',
  inverse: 'oklch(0.985 0.015 100)',
  protein: 'oklch(0.79 0.13 42)',
  carbs: 'oklch(0.82 0.14 88)',
  fat: 'oklch(0.72 0.1 230)',
};

const PLANS = ['Maintain', 'Gentle cut', 'Lean bulk', 'Custom'];

const PLAN_CALORIES = {
  'Maintain': 2000,
  'Gentle cut': 1700,
  'Lean bulk': 2500,
  'Custom': null,
};

const EMPTY_GOAL = {
  dailyCalories: 2000,
  proteinG: 150,
  carbsG: 250,
  fatG: 65,
  fiberG: 25,
  sodiumMg: 2300,
  waterGlasses: 8,
  activityLevel: 'Moderately active',
  weightGoalKg: '',
  weightCurrentKg: '',
  weightPace: '0.4 kg per week',
  targetDate: '',
  notes: '',
};

// ── Small reusable pieces ─────────────────────────────────────────────────────
const Card = ({ children, style = {} }) => (
  <div style={{
    background: T.surface, border: `1px solid ${T.border}`, borderRadius: 18,
    padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    ...style,
  }}>
    {children}
  </div>
);

const SectionTitle = ({ children, hint }) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
    <span style={{ fontSize: 17, fontWeight: 700, color: T.text }}>{children}</span>
    {hint && <span style={{ fontSize: 13, color: T.muted }}>{hint}</span>}
  </div>
);

const Field = ({ label, hint, children }) => (
  <div className="form-group">
    <label className="form-label">{label}</label>
    {hint && <span style={{ fontSize: 12, color: T.muted, marginLeft: 6 }}>{hint}</span>}
    {children}
  </div>
);

const Chip = ({ children, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      padding: '6px 16px', borderRadius: 99, fontSize: 13, fontWeight: 600, cursor: 'pointer',
      border: `1.5px solid ${active ? T.primary : T.border}`,
      background: active ? T.primary : T.surface,
      color: active ? T.inverse : T.secondary,
      transition: 'all 0.18s ease',
    }}
  >
    {children}
  </button>
);

const ProgressBar = ({ value, target, color }) => {
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  return (
    <div style={{ height: 7, borderRadius: 99, background: `${color}22` }}>
      <div style={{
        height: '100%', width: `${pct}%`, borderRadius: 99, background: color, transition: 'width 0.6s ease',
      }} />
    </div>
  );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GoalsPage() {
  const [form, setForm] = useState(() => {
    const savedWeight = localStorage.getItem('nutritrack_current_weight');
    return {
      ...EMPTY_GOAL,
      weightCurrentKg: savedWeight || '',
    };
  });
  const [plan, setPlan] = useState('Custom');
  const [activeGoal, setActiveGoal] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [todayTotals, setTodayTotals] = useState(null);

  const fetchGoals = useCallback(async () => {
    try {
      const [activeRes, historyRes, todayRes] = await Promise.all([
        goalApi.getActive(),
        goalApi.getHistory({ limit: 10 }),
        entryApi.getToday(),
      ]);
      const g = activeRes.data.data;
      const savedWeight = localStorage.getItem('nutritrack_current_weight');
      setActiveGoal(g);
      if (g) {
        setForm({
          dailyCalories: g.dailyCalories || 2000,
          proteinG: g.proteinG || 0,
          carbsG: g.carbsG || 0,
          fatG: g.fatG || 0,
          fiberG: g.fiberG || 25,
          sodiumMg: g.sodiumMg || 2300,
          waterGlasses: g.waterGlasses || 8,
          activityLevel: g.activityLevel || 'Moderately active',
          weightGoalKg: g.weightGoalKg || '',
          weightCurrentKg: savedWeight || g.weightCurrentKg || '',
          weightPace: g.weightPace || '0.4 kg per week',
          targetDate: g.targetDate ? g.targetDate.split('T')[0] : '',
          notes: g.notes || '',
        });
      } else if (savedWeight) {
        setForm((f) => ({ ...f, weightCurrentKg: savedWeight }));
      }
      setHistory(historyRes.data.data || []);
      setTodayTotals(todayRes.data.data?.totals || null);
    } catch {
      toast.error('Failed to load goals.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchGoals(); }, [fetchGoals]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleCurrentWeightChange = (e) => {
    const val = e.target.value;
    setForm((f) => ({ ...f, weightCurrentKg: val }));
    if (val && parseFloat(val) > 0) {
      localStorage.setItem('nutritrack_current_weight', val);
    }
  };

  const handleQuickUpdateWeight = () => {
    const val = parseFloat(form.weightCurrentKg);
    if (!val || val <= 0) return toast.error('Please enter a valid current weight in kg.');
    localStorage.setItem('nutritrack_current_weight', val);
    toast.success('Current weight updated & synced! ⚖️');
  };

  const handlePlanChange = (p) => {
    setPlan(p);
    const cal = PLAN_CALORIES[p];
    if (cal) {
      setForm((f) => ({
        ...f,
        dailyCalories: cal,
        proteinG: Math.round(cal * 0.30 / 4),
        carbsG: Math.round(cal * 0.45 / 4),
        fatG: Math.round(cal * 0.25 / 9),
      }));
    }
  };

  const suggestMacros = () => {
    const cal = parseFloat(form.dailyCalories) || 2000;
    setForm((f) => ({
      ...f,
      proteinG: Math.round(cal * 0.30 / 4),
      carbsG: Math.round(cal * 0.45 / 4),
      fatG: Math.round(cal * 0.25 / 9),
    }));
    toast.success('Macros auto-calculated!', { icon: '✨' });
  };

  const handleSave = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!form.dailyCalories || form.dailyCalories < 500) return toast.error('Daily calorie target must be at least 500.');
    setSaving(true);
    try {
      if (form.weightCurrentKg) {
        localStorage.setItem('nutritrack_current_weight', form.weightCurrentKg);
      }
      const payload = {
        ...form,
        dailyCalories: parseFloat(form.dailyCalories),
        proteinG: parseFloat(form.proteinG) || 0,
        carbsG: parseFloat(form.carbsG) || 0,
        fatG: parseFloat(form.fatG) || 0,
        fiberG: parseFloat(form.fiberG) || 0,
        sodiumMg: parseFloat(form.sodiumMg) || 0,
        waterGlasses: parseFloat(form.waterGlasses) || 8,
        weightGoalKg: form.weightGoalKg ? parseFloat(form.weightGoalKg) : null,
        weightCurrentKg: form.weightCurrentKg ? parseFloat(form.weightCurrentKg) : null,
        targetDate: form.targetDate || null,
      };
      await goalApi.create(payload);
      toast.success('Goal saved! 🎯');
      fetchGoals();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this goal?')) return;
    try {
      await goalApi.delete(id);
      toast.success('Goal deleted.');
      fetchGoals();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 400 }}>
      <div className="spinner dark" style={{ width: 32, height: 32 }} />
    </div>
  );

  const caloriesFromMacros = Math.round(
    (form.proteinG || 0) * 4 + (form.carbsG || 0) * 4 + (form.fatG || 0) * 9
  );

  // Goal vs Actual for today
  const progress = [
    { label: 'Calories', value: todayTotals?.calories || 0, target: parseFloat(form.dailyCalories) || 0, unit: 'kcal', color: T.primary },
    { label: 'Protein', value: todayTotals?.protein || 0, target: parseFloat(form.proteinG) || 0, unit: 'g', color: T.protein },
    { label: 'Carbs', value: todayTotals?.carbs || 0, target: parseFloat(form.carbsG) || 0, unit: 'g', color: T.carbs },
    { label: 'Fat', value: todayTotals?.fat || 0, target: parseFloat(form.fatG) || 0, unit: 'g', color: T.fat },
  ];

  // Estimated finish date based on weight pace
  const estimateFinish = () => {
    const cur = parseFloat(form.weightCurrentKg);
    const tgt = parseFloat(form.weightGoalKg);
    const pace = parseFloat(form.weightPace) || 0.4;
    if (!cur || !tgt || cur === tgt) return null;
    const diff = Math.abs(cur - tgt);
    const weeks = Math.ceil(diff / pace);
    const d = new Date();
    d.setDate(d.getDate() + weeks * 7);
    return d.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  const finishDate = estimateFinish();

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '24px 28px' }}>
      {/* ── Page header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>
            Health Goals
          </h1>
          <p style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>
            Your targets drive every ring, chart and nudge in the app
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            id="btn-toggle-history"
            style={{ fontSize: 13, gap: 6 }}
          >
            <History size={14} /> {showHistory ? 'Hide' : 'View'} History
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleSave}
            disabled={saving}
            id="btn-save-goal"
            style={{ fontSize: 13, gap: 6 }}
          >
            {saving ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <Save size={14} />}
            Save goals
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {/* ── Main 3-col grid ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>

          {/* ── Left: Daily nutrition targets ── */}
          <Card>
            <SectionTitle hint="Applied from tomorrow">Daily nutrition targets</SectionTitle>

            {/* Plan chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
              {PLANS.map((p) => (
                <Chip key={p} active={plan === p} onClick={() => handlePlanChange(p)}>{p}</Chip>
              ))}
            </div>

            {/* Fields grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Daily calories (kcal)" hint="Suggested for your plan">
                <input
                  id="input-goal-calories"
                  type="number"
                  className="form-control"
                  min="500" max="10000"
                  value={form.dailyCalories}
                  onChange={(e) => { set('dailyCalories')(e); setPlan('Custom'); }}
                />
              </Field>

              <Field label="Protein (g)" hint="30% of calories">
                <input id="input-goal-protein" type="number" className="form-control"
                  min="0" value={form.proteinG} onChange={set('proteinG')} />
              </Field>

              <Field label="Carbs (g)" hint="45% of calories">
                <input id="input-goal-carbs" type="number" className="form-control"
                  min="0" value={form.carbsG} onChange={set('carbsG')} />
              </Field>

              <Field label="Fat (g)" hint="25% of calories">
                <input id="input-goal-fat" type="number" className="form-control"
                  min="0" value={form.fatG} onChange={set('fatG')} />
              </Field>

              <Field label="Fiber (g)">
                <input id="input-goal-fiber" type="number" className="form-control"
                  min="0" value={form.fiberG} onChange={set('fiberG')} />
              </Field>

              <Field label="Sodium limit (mg)">
                <input id="input-goal-sodium" type="number" className="form-control"
                  min="0" value={form.sodiumMg} onChange={set('sodiumMg')} />
              </Field>

              <Field label="Water (glasses)">
                <input id="input-goal-water" type="number" className="form-control"
                  min="1" max="20" value={form.waterGlasses} onChange={set('waterGlasses')} />
              </Field>

              <Field label="Activity level">
                <select id="input-goal-activity" className="form-control" value={form.activityLevel} onChange={set('activityLevel')}>
                  <option>Sedentary</option>
                  <option>Lightly active</option>
                  <option>Moderately active</option>
                  <option>Very active</option>
                </select>
              </Field>
            </div>

            {/* Macro auto-suggest + calorie sanity check */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.surface2, borderRadius: 12, padding: '10px 14px', marginTop: 16
            }}>
              <span style={{ fontSize: 13, color: T.secondary }}>
                Calories from macros:{' '}
                <strong style={{ color: Math.abs(caloriesFromMacros - (form.dailyCalories || 0)) > 100 ? T.warning : T.primary }}>
                  {caloriesFromMacros} kcal
                </strong>
                {' '}vs target {form.dailyCalories || 0} kcal
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={suggestMacros}
                id="btn-suggest-macros"
                style={{ fontSize: 12, gap: 5, flexShrink: 0 }}
              >
                <Sparkles size={13} /> Auto-suggest
              </button>
            </div>

            {/* Notes */}
            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label" htmlFor="input-goal-notes">Notes (optional)</label>
              <input
                id="input-goal-notes"
                type="text"
                className="form-control"
                placeholder="e.g. Summer cut, marathon training…"
                value={form.notes}
                onChange={set('notes')}
              />
            </div>
          </Card>

          {/* ── Right column ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Weight goal */}
            <Card>
              <SectionTitle>Weight goal</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <Field label="Current weight (kg)">
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      id="input-goal-weight-current"
                      type="number"
                      className="form-control"
                      min="20"
                      max="300"
                      step="0.1"
                      placeholder="e.g. 78"
                      value={form.weightCurrentKg}
                      onChange={handleCurrentWeightChange}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleQuickUpdateWeight}
                      id="btn-quick-update-weight"
                      style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '0 12px' }}
                      title="Quick update weight"
                    >
                      Update
                    </button>
                  </div>
                </Field>
                <Field label="Target weight (kg)">
                  <input id="input-goal-weight-target" type="number" className="form-control"
                    min="20" max="300" step="0.1" placeholder="e.g. 70"
                    value={form.weightGoalKg} onChange={set('weightGoalKg')} />
                </Field>
                <Field label="Pace">
                  <select id="input-goal-pace" className="form-control" value={form.weightPace} onChange={set('weightPace')}>
                    <option>0.5 kg per week</option>
                    <option>1 kg per week</option>
                    <option>1.5 kg per week</option>
                  </select>
                </Field>
                <Field label="Target date">
                  <input id="input-goal-date" type="date" className="form-control"
                    value={form.targetDate} onChange={set('targetDate')}
                    min={new Date().toISOString().split('T')[0]} />
                </Field>
              </div>

              {/* Estimated finish */}
              {finishDate && (
                <div style={{ marginTop: 14, background: T.surface2, borderRadius: 12, padding: '12px 14px' }}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: T.text, margin: 0 }}>Estimated finish</p>
                  <p style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>
                    Around <strong style={{ color: T.primary }}>{finishDate}</strong> at this pace.
                  </p>
                </div>
              )}
            </Card>

            {/* Reminders */}
            <Card>
              <SectionTitle>Reminders</SectionTitle>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
                {[
                  ['Meal logging reminders', '09:00 · 14:00 · 21:00'],
                  ['Protein shortfall alert', 'After 18:00'],
                  ['Weekly report', 'Sunday 20:00'],
                  ['Weigh-in reminder', 'Monday 07:00'],
                ].map(([label, when]) => (
                  <li key={label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                    background: T.surface2, borderRadius: 12, padding: '10px 13px',
                  }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: T.text, margin: 0 }}>{label}</p>
                      <p style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{when}</p>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: T.primary, background: `${T.primary}15`,
                      padding: '2px 10px', borderRadius: 99,
                    }}>On</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Goal history (collapsible) */}
            {showHistory && (
              <Card>
                <SectionTitle>Goal history</SectionTitle>
                {history.length === 0 ? (
                  <p style={{ fontSize: 13, color: T.muted, textAlign: 'center', padding: '16px 0' }}>No previous goals</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {history.map((g, idx) => (
                      <div key={g.id} style={{
                        padding: 14, background: T.surface2, borderRadius: 12,
                        border: idx === 0 ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                        position: 'relative',
                      }}>
                        {idx === 0 && (
                          <span style={{
                            position: 'absolute', top: 8, right: 8, fontSize: 10, fontWeight: 700,
                            color: T.inverse, background: T.primary, padding: '2px 8px', borderRadius: 99,
                          }}>Active</span>
                        )}
                        <div style={{ fontWeight: 700, fontSize: 15, color: T.primary }}>{g.dailyCalories} kcal/day</div>
                        <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
                          P:{g.proteinG}g · C:{g.carbsG}g · F:{g.fatG}g
                        </div>
                        {g.weightGoalKg && (
                          <div style={{ fontSize: 12, color: T.secondary, marginTop: 2 }}>Target: {g.weightGoalKg} kg</div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                          <span style={{ fontSize: 11, color: T.muted }}>
                            {fmtDate(g.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {idx !== 0 && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              style={{ color: T.danger, padding: '2px 8px' }}
                              onClick={() => handleDelete(g.id)}
                              id={`btn-delete-goal-${g.id}`}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        {/* ── Goal vs Actual ── */}
        <Card style={{ marginTop: 16 }}>
          <SectionTitle hint={new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'long', weekday: 'long' })}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Target size={16} color={T.primary} /> Goal vs actual
            </span>
          </SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
            {progress.map((p) => {
              const remaining = p.target - p.value;
              return (
                <div key={p.label} style={{ background: T.surface2, borderRadius: 14, padding: 16 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: T.text, margin: 0 }}>{p.label}</p>
                  <p style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: T.text, lineHeight: 1 }}>
                    {Math.round(p.value)}
                    <span style={{ fontSize: 13, fontWeight: 400, color: T.muted }}> / {p.target} {p.unit}</span>
                  </p>
                  <div style={{ marginTop: 10 }}>
                    <ProgressBar value={p.value} target={p.target} color={p.color} />
                  </div>
                  <p style={{ fontSize: 12, color: T.muted, marginTop: 7 }}>
                    {remaining > 0 ? `${Math.round(remaining)} ${p.unit} remaining` : '✓ Target reached'}
                  </p>
                </div>
              );
            })}
          </div>
        </Card>
      </form>
    </div>
  );
}
