import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import Modal from './Modal';
import { entryApi } from '../api';
import { today, getApiError } from '../utils/helpers';
import { ChevronDown, ChevronUp } from 'lucide-react';

const EMPTY = {
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
};

export default function FoodEntryModal({ isOpen, onClose, onSaved, entry = null, defaults = {} }) {
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [showMicros, setShowMicros] = useState(false);

  const isEditing = Boolean(entry);

  useEffect(() => {
    if (isOpen) {
      setForm(entry
        ? { ...EMPTY, ...entry }
        : { ...EMPTY, date: today(), ...defaults });
      setShowMicros(false);
    }
  }, [isOpen, entry, defaults]);

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.foodName.trim()) return toast.error('Food name is required.');
    if (!form.quantity || form.quantity <= 0) return toast.error('Quantity must be positive.');

    setLoading(true);
    try {
      const payload = {
        ...form,
        quantity: parseFloat(form.quantity) || 0,
        calories: parseFloat(form.calories) || 0,
        protein: parseFloat(form.protein) || 0,
        carbs: parseFloat(form.carbs) || 0,
        fat: parseFloat(form.fat) || 0,
        fiber: parseFloat(form.fiber) || 0,
        sugar: parseFloat(form.sugar) || 0,
        sodium: parseFloat(form.sodium) || 0,
        potassium: parseFloat(form.potassium) || 0,
        vitaminC: parseFloat(form.vitaminC) || 0,
        vitaminD: parseFloat(form.vitaminD) || 0,
        calcium: parseFloat(form.calcium) || 0,
        iron: parseFloat(form.iron) || 0,
      };

      if (isEditing) {
        await entryApi.updateEntry(entry.id, payload);
        toast.success('Entry updated!');
      } else {
        await entryApi.createEntry(payload);
        toast.success('Meal logged! 🎉');
      }
      onSaved?.();
      onClose();
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const inputProps = (field, type = 'number') => ({
    id: `input-entry-${field}`,
    type,
    className: 'form-control',
    value: form[field],
    onChange: set(field),
    min: type === 'number' ? '0' : undefined,
    step: type === 'number' ? 'any' : undefined,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Food Entry' : 'Log Food Entry'}
      maxWidth={620}
      footer={
        <>
          <button className="btn btn-secondary" onClick={onClose} type="button">Cancel</button>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading} id="btn-save-entry">
            {loading ? <span className="spinner" /> : null}
            {isEditing ? 'Save Changes' : 'Log Entry'}
          </button>
        </>
      }
    >
      {/* Core fields */}
      <div className="form-row">
        <div className="form-group">
          <label className="form-label required" htmlFor="input-entry-date">Date</label>
          <input {...inputProps('date', 'date')} />
        </div>
        <div className="form-group">
          <label className="form-label required" htmlFor="input-entry-mealType">Meal Type</label>
          <select id="input-entry-mealType" className="form-control" value={form.mealType} onChange={set('mealType')}>
            {['breakfast', 'lunch', 'dinner', 'snacks'].map((m) => (
              <option key={m} value={m}>{m.charAt(0).toUpperCase() + m.slice(1)}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label required" htmlFor="input-entry-foodName">Food Name</label>
        <input
          id="input-entry-foodName"
          type="text"
          className="form-control"
          placeholder="e.g. Grilled Chicken Breast"
          value={form.foodName}
          onChange={set('foodName')}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label required" htmlFor="input-entry-quantity">Quantity</label>
          <input {...inputProps('quantity')} placeholder="100" />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="input-entry-unit">Unit</label>
          <select id="input-entry-unit" className="form-control" value={form.unit} onChange={set('unit')}>
            {['g', 'ml', 'oz', 'lb', 'cup', 'tbsp', 'tsp', 'piece', 'serving', 'slice'].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Macros */}
      <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
        <div className="text-sm font-semibold text-secondary mb-4">Macronutrients</div>
        <div className="form-row-3">
          {[['calories', 'kcal'], ['protein', 'g'], ['carbs', 'g'], ['fat', 'g']].map(([f, u]) => (
            <div key={f} className="form-group">
              <label className="form-label" htmlFor={`input-entry-${f}`} style={{ textTransform: 'capitalize' }}>{f} ({u})</label>
              <input {...inputProps(f)} placeholder="0" />
            </div>
          ))}
        </div>
      </div>

      {/* Micronutrients toggle */}
      <button
        type="button"
        className="btn btn-ghost w-full"
        onClick={() => setShowMicros((v) => !v)}
        id="btn-toggle-micros"
        style={{ justifyContent: 'center', gap: 'var(--space-2)' }}
      >
        {showMicros ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        {showMicros ? 'Hide' : 'Show'} Micronutrients
      </button>

      {showMicros && (
        <div style={{ background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)', animation: 'slideUp 0.2s ease' }}>
          <div className="text-sm font-semibold text-secondary mb-4">Micronutrients</div>
          <div className="form-row">
            {[['fiber', 'g'], ['sugar', 'g'], ['sodium', 'mg'], ['potassium', 'mg'], ['vitaminC', 'mg'], ['vitaminD', 'IU'], ['calcium', 'mg'], ['iron', 'mg']].map(([f, u]) => (
              <div key={f} className="form-group">
                <label className="form-label" htmlFor={`input-entry-${f}`}>
                  {f === 'vitaminC' ? 'Vitamin C' : f === 'vitaminD' ? 'Vitamin D' : f.charAt(0).toUpperCase() + f.slice(1)} ({u})
                </label>
                <input {...inputProps(f)} placeholder="0" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="form-group">
        <label className="form-label" htmlFor="input-entry-notes">Notes (optional)</label>
        <input
          id="input-entry-notes"
          type="text"
          className="form-control"
          placeholder="e.g. Homemade, restaurant name, etc."
          value={form.notes}
          onChange={set('notes')}
        />
      </div>
    </Modal>
  );
}
