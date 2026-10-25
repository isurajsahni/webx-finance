import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

const variants = {
  primary: 'bg-brand-500 text-white hover:bg-brand-600 focus-visible:ring-brand-500/40 shadow-xs',
  dark: 'bg-ink text-white hover:bg-black/85 focus-visible:ring-ink/30 shadow-xs',
  secondary: 'border border-line bg-white text-body hover:bg-panel focus-visible:ring-brand-500/30 shadow-xs',
  ghost: 'text-body hover:bg-panel focus-visible:ring-brand-500/30',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500/40',
};

const sizes = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9.5 px-4 text-sm gap-2',
  icon: 'h-8 w-8 justify-center',
};

/** Pass `as={Link}` (with `to`) or `as="a"` (with `href`) to render a link styled as a button. */
export function Button({ as, variant = 'primary', size = 'md', loading = false, className, children, disabled, type = 'button', ...props }) {
  const Comp = as || 'button';
  const buttonProps = as ? {} : { type, disabled: disabled || loading };
  return (
    <Comp
      {...buttonProps}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-semibold whitespace-nowrap transition-colors',
        'focus-visible:ring-3 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Comp>
  );
}
