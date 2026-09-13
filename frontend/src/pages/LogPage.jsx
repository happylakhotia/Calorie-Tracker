import { useState, useRef } from 'react';
import { Plus, Camera, Bot, FileUp, Sparkles, ArrowRight, X, FileText, CheckCircle2 } from 'lucide-react';
import FoodEntryModal from '../components/FoodEntryModal';
import AIPhotoUpload from '../components/AIPhotoUpload';
import Modal from '../components/Modal';
import { today, getApiError } from '../utils/helpers';
import { useNavigate } from 'react-router-dom';
import { aiApi } from '../api';
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
  const navigate = useNavigate();

  const openModal = (mealType) => {
    setDefaultMeal(mealType);
    setModalDefaults({ mealType, date: today() });
    setModalOpen(true);
  };

  const handleSaved = () => {
    navigate('/dashboard');
  };

  const handleAIData = (data) => {
    setScanModalOpen(false);
    setModalDefaults({
      mealType: 'breakfast',
      date: today(),
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
    setModalOpen(true);
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
    <div style={{ background: T.bg, minHeight: '100vh', padding: '28px 32px' }} className="animate-fade-in">
      {/* ── Generous Container ── */}
      <div style={{ maxWidth: 1180, margin: '0 auto' }}>
        
        {/* ── Page Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 14 }}>
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

        {/* ── 4 Meal Cards Grid with Increased Height & Width ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: 18, marginBottom: 24 }}>
          {MEAL_CARDS.map(({ type, label, emoji, desc, bg }) => (
            <div
              key={type}
              onClick={() => openModal(type)}
              id={`btn-log-${type}`}
              style={{
                background: T.surface,
                border: `1.5px solid ${T.border}`,
                borderRadius: 18,
                padding: '26px 28px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 20,
                minHeight: 116,
                boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = T.primary;
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 28px rgba(0,0,0,0.07)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = T.border;
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)';
              }}
            >
              <div style={{
                width: 60,
                height: 60,
                borderRadius: 16,
                background: bg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 30,
                flexShrink: 0,
              }}>
                {emoji}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 700, color: T.text, display: 'block' }}>{label}</span>
                <p style={{ fontSize: 13.5, color: T.muted, margin: '4px 0 0', lineHeight: 1.45 }}>
                  {desc}
                </p>
              </div>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 99,
                background: T.surface2,
                border: `1px solid ${T.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                color: T.primary,
              }}>
                <Plus size={18} />
              </div>
            </div>
          ))}
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
        defaultValues={modalDefaults}
        entry={{ mealType: defaultMeal, date: today(), ...modalDefaults }}
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
