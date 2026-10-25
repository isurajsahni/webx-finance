import { useEffect, useRef, useState } from 'react';
import { useDebounced } from '@/hooks/useDebounced';

const A4_WIDTH_PX = 793.7; // 210mm at 96dpi

/**
 * Shows a rendered document HTML string as a scaled A4 sheet. The HTML comes
 * from the same shared template the server turns into the PDF.
 */
export function DocumentPreview({ html, debounce = 150, className = '' }) {
  const wrap = useRef(null);
  const frame = useRef(null);
  const [scale, setScale] = useState(0.6);
  const [height, setHeight] = useState(1123);
  const debounced = useDebounced(html, debounce);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1.2, entry.contentRect.width / A4_WIDTH_PX)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const measure = () => {
    const doc = frame.current?.contentDocument;
    if (doc?.body) setHeight(Math.max(1123, doc.documentElement.scrollHeight));
  };

  useEffect(() => {
    const doc = frame.current?.contentDocument;
    if (!doc) return;
    // Write instead of srcdoc so updates do not flash a blank page.
    doc.open();
    doc.write(debounced || '');
    doc.close();
    measure();
    doc.fonts?.ready.then(measure);
    const imgs = [...doc.images];
    imgs.forEach((img) => img.complete || img.addEventListener('load', measure, { once: true }));
  }, [debounced]);

  return (
    <div ref={wrap} className={`w-full min-w-0 overflow-hidden ${className}`}>
      <div className="overflow-hidden rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08),0_12px_40px_-12px_rgba(60,40,120,0.25)] ring-1 ring-line/60" style={{ height: height * scale }}>
        <iframe
          ref={frame}
          title="Document preview"
          sandbox="allow-same-origin"
          style={{ width: A4_WIDTH_PX, height, transform: `scale(${scale})`, transformOrigin: '0 0', border: 0, display: 'block' }}
        />
      </div>
    </div>
  );
}
