import { cn } from '@/lib/cn';

const tones = {
  neutral: 'bg-panel text-muted ring-line',
  brand: 'bg-lavender text-brand-700 ring-brand-200',
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  amber: 'bg-amber-50 text-amber-700 ring-amber-200',
  red: 'bg-red-50 text-red-700 ring-red-200',
  dark: 'bg-ink text-white ring-ink',
};

export function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ring-inset', tones[tone], className)}>
      {children}
    </span>
  );
}
