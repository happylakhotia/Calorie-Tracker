import { fmtCal } from '../utils/helpers';

export default function CalorieRing({ consumed, goal, size = 160 }) {
  const STROKE = 12;
  const RADIUS = (size - STROKE) / 2;
  const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
  const percentage = goal > 0 ? Math.min((consumed / goal) * 100, 100) : 0;
  const offset = CIRCUMFERENCE - (percentage / 100) * CIRCUMFERENCE;
  const isOver = goal > 0 && consumed > goal;
  const ringColor = isOver ? 'var(--color-danger)' : 'var(--color-primary)';

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="calorie-ring-svg"
        style={{ transform: 'rotate(-90deg)' }}
      >
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={RADIUS}
          fill="none" stroke="var(--color-border)" strokeWidth={STROKE}
        />
        {/* Progress */}
        <circle
          cx={size / 2} cy={size / 2} r={RADIUS}
          fill="none" stroke={ringColor} strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease, stroke 0.3s ease' }}
        />
      </svg>

      {/* Center text */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: size < 150 ? 22 : 28, fontWeight: 800, color: isOver ? 'var(--color-danger)' : 'var(--text-primary)', lineHeight: 1.1 }}>
          {fmtCal(consumed)}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>kcal</div>
        {goal > 0 && (
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>of {fmtCal(goal)}</div>
        )}
      </div>
    </div>
  );
}
