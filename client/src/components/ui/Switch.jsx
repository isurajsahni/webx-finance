import { cn } from '@/lib/cn';

export function Switch({ checked, onChange, label, description, disabled }) {
  return (
    <label className={cn('flex items-start gap-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 inline-flex h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:ring-3 focus-visible:ring-brand-500/30 focus-visible:outline-none',
          checked ? 'bg-brand-500' : 'bg-line',
        )}
      >
        <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform', checked && 'translate-x-4')} />
      </button>
      {(label || description) && (
        <span>
          {label && <span className="block text-sm font-semibold text-body">{label}</span>}
          {description && <span className="block text-xs text-muted">{description}</span>}
        </span>
      )}
    </label>
  );
}
