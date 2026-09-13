import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine, Area, AreaChart,
} from 'recharts';
import { Download, Loader2, FileText, CheckCircle2, Flame, Calendar, Table } from 'lucide-react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { reportApi, entryApi, goalApi } from '../api';
import { fmtDate, fmt, daysAgo, today } from '../utils/helpers';
import toast from 'react-hot-toast';

// ── Design tokens matching NourishLoop / NutriTrack (Standard Hex for PDF & Canvas compatibility) ──
const T = {
  bg: '#F5F4F0',
  surface: '#FFFFFF',
  surface2: '#F9F8F6',
  surface3: '#F0EFEA',
  border: '#E5E3DE',
  borderLight: '#F0EEE9',
  primary: '#2D5A43',
  primaryDark: '#1E4230',
  success: '#2D5A43',
  mint: '#E6F4EA',
  mintFg: '#1B5E20',
  warning: '#D97706',
  danger: '#DC2626',
  text: '#1C1917',
  secondary: '#4B5563',
  muted: '#6B7280',
  inverse: '#FFFFFF',
  protein: '#FB923C',      /* coral */
  carbs: '#FBBF24',        /* sunny amber */
  fat: '#60A5FA',          /* sky blue */
};

const RANGE_PRESETS = [
  { label: '7 Days', days: 6 },
  { label: '14 Days', days: 13 },
  { label: '30 Days', days: 29 },
];

const MICRO_CONFIG = [
  { key: 'fiber', label: 'Fiber', unit: 'g', rdi: 28, color: '#059669' },
  { key: 'sugar', label: 'Sugar', unit: 'g', rdi: 50, color: '#D97706' },
  { key: 'sodium', label: 'Sodium', unit: 'mg', rdi: 2300, color: '#DC2626' },
  { key: 'potassium', label: 'Potassium', unit: 'mg', rdi: 4700, color: '#00d4aa' },
  { key: 'vitaminC', label: 'Vitamin C', unit: 'mg', rdi: 90, color: '#f97316' },
  { key: 'vitaminD', label: 'Vitamin D', unit: 'IU', rdi: 600, color: '#eab308' },
  { key: 'calcium', label: 'Calcium', unit: 'mg', rdi: 1000, color: '#06b6d4' },
  { key: 'iron', label: 'Iron', unit: 'mg', rdi: 18, color: '#dc2626' },
];

const PIE_COLORS = [
  '#FB923C',   /* breakfast - coral */
  '#2D5A43',   /* lunch - emerald */
  '#FBBF24',   /* dinner - sunny */
  '#60A5FA',   /* snacks - sky */
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '10px 14px',
      boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: T.muted, marginBottom: 6 }}>
        {label ? (label.length > 10 ? label : fmtDate(label, { weekday: 'short', month: 'short', day: 'numeric' })) : ''}
      </div>
      {payload.map((p) => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 12 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.fill || p.stroke }} />
          <span style={{ color: T.secondary }}>{p.name}:</span>
          <span style={{ fontWeight: 700, color: T.text }}>
            {typeof p.value === 'number' ? fmt(p.value) : p.value}
            {p.unit || (p.name === 'Calories' || p.name === 'Actual' || p.name === 'Goal' ? ' kcal' : p.name === 'Protein' || p.name === 'Carbs' || p.name === 'Fat' ? ' g' : '')}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ReportsPage() {
  const [range, setRange] = useState({ startDate: daysAgo(6), endDate: today() });
  const [weeklyData, setWeeklyData] = useState([]);
  const [macroData, setMacroData] = useState([]);
  const [microData, setMicroData] = useState({});
  const [comparisonData, setComparisonData] = useState({ actual: [], goal: null });
  const [mealDist, setMealDist] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [reportEntries, setReportEntries] = useState([]);

  const pdfExportContainerRef = useRef(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wc, macro, micro, comp, dist, entriesRes] = await Promise.all([
        reportApi.weeklyCalories(range),
        reportApi.macros(range),
        reportApi.micros(range),
        reportApi.goalComparison(range),
        reportApi.mealDistribution(range),
        entryApi.getEntries({ startDate: range.startDate, endDate: range.endDate, limit: 1000 }).catch(() => ({ data: { data: [] } })),
      ]);
      setWeeklyData(wc.data.data || []);
      setMacroData(macro.data.data || []);
      setMicroData(micro.data.data || {});
      setComparisonData(comp.data.data || { actual: [], goal: null });
      setMealDist(dist.data.data || []);
      setReportEntries(entriesRes.data?.data || []);
    } catch (err) {
      toast.error('Failed to load reports.');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setPreset = (days) => {
    setRange({ startDate: daysAgo(days), endDate: today() });
  };

  const chartColors = {
    protein: T.protein,
    carbs: T.carbs,
    fat: T.fat,
    calories: T.primary,
  };

  const mealOrder = ['breakfast', 'lunch', 'dinner', 'snacks'];

  const pieData = mealOrder
    .map((m) => mealDist.find((d) => d.mealType === m))
    .filter(Boolean)
    .map((d) => ({ name: d.mealType, value: d.calories }));

  const axisStyle = { fill: T.muted, fontSize: 11 };

  // Calculate summary metrics for the PDF header
  const totalCalories = weeklyData.reduce((sum, item) => sum + (Number(item.calories) || 0), 0);
  const totalDays = weeklyData.length || 1;
  const avgCalories = Math.round(totalCalories / totalDays);
  const avgProtein = Math.round(macroData.reduce((s, i) => s + (Number(i.protein) || 0), 0) / (macroData.length || 1));
  const avgCarbs = Math.round(macroData.reduce((s, i) => s + (Number(i.carbs) || 0), 0) / (macroData.length || 1));
  const avgFat = Math.round(macroData.reduce((s, i) => s + (Number(i.fat) || 0), 0) / (macroData.length || 1));

  // ── PDF Export Handler ───────────────────────────────────────────────────────
  const handleDownloadPdf = async () => {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    const toastId = toast.loading('Generating comprehensive PDF report with graphs & entries table…');

    try {
      // Ensure entries are loaded
      let entries = reportEntries;
      if (!entries || entries.length === 0) {
        const res = await entryApi.getEntries({ startDate: range.startDate, endDate: range.endDate, limit: 1000 });
        entries = res.data?.data || [];
        setReportEntries(entries);
      }

      await new Promise((r) => setTimeout(r, 450));

      const exportElement = pdfExportContainerRef.current;
      if (!exportElement) {
        throw new Error('Export element not found');
      }

      // Safe capture with onclone sanitization (converts any potential oklch / CSS vars into hex)
      const canvas = await html2canvas(exportElement, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#FFFFFF',
        windowWidth: 1000,
        onclone: (clonedDoc) => {
          // Sanitize style tags
          const styles = clonedDoc.querySelectorAll('style');
          styles.forEach((s) => {
            try {
              s.innerHTML = s.innerHTML.replace(/oklch\([^)]+\)/g, '#2D5A43');
            } catch (_) {}
          });

          // Sanitize inline styles
          const allEls = clonedDoc.querySelectorAll('*');
          allEls.forEach((el) => {
            const inline = el.getAttribute('style');
            if (inline && inline.includes('oklch')) {
              el.setAttribute('style', inline.replace(/oklch\([^)]+\)/g, '#2D5A43'));
            }
          });
        },
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfHeight;

      // Add extra pages if needed
      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfHeight;
      }

      const fileName = `NutriTrack_Report_${range.startDate}_to_${range.endDate}.pdf`;
      pdf.save(fileName);

      toast.success('PDF report downloaded successfully! 📄', { id: toastId });
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error(`Failed to generate PDF: ${err.message || 'Unknown error'}`, { id: toastId });
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="page-container animate-fade-in" style={{ background: T.bg, minHeight: '100vh', padding: '24px 28px' }}>
      
      {/* ── Header & Range Controls ── */}
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22, flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 className="page-title" style={{ fontSize: 24, fontWeight: 800, color: T.text, margin: 0, letterSpacing: '-0.4px' }}>
            Nutrition Reports
          </h1>
          <p className="page-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 3 }}>
            Visual insights into your nutrition journey
          </p>
        </div>

        {/* Range controls & Download PDF button */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {RANGE_PRESETS.map(({ label, days }) => (
            <button
              key={label}
              className={`btn btn-sm ${range.startDate === daysAgo(days) && range.endDate === today() ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPreset(days)}
              id={`btn-preset-${label.replace(/\s/g, '-').toLowerCase()}`}
              style={{ fontSize: 13, padding: '6px 14px', borderRadius: 99 }}
            >
              {label}
            </button>
          ))}
          <input
            type="date"
            className="form-control"
            value={range.startDate}
            onChange={(e) => setRange((r) => ({ ...r, startDate: e.target.value }))}
            style={{ width: 136, padding: '6px 10px', fontSize: 12, borderRadius: 10 }}
            id="report-start-date"
          />
          <span style={{ color: T.muted }}>→</span>
          <input
            type="date"
            className="form-control"
            value={range.endDate}
            onChange={(e) => setRange((r) => ({ ...r, endDate: e.target.value }))}
            style={{ width: 136, padding: '6px 10px', fontSize: 12, borderRadius: 10 }}
            id="report-end-date"
          />

          {/* ── Download PDF Button (beside days) ── */}
          <button
            className="btn btn-primary"
            onClick={handleDownloadPdf}
            disabled={loading || downloadingPdf}
            id="btn-download-pdf"
            style={{
              fontSize: 13,
              fontWeight: 700,
              padding: '6px 16px',
              borderRadius: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: '0 2px 8px rgba(45,90,67,0.2)',
            }}
          >
            {downloadingPdf ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Generating PDF…</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 400 }}>
          <div className="spinner dark" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Row 1: Weekly calories + Meal distribution */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            
            {/* Component 1: Weekly calorie trend */}
            <div className="card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="card-title" style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Weekly Calorie Intake</div>
                  <div className="card-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Daily calories over the selected period</div>
                </div>
              </div>
              {weeklyData.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}>
                  <p>No data for this period</p>
                </div>
              ) : (
                <div style={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                      <defs>
                        <linearGradient id="calorieGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={T.primary} stopOpacity={0.45} />
                          <stop offset="100%" stopColor={T.primary} stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })}
                        tick={axisStyle}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      {comparisonData.goal?.dailyCalories && (
                        <ReferenceLine
                          y={comparisonData.goal.dailyCalories}
                          stroke={T.primary}
                          strokeDasharray="6 3"
                          label={{ value: 'Goal', fill: T.primary, fontSize: 11, position: 'insideTopRight' }}
                        />
                      )}
                      <Area
                        type="monotone"
                        dataKey="calories"
                        name="Calories"
                        stroke={T.primary}
                        strokeWidth={3}
                        fill="url(#calorieGrad)"
                        dot={{ fill: T.primary, r: 4 }}
                        activeDot={{ r: 6, fill: T.primary }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Component 2: Meal distribution pie */}
            <div className="card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              <div className="card-header" style={{ marginBottom: 16 }}>
                <div>
                  <div className="card-title" style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Calorie Distribution by Meal</div>
                  <div className="card-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Which meal contributes most calories</div>
                </div>
              </div>
              {pieData.length === 0 ? (
                <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}><p>No data</p></div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 24, minHeight: 260 }}>
                  <div style={{ width: '50%', height: 230 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={84}
                          dataKey="value"
                          paddingAngle={4}
                        >
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} stroke={T.surface} strokeWidth={2} />
                          ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pieData.map((d, idx) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 12, height: 12, borderRadius: 4, background: PIE_COLORS[idx % PIE_COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 13, textTransform: 'capitalize', color: T.secondary, flex: 1, fontWeight: 500 }}>{d.name}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{Math.round(d.value)} kcal</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Component 3: Row 2: Macro stacked bar */}
          <div className="card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="card-title" style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Macronutrient Breakdown</div>
                <div className="card-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Daily protein, carbs, and fat distribution</div>
              </div>
            </div>
            {macroData.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}><p>No data</p></div>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={macroData} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12, color: T.secondary, paddingTop: 8 }} iconType="circle" />
                    <Bar dataKey="protein" name="Protein" stackId="a" fill={chartColors.protein} radius={[0, 0, 0, 0]} />
                    <Bar dataKey="carbs" name="Carbs" stackId="a" fill={chartColors.carbs} />
                    <Bar dataKey="fat" name="Fat" stackId="a" fill={chartColors.fat} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Component 4: Row 3: Goal vs Actual */}
          <div className="card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div className="card-title" style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Goal vs Actual Calories</div>
                <div className="card-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>How you track against your daily calorie target</div>
              </div>
              {comparisonData.goal && (
                <div style={{ fontSize: 12, fontWeight: 600, color: T.primary, background: T.surface2, padding: '4px 12px', borderRadius: 99, border: `1px solid ${T.border}` }}>
                  Goal: {comparisonData.goal.dailyCalories} kcal
                </div>
              )}
            </div>
            {comparisonData.actual.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 0', textAlign: 'center', color: T.muted }}><p>No data</p></div>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={comparisonData.actual} margin={{ top: 8, right: 8, bottom: 0, left: -14 }}>
                    <CartesianGrid strokeDasharray="4 4" stroke={T.border} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })}
                      tick={axisStyle}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    {comparisonData.goal?.dailyCalories && (
                      <ReferenceLine
                        y={comparisonData.goal.dailyCalories}
                        stroke={T.primary}
                        strokeDasharray="6 3"
                        label={{ value: 'Goal', fill: T.primary, fontSize: 11, position: 'insideTopRight' }}
                      />
                    )}
                    <Bar dataKey="calories" name="Actual" fill={T.primary} radius={[6, 6, 0, 0]} opacity={0.88} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Component 5: Row 4: Micronutrient summary */}
          <div className="card" style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 16, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
            <div className="card-header" style={{ marginBottom: 16 }}>
              <div>
                <div className="card-title" style={{ fontSize: 17, fontWeight: 700, color: T.text }}>Micronutrient Summary</div>
                <div className="card-subtitle" style={{ fontSize: 13, color: T.muted, marginTop: 2 }}>Total intake vs recommended daily intake (RDI) for the period</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
              {MICRO_CONFIG.map(({ key, label, unit, rdi, color }) => {
                const total = microData[key] || 0;
                const days = microData.daysTracked || 1;
                const avg = total / days;
                const pct = Math.min((avg / rdi) * 100, 100);
                return (
                  <div key={key} style={{ padding: '14px 16px', background: T.surface2, borderRadius: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.text }}>{label}</span>
                      <span style={{ fontSize: 11, color: T.muted }}>RDI {rdi}{unit}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 99, background: `${color}20`, marginBottom: 8 }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          borderRadius: 99,
                          background: pct < 50 ? T.danger : pct < 80 ? T.warning : color,
                          transition: 'width 0.6s ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color }}>
                        {fmt(avg, 1)}{unit}/day avg
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: T.muted }}>{Math.round(pct)}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {microData.daysTracked && (
              <p style={{ fontSize: 12, color: T.muted, marginTop: 16, textAlign: 'center' }}>
                Based on {microData.daysTracked} day{microData.daysTracked > 1 ? 's' : ''} of tracked data
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Hidden Printable PDF Export Template (100% Hex colors & no oklch) ── */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, width: 1000 }}>
        <div
          ref={pdfExportContainerRef}
          style={{
            width: 1000,
            background: '#FFFFFF',
            padding: '36px 40px',
            color: '#1C1917',
            fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
            boxSizing: 'border-box',
          }}
        >
          {/* PDF Report Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #E5E3DE', paddingBottom: 20, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: '#2D5A43',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Flame size={24} color="#FFFFFF" />
              </div>
              <div>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0, color: '#1C1917', letterSpacing: '-0.4px' }}>
                  NutriTrack Report
                </h1>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0 0' }}>
                  Nutrition, Macro Analytics & Complete Food Diary
                </p>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                display: 'inline-block',
                background: '#E6F4EA',
                color: '#2D5A43',
                fontWeight: 700,
                fontSize: 13,
                padding: '4px 12px',
                borderRadius: 99,
                marginBottom: 4,
              }}>
                📅 {fmtDate(range.startDate)} — {fmtDate(range.endDate)}
              </div>
              <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
                Generated on: {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* Quick Stats Summary Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 28 }}>
            <div style={{ background: '#F9F8F6', border: '1px solid #E5E3DE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Daily Avg Calories</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#2D5A43', marginTop: 4 }}>{avgCalories.toLocaleString()} kcal</div>
            </div>
            <div style={{ background: '#F9F8F6', border: '1px solid #E5E3DE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Avg Protein</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FB923C', marginTop: 4 }}>{avgProtein}g / day</div>
            </div>
            <div style={{ background: '#F9F8F6', border: '1px solid #E5E3DE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Avg Carbs / Fat</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#FBBF24', marginTop: 4 }}>{avgCarbs}g / {avgFat}g</div>
            </div>
            <div style={{ background: '#F9F8F6', border: '1px solid #E5E3DE', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Meals Logged</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: '#1C1917', marginTop: 4 }}>{reportEntries.length} Items</div>
            </div>
          </div>

          {/* Section: Nutrition Graphs & Visualizations */}
          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1C1917', marginBottom: 14, borderBottom: '1px solid #E5E3DE', paddingBottom: 6 }}>
              📊 Nutrition Visualizations & Trends
            </h2>

            {/* Graphs row 1 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Chart 1 */}
              <div style={{ border: '1px solid #E5E3DE', borderRadius: 14, padding: 16, background: '#FFFFFF' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>Daily Calorie Intake</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Total calories per day in period</div>
                <div style={{ height: 190 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })} tick={{ fill: '#6B7280', fontSize: 9 }} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} />
                      <Area type="monotone" dataKey="calories" stroke="#2D5A43" strokeWidth={2} fill="#2D5A43" fillOpacity={0.25} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 2 */}
              <div style={{ border: '1px solid #E5E3DE', borderRadius: 14, padding: 16, background: '#FFFFFF' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>Meal Distribution</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Calorie split across meals</div>
                <div style={{ height: 190, display: 'flex', alignItems: 'center' }}>
                  <div style={{ width: '55%', height: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={35} outerRadius={65} dataKey="value">
                          {pieData.map((_, idx) => (
                            <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ width: '45%', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                    {pieData.map((d, idx) => (
                      <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                        <span style={{ textTransform: 'capitalize', color: '#4B5563', flex: 1 }}>{d.name}:</span>
                        <strong style={{ color: '#1C1917' }}>{Math.round(d.value)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Graphs row 2 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {/* Chart 3 */}
              <div style={{ border: '1px solid #E5E3DE', borderRadius: 14, padding: 16, background: '#FFFFFF' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>Macronutrient Split</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Protein, carbs & fat distribution</div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={macroData} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })} tick={{ fill: '#6B7280', fontSize: 9 }} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="protein" name="Protein" stackId="a" fill="#FB923C" />
                      <Bar dataKey="carbs" name="Carbs" stackId="a" fill="#FBBF24" />
                      <Bar dataKey="fat" name="Fat" stackId="a" fill="#60A5FA" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Chart 4 */}
              <div style={{ border: '1px solid #E5E3DE', borderRadius: 14, padding: 16, background: '#FFFFFF' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#1C1917', marginBottom: 2 }}>Goal vs Actual Intake</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10 }}>Performance against daily calorie target</div>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData.actual} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F0EFEA" vertical={false} />
                      <XAxis dataKey="date" tickFormatter={(d) => fmtDate(d, { month: 'short', day: 'numeric' })} tick={{ fill: '#6B7280', fontSize: 9 }} />
                      <YAxis tick={{ fill: '#6B7280', fontSize: 9 }} />
                      {comparisonData.goal?.dailyCalories && (
                        <ReferenceLine y={comparisonData.goal.dailyCalories} stroke="#2D5A43" strokeDasharray="4 2" />
                      )}
                      <Bar dataKey="calories" name="Actual" fill="#2D5A43" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Food Entries Detailed Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid #E5E3DE', paddingBottom: 6 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: '#1C1917', margin: 0 }}>
                📋 Food Entries Diary Table ({reportEntries.length} Items)
              </h2>
              <span style={{ fontSize: 12, color: '#6B7280' }}>
                Sorted chronologically by date and meal
              </span>
            </div>

            {reportEntries.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9CA3AF', fontStyle: 'italic' }}>
                No food entries recorded in this time period.
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: '#F3F4F6', borderBottom: '2px solid #E5E7EB' }}>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151' }}>Date</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151' }}>Meal</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151' }}>Food Item</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151' }}>Qty</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Calories</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Protein</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Carbs</th>
                    <th style={{ padding: '8px 10px', fontWeight: 700, color: '#374151', textAlign: 'right' }}>Fat</th>
                  </tr>
                </thead>
                <tbody>
                  {reportEntries.map((entry, idx) => (
                    <tr
                      key={entry.id || idx}
                      style={{
                        borderBottom: '1px solid #E5E7EB',
                        background: idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB',
                      }}
                    >
                      <td style={{ padding: '8px 10px', color: '#4B5563', whiteSpace: 'nowrap' }}>
                        {fmtDate(entry.date, { month: 'short', day: 'numeric' })}
                      </td>
                      <td style={{ padding: '8px 10px' }}>
                        <span style={{
                          textTransform: 'capitalize',
                          fontWeight: 600,
                          fontSize: 10.5,
                          padding: '2px 7px',
                          borderRadius: 99,
                          background: entry.mealType === 'breakfast' ? '#FEF3C7' : entry.mealType === 'lunch' ? '#E6F4EA' : entry.mealType === 'dinner' ? '#EDE9FE' : '#E0F2FE',
                          color: entry.mealType === 'breakfast' ? '#92400E' : entry.mealType === 'lunch' ? '#166534' : entry.mealType === 'dinner' ? '#5B21B6' : '#075985',
                        }}>
                          {entry.mealType}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#111827' }}>
                        {entry.foodName}
                      </td>
                      <td style={{ padding: '8px 10px', color: '#6B7280' }}>
                        {entry.quantity} {entry.unit}
                      </td>
                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2D5A43', textAlign: 'right' }}>
                        {Math.round(entry.calories || 0)} kcal
                      </td>
                      <td style={{ padding: '8px 10px', color: '#374151', textAlign: 'right' }}>
                        {fmt(entry.protein || 0)}g
                      </td>
                      <td style={{ padding: '8px 10px', color: '#374151', textAlign: 'right' }}>
                        {fmt(entry.carbs || 0)}g
                      </td>
                      <td style={{ padding: '8px 10px', color: '#374151', textAlign: 'right' }}>
                        {fmt(entry.fat || 0)}g
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* PDF Footer */}
          <div style={{ borderTop: '1px solid #E5E3DE', marginTop: 28, paddingTop: 14, display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#9CA3AF' }}>
            <span>NutriTrack Precision Health & Nutrition System</span>
            <span>Confidential & Private Personal Health Record</span>
          </div>
        </div>
      </div>

    </div>
  );
}
