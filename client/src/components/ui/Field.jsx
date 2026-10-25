import { useId, cloneElement, isValidElement } from 'react';
import { cn } from '@/lib/cn';

/** Label + control + hint/error. Wires id and aria attributes onto the child. */
export function Field({ label, error, hint, required, className, children, render }) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const a11y = { id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy };
  // `render` lets a wrapped control (e.g. input + icon button) receive the a11y props itself.
  const control = render ? render(a11y) : isValidElement(children) ? cloneElement(children, a11y) : children;
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <label htmlFor={id} className="block text-[13px] font-semibold text-body">
          {label}
          {required && <span className="ml-0.5 text-brand-500">*</span>}
        </label>
      )}
      {control}
      {error ? (
        <p id={`${id}-err`} className="text-xs font-medium text-red-600">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }) {
  return <input className={cn('input', className)} {...props} />;
}

export function Textarea({ className, rows = 3, ...props }) {
  return <textarea rows={rows} className={cn('input resize-y', className)} {...props} />;
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn('input pr-8', className)} {...props}>
      {children}
    </select>
  );
}

/** Text input with a currency symbol prefix. Value stays a string in major units. */
export function MoneyInput({ symbol = '₹', className, ...props }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted">{symbol}</span>
      <input inputMode="decimal" className={cn('input pl-7 tabular-nums', className)} {...props} />
    </div>
  );
}
