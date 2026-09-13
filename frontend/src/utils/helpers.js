/**
 * Format a number to a fixed decimal, hiding trailing zeros.
 * @param {number} value
 * @param {number} decimals
 */
export const fmt = (value, decimals = 1) => {
  const n = parseFloat(value) || 0;
  return n % 1 === 0 ? n.toString() : n.toFixed(decimals);
};

/**
 * Format calorie value (always whole number).
 */
export const fmtCal = (value) => Math.round(parseFloat(value) || 0).toLocaleString();

/**
 * Get today's date as YYYY-MM-DD.
 */
export const today = () => new Date().toISOString().split('T')[0];

/**
 * Format a YYYY-MM-DD date string for display.
 * @param {string} dateStr
 * @param {object} options - Intl.DateTimeFormat options
 */
export const fmtDate = (dateStr, options = { month: 'short', day: 'numeric' }) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', options);
};

/**
 * Get N days ago as YYYY-MM-DD.
 */
export const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

/**
 * Get initials from a full name.
 */
export const getInitials = (name = '') =>
  name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

/**
 * Calculate percentage (0-100), capped at 100 for display.
 */
export const pct = (actual, goal) => {
  if (!goal || goal <= 0) return 0;
  return Math.min(100, Math.round((actual / goal) * 100));
};

/**
 * Get colour for a progress value.
 */
export const progressColor = (pctValue) => {
  if (pctValue >= 100) return 'var(--color-danger)';
  if (pctValue >= 80) return 'var(--color-warning)';
  return 'var(--color-success)';
};

/**
 * Meal type label map.
 */
export const MEAL_LABELS = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export const MEAL_EMOJIS = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snacks: '🍎',
};

/**
 * Nutrient display config (label, unit, color).
 */
export const NUTRIENTS = {
  calories: { label: 'Calories', unit: 'kcal', color: 'var(--color-calories)' },
  protein: { label: 'Protein', unit: 'g', color: 'var(--color-protein)' },
  carbs: { label: 'Carbs', unit: 'g', color: 'var(--color-carbs)' },
  fat: { label: 'Fat', unit: 'g', color: 'var(--color-fat)' },
  fiber: { label: 'Fiber', unit: 'g', color: 'var(--color-fiber)' },
  sugar: { label: 'Sugar', unit: 'g', color: 'var(--color-warning)' },
  sodium: { label: 'Sodium', unit: 'mg', color: 'var(--color-danger)' },
  potassium: { label: 'Potassium', unit: 'mg', color: 'var(--color-accent)' },
  vitaminC: { label: 'Vitamin C', unit: 'mg', color: '#f97316' },
  vitaminD: { label: 'Vitamin D', unit: 'IU', color: '#eab308' },
  calcium: { label: 'Calcium', unit: 'mg', color: '#06b6d4' },
  iron: { label: 'Iron', unit: 'mg', color: '#dc2626' },
};

/**
 * Extract the first error message from an Axios error response.
 */
export const getApiError = (err) =>
  err?.response?.data?.message || err?.message || 'An unexpected error occurred.';
