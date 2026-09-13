import { useState, useEffect, useCallback } from 'react';
import { Plus, Filter, Search, Edit2, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { entryApi } from '../api';
import { fmtDate, fmt, fmtCal, MEAL_LABELS, getApiError, daysAgo, today } from '../utils/helpers';
import FoodEntryModal from '../components/FoodEntryModal';
import Pagination from '../components/Pagination';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];

export default function EntriesPage() {
  const [entries, setEntries] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editEntry, setEditEntry] = useState(null);

  // Filters
  const [filters, setFilters] = useState({
    startDate: daysAgo(29),
    endDate: today(),
    mealType: '',
    page: 1,
    limit: 20,
  });
  const [search, setSearch] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      if (!params.mealType) delete params.mealType;
      const { data } = await entryApi.getEntries(params);
      setEntries(data.data || []);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load entries.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value, page: 1 }));
  const clearFilters = () => setFilters({ startDate: daysAgo(29), endDate: today(), mealType: '', page: 1, limit: 20 });

  const handleDelete = async (id) => {
    if (!confirm('Delete this entry?')) return;
    try {
      await entryApi.deleteEntry(id);
      toast.success('Entry deleted.');
      fetchEntries();
    } catch (err) {
      toast.error(getApiError(err));
    }
  };

  const openEdit = (entry) => { setEditEntry(entry); setModalOpen(true); };
  const openAdd = () => { setEditEntry(null); setModalOpen(true); };

  // Client-side search filter
  const displayedEntries = search.trim()
    ? entries.filter((e) => e.foodName.toLowerCase().includes(search.toLowerCase()))
    : entries;

  return (
    <div className="page-container animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Food Entries</h1>
          <p className="page-subtitle">Browse and manage all your logged meals</p>
        </div>
        <button className="btn btn-primary" onClick={openAdd} id="btn-add-entry">
          <Plus size={18} /> Add Entry
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-4)', alignItems: 'flex-end' }}>
          <div className="form-group">
            <label className="form-label">Start Date</label>
            <input
              id="filter-start-date"
              type="date"
              className="form-control"
              value={filters.startDate}
              onChange={setFilter('startDate')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">End Date</label>
            <input
              id="filter-end-date"
              type="date"
              className="form-control"
              value={filters.endDate}
              onChange={setFilter('endDate')}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Meal Type</label>
            <select id="filter-meal-type" className="form-control" value={filters.mealType} onChange={setFilter('mealType')}>
              <option value="">All Meals</option>
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>{MEAL_LABELS[m]}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Per Page</label>
            <select id="filter-per-page" className="form-control" value={filters.limit} onChange={setFilter('limit')}>
              {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button className="btn btn-secondary w-full" onClick={clearFilters} id="btn-clear-filters">
              <X size={14} /> Clear
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div style={{ marginTop: 'var(--space-4)', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            id="search-entries"
            type="text"
            className="form-control"
            placeholder="Search food name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
        </div>
      </div>

      {/* Results */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: 'var(--space-10)', textAlign: 'center' }}>
            <div className="spinner dark" style={{ width: 28, height: 28, margin: '0 auto' }} />
          </div>
        ) : displayedEntries.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Filter size={24} /></div>
            <h3>No entries found</h3>
            <p>Try adjusting your filters or add a new food entry.</p>
            <button className="btn btn-primary" onClick={openAdd} id="btn-add-first-entry">
              <Plus size={16} /> Add Entry
            </button>
          </div>
        ) : (
          <div className="table-wrapper" style={{ border: 'none' }}>
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Food</th>
                  <th>Qty</th>
                  <th>Calories</th>
                  <th>Protein</th>
                  <th>Carbs</th>
                  <th>Fat</th>
                  <th style={{ width: 80 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)' }}>
                      {fmtDate(entry.date, { month: 'short', day: 'numeric' })}
                    </td>
                    <td>
                      <span className={`meal-badge ${entry.mealType}`}>{MEAL_LABELS[entry.mealType]}</span>
                    </td>
                    <td style={{ maxWidth: 200 }}>
                      <div className="truncate" style={{ fontWeight: 500 }}>{entry.foodName}</div>
                      {entry.notes && (
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }} className="truncate">{entry.notes}</div>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{entry.quantity}{entry.unit}</td>
                    <td style={{ fontWeight: 700, color: 'var(--color-accent)' }}>{fmtCal(entry.calories)}</td>
                    <td>{fmt(entry.protein)}g</td>
                    <td>{fmt(entry.carbs)}g</td>
                    <td>{fmt(entry.fat)}g</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ width: 28, height: 28 }}
                          onClick={() => openEdit(entry)}
                          id={`btn-edit-${entry.id}`}
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          style={{ width: 28, height: 28, color: 'var(--color-danger)' }}
                          onClick={() => handleDelete(entry.id)}
                          id={`btn-delete-${entry.id}`}
                          title="Delete"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!loading && pagination && (
        <Pagination
          pagination={pagination}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
        />
      )}

      <FoodEntryModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditEntry(null); }}
        onSaved={fetchEntries}
        entry={editEntry}
      />
    </div>
  );
}
