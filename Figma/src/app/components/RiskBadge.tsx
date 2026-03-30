import { RiskLevel } from '../services/mockData';

interface RiskBadgeProps {
  level: RiskLevel;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function RiskBadge({ level, label, size = 'md' }: RiskBadgeProps) {
  const colors = {
    safe: 'bg-green-500 text-white',
    warning: 'bg-amber-500 text-gray-900',
    danger: 'bg-red-500 text-white',
  };

  const sizes = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base',
  };

  const labels = {
    safe: 'Sécurisé',
    warning: 'Vigilance',
    danger: 'Danger',
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full font-medium uppercase tracking-wide ${colors[level]} ${sizes[size]}`}
    >
      {label || labels[level]}
    </span>
  );
}
