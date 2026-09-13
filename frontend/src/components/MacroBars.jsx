import { fmt } from '../utils/helpers';

const MACROS = [
  { key: 'protein', label: 'Protein', color: 'var(--color-protein)', goalKey: 'proteinG' },
  { key: 'carbs', label: 'Carbs', color: 'var(--color-carbs)', goalKey: 'carbsG' },
  { key: 'fat', label: 'Fat', color: 'var(--color-fat)', goalKey: 'fatG' },
];

export default function MacroBars({ totals, goal }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', width: '100%' }}>
      {MACROS.map(({ key, label, color, goalKey }) => {
        const actual = totals?.[key] || 0;
        const target = goal?.[goalKey] || 0;
        const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
        const isOver = target > 0 && actual > target;

        return (
          <div key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--space-1)' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                {label}
              </span>
              <span style={{ fontSize: 'var(--font-size-xs)', fontWeight: 600, color: isOver ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                {fmt(actual)}g{target > 0 ? ` / ${fmt(target)}g` : ''}
              </span>
            </div>
            <div className="macro-bar-wrapper">
              <div
                className="macro-bar-fill"
                style={{
                  width: `${pct}%`,
                  background: isOver ? 'var(--gradient-danger)' : color,
                  transition: 'width 0.8s ease',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
