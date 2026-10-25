import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

/** Footer for forms rendered inside a Modal: sticks to the bottom while the body scrolls. */
export function ModalFooter({ children }) {
  return (
    <div className="sticky -bottom-5 z-10 -mx-6 -mb-5 mt-6 flex justify-end gap-2 border-t border-line/70 bg-[#faf9fd] px-6 py-3">{children}</div>
  );
}

/** Accessible modal built on <dialog>. */
export function Modal({ open, onClose, title, description, size = 'md', children, footer }) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={cn(
        'm-auto w-[calc(100%-2rem)] rounded-2xl border border-line bg-white p-0 text-body shadow-2xl backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]',
        size === 'sm' && 'max-w-md',
        size === 'md' && 'max-w-xl',
        size === 'lg' && 'max-w-3xl',
      )}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line/70 px-6 py-4">
            <div>
              <h2 className="text-base font-bold text-ink">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
            </div>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-muted hover:bg-panel hover:text-body" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line/70 bg-panel/50 px-6 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}
