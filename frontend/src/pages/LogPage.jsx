import { useState, useRef } from 'react';
import { Plus, Camera, Bot, FileUp, Sparkles, ArrowRight, X, FileText, CheckCircle2, ChevronDown, ChevronUp, Utensils, Calendar, Scale, Flame } from 'lucide-react';
import FoodEntryModal from '../components/FoodEntryModal';
import AIPhotoUpload from '../components/AIPhotoUpload';
import Modal from '../components/Modal';
import { today, getApiError } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { aiApi, entryApi } from '../api';
import toast from 'react-hot-toast';

// ── Design tokens matching NourishLoop ─────────────────────────────────────────
const T = {
  bg: 'oklch(0.981 0.014 95)',
  surface: 'oklch(1 0 0)',
  surface2: 'oklch(0.968 0.021 108)',
  surface3: 'oklch(0.935 0.033 122)',
  border: 'oklch(0.9 0.024 120)',
  primary: 'oklch(0.48 0.098 155)',
  success: 'oklch(0.48 0.098 155)',
  mint: 'oklch(0.88 0.08 165)',
  mintFg: 'oklch(0.32 0.07 165)',
  warning: 'oklch(0.75 0.13 70)',
  danger: 'oklch(0.6 0.2 25)',
  text: 'oklch(0.26 0.032 152)',
  secondary: 'oklch(0.34 0.06 155)',
  muted: 'oklch(0.53 0.028 145)',
  inverse: 'oklch(0.985 0.015 100)',
  protein: 'oklch(0.79 0.13 42)',      /* coral */
  carbs: 'oklch(0.82 0.14 88)',        /* sunny */
  fat: 'oklch(0.72 0.1 230)',          /* sky */
};

const MEAL_CARDS = [
  {
    type: 'breakfast',
    label: 'Breakfast',
    emoji: '🥐',
    desc: 'Start your morning with essential energy',
    color: 'oklch(0.79 0.13 42)',
    bg: 'oklch(0.79 0.13 42 / 0.12)',
  },
  {
    type: 'lunch',
    label: 'Lunch',
    emoji: '🍽️',
    desc: 'Midday fuel for sustained focus',
    color: 'oklch(0.48 0.098 155)',
    bg: 'oklch(0.48 0.098 155 / 0.10)',
  },
  {
    type: 'dinner',
    label: 'Dinner',
    emoji: '🍴',
    desc: 'Evening recovery and balanced macros',
    color: 'oklch(0.48 0.098 155)',
    bg: 'oklch(0.88 0.08 165 / 0.18)',
  },
  {
    type: 'snacks',
    label: 'Snacks',
    emoji: '🍎',
    desc: 'Healthy bites, shakes and quick fruits',
    color: 'oklch(0.6 0.2 25)',
    bg: 'oklch(0.6 0.2 25 / 0.10)',
  },
];

const Card = ({ children, style = {}, className = '', onClick }) => (
  <div
    className={className}
    onClick={onClick}
    style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 16,
      padding: '18px 20px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      ...style,
    }}
  >
    {children}
  </div>
);

export default function LogPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [defaultMeal, setDefaultMeal] = useState('breakfast');
  const [modalDefaults, setModalDefaults] = useState({});
  const [scanModalOpen, setScanModalOpen] = useState(false);
  const [pdfFile, setPdfFile] = useState(null);
  const [importingPdf, setImportingPdf] = useState(false);
  const fileInputRef = useRef(null);
  const formCardRef = useRef(null);
  const navigate = useNavigate();

  // Direct quick-entry state for inline input boxes
  const [quickForm, setQuickForm] = useState({
    date: today(),
    mealType: 'breakfast',
    foodName: '',
    quantity: '',
    unit: 'g',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    sodium: '',
    potassium: '',
    vitaminC: '',
    vitaminD: '',
    calcium: '',
    iron: '',
    notes: '',
  });
  const [quickLoading, setQuickLoading] = useState(false);
  const [quickShowMicros, setQuickShowMicros] = useState(false);

  const handleQuickChange = (field) => (e) => {
    const val = e.target.value;
    setQuickForm((prev) => ({ ...prev, [field]: val }));
  };

  const selectMealSlot = (mealType) => {
    setDefaultMeal(mealType);
    setQuickForm((prev) => ({ ...prev, mealType }));
    setModalDefaults({ mealType, date: quickForm.date || today() });
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    setTimeout(() => {
      const el = document.getElementById('input-quick-food-name');
      if (el) el.focus();
    }, 150);
  };

  const openModal = (mealType) => {
    setDefaultMeal(mealType);
    setModalDefaults({
      mealType,
      date: quickForm.date || today(),
      foodName: quickForm.foodName || '',
      quantity: quickForm.quantity || '',
      unit: quickForm.unit || 'g',
      calories: quickForm.calories || '',
      protein: quickForm.protein || '',
      carbs: quickForm.carbs || '',
      fat: quickForm.fat || '',
      notes: quickForm.notes || '',
    });
    setModalOpen(true);
  };

  const handleSaved = () => {
    navigate('/dashboard');
  };

  const handleAIData = (data) => {
    setScanModalOpen(false);
    const extracted = {
      mealType: quickForm.mealType || 'breakfast',
      date: quickForm.date || today(),
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
    };
    // Populate direct inline form
    setQuickForm((prev) => ({ ...prev, ...extracted }));
    // Also prepare modal defaults
    setModalDefaults(extracted);
    toast.success(`Extracted: ${data.foodName || 'Food Plate'} 🍽️`);
    formCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleQuickSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quickForm.foodName || !quickForm.foodName.trim()) {
      return toast.error('Food name is required.');
    }
    if (!quickForm.quantity || Number(quickForm.quantity) <= 0) {
      return toast.error('Quantity must be positive.');
    }

    setQuickLoading(true);
    try {
      const payload = {
        date: quickForm.date || today(),
        mealType: quickForm.mealType || 'breakfast',
        foodName: quickForm.foodName.trim(),
        quantity: parseFloat(quickForm.quantity) || 0,
        unit: quickForm.unit || 'g',
        calories: parseFloat(quickForm.calories) || 0,
        protein: parseFloat(quickForm.protein) || 0,
        carbs: parseFloat(quickForm.carbs) || 0,
        fat: parseFloat(quickForm.fat) || 0,
        fiber: parseFloat(quickForm.fiber) || 0,
        sugar: parseFloat(quickForm.sugar) || 0,
        sodium: parseFloat(quickForm.sodium) || 0,
        potassium: parseFloat(quickForm.potassium) || 0,
        vitaminC: parseFloat(quickForm.vitaminC) || 0,
        vitaminD: parseFloat(quickForm.vitaminD) || 0,
        calcium: parseFloat(quickForm.calcium) || 0,
        iron: parseFloat(quickForm.iron) || 0,
        notes: quickForm.notes ? quickForm.notes.trim() : '',
      };

      await entryApi.createEntry(payload);
      toast.success(`${payload.foodName} logged successfully! 🎉`);
      navigate('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setQuickLoading(false);
    }
  };

  const handlePdfFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.name.endsWith('.pdf')) {
        return toast.error('Please select a valid .pdf file.');
      }
      setPdfFile(file);
    }
  };

  const handlePdfImport = async () => {
    if (!pdfFile) return;
    setImportingPdf(true);
    try {
      const formData = new FormData();
      formData.append('pdf', pdfFile);
      const { data } = await aiApi.importPdf(formData);
      toast.success(`Successfully imported ${data.imported || 0} entries from PDF! 📄`);
      setPdfFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      navigate('/dashboard');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setImportingPdf(false);
    }
  };

  return (
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px' }} className="animate-fade-in log-page-root">
      <style>{`
        @media (max-width: 768px) {
          .log-page-root {
            padding: 16px 14px !important;
          }
          .log-form-card {
            padding: 18px 16px !important;
            border-radius: 16px !important;
          }
          .log-header-row {
            flex-wrap: wrap !important;
            gap: 12px !important;
          }
          .log-btn-group {
            flex-direction: column !important;
            width: 100% !important;
            gap: 10px !important;
          }
          .log-btn-group .btn {
            width: 100% !important;
            justify-content: center !important;
          }
        }
      `}</style>
      {/* ── Generous Container ── */}
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        
        {/* ── Page Header ── */}
        <div className="log-header-row" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, gap: 14 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>
              Log a Meal
            </h1>
            <p style={{ fontSize: 14, color: T.muted, marginTop: 4 }}>
              Select a meal slot or use smart AI tools to log your food
            </p>
          </div>

          <button
            className="btn btn-secondary"
            onClick={() => setScanModalOpen(true)}
            id="btn-scan-photo-log"
            style={{
              fontSize: 15,
              fontWeight: 700,
              gap: 8,
              padding: '12px 22px',
              borderRadius: 12,
              background: T.surface,
              border: `1.5px solid ${T.border}`,
              color: T.text,
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              transition: 'all 0.18s ease',
            }}
          >
            <Camera size={18} color={T.primary} /> Scan with AI
          </button>
        </div>

        {/* ── Direct Food Entry Form (Interactive Input Boxes) ── */}
        <div
          ref={formCardRef}
          id="section-direct-food-entry"
          className="log-form-card"
          style={{
            background: T.surface,
            border: `1.5px solid ${T.border}`,
            borderRadius: 20,
            padding: '28px 30px',
            marginBottom: 24,
            boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
          }}
        >
          {/* Header & Meal Selector */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 14,
                background: 'oklch(0.88 0.08 165 / 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: T.primary,
                flexShrink: 0,
              }}>
                <Utensils size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: 19, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.3px' }}>
                  Quick Food Entry
                </h2>
                <p style={{ fontSize: 13, color: T.muted, margin: '3px 0 0' }}>
                  Type your meal details below — inputs are live and save directly
                </p>
              </div>
            </div>

            {/* Meal Slot Tabs */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {MEAL_CARDS.map(({ type, label, emoji }) => {
                const isCurrent = quickForm.mealType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => selectMealSlot(type)}
                    id={`tab-select-${type}`}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: 'pointer',
                      border: isCurrent ? `1.5px solid ${T.primary}` : `1px solid ${T.border}`,
                      background: isCurrent ? T.primary : T.surface2,
                      color: isCurrent ? '#FFFFFF' : T.text,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      boxShadow: isCurrent ? '0 2px 8px rgba(45,90,67,0.2)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>{emoji}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleQuickSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            
            {/* Row 1: Date & Meal Slot */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
              <div>
                <label className="form-label required" htmlFor="input-quick-date" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                  Date
                </label>
                <input
                  id="input-quick-date"
                  type="date"
                  className="form-control"
                  value={quickForm.date}
                  onChange={handleQuickChange('date')}
                  style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
                />
              </div>

              <div>
                <label className="form-label required" htmlFor="input-quick-meal-type" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                  Meal Type
                </label>
                <select
                  id="input-quick-meal-type"
                  className="form-control"
                  value={quickForm.mealType}
                  onChange={handleQuickChange('mealType')}
                  style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
                >
                  <option value="breakfast">🥐 Breakfast</option>
                  <option value="lunch">🍽️ Lunch</option>
                  <option value="dinner">🍴 Dinner</option>
                  <option value="snacks">🍎 Snacks</option>
                </select>
              </div>
            </div>

            {/* Row 2: Food Name */}
            <div>
              <label className="form-label required" htmlFor="input-quick-food-name" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                Food / Dish Name
              </label>
              <input
                id="input-quick-food-name"
                type="text"
                className="form-control"
                placeholder="e.g. Grilled Chicken Breast with Quinoa & Steamed Broccoli"
                value={quickForm.foodName}
                onChange={handleQuickChange('foodName')}
                style={{ borderRadius: 10, padding: '12px 16px', fontSize: 14.5 }}
              />
            </div>

            {/* Row 3: Quantity & Unit */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
              <div>
                <label className="form-label required" htmlFor="input-quick-quantity" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                  Quantity
                </label>
                <input
                  id="input-quick-quantity"
                  type="number"
                  step="any"
                  min="0"
                  className="form-control"
                  placeholder="100"
                  value={quickForm.quantity}
                  onChange={handleQuickChange('quantity')}
                  style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="input-quick-unit" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                  Unit
                </label>
                <select
                  id="input-quick-unit"
                  className="form-control"
                  value={quickForm.unit}
                  onChange={handleQuickChange('unit')}
                  style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
                >
                  {['g', 'ml', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece', 'serving', 'slice'].map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Macronutrients Container */}
            <div style={{ background: T.surface2, borderRadius: 16, padding: '16px 18px', border: `1px solid ${T.border}` }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.secondary, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={16} color={T.primary} /> Macronutrients (Optional / Auto-calculated by AI)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 12 }}>
                <div>
                  <label className="form-label" htmlFor="input-quick-calories" style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 4, display: 'block' }}>
                    Calories (kcal)
                  </label>
                  <input
                    id="input-quick-calories"
                    type="number"
                    step="any"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={quickForm.calories}
                    onChange={handleQuickChange('calories')}
                    style={{ borderRadius: 8, padding: '8px 12px', fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="input-quick-protein" style={{ fontSize: 12, fontWeight: 600, color: T.protein, marginBottom: 4, display: 'block' }}>
                    Protein (g)
                  </label>
                  <input
                    id="input-quick-protein"
                    type="number"
                    step="any"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={quickForm.protein}
                    onChange={handleQuickChange('protein')}
                    style={{ borderRadius: 8, padding: '8px 12px', fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="input-quick-carbs" style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.65 0.14 88)', marginBottom: 4, display: 'block' }}>
                    Carbs (g)
                  </label>
                  <input
                    id="input-quick-carbs"
                    type="number"
                    step="any"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={quickForm.carbs}
                    onChange={handleQuickChange('carbs')}
                    style={{ borderRadius: 8, padding: '8px 12px', fontSize: 13.5 }}
                  />
                </div>

                <div>
                  <label className="form-label" htmlFor="input-quick-fat" style={{ fontSize: 12, fontWeight: 600, color: 'oklch(0.5 0.1 230)', marginBottom: 4, display: 'block' }}>
                    Fat (g)
                  </label>
                  <input
                    id="input-quick-fat"
                    type="number"
                    step="any"
                    min="0"
                    className="form-control"
                    placeholder="0"
                    value={quickForm.fat}
                    onChange={handleQuickChange('fat')}
                    style={{ borderRadius: 8, padding: '8px 12px', fontSize: 13.5 }}
                  />
                </div>
              </div>
            </div>

            {/* Row 5: Micronutrients Toggle */}
            <div>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setQuickShowMicros((v) => !v)}
                id="btn-toggle-quick-micros"
                style={{ fontSize: 13, color: T.muted, gap: 6, padding: '6px 10px' }}
              >
                {quickShowMicros ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {quickShowMicros ? 'Hide Micronutrients' : '+ Show Micronutrients (Fiber, Sugar, Sodium, Vitamins...)'}
              </button>

              {quickShowMicros && (
                <div style={{ background: T.surface2, borderRadius: 14, padding: '16px 18px', border: `1px solid ${T.border}`, marginTop: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 14 }}>
                    {[
                      ['fiber', 'Fiber (g)'],
                      ['sugar', 'Sugar (g)'],
                      ['sodium', 'Sodium (mg)'],
                      ['potassium', 'Potassium (mg)'],
                      ['vitaminC', 'Vitamin C (mg)'],
                      ['vitaminD', 'Vitamin D (IU)'],
                      ['calcium', 'Calcium (mg)'],
                      ['iron', 'Iron (mg)'],
                    ].map(([f, label]) => (
                      <div key={f}>
                        <label className="form-label" htmlFor={`input-quick-${f}`} style={{ fontSize: 12, color: T.muted, marginBottom: 4, display: 'block' }}>
                          {label}
                        </label>
                        <input
                          id={`input-quick-${f}`}
                          type="number"
                          step="any"
                          min="0"
                          className="form-control"
                          placeholder="0"
                          value={quickForm[f]}
                          onChange={handleQuickChange(f)}
                          style={{ borderRadius: 8, padding: '7px 10px', fontSize: 13 }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Row 6: Notes */}
            <div>
              <label className="form-label" htmlFor="input-quick-notes" style={{ fontWeight: 600, fontSize: 13, color: T.text, marginBottom: 6, display: 'block' }}>
                Notes (Optional)
              </label>
              <input
                id="input-quick-notes"
                type="text"
                className="form-control"
                placeholder="e.g. Homemade, organic olive oil, eaten after workout..."
                value={quickForm.notes}
                onChange={handleQuickChange('notes')}
                style={{ borderRadius: 10, padding: '10px 14px', fontSize: 14 }}
              />
            </div>

            {/* Row 7: Action Buttons */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', paddingTop: 6 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => openModal(quickForm.mealType)}
                id="btn-open-modal-entry"
                style={{ fontSize: 13, gap: 6, borderRadius: 10, padding: '10px 16px', flex: '1 1 auto' }}
              >
                Open in Full Popup
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={quickLoading}
                id="btn-quick-log-submit"
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  gap: 8,
                  borderRadius: 12,
                  padding: '12px 24px',
                  boxShadow: '0 4px 14px rgba(45,90,67,0.22)',
                  flex: '1 1 auto',
                  justifyContent: 'center',
                }}
              >
                {quickLoading ? <span className="spinner" style={{ width: 16, height: 16 }} /> : <CheckCircle2 size={17} />}
                {quickLoading ? 'Logging Meal…' : `Log to ${quickForm.mealType.charAt(0).toUpperCase() + quickForm.mealType.slice(1)} 🚀`}
              </button>
            </div>

          </form>
        </div>

        {/* ── PDF File Ready Banner ── */}
        {pdfFile && (
          <div style={{
            background: 'oklch(0.88 0.08 165 / 0.18)',
            border: `1.5px solid ${T.primary}`,
            borderRadius: 16,
            padding: '16px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginBottom: 24,
            animation: 'fadeIn 0.2s ease',
          }}>
            <FileText size={24} color={T.primary} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: T.text, display: 'block' }}>
                {pdfFile.name}
              </span>
              <span style={{ fontSize: 12, color: T.muted }}>
                {(pdfFile.size / 1024).toFixed(1)} KB · Ready to parse and log
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={handlePdfImport}
              disabled={importingPdf}
              id="btn-confirm-pdf-import"
              style={{ fontSize: 13, gap: 6, padding: '8px 18px' }}
            >
              {importingPdf ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <CheckCircle2 size={15} />}
              {importingPdf ? 'Importing…' : 'Import Now'}
            </button>
            <button
              className="btn btn-ghost btn-icon"
              style={{ width: 32, height: 32 }}
              onClick={() => { setPdfFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ── Smart Logging Shortcuts (3 Cards) with Increased Height ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, marginBottom: 24 }}>
          {/* 1. Photo Scanner */}
          <div
            onClick={() => setScanModalOpen(true)}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'none'; }}
            id="card-photo-scanner"
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: 'oklch(0.88 0.08 165 / 0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.primary, flexShrink: 0,
            }}>
              <Camera size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text, display: 'block' }}>Photo Scanner</span>
              <span style={{ fontSize: 12.5, color: T.muted }}>Scan food plate with AI</span>
            </div>
            <ArrowRight size={17} color={T.muted} />
          </div>

          {/* 2. Chat with NutriBot */}
          <div
            onClick={() => navigate('/chat')}
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'none'; }}
            id="card-chat-nutribot"
          >
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: 'oklch(0.79 0.13 42 / 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.protein, flexShrink: 0,
            }}>
              <Bot size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text, display: 'block' }}>Chat with NutriBot</span>
              <span style={{ fontSize: 12.5, color: T.muted }}>Describe meal in text</span>
            </div>
            <ArrowRight size={17} color={T.muted} />
          </div>

          {/* 3. PDF Diary Import */}
          <label
            htmlFor="input-pdf-upload"
            style={{
              background: T.surface,
              border: `1px solid ${T.border}`,
              borderRadius: 16,
              padding: '22px 24px',
              boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = T.primary; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = T.border; e.currentTarget.style.transform = 'none'; }}
            id="card-pdf-import"
          >
            <input
              ref={fileInputRef}
              id="input-pdf-upload"
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handlePdfFileSelect}
            />
            <div style={{
              width: 48, height: 48, borderRadius: 12, background: 'oklch(0.72 0.1 230 / 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'oklch(0.34 0.07 250)', flexShrink: 0,
            }}>
              <FileUp size={24} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: T.text, display: 'block' }}>Import PDF Diary</span>
              <span style={{ fontSize: 12.5, color: T.muted }}>Upload meal log PDF</span>
            </div>
            <ArrowRight size={17} color={T.muted} />
          </label>
        </div>

        {/* ── Tips & Shortcuts Card ── */}
        <div style={{
          background: T.surface2,
          border: `1px solid ${T.border}`,
          borderRadius: 18,
          padding: '24px 28px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, background: T.surface,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.primary, flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
            }}>
              <Sparkles size={20} />
            </div>
            <div>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, display: 'block', marginBottom: 6 }}>
                Smart Logging Tips
              </span>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 6, margin: 0, paddingLeft: 18, fontSize: 13, color: T.secondary, lineHeight: 1.55 }}>
                <li>
                  <strong>Photo Scan:</strong> Upload or snap a picture of your dish for instant AI macro breakdown.
                </li>
                <li>
                  <strong>NutriBot AI:</strong> Click <em>Chat with NutriBot</em> to log naturally in conversational sentences.
                </li>
                <li>
                  <strong>PDF Diary:</strong> Upload diet logs or full meal spreadsheets in PDF format to batch import entries.
                </li>
              </ul>
            </div>
          </div>
        </div>

      </div>

      {/* Manual Entry Modal */}
      <FoodEntryModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={handleSaved}
        defaults={modalDefaults}
        entry={null}
      />

      {/* AI Photo Scan Modal */}
      <Modal
        isOpen={scanModalOpen}
        onClose={() => setScanModalOpen(false)}
        title="📸 AI Food Photo Scanner"
        subtitle="Upload or drag a photo of your food for instant nutrition analysis"
      >
        <AIPhotoUpload
          onDataExtracted={handleAIData}
          onClose={() => setScanModalOpen(false)}
        />
      </Modal>
    </div>
  );
}
